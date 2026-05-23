import { Router, type IRouter } from "express";
import { eq, gte, lt, desc, asc, inArray, or, sql } from "drizzle-orm";
import { db, meetingsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  ListMeetingsQueryParams,
  CreateMeetingBody,
  DeleteMeetingParams,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity";
import { notifyAllUsers, notifyUsers } from "../lib/notifications";
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
  const user = (req as any).currentUser;
  const isAdmin = ["super_admin", "admin"].includes(user.role);
  const scope = parsed.data.scope ?? "upcoming";
  const now = new Date();

  // Visibility: admins see all. Others see meetings where they are host,
  // included in participantIds, or it's an "all-hands" group meeting
  // (kind='group' and participantIds is empty).
  const visibility = isAdmin
    ? undefined
    : or(
        eq(meetingsTable.hostId, user.id),
        sql`${user.id} = ANY(${meetingsTable.participantIds})`,
        sql`(${meetingsTable.kind} = 'group' AND cardinality(${meetingsTable.participantIds}) = 0)`,
      );

  const timeFilter =
    scope === "upcoming" ? gte(meetingsTable.scheduledAt, now)
    : scope === "past" ? lt(meetingsTable.scheduledAt, now)
    : undefined;

  const where = timeFilter && visibility ? sql`${timeFilter} AND ${visibility}`
    : (timeFilter ?? visibility);

  const rows = await db.select().from(meetingsTable)
    .where(where)
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
  const kind = parsed.data.kind === "one_on_one" ? "one_on_one" : "group";
  const notifyEveryone = (parsed.data as any).notifyEveryone === true;
  const rawParticipants = Array.isArray(parsed.data.participantIds) ? parsed.data.participantIds : [];
  const participantIds = Array.from(new Set(
    rawParticipants.filter((id: any) => Number.isInteger(id) && id > 0 && id !== user.id),
  ));

  if (kind === "one_on_one") {
    if (participantIds.length !== 1) {
      res.status(400).json({ error: "1-on-1 meetings require exactly one other participant." });
      return;
    }
    if (notifyEveryone) {
      res.status(400).json({ error: "1-on-1 meetings cannot notify everyone." });
      return;
    }
  } else {
    if (!notifyEveryone && participantIds.length === 0) {
      res.status(400).json({ error: "Select participants or enable 'invite everyone'." });
      return;
    }
    if (participantIds.length > 200) {
      res.status(400).json({ error: "Too many participants (max 200)." });
      return;
    }
  }

  if (participantIds.length > 0) {
    const found = await db.select({ id: usersTable.id }).from(usersTable)
      .where(inArray(usersTable.id, participantIds));
    if (found.length !== participantIds.length) {
      res.status(400).json({ error: "One or more participants do not exist." });
      return;
    }
  }

  const [m] = await db.insert(meetingsTable).values({
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    scheduledAt: new Date(parsed.data.scheduledAt as any),
    durationMinutes: parsed.data.durationMinutes ?? 30,
    hostId: user.id,
    roomId,
    status: "scheduled",
    kind,
    participantIds: notifyEveryone ? [] : participantIds,
  }).returning();
  await logActivity(user.id, "meeting_created", `Scheduled meeting "${m.title}"`, m.id, "meeting");
  const when = new Date(m.scheduledAt).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  const hostName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "A teammate";
  const label = kind === "one_on_one" ? "1-on-1 meeting" : "New meeting";
  const notif = {
    type: "meeting_scheduled",
    title: `${label}: ${m.title}`,
    body: `${hostName} scheduled "${m.title}" for ${when}`,
    link: "/meetings",
  };
  if (notifyEveryone) {
    await notifyAllUsers({ ...notif, excludeUserId: user.id });
  } else {
    await notifyUsers(participantIds, notif);
  }
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
