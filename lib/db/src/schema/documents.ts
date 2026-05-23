import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable, departmentsTable } from "./users";

export const documentsTable = pgTable("documents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("other"),
  objectPath: text("object_path"),
  url: text("url"),
  size: integer("size"),
  folderId: integer("folder_id"),
  departmentId: integer("department_id").references(() => departmentsTable.id),
  uploadedById: integer("uploaded_by_id").references(() => usersTable.id),
  starred: boolean("starred").notNull().default(false),
  tags: text("tags").array(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;
