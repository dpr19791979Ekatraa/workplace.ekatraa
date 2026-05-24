import { pgTable, text, serial, timestamp, integer, numeric, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const goalsTable = pgTable("perf_goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("personal"),
  weight: integer("weight").notNull().default(1),
  targetValue: numeric("target_value", { precision: 12, scale: 2 }),
  currentValue: numeric("current_value", { precision: 12, scale: 2 }).default("0"),
  unit: text("unit"),
  dueDate: text("due_date"),
  status: text("status").notNull().default("not_started"),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const kpisTable = pgTable("perf_kpis", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  name: text("name").notNull(),
  target: numeric("target", { precision: 12, scale: 2 }).notNull(),
  current: numeric("current", { precision: 12, scale: 2 }).notNull().default("0"),
  unit: text("unit"),
  period: text("period").notNull().default("quarterly"),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const perfReviewsTable = pgTable("perf_reviews", {
  id: serial("id").primaryKey(),
  revieweeId: integer("reviewee_id").notNull().references(() => usersTable.id),
  reviewerId: integer("reviewer_id").notNull().references(() => usersTable.id),
  cycle: text("cycle").notNull(),
  type: text("type").notNull().default("manager"),
  anonymous: boolean("anonymous").notNull().default(false),
  ratings: jsonb("ratings").notNull().default({}),
  overallRating: numeric("overall_rating", { precision: 3, scale: 2 }),
  strengths: text("strengths"),
  improvements: text("improvements"),
  comments: text("comments"),
  status: text("status").notNull().default("draft"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const appraisalsTable = pgTable("perf_appraisals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  cycle: text("cycle").notNull(),
  finalRating: numeric("final_rating", { precision: 3, scale: 2 }).notNull(),
  salaryChangePercent: numeric("salary_change_percent", { precision: 5, scale: 2 }).default("0"),
  bonusAmount: numeric("bonus_amount", { precision: 12, scale: 2 }).default("0"),
  currency: text("currency").notNull().default("INR"),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  decidedById: integer("decided_by_id").references(() => usersTable.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const promotionsTable = pgTable("perf_promotions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  fromTitle: text("from_title").notNull(),
  toTitle: text("to_title").notNull(),
  fromLevel: text("from_level"),
  toLevel: text("to_level"),
  effectiveDate: text("effective_date").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("proposed"),
  requestedById: integer("requested_by_id").notNull().references(() => usersTable.id),
  decidedById: integer("decided_by_id").references(() => usersTable.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGoalSchema = createInsertSchema(goalsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertKpiSchema = createInsertSchema(kpisTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPerfReviewSchema = createInsertSchema(perfReviewsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAppraisalSchema = createInsertSchema(appraisalsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPromotionSchema = createInsertSchema(promotionsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Goal = typeof goalsTable.$inferSelect;
export type Kpi = typeof kpisTable.$inferSelect;
export type PerfReview = typeof perfReviewsTable.$inferSelect;
export type Appraisal = typeof appraisalsTable.$inferSelect;
export type Promotion = typeof promotionsTable.$inferSelect;
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type InsertKpi = z.infer<typeof insertKpiSchema>;
export type InsertPerfReview = z.infer<typeof insertPerfReviewSchema>;
export type InsertAppraisal = z.infer<typeof insertAppraisalSchema>;
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;
