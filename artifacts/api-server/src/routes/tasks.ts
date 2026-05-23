import { Router, type IRouter } from "express";
import { eq, and, type SQL } from "drizzle-orm";
import { db, tasksTable, usersTable, projectsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  ListTasksQueryParams,
  CreateTaskBody,
  GetTaskParams,
  UpdateTaskParams,
  UpdateTaskBody,
  DeleteTaskParams,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

async function formatTask(task: typeof tasksTable.$inferSelect) {
  let assigneeName: string | null = null;
  let assigneeAvatar: string | null = null;
  if (task.assigneeId) {
    const [a] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName, avatarUrl: usersTable.avatarUrl })
      .from(usersTable).where(eq(usersTable.id, task.assigneeId)).limit(1);
    if (a) {
      assigneeName = `${a.firstName} ${a.lastName}`;
      assigneeAvatar = a.avatarUrl;
    }
  }

  let projectName: string | null = null;
  if (task.projectId) {
    const [p] = await db.select({ name: projectsTable.name }).from(projectsTable).where(eq(projectsTable.id, task.projectId)).limit(1);
    projectName = p?.name ?? null;
  }

  return {
    ...task,
    tags: task.tags ?? [],
    estimatedHours: task.estimatedHours ? parseFloat(task.estimatedHours) : null,
    loggedHours: task.loggedHours ? parseFloat(task.loggedHours) : null,
    assigneeName,
    assigneeAvatar,
    projectName,
  };
}

router.get("/tasks", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListTasksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { projectId, assigneeId, status, priority } = parsed.data;
  const conditions: SQL[] = [];
  if (projectId) conditions.push(eq(tasksTable.projectId, projectId));
  if (assigneeId) conditions.push(eq(tasksTable.assigneeId, assigneeId));
  if (status) conditions.push(eq(tasksTable.status, status));
  if (priority) conditions.push(eq(tasksTable.priority, priority));

  const tasks = await db.select().from(tasksTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(tasksTable.createdAt);

  const formatted = await Promise.all(tasks.map(formatTask));
  res.json(formatted);
});

router.post("/tasks", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as any).currentUser;
  const [task] = await db.insert(tasksTable).values({
    ...parsed.data,
    estimatedHours: parsed.data.estimatedHours != null ? String(parsed.data.estimatedHours) : null,
  }).returning();
  await logActivity(user.id, "task_created", `Created task "${task.title}"`, task.id, "task");
  res.status(201).json(await formatTask(task));
});

router.get("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, params.data.id)).limit(1);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(await formatTask(task));
});

router.patch("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as any).currentUser;
  const updateData: any = { ...parsed.data };
  if (parsed.data.estimatedHours != null) updateData.estimatedHours = String(parsed.data.estimatedHours);
  if (parsed.data.loggedHours != null) updateData.loggedHours = String(parsed.data.loggedHours);

  const [updated] = await db.update(tasksTable).set(updateData).where(eq(tasksTable.id, params.data.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (updated.status === "done") {
    await logActivity(user.id, "task_completed", `Completed task "${updated.title}"`, updated.id, "task");
  }
  res.json(await formatTask(updated));
});

router.delete("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(tasksTable).where(eq(tasksTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
