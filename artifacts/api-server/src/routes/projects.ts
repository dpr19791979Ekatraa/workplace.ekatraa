import { Router, type IRouter } from "express";
import { eq, and, ilike, sql, type SQL } from "drizzle-orm";
import { db, projectsTable, tasksTable, usersTable, departmentsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  ListProjectsQueryParams,
  CreateProjectBody,
  GetProjectParams,
  UpdateProjectParams,
  UpdateProjectBody,
  DeleteProjectParams,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

async function formatProject(project: typeof projectsTable.$inferSelect) {
  const [{ taskCount }] = await db.select({ taskCount: sql<number>`count(*)::int` })
    .from(tasksTable).where(eq(tasksTable.projectId, project.id));
  const [{ completedTaskCount }] = await db.select({ completedTaskCount: sql<number>`count(*)::int` })
    .from(tasksTable).where(and(eq(tasksTable.projectId, project.id), eq(tasksTable.status, "done")));
  const [{ memberCount }] = await db.select({ memberCount: sql<number>`count(distinct ${tasksTable.assigneeId})::int` })
    .from(tasksTable).where(eq(tasksTable.projectId, project.id));

  let ownerName: string | null = null;
  if (project.ownerId) {
    const owner = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable).where(eq(usersTable.id, project.ownerId)).limit(1);
    if (owner[0]) ownerName = `${owner[0].firstName} ${owner[0].lastName}`;
  }

  let departmentName: string | null = null;
  if (project.departmentId) {
    const dept = await db.select({ name: departmentsTable.name })
      .from(departmentsTable).where(eq(departmentsTable.id, project.departmentId)).limit(1);
    departmentName = dept[0]?.name ?? null;
  }

  return { ...project, taskCount, completedTaskCount, memberCount, ownerName, departmentName };
}

router.get("/projects", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListProjectsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { status, search } = parsed.data;
  const conditions: SQL[] = [];
  if (status) conditions.push(eq(projectsTable.status, status));
  if (search) conditions.push(ilike(projectsTable.name, `%${search}%`));

  const projects = await db.select().from(projectsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(projectsTable.createdAt);

  const formatted = await Promise.all(projects.map(formatProject));
  res.json(formatted);
});

router.post("/projects", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as any).currentUser;
  const [project] = await db.insert(projectsTable).values({
    ...parsed.data,
    ownerId: user.id,
  }).returning();
  await logActivity(user.id, "project_created", `Created project "${project.name}"`, project.id, "project");
  res.status(201).json(await formatProject(project));
});

router.get("/projects/summary", requireAuth, async (_req, res): Promise<void> => {
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(projectsTable);
  const [{ active }] = await db.select({ active: sql<number>`count(*)::int` }).from(projectsTable).where(eq(projectsTable.status, "active"));
  const [{ completed }] = await db.select({ completed: sql<number>`count(*)::int` }).from(projectsTable).where(eq(projectsTable.status, "completed"));

  const now = new Date().toISOString().split("T")[0];
  const [{ overdue }] = await db.select({ overdue: sql<number>`count(*)::int` }).from(projectsTable)
    .where(and(sql`${projectsTable.dueDate} < ${now}`, sql`${projectsTable.status} not in ('completed','cancelled')`));

  const byStatusRaw = await db.select({ status: projectsTable.status, count: sql<number>`count(*)::int` })
    .from(projectsTable).groupBy(projectsTable.status);
  const byPriorityRaw = await db.select({ priority: projectsTable.priority, count: sql<number>`count(*)::int` })
    .from(projectsTable).groupBy(projectsTable.priority);

  res.json({
    total,
    active,
    completed,
    overdue,
    byStatus: byStatusRaw.map(r => ({ label: r.status, count: r.count })),
    byPriority: byPriorityRaw.map(r => ({ label: r.priority, count: r.count })),
  });
});

router.get("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, params.data.id)).limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(await formatProject(project));
});

router.patch("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db.update(projectsTable).set(parsed.data).where(eq(projectsTable.id, params.data.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(await formatProject(updated));
});

router.delete("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(projectsTable).where(eq(projectsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
