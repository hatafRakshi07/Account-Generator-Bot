import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  dailyTarget: integer("daily_target").notNull().default(100),
  scheduleTime: text("schedule_time").notNull().default("00:00"),
  proxyEnabled: boolean("proxy_enabled").notNull().default(false),
  retryEnabled: boolean("retry_enabled").notNull().default(true),
  retryMax: integer("retry_max").notNull().default(3),
  isActive: boolean("is_active").notNull().default(true),
  emailDomain: text("email_domain").notNull().default("gmail.com"),
  usernamePrefix: text("username_prefix").notNull().default("user"),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
