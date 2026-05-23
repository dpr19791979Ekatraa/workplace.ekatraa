import { Router, type IRouter } from "express";
import { eq, ilike, and, type SQL, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  departmentsTable,
  activityLogTable,
  announcementsTable,
  attendanceTable,
  leavesTable,
  projectsTable,
  tasksTable,
  documentsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { clerkClient } from "@clerk/express";
import {
  ListUsersQueryParams,
  CreateUserBody,
  GetUserParams,
  UpdateUserBody,
  UpdateCurrentUserBody,
  DeleteUserParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Workaround: generated Zod uses `coerce.date().nullish()` for date fields,
// which turns explicit `null` into 1970-01-01. Re-derive date strings from the
// raw body so users can actually clear birthday / workAnniversary.
function normalizeDateFields(parsed: any, raw: any): any {
  const out: any = { ...parsed };
  for (const key of ["birthday", "workAnniversary"] as const) {
    if (raw && key in raw) {
      const v = raw[key];
      out[key] = v && typeof v === "string" && v.length > 0 ? v : null;
    }
  }
  return out;
}

async function formatUser(user: typeof usersTable.$inferSelect) {
  let departmentName: string | null = null;
  if (user.departmentId) {
    const dept = await db.select({ name: departmentsTable.name })
      .from(departmentsTable)
      .where(eq(departmentsTable.id, user.departmentId))
      .limit(1);
    departmentName = dept[0]?.name ?? null;
  }
  return { ...user, departmentName };
}

router.get("/users", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListUsersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { department, role, search, page = 1, limit = 20 } = parsed.data;

  const conditions: SQL[] = [];
  if (role) conditions.push(eq(usersTable.role, role));
  if (search) {
    conditions.push(
      sql`(${usersTable.firstName} ilike ${"%" + search + "%"} OR ${usersTable.lastName} ilike ${"%" + search + "%"} OR ${usersTable.email} ilike ${"%" + search + "%"})`
    );
  }

  const users = await db.select().from(usersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(limit)
    .offset((page - 1) * limit)
    .orderBy(usersTable.createdAt);

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const formatted = await Promise.all(users.map(formatUser));
  res.json({ users: formatted, total: count, page, limit });
});

const OWNER_EMAIL = (process.env.OWNER_EMAIL ?? "durgaprasad.rath@ekatraa.in").toLowerCase();

router.post("/users", requireAuth, requireRole(["super_admin", "admin", "hr_manager"]), async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { password, ...rest } = parsed.data as any;
  const userData = normalizeDateFields(rest, req.body);
  if (userData.role === "super_admin" && (userData.email ?? "").toLowerCase() !== OWNER_EMAIL) {
    res.status(403).json({ error: "Only the owner account can be super admin." });
    return;
  }
  let clerkId = `local_${Date.now()}`;
  if (password) {
    try {
      const clerkUser = await clerkClient.users.createUser({
        emailAddress: [userData.email],
        password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        skipPasswordChecks: false,
      });
      clerkId = clerkUser.id;
    } catch (err: any) {
      req.log.error({ err }, "Failed to create Clerk user");
      const msg = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? err?.message ?? "Failed to create login account";
      res.status(400).json({ error: msg });
      return;
    }
  }
  try {
    const [user] = await db.insert(usersTable).values({ ...userData, clerkId }).returning();
    res.status(201).json(await formatUser(user));
  } catch (err: any) {
    if (clerkId && !clerkId.startsWith("local_")) {
      await clerkClient.users.deleteUser(clerkId).catch(() => {});
    }
    if (err?.code === "23505") {
      res.status(409).json({ error: "An employee with this email already exists." });
      return;
    }
    throw err;
  }
});

router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).currentUser;
  res.json(await formatUser(user));
});

router.patch("/users/me", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateCurrentUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as any).currentUser;
  const data = normalizeDateFields(parsed.data, req.body);
  const [updated] = await db.update(usersTable).set(data).where(eq(usersTable.id, user.id)).returning();
  res.json(await formatUser(updated));
});

router.get("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(await formatUser(user));
});

router.patch("/users/:id", requireAuth, requireRole(["super_admin", "admin", "hr_manager"]), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const newRole = (parsed.data as any).role;
  const isOwnerRow = target.email.toLowerCase() === OWNER_EMAIL;
  if (newRole === "super_admin" && !isOwnerRow) {
    res.status(403).json({ error: "Only the owner account can be super admin." });
    return;
  }
  if (target.role === "super_admin" && isOwnerRow && newRole && newRole !== "super_admin") {
    res.status(403).json({ error: "Owner account role cannot be changed." });
    return;
  }
  const data = normalizeDateFields(parsed.data, req.body);
  const [updated] = await db.update(usersTable).set(data).where(eq(usersTable.id, id)).returning();
  res.json(await formatUser(updated));
});

router.delete("/users/:id", requireAuth, requireRole(["super_admin", "admin"]), async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (target.role === "super_admin") {
      res.status(403).json({ error: "Super admin accounts cannot be deleted." });
      return;
    }
    const uid = params.data.id;
    await db.transaction(async (tx) => {
      await tx.delete(activityLogTable).where(eq(activityLogTable.actorId, uid));
      await tx.delete(announcementsTable).where(eq(announcementsTable.authorId, uid));
      await tx.delete(attendanceTable).where(eq(attendanceTable.userId, uid));
      await tx.delete(leavesTable).where(eq(leavesTable.userId, uid));
      await tx.update(leavesTable).set({ reviewedById: null }).where(eq(leavesTable.reviewedById, uid));
      await tx.update(projectsTable).set({ ownerId: null }).where(eq(projectsTable.ownerId, uid));
      await tx.update(tasksTable).set({ assigneeId: null }).where(eq(tasksTable.assigneeId, uid));
      await tx.update(documentsTable).set({ uploadedById: null }).where(eq(documentsTable.uploadedById, uid));
      await tx.delete(usersTable).where(eq(usersTable.id, uid));
    });
    if (target.clerkId && !target.clerkId.startsWith("demo_user_") && !target.clerkId.startsWith("local_")) {
      await clerkClient.users.deleteUser(target.clerkId).catch((err) => {
        req.log.warn({ err, clerkId: target.clerkId }, "DB user deleted but Clerk user removal failed");
      });
    }
    res.sendStatus(204);
  } catch (err: any) {
    if (err?.code === "23503") {
      res.status(409).json({ error: "Cannot delete: this employee has linked projects, tasks, or other records. Reassign them first." });
    } else {
      throw err;
    }
  }
});

export default router;
