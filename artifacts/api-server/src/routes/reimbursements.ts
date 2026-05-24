import { Router, type IRouter } from "express";
import { eq, and, type SQL, sql, desc } from "drizzle-orm";
import { db, reimbursementsTable, usersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import {
  ListReimbursementsQueryParams,
  CreateReimbursementBody,
  UpdateReimbursementStatusBody,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity";
import { notifyUsers } from "../lib/notifications";

const router: IRouter = Router();

const HR_ROLES = ["super_admin", "admin", "hr_manager", "finance_manager"];

async function formatReimbursement(r: typeof reimbursementsTable.$inferSelect) {
  const [u] = await db
    .select({ firstName: usersTable.firstName, lastName: usersTable.lastName, avatarUrl: usersTable.avatarUrl })
    .from(usersTable).where(eq(usersTable.id, r.userId)).limit(1);

  let reviewerName: string | null = null;
  if (r.reviewedById) {
    const [rev] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable).where(eq(usersTable.id, r.reviewedById)).limit(1);
    if (rev) reviewerName = `${rev.firstName} ${rev.lastName}`;
  }

  return {
    ...r,
    amount: parseFloat(r.amount),
    userName: u ? `${u.firstName} ${u.lastName}` : "Unknown",
    userAvatar: u?.avatarUrl ?? null,
    reviewerName,
  };
}

router.get("/reimbursements", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListReimbursementsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { userId, status } = parsed.data;
  const currentUser = (req as any).currentUser;
  const isReviewer = HR_ROLES.includes(currentUser.role);

  const conditions: SQL[] = [];
  if (!isReviewer) {
    conditions.push(eq(reimbursementsTable.userId, currentUser.id));
  } else if (userId) {
    conditions.push(eq(reimbursementsTable.userId, userId));
  }
  if (status) conditions.push(eq(reimbursementsTable.status, status));

  const rows = await db.select().from(reimbursementsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(reimbursementsTable.createdAt));

  const formatted = await Promise.all(rows.map(formatReimbursement));
  res.json(formatted);
});

router.get("/reimbursements/summary", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const rows = await db.select().from(reimbursementsTable)
    .where(eq(reimbursementsTable.userId, currentUser.id));

  let pendingCount = 0, pendingAmount = 0, approvedAmount = 0, paidAmount = 0;
  let currency = "INR";
  for (const r of rows) {
    const amt = parseFloat(r.amount);
    currency = r.currency || currency;
    if (r.status === "pending") { pendingCount++; pendingAmount += amt; }
    else if (r.status === "approved") approvedAmount += amt;
    else if (r.status === "paid") paidAmount += amt;
  }
  res.json({
    pendingCount,
    pendingAmount: Math.round(pendingAmount * 100) / 100,
    approvedAmount: Math.round(approvedAmount * 100) / 100,
    paidAmount: Math.round(paidAmount * 100) / 100,
    currency,
  });
});

router.post("/reimbursements", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateReimbursementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as any).currentUser;
  const { category, amount, currency, expenseDate, description, receiptUrl } = parsed.data;

  const [row] = await db.insert(reimbursementsTable).values({
    userId: user.id,
    category,
    amount: String(amount),
    currency: currency ?? "INR",
    expenseDate,
    description: description ?? null,
    receiptUrl: receiptUrl ?? null,
    status: "pending",
  }).returning();

  await logActivity(user.id, "reimbursement_requested" as any, `Submitted ${category} reimbursement (${row.currency} ${amount})`, row.id, "reimbursement");

  // Notify reviewers
  const reviewers = await db.select({ id: usersTable.id }).from(usersTable)
    .where(sql`${usersTable.role} = ANY(${HR_ROLES})`);
  const reviewerIds = reviewers.map(r => r.id).filter(id => id !== user.id);
  if (reviewerIds.length > 0) {
    await notifyUsers(reviewerIds, {
      type: "reimbursement_submitted",
      title: "New reimbursement request",
      body: `${user.firstName} ${user.lastName} submitted ${row.currency} ${amount} for ${category}`,
      link: "/reimbursements",
    });
  }

  res.status(201).json(await formatReimbursement(row));
});

router.patch("/reimbursements/:id/status", requireAuth, requireRole(HR_ROLES), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = UpdateReimbursementStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as any).currentUser;
  const [updated] = await db.update(reimbursementsTable).set({
    status: parsed.data.status,
    reviewedById: user.id,
    reviewedAt: new Date(),
    reviewNotes: parsed.data.reviewNotes ?? null,
  }).where(eq(reimbursementsTable.id, id)).returning();

  if (!updated) {
    res.status(404).json({ error: "Reimbursement not found" });
    return;
  }

  const verb = updated.status === "approved" ? "approved"
    : updated.status === "rejected" ? "rejected"
    : updated.status === "paid" ? "marked paid"
    : "cancelled";

  await notifyUsers([updated.userId], {
    type: `reimbursement_${updated.status}`,
    title: `Reimbursement ${verb}`,
    body: `Your ${updated.category} reimbursement (${updated.currency} ${updated.amount}) was ${verb}`,
    link: "/reimbursements",
  });

  res.json(await formatReimbursement(updated));
});

export default router;
