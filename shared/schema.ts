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

// Enhanced tables for intelligent features
export const sentimentData = pgTable("sentiment_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  source: varchar("source").notNull(), // 'reddit', 'twitter', 'news', 'fear_greed'
  sentiment: real("sentiment").notNull(), // -1 to 1
  confidence: real("confidence").notNull(),
  volume: integer("volume"), // number of mentions/posts
  data: jsonb("data"), // raw sentiment data
  timestamp: timestamp("timestamp").defaultNow(),
});

export const aiModels = pgTable("ai_models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  type: varchar("type").notNull(), // 'ensemble', 'transformer', 'reinforcement'
  version: varchar("version").notNull(),
  accuracy: real("accuracy"),
  performance: jsonb("performance"), // detailed metrics
  isActive: boolean("is_active").default(false),
  trainingData: jsonb("training_data"), // metadata about training
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const strategySharing = pgTable("strategy_sharing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  strategyName: varchar("strategy_name").notNull(),
  description: text("description"),
  performance: jsonb("performance"), // anonymized performance metrics
  parameters: jsonb("parameters"), // strategy configuration
  isPublic: boolean("is_public").default(false),
  upvotes: integer("upvotes").default(0),
  downvotes: integer("downvotes").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userReputations = pgTable("user_reputations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  tradingScore: real("trading_score").default(0),
  communityScore: real("community_score").default(0),
  aiAccuracy: real("ai_accuracy").default(0),
  riskManagement: real("risk_management").default(0),
  totalTrades: integer("total_trades").default(0),
  successfulTrades: integer("successful_trades").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const marketRegimes = pgTable("market_regimes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  regime: varchar("regime").notNull(), // 'bull', 'bear', 'sideways', 'volatile'
  confidence: real("confidence").notNull(),
  indicators: jsonb("indicators"), // technical indicators used
  volatility: real("volatility"),
  trendStrength: real("trend_strength"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const correlationMatrix = pgTable("correlation_matrix", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  asset1: varchar("asset1").notNull(),
  asset2: varchar("asset2").notNull(),
  correlation: real("correlation").notNull(),
  timeframe: varchar("timeframe").notNull(), // '1h', '24h', '7d', '30d'
  significance: real("significance"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const eventAnalysis = pgTable("event_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: varchar("event_type").notNull(), // 'news', 'announcement', 'regulatory'
  title: text("title").notNull(),
  content: text("content"),
  impact: varchar("impact").notNull(), // 'positive', 'negative', 'neutral'
  severity: real("severity"), // 0-1 scale
  affectedAssets: text("affected_assets").array(),
  predictedMovement: jsonb("predicted_movement"),
  actualMovement: jsonb("actual_movement"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const riskMetrics = pgTable("risk_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  varDaily: real("var_daily"), // Value at Risk
  varWeekly: real("var_weekly"),
  maxDrawdown: real("max_drawdown"),
  sharpeRatio: real("sharpe_ratio"),
  sortinoRatio: real("sortino_ratio"),
  beta: real("beta"),
  alpha: real("alpha"),
  diversificationScore: real("diversification_score"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const backtestResults = pgTable("backtest_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  strategyId: varchar("strategy_id").references(() => strategySharing.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  initialCapital: decimal("initial_capital", { precision: 18, scale: 8 }).notNull(),
  finalCapital: decimal("final_capital", { precision: 18, scale: 8 }).notNull(),
  totalReturn: real("total_return").notNull(),
  maxDrawdown: real("max_drawdown").notNull(),
  winRate: real("win_rate").notNull(),
  totalTrades: integer("total_trades").notNull(),
  profitFactor: real("profit_factor"),
  sharpeRatio: real("sharpe_ratio"),
  details: jsonb("details"), // detailed trade log and metrics
  createdAt: timestamp("created_at").defaultNow(),
});

// Type exports
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Feedback submissions table
export const feedbackSubmissions = pgTable("feedback_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(),
  category: varchar("category").notNull(),
  message: text("message").notNull(),
  page: varchar("page").notNull(),
  userAgent: text("user_agent"),
  submittedAt: timestamp("submitted_at").defaultNow(),
});

export type FeedbackSubmission = typeof feedbackSubmissions.$inferSelect;
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

// New type exports
export type SentimentData = typeof sentimentData.$inferSelect;
export type InsertSentimentData = typeof sentimentData.$inferInsert;
export type AIModel = typeof aiModels.$inferSelect;
export type InsertAIModel = typeof aiModels.$inferInsert;
export type StrategySharing = typeof strategySharing.$inferSelect;
export type InsertStrategySharing = typeof strategySharing.$inferInsert;
export type UserReputation = typeof userReputations.$inferSelect;
export type InsertUserReputation = typeof userReputations.$inferInsert;
export type MarketRegime = typeof marketRegimes.$inferSelect;
export type InsertMarketRegime = typeof marketRegimes.$inferInsert;
export type CorrelationMatrix = typeof correlationMatrix.$inferSelect;
export type InsertCorrelationMatrix = typeof correlationMatrix.$inferInsert;
export type EventAnalysis = typeof eventAnalysis.$inferSelect;
export type InsertEventAnalysis = typeof eventAnalysis.$inferInsert;
export type RiskMetrics = typeof riskMetrics.$inferSelect;
export type InsertRiskMetrics = typeof riskMetrics.$inferInsert;
export type BacktestResults = typeof backtestResults.$inferSelect;
export type InsertBacktestResults = typeof backtestResults.$inferInsert;

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

// New insert schemas
export const insertSentimentDataSchema = createInsertSchema(sentimentData).omit({
  id: true,
  timestamp: true,
});

export const insertAIModelSchema = createInsertSchema(aiModels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStrategySharingSchema = createInsertSchema(strategySharing).omit({
  id: true,
  createdAt: true,
});

export const insertUserReputationSchema = createInsertSchema(userReputations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMarketRegimeSchema = createInsertSchema(marketRegimes).omit({
  id: true,
  timestamp: true,
});

export const insertCorrelationMatrixSchema = createInsertSchema(correlationMatrix).omit({
  id: true,
  updatedAt: true,
});

export const insertEventAnalysisSchema = createInsertSchema(eventAnalysis).omit({
  id: true,
  timestamp: true,
});

export const insertRiskMetricsSchema = createInsertSchema(riskMetrics).omit({
  id: true,
  timestamp: true,
});

export const insertBacktestResultsSchema = createInsertSchema(backtestResults).omit({
  id: true,
  createdAt: true,
});
