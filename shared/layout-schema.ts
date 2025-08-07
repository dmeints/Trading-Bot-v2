import { pgTable, varchar, jsonb, timestamp, boolean, integer, text } from "drizzle-orm/pg-core";
import { sql } from 'drizzle-orm';

// User Layout Customization
export const userLayouts = pgTable("user_layouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  layoutName: varchar("layout_name").notNull(),
  layoutConfig: jsonb("layout_config").notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// A/B Testing Framework
export const experiments = pgTable("experiments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  variants: jsonb("variants").notNull(), // Array of variant configs
  isActive: boolean("is_active").default(true),
  trafficAllocation: integer("traffic_allocation").default(100), // Percentage
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userExperimentAssignments = pgTable("user_experiment_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  experimentId: varchar("experiment_id").notNull(),
  variant: varchar("variant").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
});

export const experimentMetrics = pgTable("experiment_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  experimentId: varchar("experiment_id").notNull(),
  variant: varchar("variant").notNull(),
  eventType: varchar("event_type").notNull(),
  eventData: jsonb("event_data"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// User Preferences
export const userPreferences = pgTable("user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  language: varchar("language").default("en"),
  theme: varchar("theme").default("dark"),
  accessibilitySettings: jsonb("accessibility_settings").default(sql`'{}'::jsonb`),
  notifications: jsonb("notifications").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UserLayout = typeof userLayouts.$inferSelect;
export type InsertUserLayout = typeof userLayouts.$inferInsert;

export type Experiment = typeof experiments.$inferSelect;
export type InsertExperiment = typeof experiments.$inferInsert;

export type UserExperimentAssignment = typeof userExperimentAssignments.$inferSelect;
export type InsertUserExperimentAssignment = typeof userExperimentAssignments.$inferInsert;

export type ExperimentMetric = typeof experimentMetrics.$inferSelect;
export type InsertExperimentMetric = typeof experimentMetrics.$inferInsert;

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = typeof userPreferences.$inferInsert;