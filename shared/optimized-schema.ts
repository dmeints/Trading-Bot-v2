import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  decimal,
  text,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Core system tables (required)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Core trading tables (4)
export const marketData = pgTable(
  "marketData", 
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    symbol: varchar("symbol", { length: 20 }).notNull(),
    price: decimal("price", { precision: 18, scale: 8 }).notNull(),
    volume24h: decimal("volume_24h", { precision: 18, scale: 2 }),
    change24h: decimal("change_24h", { precision: 10, scale: 4 }),
    timestamp: timestamp("timestamp").notNull().defaultNow(),
    source: varchar("source", { length: 50 }).default('coingecko'),
    metadata: jsonb("metadata"), // Additional market data
  },
  (table) => [
    index("idx_market_data_symbol").on(table.symbol),
    index("idx_market_data_timestamp").on(table.timestamp),
    index("idx_market_data_symbol_timestamp").on(table.symbol, table.timestamp),
  ]
);

export const positions = pgTable(
  "positions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    symbol: varchar("symbol", { length: 20 }).notNull(),
    side: varchar("side", { length: 10 }).notNull(), // 'long' or 'short'
    quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
    entryPrice: decimal("entry_price", { precision: 18, scale: 8 }).notNull(),
    currentPrice: decimal("current_price", { precision: 18, scale: 8 }),
    unrealizedPnl: decimal("unrealized_pnl", { precision: 18, scale: 2 }),
    stopLoss: decimal("stop_loss", { precision: 18, scale: 8 }),
    takeProfit: decimal("take_profit", { precision: 18, scale: 8 }),
    status: varchar("status", { length: 20 }).default('open'),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_positions_user_id").on(table.userId),
    index("idx_positions_symbol").on(table.symbol),
    index("idx_positions_status").on(table.status),
  ]
);

export const trades = pgTable(
  "trades",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    symbol: varchar("symbol", { length: 20 }).notNull(),
    side: varchar("side", { length: 10 }).notNull(), // 'buy' or 'sell'
    quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
    price: decimal("price", { precision: 18, scale: 8 }).notNull(),
    fee: decimal("fee", { precision: 18, scale: 8 }),
    pnl: decimal("pnl", { precision: 18, scale: 2 }),
    orderType: varchar("order_type", { length: 20 }).default('market'),
    positionId: varchar("position_id"), // Link to position if applicable
    aiRecommendation: boolean("ai_recommendation").default(false),
    confidence: decimal("confidence", { precision: 3, scale: 2 }),
    executedAt: timestamp("executed_at").defaultNow(),
  },
  (table) => [
    index("idx_trades_user_id").on(table.userId),
    index("idx_trades_symbol").on(table.symbol),
    index("idx_trades_executed_at").on(table.executedAt),
  ]
);

// Consolidated market intelligence table (replaces 3 tables)
export const marketEvents = pgTable(
  "marketEvents",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    eventType: varchar("event_type", { length: 50 }).notNull(), // 'regime_change', 'news_event', 'sentiment_shift'
    symbol: varchar("symbol", { length: 20 }),
    timestamp: timestamp("timestamp").notNull().defaultNow(),
    data: jsonb("data").notNull(), // Flexible structure for different event types
    confidence: decimal("confidence", { precision: 3, scale: 2 }),
    impact: varchar("impact", { length: 10 }).default('medium'), // 'low', 'medium', 'high'
    tags: text("tags").array(), // ['bearish', 'technical', 'whale_movement']
    source: varchar("source", { length: 100 }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_market_events_timestamp").on(table.timestamp),
    index("idx_market_events_symbol").on(table.symbol),
    index("idx_market_events_type").on(table.eventType),
    index("idx_market_events_tags").using('gin', table.tags),
  ]
);

// Simplified AI activities (consolidated agents)
export const agentActivities = pgTable(
  "agentActivities",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    agentType: varchar("agent_type", { length: 50 }).notNull(), // 'market_insight', 'risk_assessor'
    activity: text("activity").notNull(),
    confidence: decimal("confidence", { precision: 3, scale: 2 }),
    data: jsonb("data"),
    userId: varchar("user_id"), // Optional - for user-specific activities
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_agent_activities_type").on(table.agentType),
    index("idx_agent_activities_created_at").on(table.createdAt),
    index("idx_agent_activities_user_id").on(table.userId),
  ]
);

// Portfolio performance tracking
export const portfolioSnapshots = pgTable(
  "portfolioSnapshots",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    totalValue: decimal("total_value", { precision: 18, scale: 2 }).notNull(),
    totalPnl: decimal("total_pnl", { precision: 18, scale: 2 }),
    positionCount: integer("position_count").default(0),
    riskScore: varchar("risk_score", { length: 10 }), // 'low', 'medium', 'high'
    drawdown: decimal("drawdown", { precision: 5, scale: 4 }),
    snapshot: jsonb("snapshot"), // Detailed portfolio state
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_portfolio_snapshots_user_id").on(table.userId),
    index("idx_portfolio_snapshots_created_at").on(table.createdAt),
  ]
);

// Optional: Keep for user feedback and product improvement
export const feedbackSubmissions = pgTable("feedbackSubmissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  type: varchar("type", { length: 50 }).notNull(),
  rating: integer("rating"),
  feedback: text("feedback"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Type exports
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;

export type MarketData = typeof marketData.$inferSelect;
export type InsertMarketData = typeof marketData.$inferInsert;

export type Position = typeof positions.$inferSelect;
export type InsertPosition = typeof positions.$inferInsert;

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = typeof trades.$inferInsert;

export type MarketEvent = typeof marketEvents.$inferSelect;
export type InsertMarketEvent = typeof marketEvents.$inferInsert;

export type AgentActivity = typeof agentActivities.$inferSelect;
export type InsertAgentActivity = typeof agentActivities.$inferInsert;

export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;
export type InsertPortfolioSnapshot = typeof portfolioSnapshots.$inferInsert;

export type FeedbackSubmission = typeof feedbackSubmissions.$inferSelect;
export type InsertFeedbackSubmission = typeof feedbackSubmissions.$inferInsert;

// Zod schemas for validation
export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  executedAt: true,
});

export const insertPositionSchema = createInsertSchema(positions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMarketEventSchema = createInsertSchema(marketEvents).omit({
  id: true,
  createdAt: true,
});

export const insertAgentActivitySchema = createInsertSchema(agentActivities).omit({
  id: true,
  createdAt: true,
});

export type InsertTradeInput = z.infer<typeof insertTradeSchema>;
export type InsertPositionInput = z.infer<typeof insertPositionSchema>;
export type InsertMarketEventInput = z.infer<typeof insertMarketEventSchema>;
export type InsertAgentActivityInput = z.infer<typeof insertAgentActivitySchema>;