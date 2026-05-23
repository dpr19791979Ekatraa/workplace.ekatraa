import { Router, type IRouter } from "express";
import { and, eq, desc, count } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  ListNotificationsQueryParams,
  MarkNotificationReadParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListNotificationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as any).currentUser;
  const limit = parsed.data.limit ?? 30;
  const onlyUnread = req.query.unreadOnly === "true" || req.query.unreadOnly === true;

  const where = onlyUnread
    ? and(eq(notificationsTable.userId, user.id), eq(notificationsTable.read, false))
    : eq(notificationsTable.userId, user.id);

  const items = await db.select().from(notificationsTable)
    .where(where)
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit);

  const [{ value: unreadCount = 0 } = { value: 0 }] = await db
    .select({ value: count() })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, user.id), eq(notificationsTable.read, false)));

  res.json({ items, unreadCount: Number(unreadCount) });
});

router.post("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).currentUser;
  await db.update(notificationsTable).set({ read: true })
    .where(and(eq(notificationsTable.userId, user.id), eq(notificationsTable.read, false)));
  res.sendStatus(204);
});

router.post("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const params = MarkNotificationReadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const user = (req as any).currentUser;
  await db.update(notificationsTable).set({ read: true })
    .where(and(eq(notificationsTable.id, params.data.id), eq(notificationsTable.userId, user.id)));
  res.sendStatus(204);
});

export default router;
