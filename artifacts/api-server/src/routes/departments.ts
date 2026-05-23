import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, departmentsTable, usersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import {
  CreateDepartmentBody,
  UpdateDepartmentParams,
  UpdateDepartmentBody,
  DeleteDepartmentParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function formatDept(dept: typeof departmentsTable.$inferSelect) {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(eq(usersTable.departmentId, dept.id));

  let managerName: string | null = null;
  if (dept.managerId) {
    const mgr = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable)
      .where(eq(usersTable.id, dept.managerId))
      .limit(1);
    if (mgr[0]) managerName = `${mgr[0].firstName} ${mgr[0].lastName}`;
  }
  return { ...dept, memberCount: count, managerName };
}

router.get("/departments", requireAuth, async (_req, res): Promise<void> => {
  const depts = await db.select().from(departmentsTable).orderBy(departmentsTable.name);
  const formatted = await Promise.all(depts.map(formatDept));
  res.json(formatted);
});

router.post("/departments", requireAuth, requireRole(["super_admin", "admin"]), async (req, res): Promise<void> => {
  const parsed = CreateDepartmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [dept] = await db.insert(departmentsTable).values(parsed.data).returning();
  res.status(201).json(await formatDept(dept));
});

router.patch("/departments/:id", requireAuth, requireRole(["super_admin", "admin"]), async (req, res): Promise<void> => {
  const params = UpdateDepartmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateDepartmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db.update(departmentsTable).set(parsed.data).where(eq(departmentsTable.id, params.data.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Department not found" });
    return;
  }
  res.json(await formatDept(updated));
});

router.delete("/departments/:id", requireAuth, requireRole(["super_admin", "admin"]), async (req, res): Promise<void> => {
  const params = DeleteDepartmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.update(usersTable)
    .set({ departmentId: null })
    .where(eq(usersTable.departmentId, params.data.id));
  await db.delete(departmentsTable).where(eq(departmentsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
