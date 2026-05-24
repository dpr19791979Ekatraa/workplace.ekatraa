import { db, notificationsTable, usersTable } from "@workspace/db";
import { ne, and, eq, inArray } from "drizzle-orm";
import { logger } from "./logger";
import { sendUserWhatsApp } from "./whatsapp";

export interface NotifyAllOptions {
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  excludeUserId?: number;
}

function formatWhatsApp(opts: { title: string; body?: string | null }): string {
  const parts = [`🔔 ${opts.title}`];
  if (opts.body) parts.push(opts.body);
  return parts.join("\n");
}

async function fanOutWhatsApp(ids: number[], opts: { title: string; body?: string | null }) {
  if (ids.length === 0 || !process.env.INTERAKT_API_KEY) return;
  try {
    const users = await db
      .select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email, phone: usersTable.phone })
      .from(usersTable)
      .where(inArray(usersTable.id, ids));
    const msg = formatWhatsApp(opts);
    await Promise.all(users.filter((u) => u.phone).map((u) => sendUserWhatsApp(u, msg).catch(() => undefined)));
  } catch (err) {
    logger.warn({ err }, "fanOutWhatsApp failed");
  }
}

export async function notifyUsers(userIds: number[], opts: Omit<NotifyAllOptions, "excludeUserId">): Promise<void> {
  const ids = Array.from(new Set(userIds.filter((id) => Number.isFinite(id))));
  if (ids.length === 0) return;
  try {
    await db.insert(notificationsTable).values(
      ids.map((id) => ({
        userId: id,
        type: opts.type,
        title: opts.title,
        body: opts.body ?? null,
        link: opts.link ?? null,
      })),
    );
  } catch (err) {
    logger.error({ err, type: opts.type, title: opts.title }, "notifyUsers failed");
  }
  void fanOutWhatsApp(ids, opts);
}

export async function notifyAllUsers(opts: NotifyAllOptions): Promise<void> {
  try {
    const users = await db.select({ id: usersTable.id }).from(usersTable).where(
      opts.excludeUserId != null
        ? and(eq(usersTable.status, "active"), ne(usersTable.id, opts.excludeUserId))
        : eq(usersTable.status, "active"),
    );
    if (users.length === 0) return;
    const ids = users.map((u) => u.id);
    await db.insert(notificationsTable).values(
      ids.map((id) => ({
        userId: id,
        type: opts.type,
        title: opts.title,
        body: opts.body ?? null,
        link: opts.link ?? null,
      })),
    );
    void fanOutWhatsApp(ids, opts);
  } catch (err) {
    logger.error({ err, type: opts.type, title: opts.title }, "notifyAllUsers failed");
  }
}
