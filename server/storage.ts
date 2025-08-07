import {
  users,
  positions,
  trades,
  agentActivities,
  marketData,
  recommendations,
  portfolioSnapshots,
  sentimentData,
  aiModels,
  strategySharing,
  userReputations,
  marketRegimes,
  correlationMatrix,
  eventAnalysis,
  riskMetrics,
  backtestResults,
  feedbackSubmissions,
  type User,
  type UpsertUser,
  type Position,
  type InsertPosition,
  type Trade,
  type InsertTrade,
  type AgentActivity,
  type InsertAgentActivity,
  type MarketData,
  type InsertMarketData,
  type Recommendation,
  type InsertRecommendation,
  type PortfolioSnapshot,
  type InsertPortfolioSnapshot,
  type SentimentData,
  type InsertSentimentData,
  type AIModel,
  type InsertAIModel,
  type StrategySharing,
  type InsertStrategySharing,
  type UserReputation,
  type InsertUserReputation,
  type MarketRegime,
  type InsertMarketRegime,
  type CorrelationMatrix,
  type InsertCorrelationMatrix,
  type EventAnalysis,
  type InsertEventAnalysis,
  type RiskMetrics,
  type InsertRiskMetrics,
  type BacktestResults,
  type InsertBacktestResults,
  type FeedbackSubmission,
  type InsertFeedbackSubmission,
  userLayouts,
  experiments,
  userExperimentAssignments,
  experimentMetrics,
  userPreferences,
  type UserLayout,
  type InsertUserLayout,
  type Experiment,
  type InsertExperiment,
  type UserExperimentAssignment,
  type InsertUserExperimentAssignment,
  type ExperimentMetric,
  type InsertExperimentMetric,
  type UserPreference,
  type InsertUserPreference,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Trading operations
  createTrade(trade: InsertTrade): Promise<Trade>;
  getUserTrades(userId: string, limit?: number): Promise<Trade[]>;
  
  // Position operations
  getUserPositions(userId: string): Promise<Position[]>;
  createPosition(position: InsertPosition): Promise<Position>;
  
  // Market data operations
  updateMarketData(data: InsertMarketData): Promise<MarketData>;
  getLatestMarketData(): Promise<MarketData[]>;
  
  // Agent activities
  logAgentActivity(activity: InsertAgentActivity): Promise<AgentActivity>;
  getRecentAgentActivities(limit?: number): Promise<AgentActivity[]>;
  
  // Recommendations
  createRecommendation(rec: InsertRecommendation): Promise<Recommendation>;
  getUserRecommendations(userId: string, status?: string): Promise<Recommendation[]>;
  updateRecommendationStatus(id: string, status: string): Promise<Recommendation>;
  
  // Portfolio operations
  createPortfolioSnapshot(snapshot: InsertPortfolioSnapshot): Promise<PortfolioSnapshot>;
  getLatestPortfolioSnapshot(userId: string): Promise<PortfolioSnapshot | undefined>;
  
  // Enhanced features
  createSentimentData(data: InsertSentimentData): Promise<SentimentData>;
  getSentimentData(symbol: string): Promise<SentimentData[]>;
  
  // Feedback operations
  createFeedbackSubmission(feedbackData: InsertFeedbackSubmission): Promise<FeedbackSubmission>;
  getFeedbackSubmissions(limit?: number): Promise<FeedbackSubmission[]>;

  // Layout management
  getUserLayouts(userId: string): Promise<UserLayout[]>;
  saveUserLayout(userId: string, layoutData: InsertUserLayout): Promise<UserLayout>;
  deleteUserLayout(userId: string, layoutId: string): Promise<void>;

  // Experiment management
  getExperimentByName(name: string): Promise<Experiment | undefined>;
  getUserExperimentAssignment(userId: string, experimentName: string): Promise<UserExperimentAssignment | undefined>;
  assignUserToExperiment(userId: string, experimentId: string, variant: string): Promise<UserExperimentAssignment>;
  trackExperimentEvent(data: InsertExperimentMetric): Promise<void>;
  getAllExperiments(): Promise<Experiment[]>;
  getExperimentMetrics(experimentId: string): Promise<any[]>;
  createExperiment(data: InsertExperiment): Promise<Experiment>;

  // User preferences
  getUserPreferences(userId: string): Promise<UserPreference | undefined>;
  updateUserPreferences(userId: string, updates: Partial<InsertUserPreference>): Promise<UserPreference>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Trading operations
  async createTrade(tradeData: InsertTrade): Promise<Trade> {
    const [trade] = await db.insert(trades).values(tradeData).returning();
    return trade;
  }

  async getUserTrades(userId: string, limit = 50): Promise<Trade[]> {
    return await db
      .select()
      .from(trades)
      .where(eq(trades.userId, userId))
      .orderBy(desc(trades.executedAt))
      .limit(limit);
  }

  // Position operations
  async getUserPositions(userId: string): Promise<Position[]> {
    return await db
      .select()
      .from(positions)
      .where(and(eq(positions.userId, userId), eq(positions.status, 'open')))
      .orderBy(desc(positions.createdAt));
  }

  async createPosition(positionData: InsertPosition): Promise<Position> {
    const [position] = await db.insert(positions).values(positionData).returning();
    return position;
  }

  // Market data operations
  async updateMarketData(data: InsertMarketData): Promise<MarketData> {
    const [marketDataEntry] = await db
      .insert(marketData)
      .values(data)
      .onConflictDoUpdate({
        target: marketData.symbol,
        set: { ...data, timestamp: new Date() },
      })
      .returning();
    return marketDataEntry;
  }

  async getLatestMarketData(): Promise<MarketData[]> {
    return await db
      .select()
      .from(marketData)
      .orderBy(desc(marketData.timestamp));
  }

  // Agent activities
  async logAgentActivity(activityData: InsertAgentActivity): Promise<AgentActivity> {
    const [activity] = await db.insert(agentActivities).values(activityData).returning();
    return activity;
  }

  async getRecentAgentActivities(limit = 100): Promise<AgentActivity[]> {
    return await db
      .select()
      .from(agentActivities)
      .orderBy(desc(agentActivities.createdAt))
      .limit(limit);
  }

  // Recommendations
  async createRecommendation(rec: InsertRecommendation): Promise<Recommendation> {
    const [newRec] = await db.insert(recommendations).values(rec).returning();
    return newRec;
  }

  async getUserRecommendations(userId: string, status = 'active'): Promise<Recommendation[]> {
    return await db
      .select()
      .from(recommendations)
      .where(and(eq(recommendations.userId, userId), eq(recommendations.status, status)))
      .orderBy(desc(recommendations.createdAt));
  }

  async updateRecommendationStatus(id: string, status: string): Promise<Recommendation> {
    const [updatedRec] = await db
      .update(recommendations)
      .set({ status })
      .where(eq(recommendations.id, id))
      .returning();
    return updatedRec;
  }

  // Portfolio operations
  async createPortfolioSnapshot(snapshot: InsertPortfolioSnapshot): Promise<PortfolioSnapshot> {
    const [newSnapshot] = await db.insert(portfolioSnapshots).values(snapshot).returning();
    return newSnapshot;
  }

  async getLatestPortfolioSnapshot(userId: string): Promise<PortfolioSnapshot | undefined> {
    const [snapshot] = await db
      .select()
      .from(portfolioSnapshots)
      .where(eq(portfolioSnapshots.userId, userId))
      .orderBy(desc(portfolioSnapshots.createdAt))
      .limit(1);
    return snapshot;
  }

  // Enhanced features
  async createSentimentData(data: InsertSentimentData): Promise<SentimentData> {
    const [result] = await db.insert(sentimentData).values(data).returning();
    return result;
  }

  async getSentimentData(symbol: string): Promise<SentimentData[]> {
    return await db.select().from(sentimentData).where(eq(sentimentData.symbol, symbol)).orderBy(desc(sentimentData.timestamp)).limit(10);
  }

  // Feedback operations
  async createFeedbackSubmission(feedbackData: InsertFeedbackSubmission): Promise<FeedbackSubmission> {
    const [feedback] = await db.insert(feedbackSubmissions).values(feedbackData).returning();
    return feedback;
  }

  async getFeedbackSubmissions(limit = 50): Promise<FeedbackSubmission[]> {
    return await db
      .select()
      .from(feedbackSubmissions)
      .orderBy(desc(feedbackSubmissions.submittedAt))
      .limit(limit);
  }

  // Layout management
  async getUserLayouts(userId: string): Promise<UserLayout[]> {
    return await db.select().from(userLayouts).where(eq(userLayouts.userId, userId));
  }

  async saveUserLayout(userId: string, layoutData: InsertUserLayout): Promise<UserLayout> {
    const [layout] = await db
      .insert(userLayouts)
      .values({ ...layoutData, userId })
      .returning();
    return layout;
  }

  async deleteUserLayout(userId: string, layoutId: string): Promise<void> {
    await db.delete(userLayouts).where(
      and(eq(userLayouts.userId, userId), eq(userLayouts.id, layoutId))
    );
  }

  // Experiment management
  async getExperimentByName(name: string): Promise<Experiment | undefined> {
    const [experiment] = await db.select().from(experiments).where(eq(experiments.name, name));
    return experiment;
  }

  async getUserExperimentAssignment(userId: string, experimentName: string): Promise<UserExperimentAssignment | undefined> {
    const result = await db
      .select({
        id: userExperimentAssignments.id,
        userId: userExperimentAssignments.userId,
        experimentId: userExperimentAssignments.experimentId,
        variant: userExperimentAssignments.variant,
        assignedAt: userExperimentAssignments.assignedAt,
      })
      .from(userExperimentAssignments)
      .innerJoin(experiments, eq(experiments.id, userExperimentAssignments.experimentId))
      .where(
        and(
          eq(userExperimentAssignments.userId, userId),
          eq(experiments.name, experimentName)
        )
      );
    
    return result[0];
  }

  async assignUserToExperiment(userId: string, experimentId: string, variant: string): Promise<UserExperimentAssignment> {
    const [assignment] = await db
      .insert(userExperimentAssignments)
      .values({ userId, experimentId, variant })
      .returning();
    return assignment;
  }

  async trackExperimentEvent(data: InsertExperimentMetric): Promise<void> {
    await db.insert(experimentMetrics).values(data);
  }

  async getAllExperiments(): Promise<Experiment[]> {
    return await db.select().from(experiments);
  }

  async getExperimentMetrics(experimentId: string): Promise<any[]> {
    const metrics = await db
      .select({
        variant: experimentMetrics.variant,
        eventType: experimentMetrics.eventType,
        count: sql`count(*)`.as('count'),
      })
      .from(experimentMetrics)
      .where(eq(experimentMetrics.experimentId, experimentId))
      .groupBy(experimentMetrics.variant, experimentMetrics.eventType);
    
    return metrics;
  }

  async createExperiment(data: InsertExperiment): Promise<Experiment> {
    const [experiment] = await db.insert(experiments).values(data).returning();
    return experiment;
  }

  // User preferences
  async getUserPreferences(userId: string): Promise<UserPreference | undefined> {
    const [preferences] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    return preferences;
  }

  async updateUserPreferences(userId: string, updates: Partial<InsertUserPreference>): Promise<UserPreference> {
    const [preferences] = await db
      .insert(userPreferences)
      .values({ userId, ...updates })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { ...updates, updatedAt: new Date() },
      })
      .returning();
    return preferences;
  }
}

export const storage = new DatabaseStorage();