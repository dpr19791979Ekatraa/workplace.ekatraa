import { Router, type IRouter } from "express";
import { eq, gte, lt, desc, asc } from "drizzle-orm";
import { db, meetingsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  ListMeetingsQueryParams,
  CreateMeetingBody,
  DeleteMeetingParams,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity";
import { notifyAllUsers } from "../lib/notifications";
import { randomBytes } from "crypto";

const router: IRouter = Router();

const JITSI_BASE = "https://meet.jit.si";

async function formatMeeting(m: typeof meetingsTable.$inferSelect) {
  const [host] = await db.select({
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    avatarUrl: usersTable.avatarUrl,
  }).from(usersTable).where(eq(usersTable.id, m.hostId)).limit(1);
  return {
    ...m,
    hostName: host ? `${host.firstName} ${host.lastName}` : null,
    hostAvatar: host?.avatarUrl ?? null,
    joinUrl: `${JITSI_BASE}/${m.roomId}`,
  };
}

router.get("/meetings", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListMeetingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const scope = parsed.data.scope ?? "upcoming";
  const now = new Date();
  const rows = await db.select().from(meetingsTable)
    .where(
      scope === "upcoming" ? gte(meetingsTable.scheduledAt, now)
      : scope === "past" ? lt(meetingsTable.scheduledAt, now)
      : undefined
    )
    .orderBy(scope === "past" ? desc(meetingsTable.scheduledAt) : asc(meetingsTable.scheduledAt));
  const formatted = await Promise.all(rows.map(formatMeeting));
  res.json(formatted);
});

router.post("/meetings", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateMeetingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as any).currentUser;
  const slug = (parsed.data.title || "meet")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32) || "meet";
  const roomId = `ekatraa-${slug}-${randomBytes(4).toString("hex")}`;
  const [m] = await db.insert(meetingsTable).values({
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    scheduledAt: new Date(parsed.data.scheduledAt as any),
    durationMinutes: parsed.data.durationMinutes ?? 30,
    hostId: user.id,
    roomId,
    status: "scheduled",
  }).returning();
  await logActivity(user.id, "meeting_created", `Scheduled meeting "${m.title}"`, m.id, "meeting");
  const when = new Date(m.scheduledAt).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  const hostName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "A teammate";
  await notifyAllUsers({
    type: "meeting_scheduled",
    title: `New meeting: ${m.title}`,
    body: `${hostName} scheduled "${m.title}" for ${when}`,
    link: "/meetings",
    excludeUserId: user.id,
  });
  res.status(201).json(await formatMeeting(m));
});

router.delete("/meetings/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteMeetingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const user = (req as any).currentUser;
  const [target] = await db.select().from(meetingsTable).where(eq(meetingsTable.id, params.data.id)).limit(1);
  if (!target) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  const canDelete = target.hostId === user.id || ["super_admin", "admin"].includes(user.role);
  if (!canDelete) {
    res.status(403).json({ error: "Only the host or an admin can cancel this meeting." });
    return;
  }
  await db.delete(meetingsTable).where(eq(meetingsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
