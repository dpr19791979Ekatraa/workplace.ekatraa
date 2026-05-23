import { Router, type IRouter } from "express";
import { eq, and, type SQL, sql, desc } from "drizzle-orm";
import { db, attendanceTable, leavesTable, usersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import {
  ListAttendanceQueryParams,
  GetAttendanceSummaryQueryParams,
  ListLeavesQueryParams,
  CreateLeaveBody,
  UpdateLeaveStatusParams,
  UpdateLeaveStatusBody,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

async function formatAttendance(a: typeof attendanceTable.$inferSelect) {
  const [u] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
    .from(usersTable).where(eq(usersTable.id, a.userId)).limit(1);
  const hoursWorked = a.hoursWorked ? parseFloat(a.hoursWorked) : null;
  return {
    ...a,
    userName: u ? `${u.firstName} ${u.lastName}` : "Unknown",
    hoursWorked,
  };
}

async function formatLeave(l: typeof leavesTable.$inferSelect) {
  const [u] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName, avatarUrl: usersTable.avatarUrl })
    .from(usersTable).where(eq(usersTable.id, l.userId)).limit(1);

  let reviewerName: string | null = null;
  if (l.reviewedById) {
    const [r] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable).where(eq(usersTable.id, l.reviewedById)).limit(1);
    if (r) reviewerName = `${r.firstName} ${r.lastName}`;
  }

  return {
    ...l,
    userName: u ? `${u.firstName} ${u.lastName}` : "Unknown",
    userAvatar: u?.avatarUrl ?? null,
    reviewerName,
  };
}

// Attendance routes
router.get("/attendance", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListAttendanceQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { userId, from, to } = parsed.data;
  const conditions: SQL[] = [];
  if (userId) conditions.push(eq(attendanceTable.userId, userId));
  if (from) conditions.push(sql`${attendanceTable.date} >= ${from}`);
  if (to) conditions.push(sql`${attendanceTable.date} <= ${to}`);

  const records = await db.select().from(attendanceTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(attendanceTable.clockIn));

  const formatted = await Promise.all(records.map(formatAttendance));
  res.json(formatted);
});

router.post("/attendance/clock-in", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).currentUser;
  const today = new Date().toISOString().split("T")[0];
  const [existing] = await db.select().from(attendanceTable)
    .where(and(eq(attendanceTable.userId, user.id), eq(attendanceTable.date, today)))
    .limit(1);

  if (existing) {
    res.status(400).json({ error: "Already clocked in today" });
    return;
  }

  const [record] = await db.insert(attendanceTable).values({
    userId: user.id,
    date: today,
    clockIn: new Date(),
    status: "present",
  }).returning();

  res.status(201).json(await formatAttendance(record));
});

router.post("/attendance/clock-out", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).currentUser;
  const today = new Date().toISOString().split("T")[0];
  const [record] = await db.select().from(attendanceTable)
    .where(and(eq(attendanceTable.userId, user.id), eq(attendanceTable.date, today)))
    .limit(1);

  if (!record) {
    res.status(400).json({ error: "Not clocked in today" });
    return;
  }

  const clockOut = new Date();
  const hoursWorked = ((clockOut.getTime() - record.clockIn.getTime()) / (1000 * 60 * 60)).toFixed(2);

  const [updated] = await db.update(attendanceTable).set({ clockOut, hoursWorked }).where(eq(attendanceTable.id, record.id)).returning();
  res.json(await formatAttendance(updated));
});

router.get("/attendance/summary", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetAttendanceSummaryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { month = new Date().getMonth() + 1, year = new Date().getFullYear() } = parsed.data;
  const monthStr = String(month).padStart(2, "0");
  const prefix = `${year}-${monthStr}`;

  const records = await db.select().from(attendanceTable)
    .where(sql`${attendanceTable.date} like ${prefix + "%"}`);

  const presentDays = records.filter(r => r.status === "present" || r.status === "remote").length;
  const absentDays = records.filter(r => r.status === "absent").length;
  const lateDays = records.filter(r => r.status === "late").length;
  const totalHours = records.reduce((sum, r) => sum + (r.hoursWorked ? parseFloat(r.hoursWorked) : 0), 0);
  const avgHoursPerDay = presentDays > 0 ? totalHours / presentDays : 0;

  res.json({
    totalDays: presentDays + absentDays + lateDays,
    presentDays,
    absentDays,
    lateDays,
    avgHoursPerDay: Math.round(avgHoursPerDay * 100) / 100,
    byUser: [],
  });
});

// Leave routes
router.get("/leaves", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListLeavesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { userId, status } = parsed.data;
  const currentUser = (req as any).currentUser;
  const isHR = ["super_admin", "admin", "hr_manager"].includes(currentUser.role);
  const conditions: SQL[] = [];
  if (!isHR) {
    conditions.push(eq(leavesTable.userId, currentUser.id));
  } else if (userId) {
    conditions.push(eq(leavesTable.userId, userId));
  }
  if (status) conditions.push(eq(leavesTable.status, status));

  const leaves = await db.select().from(leavesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(leavesTable.createdAt));

  const formatted = await Promise.all(leaves.map(formatLeave));
  res.json(formatted);
});

router.post("/leaves", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateLeaveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as any).currentUser;
  const start = new Date(parsed.data.startDate);
  const end = new Date(parsed.data.endDate);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const [leave] = await db.insert(leavesTable).values({
    ...parsed.data,
    userId: user.id,
    days,
    status: "pending",
  }).returning();

  await logActivity(user.id, "leave_requested", `Requested ${parsed.data.type} leave`, leave.id, "leave");
  res.status(201).json(await formatLeave(leave));
});

router.patch("/leaves/:id/status", requireAuth, requireRole(["super_admin", "admin", "hr_manager"]), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = UpdateLeaveStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as any).currentUser;
  const [updated] = await db.update(leavesTable).set({
    status: parsed.data.status,
    reviewedById: user.id,
  }).where(eq(leavesTable.id, id)).returning();

  if (!updated) {
    res.status(404).json({ error: "Leave not found" });
    return;
  }
  res.json(await formatLeave(updated));
});

export default router;
