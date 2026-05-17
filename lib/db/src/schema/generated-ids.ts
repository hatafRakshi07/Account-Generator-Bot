import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const generatedIdsTable = pgTable("generated_ids", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  recoveryEmail: text("recovery_email"),
  status: text("status").notNull().default("success"),
  errorMessage: text("error_message"),
  batchId: integer("batch_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGeneratedIdSchema = createInsertSchema(generatedIdsTable).omit({ id: true, createdAt: true });
export type InsertGeneratedId = z.infer<typeof insertGeneratedIdSchema>;
export type GeneratedId = typeof generatedIdsTable.$inferSelect;
