import { Router, type IRouter } from "express";
import { eq, desc, sql, and } from "drizzle-orm";
import {
  db, usersTable, projectsTable, tasksTable, documentsTable,
  attendanceTable, leavesTable, activityLogTable, departmentsTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { GetActivityFeedQueryParams, GetProductivityAnalyticsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/analytics/dashboard", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const isHR = ["super_admin", "admin", "hr_manager"].includes(currentUser.role);
  const isManager = ["super_admin", "admin", "hr_manager", "manager", "team_leader"].includes(currentUser.role);

  const [{ totalEmployees }] = await db.select({ totalEmployees: sql<number>`count(*)::int` }).from(usersTable).where(eq(usersTable.status, "active"));
  const [{ activeProjects }] = await db.select({ activeProjects: sql<number>`count(*)::int` }).from(projectsTable).where(eq(projectsTable.status, "active"));
  const [{ pendingTasks }] = await db.select({ pendingTasks: sql<number>`count(*)::int` })
    .from(tasksTable)
    .where(isManager
      ? sql`${tasksTable.status} not in ('done')`
      : and(sql`${tasksTable.status} not in ('done')`, eq(tasksTable.assigneeId, currentUser.id))!);
  const [{ documentsUploaded }] = await db.select({ documentsUploaded: sql<number>`count(*)::int` }).from(documentsTable);
  const [{ pendingLeaves }] = await db.select({ pendingLeaves: sql<number>`count(*)::int` })
    .from(leavesTable)
    .where(isHR
      ? eq(leavesTable.status, "pending")
      : and(eq(leavesTable.status, "pending"), eq(leavesTable.userId, currentUser.id))!);

  const today = new Date().toISOString().split("T")[0];
  const [{ presentToday }] = await db.select({ presentToday: sql<number>`count(*)::int` }).from(attendanceTable).where(eq(attendanceTable.date, today));

  const tasksByStatusRaw = await db.select({ status: tasksTable.status, count: sql<number>`count(*)::int` })
    .from(tasksTable)
    .where(isManager ? undefined : eq(tasksTable.assigneeId, currentUser.id))
    .groupBy(tasksTable.status);
  const projectsByStatusRaw = await db.select({ status: projectsTable.status, count: sql<number>`count(*)::int` })
    .from(projectsTable)
    .where(isManager ? undefined : eq(projectsTable.ownerId, currentUser.id))
    .groupBy(projectsTable.status);

  const recentHiresRaw = await db.select().from(usersTable)
    .orderBy(desc(usersTable.createdAt)).limit(4);

  const recentHires = await Promise.all(recentHiresRaw.map(async u => {
    let departmentName: string | null = null;
    if (u.departmentId) {
      const [dept] = await db.select({ name: departmentsTable.name })
        .from(departmentsTable).where(eq(departmentsTable.id, u.departmentId)).limit(1);
      departmentName = dept?.name ?? null;
    }
    return { ...u, departmentName };
  }));

  const now = new Date().toISOString().split("T")[0];
  const upcomingDeadlinesRaw = await db.select().from(tasksTable)
    .where(and(
      sql`${tasksTable.dueDate} >= ${now}`,
      sql`${tasksTable.status} not in ('done')`,
    ))
    .orderBy(tasksTable.dueDate)
    .limit(5);

  const upcomingDeadlines = await Promise.all(upcomingDeadlinesRaw.map(async t => {
    let assigneeName: string | null = null;
    let assigneeAvatar: string | null = null;
    if (t.assigneeId) {
      const [u] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName, avatarUrl: usersTable.avatarUrl })
        .from(usersTable).where(eq(usersTable.id, t.assigneeId)).limit(1);
      if (u) {
        assigneeName = `${u.firstName} ${u.lastName}`.trim();
        assigneeAvatar = u.avatarUrl;
      }
    }
    let projectName: string | null = null;
    if (t.projectId) {
      const [p] = await db.select({ name: projectsTable.name })
        .from(projectsTable).where(eq(projectsTable.id, t.projectId)).limit(1);
      projectName = p?.name ?? null;
    }
    return {
      ...t,
      tags: t.tags ?? [],
      estimatedHours: t.estimatedHours ? parseFloat(t.estimatedHours) : null,
      loggedHours: t.loggedHours ? parseFloat(t.loggedHours) : null,
      assigneeName,
      assigneeAvatar,
      projectName,
    };
  }));

  res.json({
    totalEmployees,
    activeProjects,
    pendingTasks,
    presentToday,
    documentsUploaded,
    pendingLeaves,
    tasksByStatus: tasksByStatusRaw.map(r => ({ label: r.status, count: r.count })),
    projectsByStatus: projectsByStatusRaw.map(r => ({ label: r.status, count: r.count })),
    recentHires,
    upcomingDeadlines,
  });
});

router.get("/analytics/activity", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetActivityFeedQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { limit = 20 } = parsed.data;
  const logs = await db.select().from(activityLogTable)
    .where(sql`${activityLogTable.type} NOT ILIKE 'chat_%' AND ${activityLogTable.type} NOT ILIKE 'message_%'`)
    .orderBy(desc(activityLogTable.createdAt))
    .limit(limit);

  const formatted = await Promise.all(logs.map(async log => {
    let actorName = "System";
    let actorAvatar: string | null = null;
    if (log.actorId) {
      const [u] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName, avatarUrl: usersTable.avatarUrl })
        .from(usersTable).where(eq(usersTable.id, log.actorId)).limit(1);
      if (u) {
        actorName = `${u.firstName} ${u.lastName}`;
        actorAvatar = u.avatarUrl;
      }
    }
    return {
      id: log.id,
      type: log.type,
      description: log.description,
      actorName,
      actorAvatar,
      entityId: log.entityId,
      entityType: log.entityType,
      createdAt: log.createdAt,
    };
  }));

  res.json(formatted);
});

router.get("/analytics/team-performance", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  if (!["super_admin", "admin"].includes(currentUser.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  const rows = await db.select({
    userId: usersTable.id,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    avatarUrl: usersTable.avatarUrl,
    role: usersTable.role,
    jobTitle: usersTable.jobTitle,
    departmentId: usersTable.departmentId,
    status: usersTable.status,
  }).from(usersTable).where(eq(usersTable.status, "active")).orderBy(usersTable.firstName);

  const perf = await Promise.all(rows.map(async u => {
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` })
      .from(tasksTable).where(eq(tasksTable.assigneeId, u.userId));
    const [{ done }] = await db.select({ done: sql<number>`count(*)::int` })
      .from(tasksTable)
      .where(and(eq(tasksTable.assigneeId, u.userId), eq(tasksTable.status, "done"))!);
    const [{ inProgress }] = await db.select({ inProgress: sql<number>`count(*)::int` })
      .from(tasksTable)
      .where(and(eq(tasksTable.assigneeId, u.userId), eq(tasksTable.status, "in_progress"))!);
    const [{ todo }] = await db.select({ todo: sql<number>`count(*)::int` })
      .from(tasksTable)
      .where(and(eq(tasksTable.assigneeId, u.userId), eq(tasksTable.status, "todo"))!);
    const [{ overdue }] = await db.select({ overdue: sql<number>`count(*)::int` })
      .from(tasksTable)
      .where(and(
        eq(tasksTable.assigneeId, u.userId),
        sql`${tasksTable.status} != 'done'`,
        sql`${tasksTable.dueDate} is not null`,
        sql`${tasksTable.dueDate} < ${today}`,
      )!);
    const [{ projects }] = await db.select({ projects: sql<number>`count(*)::int` })
      .from(projectsTable).where(eq(projectsTable.ownerId, u.userId));

    let departmentName: string | null = null;
    if (u.departmentId) {
      const [d] = await db.select({ name: departmentsTable.name })
        .from(departmentsTable).where(eq(departmentsTable.id, u.departmentId)).limit(1);
      if (d) departmentName = d.name;
    }

    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

    return {
      userId: u.userId,
      name: `${u.firstName} ${u.lastName}`.trim(),
      avatarUrl: u.avatarUrl,
      role: u.role,
      jobTitle: u.jobTitle,
      departmentName,
      totalTasks: total,
      doneTasks: done,
      inProgressTasks: inProgress,
      todoTasks: todo,
      overdueTasks: overdue,
      ownedProjects: projects,
      completionRate,
    };
  }));

  perf.sort((a, b) => b.completionRate - a.completionRate || b.doneTasks - a.doneTasks);
  res.json(perf);
});

router.get("/analytics/productivity", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetProductivityAnalyticsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { period = "month" } = parsed.data;
  const currentUser = (req as any).currentUser;
  const isManager = ["super_admin", "admin", "hr_manager", "manager", "team_leader"].includes(currentUser.role);

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` })
    .from(tasksTable)
    .where(isManager ? undefined : eq(tasksTable.assigneeId, currentUser.id));
  const [{ done }] = await db.select({ done: sql<number>`count(*)::int` })
    .from(tasksTable)
    .where(isManager
      ? eq(tasksTable.status, "done")
      : and(eq(tasksTable.status, "done"), eq(tasksTable.assigneeId, currentUser.id))!);
  const taskCompletionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  const days = period === "week" ? 7 : period === "month" ? 30 : 90;
  const avgTasksPerDay = Math.round((done / days) * 10) / 10;

  const topPerformersRaw = isManager
    ? await db.select({
        assigneeId: tasksTable.assigneeId,
        completedTasks: sql<number>`count(*)::int`,
      })
        .from(tasksTable)
        .where(eq(tasksTable.status, "done"))
        .groupBy(tasksTable.assigneeId)
        .orderBy(desc(sql`count(*)`))
        .limit(5)
    : await db.select({
        assigneeId: tasksTable.assigneeId,
        completedTasks: sql<number>`count(*)::int`,
      })
        .from(tasksTable)
        .where(and(eq(tasksTable.status, "done"), eq(tasksTable.assigneeId, currentUser.id))!)
        .groupBy(tasksTable.assigneeId);

  const topPerformers = await Promise.all(topPerformersRaw.map(async p => {
    if (!p.assigneeId) return null;
    const [u] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName, avatarUrl: usersTable.avatarUrl })
      .from(usersTable).where(eq(usersTable.id, p.assigneeId)).limit(1);
    if (!u) return null;
    return {
      userId: p.assigneeId,
      userName: `${u.firstName} ${u.lastName}`,
      avatarUrl: u.avatarUrl,
      completedTasks: p.completedTasks,
      avgHoursPerTask: 0,
    };
  }));

  const weeklyTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      label: d.toLocaleDateString("en", { weekday: "short" }),
      value: Math.floor(Math.random() * 10),
    };
  });

  res.json({
    period,
    taskCompletionRate,
    avgTasksPerDay,
    topPerformers: topPerformers.filter(Boolean),
    weeklyTrend,
  });
});

export default router;
