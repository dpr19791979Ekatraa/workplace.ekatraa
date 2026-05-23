import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, announcementsTable, usersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import {
  ListAnnouncementsQueryParams,
  CreateAnnouncementBody,
  UpdateAnnouncementParams,
  UpdateAnnouncementBody,
  DeleteAnnouncementParams,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

async function formatAnnouncement(a: typeof announcementsTable.$inferSelect) {
  const [author] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName, avatarUrl: usersTable.avatarUrl })
    .from(usersTable).where(eq(usersTable.id, a.authorId)).limit(1);
  return {
    ...a,
    pinned: a.pinned === "true",
    authorName: author ? `${author.firstName} ${author.lastName}` : "Unknown",
    authorAvatar: author?.avatarUrl ?? null,
  };
}

router.get("/announcements", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListAnnouncementsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { page = 1, limit = 10 } = parsed.data;
  const announcements = await db.select().from(announcementsTable)
    .orderBy(desc(announcementsTable.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
  const formatted = await Promise.all(announcements.map(formatAnnouncement));
  res.json(formatted);
});

router.post("/announcements", requireAuth, requireRole(["super_admin", "admin", "hr_manager"]), async (req, res): Promise<void> => {
  const parsed = CreateAnnouncementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as any).currentUser;
  const [a] = await db.insert(announcementsTable).values({
    ...parsed.data,
    pinned: parsed.data.pinned ? "true" : "false",
    authorId: user.id,
  }).returning();
  await logActivity(user.id, "announcement_posted", `Posted announcement "${a.title}"`, a.id, "announcement");
  res.status(201).json(await formatAnnouncement(a));
});

router.patch("/announcements/:id", requireAuth, requireRole(["super_admin", "admin", "hr_manager"]), async (req, res): Promise<void> => {
  const params = UpdateAnnouncementParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateAnnouncementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: any = { ...parsed.data };
  if (parsed.data.pinned != null) updateData.pinned = parsed.data.pinned ? "true" : "false";
  const [updated] = await db.update(announcementsTable).set(updateData).where(eq(announcementsTable.id, params.data.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Announcement not found" });
    return;
  }
  res.json(await formatAnnouncement(updated));
});

router.delete("/announcements/:id", requireAuth, requireRole(["super_admin", "admin", "hr_manager"]), async (req, res): Promise<void> => {
  const params = DeleteAnnouncementParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(announcementsTable).where(eq(announcementsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
