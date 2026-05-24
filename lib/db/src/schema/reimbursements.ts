import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const reimbursementsTable = pgTable("reimbursements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  category: text("category").notNull().default("other"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("INR"),
  expenseDate: text("expense_date").notNull(),
  description: text("description"),
  receiptUrl: text("receipt_url"),
  status: text("status").notNull().default("pending"),
  reviewedById: integer("reviewed_by_id").references(() => usersTable.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertReimbursementSchema = createInsertSchema(reimbursementsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReimbursement = z.infer<typeof insertReimbursementSchema>;
export type Reimbursement = typeof reimbursementsTable.$inferSelect;
