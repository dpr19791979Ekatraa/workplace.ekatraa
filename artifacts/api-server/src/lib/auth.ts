import { getAuth, clerkClient } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

async function fetchClerkProfile(clerkId: string): Promise<{ email: string; firstName: string; lastName: string; avatarUrl: string | null }> {
  try {
    const cu = await clerkClient.users.getUser(clerkId);
    const primaryEmailId = (cu as any).primaryEmailAddressId;
    const primary = cu.emailAddresses?.find(e => e.id === primaryEmailId) ?? cu.emailAddresses?.[0];
    return {
      email: primary?.emailAddress ?? `${clerkId}@unknown.com`,
      firstName: cu.firstName ?? "User",
      lastName: cu.lastName ?? "",
      avatarUrl: (cu as any).imageUrl ?? null,
    };
  } catch {
    return { email: `${clerkId}@unknown.com`, firstName: "User", lastName: "", avatarUrl: null };
  }
}

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
    const profile = await fetchClerkProfile(clerkId);
    [user] = await db.insert(usersTable).values({
      clerkId,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatarUrl: profile.avatarUrl ?? undefined,
      role: "employee",
      status: "active",
    }).returning();
    req.log.info({ clerkId, email: profile.email }, "New user registered via Clerk login");
  } else if (user.email.endsWith("@unknown.com")) {
    const profile = await fetchClerkProfile(clerkId);
    if (!profile.email.endsWith("@unknown.com")) {
      [user] = await db.update(usersTable).set({
        email: profile.email,
        firstName: user.firstName === "User" ? profile.firstName : user.firstName,
        lastName: user.lastName === "" ? profile.lastName : user.lastName,
        avatarUrl: user.avatarUrl ?? profile.avatarUrl ?? undefined,
      }).where(eq(usersTable.id, user.id)).returning();
    }
  }

  const ownerEmail = (process.env.OWNER_EMAIL ?? "durgaprasad.rath@ekatraa.in").toLowerCase();
  if (user.email.toLowerCase() === ownerEmail && user.role !== "super_admin") {
    [user] = await db.update(usersTable).set({ role: "super_admin" }).where(eq(usersTable.id, user.id)).returning();
    req.log.info({ userId: user.id }, "Auto-promoted owner to super_admin");
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
