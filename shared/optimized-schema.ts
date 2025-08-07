import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  primaryKey,
  pgEnum
} from "drizzle-orm/pg-core";

// Existing tables (from the optimized schema)
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
  tradingMode: varchar("trading_mode").default("paper"),
  riskTolerance: varchar("risk_tolerance").default("medium"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const marketData = pgTable(
  "marketData",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    symbol: varchar("symbol").notNull(),
    price: decimal("price", { precision: 18, scale: 8 }).notNull(),
    volume24h: decimal("volume_24h", { precision: 18, scale: 2 }),
    change24h: decimal("change_24h", { precision: 8, scale: 4 }),
    marketCap: decimal("market_cap", { precision: 18, scale: 2 }),
    timestamp: timestamp("timestamp").defaultNow(),
    source: varchar("source").default("coingecko"),
  },
  (table) => [
    index("idx_market_data_symbol_time").on(table.symbol, table.timestamp),
    index("idx_market_data_timestamp").on(table.timestamp),
  ]
);

export const positions = pgTable(
  "positions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    symbol: varchar("symbol").notNull(),
    side: varchar("side").notNull(), // 'long' | 'short'
    quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
    entryPrice: decimal("entry_price", { precision: 18, scale: 8 }).notNull(),
    currentPrice: decimal("current_price", { precision: 18, scale: 8 }),
    stopLoss: decimal("stop_loss", { precision: 18, scale: 8 }),
    takeProfit: decimal("take_profit", { precision: 18, scale: 8 }),
    unrealizedPnl: decimal("unrealized_pnl", { precision: 18, scale: 8 }),
    status: varchar("status").default("open"), // 'open' | 'closed'
    openedAt: timestamp("opened_at").defaultNow(),
    closedAt: timestamp("closed_at"),
    metadata: jsonb("metadata"),
  },
  (table) => [
    index("idx_positions_user_status").on(table.userId, table.status),
    index("idx_positions_symbol").on(table.symbol),
  ]
);

export const trades = pgTable(
  "trades",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    positionId: varchar("position_id"),
    symbol: varchar("symbol").notNull(),
    side: varchar("side").notNull(), // 'buy' | 'sell'
    quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
    price: decimal("price", { precision: 18, scale: 8 }).notNull(),
    executedAt: timestamp("executed_at").defaultNow(),
    pnl: decimal("pnl", { precision: 18, scale: 8 }),
    fees: decimal("fees", { precision: 18, scale: 8 }).default("0"),
    status: varchar("status").default("pending"), // 'pending' | 'executed' | 'failed' | 'closed'
    type: varchar("type").default("market"), // 'market' | 'limit' | 'stop'
    source: varchar("source").default("manual"), // 'manual' | 'ai' | 'strategy'
    metadata: jsonb("metadata"),
  },
  (table) => [
    index("idx_trades_user_time").on(table.userId, table.executedAt),
    index("idx_trades_symbol_time").on(table.symbol, table.executedAt),
  ]
);

export const marketEvents = pgTable(
  "marketEvents",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    eventType: varchar("event_type").notNull(),
    symbol: varchar("symbol"),
    timestamp: timestamp("timestamp").defaultNow(),
    data: jsonb("data").notNull(),
    confidence: decimal("confidence", { precision: 3, scale: 2 }),
    impact: varchar("impact"), // 'low' | 'medium' | 'high'
    source: varchar("source").notNull(),
    tags: varchar("tags").array(),
    processed: boolean("processed").default(false),
  },
  (table) => [
    index("idx_market_events_type_time").on(table.eventType, table.timestamp),
    index("idx_market_events_symbol_time").on(table.symbol, table.timestamp),
  ]
);

export const agentActivities = pgTable(
  "agentActivities",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    agentType: varchar("agent_type").notNull(),
    activity: text("activity").notNull(),
    confidence: decimal("confidence", { precision: 3, scale: 2 }),
    data: jsonb("data"),
    userId: varchar("user_id"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_agent_activities_type_time").on(table.agentType, table.createdAt),
    index("idx_agent_activities_user_time").on(table.userId, table.createdAt),
  ]
);

export const portfolioSnapshots = pgTable(
  "portfolioSnapshots",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    totalValue: decimal("total_value", { precision: 18, scale: 2 }).notNull(),
    totalPnl: decimal("total_pnl", { precision: 18, scale: 2 }).default("0"),
    portfolioData: jsonb("portfolio_data").notNull(),
    timestamp: timestamp("timestamp").defaultNow(),
  },
  (table) => [
    index("idx_portfolio_snapshots_user_time").on(table.userId, table.timestamp),
  ]
);

// NEW MLOps Tables

export const modelRunStatusEnum = pgEnum('model_run_status', ['running', 'completed', 'failed']);
export const deploymentStatusEnum = pgEnum('deployment_status', ['pending', 'deployed', 'rejected']);

export const modelRuns = pgTable(
  "model_runs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    agentType: varchar("agent_type").notNull(), // 'market_insight' | 'risk_assessor'
    modelVersion: varchar("model_version").notNull(),
    trainingStart: timestamp("training_start").notNull(),
    trainingEnd: timestamp("training_end"),
    status: modelRunStatusEnum("status").default('running'),
    metrics: jsonb("metrics").default('{}'),
    config: jsonb("config").notNull(),
    trainingSamples: integer("training_samples").default(0),
    validationSamples: integer("validation_samples").default(0),
    improvementThreshold: decimal("improvement_threshold", { precision: 5, scale: 4 }).default("0.02"),
    previousModelVersion: varchar("previous_model_version"),
    deploymentStatus: deploymentStatusEnum("deployment_status").default('pending'),
    createdAt: timestamp("created_at").defaultNow(),
    notes: text("notes"),
  },
  (table) => [
    index("idx_model_runs_agent_time").on(table.agentType, table.trainingStart),
    index("idx_model_runs_status").on(table.status),
    index("idx_model_runs_deployment").on(table.deploymentStatus),
  ]
);

export const sweepResultStatusEnum = pgEnum('sweep_result_status', ['running', 'completed', 'failed']);

export const sweepResults = pgTable(
  "sweep_results",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    sweepId: varchar("sweep_id").notNull(),
    agentType: varchar("agent_type").notNull(),
    config: jsonb("config").notNull(),
    metrics: jsonb("metrics").default('{}'),
    status: sweepResultStatusEnum("status").default('running'),
    executionTime: integer("execution_time").default(0), // milliseconds
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("idx_sweep_results_sweep_id").on(table.sweepId),
    index("idx_sweep_results_agent_time").on(table.agentType, table.createdAt),
    index("idx_sweep_results_status").on(table.status),
  ]
);

export const driftMetricStatusEnum = pgEnum('drift_metric_status', ['normal', 'warning', 'critical']);
export const driftMetricTypeEnum = pgEnum('drift_metric_type', ['feature_drift', 'prediction_drift', 'performance_drift']);

export const driftMetrics = pgTable(
  "drift_metrics",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    agentType: varchar("agent_type").notNull(),
    metricType: driftMetricTypeEnum("metric_type").notNull(),
    value: decimal("value", { precision: 10, scale: 6 }).notNull(),
    threshold: decimal("threshold", { precision: 10, scale: 6 }).notNull(),
    status: driftMetricStatusEnum("status").default('normal'),
    details: jsonb("details").default('{}'),
    calculatedAt: timestamp("calculated_at").defaultNow(),
    alertSent: boolean("alert_sent").default(false),
  },
  (table) => [
    index("idx_drift_metrics_agent_time").on(table.agentType, table.calculatedAt),
    index("idx_drift_metrics_status").on(table.status),
    index("idx_drift_metrics_type").on(table.metricType),
  ]
);

export const modelDeployments = pgTable(
  "model_deployments",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    agentType: varchar("agent_type").notNull(),
    modelVersion: varchar("model_version").notNull(),
    deployedAt: timestamp("deployed_at").defaultNow(),
    undeployedAt: timestamp("undeployed_at"),
    isActive: boolean("is_active").default(true),
    modelData: jsonb("model_data").notNull(),
    deploymentConfig: jsonb("deployment_config").default('{}'),
    performanceMetrics: jsonb("performance_metrics").default('{}'),
  },
  (table) => [
    index("idx_model_deployments_agent_version").on(table.agentType, table.modelVersion),
    index("idx_model_deployments_active").on(table.isActive),
  ]
);

export const hyperparameterSweeps = pgTable(
  "hyperparameter_sweeps",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name").notNull(),
    agentType: varchar("agent_type").notNull(),
    parameterGrid: jsonb("parameter_grid").notNull(),
    status: sweepResultStatusEnum("status").default('running'),
    totalConfigurations: integer("total_configurations").notNull(),
    completedConfigurations: integer("completed_configurations").default(0),
    bestConfig: jsonb("best_config"),
    bestMetrics: jsonb("best_metrics"),
    startedAt: timestamp("started_at").defaultNow(),
    completedAt: timestamp("completed_at"),
    createdBy: varchar("created_by"),
    notes: text("notes"),
  },
  (table) => [
    index("idx_hyperparameter_sweeps_agent_time").on(table.agentType, table.startedAt),
    index("idx_hyperparameter_sweeps_status").on(table.status),
  ]
);

// Feature importance tracking
export const featureImportance = pgTable(
  "feature_importance",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    modelRunId: varchar("model_run_id").notNull(),
    agentType: varchar("agent_type").notNull(),
    featureName: varchar("feature_name").notNull(),
    importance: decimal("importance", { precision: 10, scale: 6 }).notNull(),
    rank: integer("rank").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_feature_importance_model_run").on(table.modelRunId),
    index("idx_feature_importance_agent_feature").on(table.agentType, table.featureName),
  ]
);

// Model performance tracking over time
export const modelPerformanceHistory = pgTable(
  "model_performance_history",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    agentType: varchar("agent_type").notNull(),
    modelVersion: varchar("model_version").notNull(),
    evaluationDate: timestamp("evaluation_date").defaultNow(),
    metrics: jsonb("metrics").notNull(),
    datasetSize: integer("dataset_size"),
    evaluationPeriod: varchar("evaluation_period"), // '1d', '7d', '30d'
    notes: text("notes"),
  },
  (table) => [
    index("idx_model_performance_agent_date").on(table.agentType, table.evaluationDate),
    index("idx_model_performance_version").on(table.modelVersion),
  ]
);

// Training data quality metrics
export const trainingDataQuality = pgTable(
  "training_data_quality",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    agentType: varchar("agent_type").notNull(),
    datasetId: varchar("dataset_id").notNull(),
    sampleCount: integer("sample_count").notNull(),
    qualityScore: decimal("quality_score", { precision: 5, scale: 4 }).notNull(),
    completenessScore: decimal("completeness_score", { precision: 5, scale: 4 }).notNull(),
    consistencyScore: decimal("consistency_score", { precision: 5, scale: 4 }).notNull(),
    validityScore: decimal("validity_score", { precision: 5, scale: 4 }).notNull(),
    timeRange: varchar("time_range").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    metadata: jsonb("metadata").default('{}'),
  },
  (table) => [
    index("idx_training_data_quality_agent_time").on(table.agentType, table.createdAt),
    index("idx_training_data_quality_dataset").on(table.datasetId),
  ]
);

// Export types for use in application
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;
export type MarketData = typeof marketData.$inferSelect;
export type Position = typeof positions.$inferSelect;
export type Trade = typeof trades.$inferSelect;
export type MarketEvent = typeof marketEvents.$inferSelect;
export type AgentActivity = typeof agentActivities.$inferSelect;
export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;

// MLOps types
export type ModelRun = typeof modelRuns.$inferSelect;
export type InsertModelRun = typeof modelRuns.$inferInsert;
export type SweepResult = typeof sweepResults.$inferSelect;
export type InsertSweepResult = typeof sweepResults.$inferInsert;
export type DriftMetric = typeof driftMetrics.$inferSelect;
export type InsertDriftMetric = typeof driftMetrics.$inferInsert;
export type ModelDeployment = typeof modelDeployments.$inferSelect;
export type HyperparameterSweep = typeof hyperparameterSweeps.$inferSelect;
export type FeatureImportance = typeof featureImportance.$inferSelect;
export type ModelPerformanceHistory = typeof modelPerformanceHistory.$inferSelect;
export type TrainingDataQuality = typeof trainingDataQuality.$inferSelect;