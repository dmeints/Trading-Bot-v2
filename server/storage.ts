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
}

export const storage = new DatabaseStorage();