import { db, notificationsTable, usersTable } from "@workspace/db";
import { ne, and, eq } from "drizzle-orm";
import { logger } from "./logger";

export interface NotifyAllOptions {
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  excludeUserId?: number;
}

export async function notifyAllUsers(opts: NotifyAllOptions): Promise<void> {
  try {
    const users = await db.select({ id: usersTable.id }).from(usersTable).where(
      opts.excludeUserId != null
        ? and(eq(usersTable.status, "active"), ne(usersTable.id, opts.excludeUserId))
        : eq(usersTable.status, "active"),
    );
    if (users.length === 0) return;
    await db.insert(notificationsTable).values(
      users.map((u) => ({
        userId: u.id,
        type: opts.type,
        title: opts.title,
        body: opts.body ?? null,
        link: opts.link ?? null,
      })),
    );
  } catch (err) {
    logger.error({ err, type: opts.type, title: opts.title }, "notifyAllUsers failed");
  }
}
