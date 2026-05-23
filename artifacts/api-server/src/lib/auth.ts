import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).clerkId = clerkId;

  let user = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1).then(r => r[0]);
  if (!user) {
    const clerkUser = (auth as any).sessionClaims;
    const email = clerkUser?.email ?? `${clerkId}@unknown.com`;
    const firstName = clerkUser?.firstName ?? "User";
    const lastName = clerkUser?.lastName ?? "";
    [user] = await db.insert(usersTable).values({
      clerkId,
      email,
      firstName,
      lastName,
      role: "employee",
      status: "active",
    }).returning();
  }

  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

  (req as any).currentUser = user;
  next();
};

export const requireRole = (roles: string[]) => async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const user = (req as any).currentUser;
  if (!user || !roles.includes(user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
};
