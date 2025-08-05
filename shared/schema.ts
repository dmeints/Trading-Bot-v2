import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  decimal,
  text,
  integer,
  boolean,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  tradingMode: varchar("trading_mode").default('paper'), // 'paper' or 'live'
  riskTolerance: varchar("risk_tolerance").default('medium'), // 'low', 'medium', 'high'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Trading positions
export const positions = pgTable("positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  symbol: varchar("symbol").notNull(), // e.g., 'BTC/USD'
  side: varchar("side").notNull(), // 'buy' or 'sell'
  quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
  entryPrice: decimal("entry_price", { precision: 18, scale: 8 }).notNull(),
  currentPrice: decimal("current_price", { precision: 18, scale: 8 }).notNull(),
  unrealizedPnl: decimal("unrealized_pnl", { precision: 18, scale: 8 }).default('0'),
  status: varchar("status").default('open'), // 'open', 'closed'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Trade history
export const trades = pgTable("trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  symbol: varchar("symbol").notNull(),
  side: varchar("side").notNull(), // 'buy' or 'sell'
  quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
  price: decimal("price", { precision: 18, scale: 8 }).notNull(),
  fee: decimal("fee", { precision: 18, scale: 8 }).default('0'),
  pnl: decimal("pnl", { precision: 18, scale: 8 }).default('0'),
  orderType: varchar("order_type").notNull(), // 'market', 'limit', 'stop'
  aiRecommendation: boolean("ai_recommendation").default(false),
  confidence: real("confidence"), // AI confidence score 0-1
  executedAt: timestamp("executed_at").defaultNow(),
});

// AI agent activities
export const agentActivities = pgTable("agent_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentType: varchar("agent_type").notNull(), // 'market_analyst', 'news_analyst', etc.
  activity: text("activity").notNull(),
  confidence: real("confidence"),
  data: jsonb("data"), // Additional structured data
  createdAt: timestamp("created_at").defaultNow(),
});

// Market data cache
export const marketData = pgTable("market_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull().unique(),
  price: decimal("price", { precision: 18, scale: 8 }).notNull(),
  change24h: real("change_24h"),
  volume24h: decimal("volume_24h", { precision: 18, scale: 8 }),
  timestamp: timestamp("timestamp").defaultNow(),
});

// AI recommendations
export const recommendations = pgTable("recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  symbol: varchar("symbol").notNull(),
  action: varchar("action").notNull(), // 'buy', 'sell', 'hold'
  entryPrice: decimal("entry_price", { precision: 18, scale: 8 }),
  targetPrice: decimal("target_price", { precision: 18, scale: 8 }),
  stopLoss: decimal("stop_loss", { precision: 18, scale: 8 }),
  confidence: real("confidence").notNull(),
  reasoning: text("reasoning"),
  status: varchar("status").default('active'), // 'active', 'executed', 'expired'
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

// Portfolio snapshots
export const portfolioSnapshots = pgTable("portfolio_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  totalValue: decimal("total_value", { precision: 18, scale: 8 }).notNull(),
  dailyPnl: decimal("daily_pnl", { precision: 18, scale: 8 }).default('0'),
  totalPnl: decimal("total_pnl", { precision: 18, scale: 8 }).default('0'),
  winRate: real("win_rate"),
  sharpeRatio: real("sharpe_ratio"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Type exports
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Position = typeof positions.$inferSelect;
export type InsertPosition = typeof positions.$inferInsert;
export type Trade = typeof trades.$inferSelect;
export type InsertTrade = typeof trades.$inferInsert;
export type AgentActivity = typeof agentActivities.$inferSelect;
export type InsertAgentActivity = typeof agentActivities.$inferInsert;
export type MarketData = typeof marketData.$inferSelect;
export type InsertMarketData = typeof marketData.$inferInsert;
export type Recommendation = typeof recommendations.$inferSelect;
export type InsertRecommendation = typeof recommendations.$inferInsert;
export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;
export type InsertPortfolioSnapshot = typeof portfolioSnapshots.$inferInsert;

// Insert schemas
export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  executedAt: true,
});

export const insertPositionSchema = createInsertSchema(positions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRecommendationSchema = createInsertSchema(recommendations).omit({
  id: true,
  createdAt: true,
});
