import { db, activityLogTable } from "@workspace/db";

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
}
