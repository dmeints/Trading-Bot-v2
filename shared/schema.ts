import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  serial,
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

// Benchmark results table
export const benchmarkResults = pgTable("benchmark_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().unique(),
  version: varchar("version").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  performance: jsonb("performance").notNull(), // AlgorithmPerformance object
  cashReserveScore: real("cash_reserve_score").notNull(),
  recommendations: jsonb("recommendations").notNull(),
  provenance: jsonb("provenance").notNull(), // Provenance object
  createdAt: timestamp("created_at").defaultNow(),
});

// Feedback submissions table
export const feedbackSubmissions = pgTable("feedback_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(), // 1-5 stars
  category: varchar("category").notNull(), // 'UI/UX', 'Performance', etc.
  message: text("message").notNull(),
  page: varchar("page").default('/'),
  userAgent: varchar("user_agent"),
  submittedAt: timestamp("submitted_at").defaultNow(),
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

// Removed duplicate - using enhanced version below

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

// Removed duplicate - using enhanced version below

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

// Enhanced Stevie Personality & Memory Tables
export const stevieMemories = pgTable("stevie_memories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: varchar("type").notNull(), // 'trade_decision' | 'market_insight' | 'user_feedback' | 'pattern_recognition'
  content: text("content").notNull(),
  metadata: jsonb("metadata").default({}),
  importance: real("importance").notNull().default(0.5), // 0-1
  timestamp: timestamp("timestamp").defaultNow(),
});

export const stevieUserProfiles = pgTable("stevie_user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  experienceLevel: varchar("experience_level").notNull().default('intermediate'),
  preferredTone: varchar("preferred_tone").notNull().default('encouraging'),
  riskTolerance: real("risk_tolerance").notNull().default(0.5),
  learningPreferences: jsonb("learning_preferences").default({}),
  tradingGoals: jsonb("trading_goals").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const stevieTradeMemories = pgTable("stevie_trade_memories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  symbol: varchar("symbol").notNull(),
  action: varchar("action").notNull(), // 'buy' | 'sell' | 'hold'
  reasoning: text("reasoning").notNull(),
  confidence: real("confidence").notNull(),
  outcome: varchar("outcome"), // 'profit' | 'loss' | 'pending'
  marketContext: jsonb("market_context").default({}),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Real-Time Learning System Tables
export const learningParameters = pgTable("learning_parameters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  value: real("value").notNull(),
  category: varchar("category").notNull(), // 'risk' | 'features' | 'decision' | 'system'
  performanceHistory: jsonb("performance_history").default({}),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const performanceMetrics = pgTable("performance_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tradeId: varchar("trade_id").notNull(),
  symbol: varchar("symbol").notNull(),
  action: varchar("action").notNull(),
  entryPrice: real("entry_price").notNull(),
  exitPrice: real("exit_price").notNull(),
  confidence: real("confidence").notNull(),
  profit: real("profit").notNull(),
  features: jsonb("features").default({}),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const marketRegimes = pgTable("market_regimes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  regime: varchar("regime").notNull(), // 'bull' | 'bear' | 'sideways' | 'volatile'
  confidence: real("confidence").notNull(),
  signals: text("signals").notNull(),
  marketData: jsonb("market_data").default({}),
  recommendedStrategy: varchar("recommended_strategy").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Advanced Risk Management Tables
export const riskMetrics = pgTable("risk_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  overallRisk: real("overall_risk").notNull(),
  positionRisk: real("position_risk").notNull(),
  portfolioRisk: real("portfolio_risk").notNull(),
  liquidityRisk: real("liquidity_risk").notNull(),
  correlationRisk: real("correlation_risk").notNull(),
  blackSwanProbability: real("black_swan_probability").notNull(),
  recommendations: text("recommendations"),
  marketData: jsonb("market_data").default({}),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const portfolioCorrelations = pgTable("portfolio_correlations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol1: varchar("symbol1").notNull(),
  symbol2: varchar("symbol2").notNull(),
  correlation: real("correlation").notNull(),
  timeframe: varchar("timeframe").notNull().default('7d'),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => [
  index("idx_portfolio_correlations_symbols").on(table.symbol1, table.symbol2),
]);

export const riskEvents = pgTable("risk_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: varchar("event_type").notNull(),
  severity: varchar("severity").notNull(), // 'low' | 'medium' | 'high' | 'extreme'
  probability: real("probability").notNull(),
  indicators: text("indicators").notNull(),
  marketData: jsonb("market_data").default({}),
  recommendedAction: text("recommended_action"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Multi-Timeframe Strategy Tables
export const timeframeStrategies = pgTable("timeframe_strategies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  strategy: varchar("strategy").notNull(),
  timeframe: varchar("timeframe").notNull(),
  performance: jsonb("performance").default({}),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_timeframe_strategies_combo").on(table.strategy, table.timeframe),
]);

export const strategyAllocations = pgTable("strategy_allocations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  strategy: varchar("strategy").notNull(),
  timeframe: varchar("timeframe").notNull(),
  allocation: real("allocation").notNull(),
  confidence: real("confidence").notNull(),
  reasoning: text("reasoning"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const timeframeSignals = pgTable("timeframe_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  timeframe: varchar("timeframe").notNull(),
  strategy: varchar("strategy").notNull(),
  signal: real("signal").notNull(), // -1 to 1
  confidence: real("confidence").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Market Intelligence Tables
export const orderFlowData = pgTable("order_flow_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  largeOrderCount: integer("large_order_count").notNull(),
  institutionalFlow: real("institutional_flow").notNull(),
  retailFlow: real("retail_flow").notNull(),
  smartMoneyIndicator: real("smart_money_indicator").notNull(),
  averageOrderSize: real("average_order_size").notNull(),
  marketData: jsonb("market_data").default({}),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const whaleMovements = pgTable("whale_movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  address: varchar("address").notNull(),
  amount: real("amount").notNull(),
  movementType: varchar("movement_type").notNull(), // 'deposit' | 'withdrawal' | 'transfer'
  exchange: varchar("exchange"),
  significance: varchar("significance").notNull(),
  priceImpactEstimate: real("price_impact_estimate").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const arbitrageOpportunities = pgTable("arbitrage_opportunities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  buyExchange: varchar("buy_exchange").notNull(),
  sellExchange: varchar("sell_exchange").notNull(),
  priceDifference: real("price_difference").notNull(),
  percentageGap: real("percentage_gap").notNull(),
  estimatedProfit: real("estimated_profit").notNull(),
  requiredCapital: real("required_capital").notNull(),
  riskLevel: varchar("risk_level").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const optionsFlow = pgTable("options_flow", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  callVolume: real("call_volume").notNull(),
  putVolume: real("put_volume").notNull(),
  callPutRatio: real("call_put_ratio").notNull(),
  unusualActivity: boolean("unusual_activity").default(false),
  maxPain: real("max_pain").notNull(),
  significance: real("significance").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Production Monitoring Tables
export const systemHealthMetrics = pgTable("system_health_metrics", {
  id: serial("id").primaryKey(),
  metricName: varchar("metric_name").notNull(),
  value: real("value").notNull(),
  status: varchar("status"),
  metadata: jsonb("metadata").default({}),
  timestamp: timestamp("timestamp").defaultNow(),
  overallScore: real("overall_score"),
  tradingScore: real("trading_score"),
  aiScore: real("ai_score"),
  riskScore: real("risk_score"),
  dataScore: real("data_score"),
  infrastructureScore: real("infrastructure_score"),
  activeAlerts: integer("active_alerts"),
  systemStatus: varchar("system_status"),
  uptime: real("uptime"),
});

export const performanceBenchmarks = pgTable("performance_benchmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  benchmarkName: varchar("benchmark_name").notNull(),
  category: varchar("category").notNull(), // 'latency' | 'throughput' | 'accuracy' | 'uptime'
  currentValue: real("current_value").notNull(),
  targetValue: real("target_value").notNull(),
  threshold: real("threshold").notNull(),
  status: varchar("status").notNull(), // 'passing' | 'warning' | 'failing'
  timestamp: timestamp("timestamp").defaultNow(),
});

export const alertingRules = pgTable("alerting_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  condition: text("condition").notNull(),
  severity: varchar("severity").notNull(), // 'info' | 'warning' | 'error' | 'critical'
  action: varchar("action").notNull(),
  isActive: boolean("is_active").default(true),
  lastTriggered: timestamp("last_triggered"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Type exports for new tables
export type StevieMemory = typeof stevieMemories.$inferSelect;
export type StevieUserProfile = typeof stevieUserProfiles.$inferSelect;
export type StevieTradeMemory = typeof stevieTradeMemories.$inferSelect;
export type LearningParameter = typeof learningParameters.$inferSelect;
export type PerformanceMetric = typeof performanceMetrics.$inferSelect;
export type RiskMetric = typeof riskMetrics.$inferSelect;
export type PortfolioCorrelation = typeof portfolioCorrelations.$inferSelect;
export type RiskEvent = typeof riskEvents.$inferSelect;
export type TimeframeStrategy = typeof timeframeStrategies.$inferSelect;
export type StrategyAllocation = typeof strategyAllocations.$inferSelect;
export type TimeframeSignal = typeof timeframeSignals.$inferSelect;
export type OrderFlowData = typeof orderFlowData.$inferSelect;
export type WhaleMovement = typeof whaleMovements.$inferSelect;
export type ArbitrageOpportunity = typeof arbitrageOpportunities.$inferSelect;
export type OptionsFlow = typeof optionsFlow.$inferSelect;
export type SystemHealthMetric = typeof systemHealthMetrics.$inferSelect;
export type PerformanceBenchmark = typeof performanceBenchmarks.$inferSelect;
export type AlertingRule = typeof alertingRules.$inferSelect;

// Phase A - External Connectors & Schemas (Compliance Mode Implementation)
// Market bars table for OHLCV data with provider metadata
export const marketBars = pgTable("market_bars", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  timeframe: varchar("timeframe").notNull(), // '1m', '5m', '1h', '1d'
  timestamp: timestamp("timestamp").notNull(),
  open: decimal("open", { precision: 18, scale: 8 }).notNull(),
  high: decimal("high", { precision: 18, scale: 8 }).notNull(),
  low: decimal("low", { precision: 18, scale: 8 }).notNull(),
  close: decimal("close", { precision: 18, scale: 8 }).notNull(),
  volume: decimal("volume", { precision: 18, scale: 8 }).notNull(),
  provider: varchar("provider").notNull(), // 'coingecko', 'binance'
  datasetId: varchar("dataset_id").notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow(),
  provenance: jsonb("provenance").notNull(), // {provider, endpoint, fetchedAt, quotaCost}
}, (table) => [
  index("idx_market_bars_symbol_ts").on(table.symbol, table.timestamp),
  index("idx_market_bars_provider_symbol").on(table.provider, table.symbol),
]);

// Orderbook snapshots table for L1/L2 order book data
export const orderbookSnaps = pgTable("orderbook_snaps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  bid: decimal("bid", { precision: 18, scale: 8 }).notNull(),
  ask: decimal("ask", { precision: 18, scale: 8 }).notNull(),
  spreadBps: real("spread_bps").notNull(),
  depth1bp: decimal("depth_1bp", { precision: 18, scale: 8 }).notNull(),
  depth5bp: decimal("depth_5bp", { precision: 18, scale: 8 }).notNull(),
  provider: varchar("provider").notNull(), // 'binance'
  provenance: jsonb("provenance").notNull(),
}, (table) => [
  index("idx_orderbook_symbol_ts").on(table.symbol, table.timestamp),
]);

// Sentiment ticks table for social/news sentiment scores  
export const sentimentTicks = pgTable("sentiment_ticks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull(),
  source: varchar("source").notNull(), // 'twitter', 'reddit', 'cryptopanic'
  symbol: varchar("symbol").notNull(),
  score: real("score").notNull(), // -1 to 1
  volume: integer("volume").notNull(), // mentions/posts count
  topic: text("topic"),
  raw: jsonb("raw").notNull(), // raw sentiment data
  provenance: jsonb("provenance").notNull(),
}, (table) => [
  index("idx_sentiment_symbol_ts").on(table.symbol, table.timestamp),
  index("idx_sentiment_source").on(table.source),
]);

// Onchain ticks table for blockchain metrics
export const onchainTicks = pgTable("onchain_ticks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull(),
  chain: varchar("chain").notNull(), // 'bitcoin', 'ethereum'
  metric: varchar("metric").notNull(), // 'gas_price', 'hashrate', 'active_addresses'
  value: decimal("value", { precision: 18, scale: 8 }).notNull(),
  provider: varchar("provider").notNull(), // 'etherscan', 'blockchair'
  provenance: jsonb("provenance").notNull(),
}, (table) => [
  index("idx_onchain_chain_metric_ts").on(table.chain, table.metric, table.timestamp),
]);

// Macro events table for economic calendar events
export const macroEvents = pgTable("macro_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull(),
  name: varchar("name").notNull(),
  importance: varchar("importance").notNull(), // 'low', 'medium', 'high'
  windowBeforeMs: integer("window_before_ms").notNull().default(3600000), // 1 hour
  windowAfterMs: integer("window_after_ms").notNull().default(3600000), // 1 hour  
  provider: varchar("provider").notNull(), // 'tradingeconomics'
  provenance: jsonb("provenance").notNull(),
}, (table) => [
  index("idx_macro_events_ts").on(table.timestamp),
  index("idx_macro_events_importance").on(table.importance),
]);

// Connector health metrics table
export const connectorHealth = pgTable("connector_health", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: varchar("provider").notNull().unique(),
  status: varchar("status").notNull(), // 'healthy', 'degraded', 'down'
  lastSuccessfulFetch: timestamp("last_successful_fetch"),
  lastError: text("last_error"),
  requestCount24h: integer("request_count_24h").default(0),
  errorCount24h: integer("error_count_24h").default(0),
  quotaUsed: integer("quota_used").default(0),
  quotaLimit: integer("quota_limit"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Import layout schemas
export * from "./layout-schema";

// Phase A type exports
export type MarketBar = typeof marketBars.$inferSelect;
export type InsertMarketBar = typeof marketBars.$inferInsert;
export type OrderbookSnap = typeof orderbookSnaps.$inferSelect;
export type InsertOrderbookSnap = typeof orderbookSnaps.$inferInsert;
export type SentimentTick = typeof sentimentTicks.$inferSelect;
export type InsertSentimentTick = typeof sentimentTicks.$inferInsert;
export type OnchainTick = typeof onchainTicks.$inferSelect;
export type InsertOnchainTick = typeof onchainTicks.$inferInsert;
export type MacroEvent = typeof macroEvents.$inferSelect;
export type InsertMacroEvent = typeof macroEvents.$inferInsert;
export type ConnectorHealth = typeof connectorHealth.$inferSelect;
export type InsertConnectorHealth = typeof connectorHealth.$inferInsert;
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

// Feedback submission types  
export type FeedbackSubmission = typeof feedbackSubmissions.$inferSelect;
export type InsertFeedbackSubmission = typeof feedbackSubmissions.$inferInsert;

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

export const insertFeedbackSubmissionSchema = createInsertSchema(feedbackSubmissions).omit({
  id: true,
  submittedAt: true,
});
