import { Router, type IRouter } from "express";
import { eq, and, type SQL, sql, desc, inArray } from "drizzle-orm";
import {
  db, usersTable,
  goalsTable, kpisTable, perfReviewsTable, appraisalsTable, promotionsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import {
  ListGoalsQueryParams, CreateGoalBody, UpdateGoalBody, UpdateGoalParams, DeleteGoalParams,
  ListKpisQueryParams, CreateKpiBody, UpdateKpiBody, UpdateKpiParams, DeleteKpiParams,
  ListPerfReviewsQueryParams, CreatePerfReviewBody,
  ListAppraisalsQueryParams, CreateAppraisalBody, UpdateAppraisalStatusBody, UpdateAppraisalStatusParams,
  ListPromotionsQueryParams, CreatePromotionBody, UpdatePromotionStatusBody, UpdatePromotionStatusParams,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity";
import { notifyUsers } from "../lib/notifications";

const router: IRouter = Router();

const HR_ROLES = ["super_admin", "admin", "hr_manager"];

router.use("/performance", requireAuth, requireRole(HR_ROLES));

async function userMap(ids: number[]): Promise<Map<number, { name: string; avatar: string | null }>> {
  const unique = Array.from(new Set(ids.filter((id) => Number.isFinite(id))));
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, avatarUrl: usersTable.avatarUrl })
    .from(usersTable).where(inArray(usersTable.id, unique));
  return new Map(rows.map((u) => [u.id, { name: `${u.firstName} ${u.lastName}`, avatar: u.avatarUrl ?? null }]));
}

function goalProgress(g: typeof goalsTable.$inferSelect): number {
  if (g.status === "completed") return 100;
  const target = g.targetValue ? parseFloat(g.targetValue) : 0;
  const current = g.currentValue ? parseFloat(g.currentValue) : 0;
  if (target > 0) return Math.min(100, Math.round((current / target) * 100));
  if (g.status === "in_progress") return 50;
  return 0;
}

async function formatGoal(g: typeof goalsTable.$inferSelect, map?: Map<number, { name: string; avatar: string | null }>) {
  const m = map ?? (await userMap([g.userId]));
  const u = m.get(g.userId);
  return {
    ...g,
    targetValue: g.targetValue ? parseFloat(g.targetValue) : null,
    currentValue: g.currentValue ? parseFloat(g.currentValue) : null,
    userName: u?.name ?? "Unknown",
    userAvatar: u?.avatar ?? null,
    progressPercent: goalProgress(g),
  };
}

async function formatKpi(k: typeof kpisTable.$inferSelect, map?: Map<number, { name: string; avatar: string | null }>) {
  const m = map ?? (await userMap([k.userId]));
  const u = m.get(k.userId);
  const target = parseFloat(k.target);
  const current = parseFloat(k.current);
  return {
    ...k,
    target,
    current,
    userName: u?.name ?? "Unknown",
    userAvatar: u?.avatar ?? null,
    attainmentPercent: target > 0 ? Math.round((current / target) * 100) : 0,
  };
}

async function formatReview(r: typeof perfReviewsTable.$inferSelect, map?: Map<number, { name: string; avatar: string | null }>) {
  const m = map ?? (await userMap([r.revieweeId, r.reviewerId]));
  const reviewee = m.get(r.revieweeId);
  const reviewer = m.get(r.reviewerId);
  return {
    ...r,
    overallRating: r.overallRating ? parseFloat(r.overallRating) : null,
    revieweeName: reviewee?.name ?? "Unknown",
    reviewerName: r.anonymous ? "Anonymous" : (reviewer?.name ?? "Unknown"),
  };
}

async function formatAppraisal(a: typeof appraisalsTable.$inferSelect, map?: Map<number, { name: string; avatar: string | null }>) {
  const m = map ?? (await userMap([a.userId]));
  const u = m.get(a.userId);
  return {
    ...a,
    finalRating: parseFloat(a.finalRating),
    salaryChangePercent: a.salaryChangePercent ? parseFloat(a.salaryChangePercent) : null,
    bonusAmount: a.bonusAmount ? parseFloat(a.bonusAmount) : null,
    userName: u?.name ?? "Unknown",
    userAvatar: u?.avatar ?? null,
  };
}

async function formatPromotion(p: typeof promotionsTable.$inferSelect, map?: Map<number, { name: string; avatar: string | null }>) {
  const m = map ?? (await userMap([p.userId, p.requestedById]));
  const u = m.get(p.userId);
  const req = m.get(p.requestedById);
  return {
    ...p,
    userName: u?.name ?? "Unknown",
    userAvatar: u?.avatar ?? null,
    requestedByName: req?.name ?? null,
  };
}

// ── Goals ─────────────────────────────────────────────────────────────
router.get("/performance/goals", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListGoalsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const me = (req as any).currentUser;
  const isReviewer = HR_ROLES.includes(me.role);
  const conds: SQL[] = [];
  if (!isReviewer) conds.push(eq(goalsTable.userId, me.id));
  else if (parsed.data.userId) conds.push(eq(goalsTable.userId, parsed.data.userId));
  if (parsed.data.status) conds.push(eq(goalsTable.status, parsed.data.status));
  const rows = await db.select().from(goalsTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(goalsTable.createdAt));
  const map = await userMap(rows.map((r) => r.userId));
  res.json(await Promise.all(rows.map((r) => formatGoal(r, map))));
});

router.post("/performance/goals", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateGoalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const me = (req as any).currentUser;
  const isReviewer = HR_ROLES.includes(me.role);
  const targetUserId = parsed.data.userId && isReviewer ? parsed.data.userId : me.id;
  const [row] = await db.insert(goalsTable).values({
    userId: targetUserId,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    category: parsed.data.category ?? "personal",
    weight: parsed.data.weight ?? 1,
    targetValue: parsed.data.targetValue != null ? String(parsed.data.targetValue) : null,
    currentValue: parsed.data.currentValue != null ? String(parsed.data.currentValue) : "0",
    unit: parsed.data.unit ?? null,
    dueDate: parsed.data.dueDate ?? null,
    createdById: me.id,
  } as any).returning();
  await logActivity(me.id, "goal_created" as any, `Goal "${row.title}" created`, row.id, "goal");
  if (targetUserId !== me.id) {
    await notifyUsers([targetUserId], {
      type: "goal_assigned",
      title: "New goal assigned",
      body: `${me.firstName} ${me.lastName} set a goal: "${row.title}"`,
      link: "/performance",
    });
  }
  res.status(201).json(await formatGoal(row));
});

router.patch("/performance/goals/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateGoalParams.safeParse(req.params);
  const body = UpdateGoalBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid request" }); return; }
  const me = (req as any).currentUser;
  const [existing] = await db.select().from(goalsTable).where(eq(goalsTable.id, params.data.id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Goal not found" }); return; }
  if (existing.userId !== me.id && existing.createdById !== me.id && !HR_ROLES.includes(me.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const patch: Record<string, unknown> = {};
  const d = body.data;
  if (d.title != null) patch.title = d.title;
  if (d.description !== undefined) patch.description = d.description;
  if (d.category != null) patch.category = d.category;
  if (d.weight != null) patch.weight = d.weight;
  if (d.targetValue !== undefined) patch.targetValue = d.targetValue != null ? String(d.targetValue) : null;
  if (d.currentValue !== undefined) patch.currentValue = d.currentValue != null ? String(d.currentValue) : null;
  if (d.unit !== undefined) patch.unit = d.unit;
  if (d.dueDate !== undefined) patch.dueDate = d.dueDate;
  if (d.status != null) patch.status = d.status;
  const [updated] = await db.update(goalsTable).set(patch).where(eq(goalsTable.id, params.data.id)).returning();
  res.json(await formatGoal(updated));
});

router.delete("/performance/goals/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteGoalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const me = (req as any).currentUser;
  const [existing] = await db.select().from(goalsTable).where(eq(goalsTable.id, params.data.id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.userId !== me.id && existing.createdById !== me.id && !HR_ROLES.includes(me.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.delete(goalsTable).where(eq(goalsTable.id, params.data.id));
  res.status(204).end();
});

// ── KPIs ──────────────────────────────────────────────────────────────
router.get("/performance/kpis", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListKpisQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const me = (req as any).currentUser;
  const isReviewer = HR_ROLES.includes(me.role);
  const conds: SQL[] = [];
  if (!isReviewer) conds.push(eq(kpisTable.userId, me.id));
  else if (parsed.data.userId) conds.push(eq(kpisTable.userId, parsed.data.userId));
  const rows = await db.select().from(kpisTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(kpisTable.createdAt));
  const map = await userMap(rows.map((r) => r.userId));
  res.json(await Promise.all(rows.map((r) => formatKpi(r, map))));
});

router.post("/performance/kpis", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateKpiBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const me = (req as any).currentUser;
  const isReviewer = HR_ROLES.includes(me.role);
  const targetUserId = parsed.data.userId && isReviewer ? parsed.data.userId : me.id;
  const [row] = await db.insert(kpisTable).values({
    userId: targetUserId,
    name: parsed.data.name,
    target: String(parsed.data.target),
    current: String(parsed.data.current ?? 0),
    unit: parsed.data.unit ?? null,
    period: parsed.data.period ?? "quarterly",
    periodStart: parsed.data.periodStart,
    periodEnd: parsed.data.periodEnd,
    createdById: me.id,
  } as any).returning();
  if (targetUserId !== me.id) {
    await notifyUsers([targetUserId], {
      type: "kpi_assigned",
      title: "New KPI assigned",
      body: `${row.name} (${row.period})`,
      link: "/performance",
    });
  }
  res.status(201).json(await formatKpi(row));
});

router.patch("/performance/kpis/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateKpiParams.safeParse(req.params);
  const body = UpdateKpiBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid request" }); return; }
  const me = (req as any).currentUser;
  const [existing] = await db.select().from(kpisTable).where(eq(kpisTable.id, params.data.id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.userId !== me.id && existing.createdById !== me.id && !HR_ROLES.includes(me.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const patch: Record<string, unknown> = {};
  const d = body.data;
  if (d.name != null) patch.name = d.name;
  if (d.target != null) patch.target = String(d.target);
  if (d.current != null) patch.current = String(d.current);
  if (d.unit !== undefined) patch.unit = d.unit;
  if (d.period != null) patch.period = d.period;
  if (d.periodStart != null) patch.periodStart = d.periodStart;
  if (d.periodEnd != null) patch.periodEnd = d.periodEnd;
  const [updated] = await db.update(kpisTable).set(patch).where(eq(kpisTable.id, params.data.id)).returning();
  res.json(await formatKpi(updated));
});

router.delete("/performance/kpis/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteKpiParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const me = (req as any).currentUser;
  const [existing] = await db.select().from(kpisTable).where(eq(kpisTable.id, params.data.id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.createdById !== me.id && !HR_ROLES.includes(me.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.delete(kpisTable).where(eq(kpisTable.id, params.data.id));
  res.status(204).end();
});

// ── Reviews (incl. 360 feedback) ──────────────────────────────────────
router.get("/performance/reviews", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListPerfReviewsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const me = (req as any).currentUser;
  const isReviewer = HR_ROLES.includes(me.role);
  const conds: SQL[] = [];
  if (isReviewer) {
    if (parsed.data.revieweeId) conds.push(eq(perfReviewsTable.revieweeId, parsed.data.revieweeId));
    if (parsed.data.reviewerId) conds.push(eq(perfReviewsTable.reviewerId, parsed.data.reviewerId));
  } else {
    // Non-HR: can only see reviews they wrote or received. Peer/upward anonymous: hide reviewer identity.
    conds.push(sql`(${perfReviewsTable.revieweeId} = ${me.id} OR ${perfReviewsTable.reviewerId} = ${me.id})`);
  }
  if (parsed.data.cycle) conds.push(eq(perfReviewsTable.cycle, parsed.data.cycle));
  if (parsed.data.type) conds.push(eq(perfReviewsTable.type, parsed.data.type));
  const rows = await db.select().from(perfReviewsTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(perfReviewsTable.createdAt));
  const ids: number[] = [];
  for (const r of rows) { ids.push(r.revieweeId, r.reviewerId); }
  const map = await userMap(ids);
  res.json(await Promise.all(rows.map((r) => formatReview(r, map))));
});

router.post("/performance/reviews", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreatePerfReviewBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const me = (req as any).currentUser;
  const submit = parsed.data.submit !== false;
  // Policy: self-review requires reviewing yourself; otherwise the reviewer can write any type
  // for any other user (peer/upward/manager). Self-reviews of others are blocked.
  if (parsed.data.type === "self" && parsed.data.revieweeId !== me.id) {
    res.status(403).json({ error: "Self-reviews must be for yourself" }); return;
  }
  if (parsed.data.type !== "self" && parsed.data.revieweeId === me.id) {
    res.status(403).json({ error: "Use type 'self' to review yourself" }); return;
  }
  const [row] = await db.insert(perfReviewsTable).values({
    revieweeId: parsed.data.revieweeId,
    reviewerId: me.id,
    cycle: parsed.data.cycle,
    type: parsed.data.type,
    anonymous: parsed.data.anonymous ?? false,
    ratings: (parsed.data.ratings ?? {}) as Record<string, number>,
    overallRating: parsed.data.overallRating != null ? String(parsed.data.overallRating) : null,
    strengths: parsed.data.strengths ?? null,
    improvements: parsed.data.improvements ?? null,
    comments: parsed.data.comments ?? null,
    status: submit ? "submitted" : "draft",
    submittedAt: submit ? new Date() : null,
  }).returning();
  if (submit && parsed.data.revieweeId !== me.id) {
    await notifyUsers([parsed.data.revieweeId], {
      type: "review_submitted",
      title: "New performance feedback",
      body: `You received ${parsed.data.type} feedback for ${parsed.data.cycle}`,
      link: "/performance",
    });
  }
  res.status(201).json(await formatReview(row));
});

// ── Appraisals ────────────────────────────────────────────────────────
router.get("/performance/appraisals", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListAppraisalsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const me = (req as any).currentUser;
  const isReviewer = HR_ROLES.includes(me.role);
  const conds: SQL[] = [];
  if (!isReviewer) conds.push(eq(appraisalsTable.userId, me.id));
  else if (parsed.data.userId) conds.push(eq(appraisalsTable.userId, parsed.data.userId));
  if (parsed.data.cycle) conds.push(eq(appraisalsTable.cycle, parsed.data.cycle));
  const rows = await db.select().from(appraisalsTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(appraisalsTable.createdAt));
  const map = await userMap(rows.map((r) => r.userId));
  res.json(await Promise.all(rows.map((r) => formatAppraisal(r, map))));
});

router.post("/performance/appraisals", requireAuth, requireRole(HR_ROLES), async (req, res): Promise<void> => {
  const parsed = CreateAppraisalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const me = (req as any).currentUser;
  const [row] = await db.insert(appraisalsTable).values({
    userId: parsed.data.userId,
    cycle: parsed.data.cycle,
    finalRating: String(parsed.data.finalRating),
    salaryChangePercent: parsed.data.salaryChangePercent != null ? String(parsed.data.salaryChangePercent) : "0",
    bonusAmount: parsed.data.bonusAmount != null ? String(parsed.data.bonusAmount) : "0",
    currency: parsed.data.currency ?? "INR",
    notes: parsed.data.notes ?? null,
    createdById: me.id,
  }).returning();
  await notifyUsers([parsed.data.userId], {
    type: "appraisal_proposed",
    title: "Appraisal pending review",
    body: `Your ${parsed.data.cycle} appraisal is awaiting decision`,
    link: "/performance",
  });
  res.status(201).json(await formatAppraisal(row));
});

router.patch("/performance/appraisals/:id/status", requireAuth, requireRole(HR_ROLES), async (req, res): Promise<void> => {
  const params = UpdateAppraisalStatusParams.safeParse(req.params);
  const body = UpdateAppraisalStatusBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid request" }); return; }
  const me = (req as any).currentUser;
  const [updated] = await db.update(appraisalsTable).set({
    status: body.data.status,
    decidedById: me.id,
    decidedAt: new Date(),
  }).where(eq(appraisalsTable.id, params.data.id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  await notifyUsers([updated.userId], {
    type: `appraisal_${updated.status}`,
    title: `Appraisal ${updated.status}`,
    body: `Your ${updated.cycle} appraisal was ${updated.status}`,
    link: "/performance",
  });
  res.json(await formatAppraisal(updated));
});

// ── Promotions ────────────────────────────────────────────────────────
router.get("/performance/promotions", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListPromotionsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const me = (req as any).currentUser;
  const isReviewer = HR_ROLES.includes(me.role);
  const conds: SQL[] = [];
  if (!isReviewer) conds.push(eq(promotionsTable.userId, me.id));
  else if (parsed.data.userId) conds.push(eq(promotionsTable.userId, parsed.data.userId));
  const rows = await db.select().from(promotionsTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(promotionsTable.createdAt));
  const ids: number[] = [];
  for (const r of rows) { ids.push(r.userId, r.requestedById); }
  const map = await userMap(ids);
  res.json(await Promise.all(rows.map((r) => formatPromotion(r, map))));
});

router.post("/performance/promotions", requireAuth, requireRole(HR_ROLES), async (req, res): Promise<void> => {
  const parsed = CreatePromotionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const me = (req as any).currentUser;
  const [row] = await db.insert(promotionsTable).values({
    userId: parsed.data.userId,
    fromTitle: parsed.data.fromTitle,
    toTitle: parsed.data.toTitle,
    fromLevel: parsed.data.fromLevel ?? null,
    toLevel: parsed.data.toLevel ?? null,
    effectiveDate: parsed.data.effectiveDate,
    reason: parsed.data.reason ?? null,
    requestedById: me.id,
  } as any).returning();
  await notifyUsers([parsed.data.userId], {
    type: "promotion_proposed",
    title: "Promotion proposed",
    body: `${row.fromTitle} → ${row.toTitle} (effective ${row.effectiveDate})`,
    link: "/performance",
  });
  res.status(201).json(await formatPromotion(row));
});

router.patch("/performance/promotions/:id/status", requireAuth, requireRole(HR_ROLES), async (req, res): Promise<void> => {
  const params = UpdatePromotionStatusParams.safeParse(req.params);
  const body = UpdatePromotionStatusBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid request" }); return; }
  const me = (req as any).currentUser;
  const [updated] = await db.update(promotionsTable).set({
    status: body.data.status,
    decidedById: me.id,
    decidedAt: new Date(),
  }).where(eq(promotionsTable.id, params.data.id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  // If effective, update user job title
  if (body.data.status === "effective") {
    await db.update(usersTable).set({ jobTitle: updated.toTitle }).where(eq(usersTable.id, updated.userId));
  }
  await notifyUsers([updated.userId], {
    type: `promotion_${updated.status}`,
    title: `Promotion ${updated.status}`,
    body: `${updated.fromTitle} → ${updated.toTitle}`,
    link: "/performance",
  });
  res.json(await formatPromotion(updated));
});

// ── Analytics ─────────────────────────────────────────────────────────
router.get("/performance/analytics", requireAuth, requireRole(HR_ROLES), async (_req, res): Promise<void> => {
  const [goals, kpis, reviews, appraisals, promotions] = await Promise.all([
    db.select().from(goalsTable),
    db.select().from(kpisTable),
    db.select().from(perfReviewsTable),
    db.select().from(appraisalsTable),
    db.select().from(promotionsTable),
  ]);

  const totalGoals = goals.length;
  const completedGoals = goals.filter((g) => g.status === "completed").length;
  const goalCompletionRate = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 1000) / 10 : 0;

  let kpiSum = 0, kpiCount = 0;
  for (const k of kpis) {
    const t = parseFloat(k.target);
    const c = parseFloat(k.current);
    if (t > 0) { kpiSum += Math.min(150, (c / t) * 100); kpiCount++; }
  }
  const avgKpiAttainment = kpiCount > 0 ? Math.round((kpiSum / kpiCount) * 10) / 10 : 0;

  const submitted = reviews.filter((r) => r.status === "submitted" && r.overallRating);
  const ratings = submitted.map((r) => parseFloat(r.overallRating as string));
  const avgOverallRating = ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : 0;

  const buckets = [
    { bucket: "1", count: 0 },
    { bucket: "2", count: 0 },
    { bucket: "3", count: 0 },
    { bucket: "4", count: 0 },
    { bucket: "5", count: 0 },
  ];
  for (const r of ratings) {
    const idx = Math.min(4, Math.max(0, Math.floor(r) - 1));
    buckets[idx].count++;
  }

  // Top performers: average rating per reviewee, plus completed goals
  const byUser = new Map<number, { sum: number; n: number; goals: number }>();
  for (const r of submitted) {
    const e = byUser.get(r.revieweeId) ?? { sum: 0, n: 0, goals: 0 };
    e.sum += parseFloat(r.overallRating as string);
    e.n++;
    byUser.set(r.revieweeId, e);
  }
  for (const g of goals) {
    if (g.status !== "completed") continue;
    const e = byUser.get(g.userId) ?? { sum: 0, n: 0, goals: 0 };
    e.goals++;
    byUser.set(g.userId, e);
  }
  const map = await userMap(Array.from(byUser.keys()));
  const topPerformers = Array.from(byUser.entries())
    .map(([userId, v]) => ({
      userId,
      userName: map.get(userId)?.name ?? "Unknown",
      userAvatar: map.get(userId)?.avatar ?? null,
      avgRating: v.n > 0 ? Math.round((v.sum / v.n) * 100) / 100 : 0,
      goalsCompleted: v.goals,
    }))
    .filter((p) => p.avgRating > 0 || p.goalsCompleted > 0)
    .sort((a, b) => (b.avgRating - a.avgRating) || (b.goalsCompleted - a.goalsCompleted))
    .slice(0, 5);

  res.json({
    totalGoals,
    completedGoals,
    goalCompletionRate,
    avgKpiAttainment,
    avgOverallRating,
    reviewsSubmitted: submitted.length,
    pendingAppraisals: appraisals.filter((a) => a.status === "pending").length,
    pendingPromotions: promotions.filter((p) => p.status === "proposed").length,
    topPerformers,
    ratingDistribution: buckets,
  });
});

export default router;
