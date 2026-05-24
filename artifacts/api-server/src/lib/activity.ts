import { db, activityLogTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendOwnerWhatsApp } from "./whatsapp";
import { logger } from "./logger";

export async function logActivity(
  actorId: number,
  type: string,
  description: string,
  entityId?: number,
  entityType?: string,
) {
  try {
    await db.insert(activityLogTable).values({ actorId, type, description, entityId, entityType });
  } catch {
    // non-critical — swallow errors
  }
  // Fire-and-forget WhatsApp alert to owner for every activity.
  void notifyOwnerWhatsApp(actorId, type, description).catch((err) => {
    logger.warn({ err }, "notifyOwnerWhatsApp failed");
  });
}

async function notifyOwnerWhatsApp(actorId: number, type: string, description: string) {
  let actorName = "Someone";
  try {
    const [u] = await db
      .select({ firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, actorId))
      .limit(1);
    if (u) {
      const full = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
      actorName = full || u.email || actorName;
    }
  } catch {}
  const when = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const msg = `🔔 ekatraa\n${actorName} • ${type}\n${description}\n${when}`;
  await sendOwnerWhatsApp(msg);
}
