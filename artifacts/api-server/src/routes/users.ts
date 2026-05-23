import { Router, type IRouter } from "express";
import { eq, ilike, and, type SQL, sql } from "drizzle-orm";
import { db, usersTable, departmentsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import {
  ListUsersQueryParams,
  CreateUserBody,
  GetUserParams,
  UpdateUserBody,
  UpdateCurrentUserBody,
  DeleteUserParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

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

router.post("/users", requireAuth, requireRole(["super_admin", "admin", "hr_manager"]), async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.insert(usersTable).values({
    ...parsed.data,
    clerkId: `local_${Date.now()}`,
  }).returning();
  res.status(201).json(await formatUser(user));
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
  const [updated] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.id, user.id)).returning();
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
  const [updated] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.id, id)).returning();
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(await formatUser(updated));
});

router.delete("/users/:id", requireAuth, requireRole(["super_admin", "admin"]), async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    await db.delete(usersTable).where(eq(usersTable.id, params.data.id));
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
