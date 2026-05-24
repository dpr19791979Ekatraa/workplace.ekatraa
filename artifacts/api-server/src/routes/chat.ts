import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, sql, gt } from "drizzle-orm";
import {
  db,
  conversationsTable,
  conversationMembersTable,
  messagesTable,
  usersTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  OpenDirectConversationBody,
  CreateGroupConversationBody,
  SendMessageBody,
} from "@workspace/api-zod";
import { notifyUsers } from "../lib/notifications";

const router: IRouter = Router();

interface MemberInfo {
  id: number;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  jobTitle: string | null;
}

async function getMembers(conversationIds: number[]): Promise<Map<number, MemberInfo[]>> {
  const map = new Map<number, MemberInfo[]>();
  if (conversationIds.length === 0) return map;
  const rows = await db
    .select({
      conversationId: conversationMembersTable.conversationId,
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      avatarUrl: usersTable.avatarUrl,
      jobTitle: usersTable.jobTitle,
    })
    .from(conversationMembersTable)
    .innerJoin(usersTable, eq(usersTable.id, conversationMembersTable.userId))
    .where(inArray(conversationMembersTable.conversationId, conversationIds));
  for (const r of rows) {
    const arr = map.get(r.conversationId) ?? [];
    arr.push({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      avatarUrl: r.avatarUrl ?? null,
      jobTitle: r.jobTitle ?? null,
    });
    map.set(r.conversationId, arr);
  }
  return map;
}

async function getMembership(userId: number, conversationId: number) {
  const [row] = await db
    .select()
    .from(conversationMembersTable)
    .where(
      and(
        eq(conversationMembersTable.conversationId, conversationId),
        eq(conversationMembersTable.userId, userId),
      ),
    )
    .limit(1);
  return row;
}

async function buildConversation(
  conversationId: number,
  viewerId: number,
): Promise<unknown> {
  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, conversationId))
    .limit(1);
  if (!conv) return null;
  const membersMap = await getMembers([conv.id]);
  const members = membersMap.get(conv.id) ?? [];
  const [last] = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conv.id))
    .orderBy(desc(messagesTable.createdAt))
    .limit(1);
  const me = await getMembership(viewerId, conv.id);
  let unread = 0;
  if (me) {
    const lastRead = me.lastReadAt;
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.conversationId, conv.id),
          sql`${messagesTable.senderId} <> ${viewerId}`,
          lastRead ? gt(messagesTable.createdAt, lastRead) : sql`true`,
        ),
      );
    unread = Number(count) || 0;
  }
  return {
    id: conv.id,
    kind: conv.kind,
    name: conv.name,
    members,
    lastMessage: last ?? null,
    unreadCount: unread,
    createdAt: conv.createdAt,
  };
}

router.get("/conversations", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).currentUser;
  const memberships = await db
    .select({ conversationId: conversationMembersTable.conversationId })
    .from(conversationMembersTable)
    .where(eq(conversationMembersTable.userId, user.id));
  const ids = memberships.map((m) => m.conversationId);
  if (ids.length === 0) {
    res.json([]);
    return;
  }
  const convs = await db
    .select()
    .from(conversationsTable)
    .where(inArray(conversationsTable.id, ids))
    .orderBy(desc(conversationsTable.updatedAt));
  const result = await Promise.all(convs.map((c) => buildConversation(c.id, user.id)));
  res.json(result.filter(Boolean));
});

router.post("/conversations/direct", requireAuth, async (req, res): Promise<void> => {
  const parsed = OpenDirectConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as any).currentUser;
  const otherId = parsed.data.userId;
  if (otherId === user.id) {
    res.status(400).json({ error: "Cannot chat with yourself" });
    return;
  }
  const [other] = await db.select().from(usersTable).where(eq(usersTable.id, otherId)).limit(1);
  if (!other) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Find existing direct conversation containing exactly these two users
  const existing = await db.execute(sql`
    SELECT c.id FROM conversations c
    JOIN conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = ${user.id}
    JOIN conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = ${otherId}
    WHERE c.kind = 'direct'
    LIMIT 1
  `);
  const rows = (existing as any).rows ?? existing;
  if (Array.isArray(rows) && rows.length > 0) {
    const id = Number(rows[0].id);
    const built = await buildConversation(id, user.id);
    res.json(built);
    return;
  }

  const [conv] = await db
    .insert(conversationsTable)
    .values({ kind: "direct", name: null, createdById: user.id })
    .returning();
  await db.insert(conversationMembersTable).values([
    { conversationId: conv.id, userId: user.id },
    { conversationId: conv.id, userId: otherId },
  ]);
  const built = await buildConversation(conv.id, user.id);
  res.json(built);
});

router.post("/conversations/group", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateGroupConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as any).currentUser;
  const memberSet = new Set<number>(parsed.data.memberIds);
  memberSet.add(user.id);
  const memberIds = Array.from(memberSet);

  const valid = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(inArray(usersTable.id, memberIds));
  if (valid.length !== memberIds.length) {
    res.status(400).json({ error: "Invalid member" });
    return;
  }

  const [conv] = await db
    .insert(conversationsTable)
    .values({ kind: "group", name: parsed.data.name, createdById: user.id })
    .returning();
  await db.insert(conversationMembersTable).values(
    memberIds.map((id) => ({ conversationId: conv.id, userId: id })),
  );
  const built = await buildConversation(conv.id, user.id);
  res.status(201).json(built);
});

router.get("/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).currentUser;
  const convId = Number(req.params.id);
  if (!Number.isFinite(convId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const me = await getMembership(user.id, convId);
  if (!me) {
    res.status(403).json({ error: "Not a member" });
    return;
  }
  const rows = await db
    .select({
      id: messagesTable.id,
      conversationId: messagesTable.conversationId,
      senderId: messagesTable.senderId,
      body: messagesTable.body,
      createdAt: messagesTable.createdAt,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
    })
    .from(messagesTable)
    .innerJoin(usersTable, eq(usersTable.id, messagesTable.senderId))
    .where(eq(messagesTable.conversationId, convId))
    .orderBy(desc(messagesTable.createdAt))
    .limit(200);
  const out = rows
    .map((r) => ({
      id: r.id,
      conversationId: r.conversationId,
      senderId: r.senderId,
      senderName: `${r.firstName} ${r.lastName}`,
      body: r.body,
      createdAt: r.createdAt,
    }))
    .reverse();
  res.json(out);
});

router.post("/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as any).currentUser;
  const convId = Number(req.params.id);
  if (!Number.isFinite(convId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const me = await getMembership(user.id, convId);
  if (!me) {
    res.status(403).json({ error: "Not a member" });
    return;
  }
  const [msg] = await db
    .insert(messagesTable)
    .values({ conversationId: convId, senderId: user.id, body: parsed.data.body })
    .returning();
  await db
    .update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, convId));
  // mark sender as read
  await db
    .update(conversationMembersTable)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(conversationMembersTable.conversationId, convId),
        eq(conversationMembersTable.userId, user.id),
      ),
    );

  // notify other members
  const others = await db
    .select({ userId: conversationMembersTable.userId })
    .from(conversationMembersTable)
    .where(
      and(
        eq(conversationMembersTable.conversationId, convId),
        sql`${conversationMembersTable.userId} <> ${user.id}`,
      ),
    );
  const otherIds = others.map((o) => o.userId);
  if (otherIds.length > 0) {
    const [conv] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, convId))
      .limit(1);
    const senderName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Someone";
    const title =
      conv?.kind === "group" && conv.name
        ? `${senderName} in ${conv.name}`
        : `New message from ${senderName}`;
    void notifyUsers(otherIds, {
      type: "chat_message",
      title,
      body: parsed.data.body.slice(0, 200),
      link: `/chat?c=${convId}`,
    });
  }

  res.status(201).json({
    id: msg.id,
    conversationId: msg.conversationId,
    senderId: msg.senderId,
    senderName: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || null,
    body: msg.body,
    createdAt: msg.createdAt,
  });
});

router.post("/conversations/:id/read", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).currentUser;
  const convId = Number(req.params.id);
  if (!Number.isFinite(convId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const me = await getMembership(user.id, convId);
  if (!me) {
    res.status(403).json({ error: "Not a member" });
    return;
  }
  await db
    .update(conversationMembersTable)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(conversationMembersTable.conversationId, convId),
        eq(conversationMembersTable.userId, user.id),
      ),
    );
  res.status(204).end();
});

export default router;
