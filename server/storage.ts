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
  aiChatConversations,
  aiChatMessages,
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
  // Phase A - External Connectors & Schemas
  marketBars,
  orderbookSnapsExtended,
  sentimentTicksExtended,
  onchainTicksExtended,
  macroEventsExtended,
  connectorHealth,
  type MarketBar,
  type InsertMarketBar,
  type OrderbookSnap,
  type InsertOrderbookSnap,
  type SentimentTick,
  type InsertSentimentTick,
  type OnchainTick,
  type InsertOnchainTick,
  type MacroEvent,
  type InsertMacroEvent,
  type ConnectorHealth,
  type InsertConnectorHealth,
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

  // Phase A - External Connectors & Schemas Storage Interface
  storeMarketBars(bars: InsertMarketBar[]): Promise<void>;
  getMarketBars(symbol: string, timeframe: string, limit?: number): Promise<MarketBar[]>;
  storeOrderbookSnaps(snaps: InsertOrderbookSnap[]): Promise<void>;
  getOrderbookSnaps(symbol: string, limit?: number): Promise<OrderbookSnap[]>;
  storeSentimentTicks(ticks: InsertSentimentTick[]): Promise<void>;
  getSentimentTicks(symbol: string, source?: string, limit?: number): Promise<SentimentTick[]>;
  storeOnchainTicks(ticks: InsertOnchainTick[]): Promise<void>;
  getOnchainTicks(chain: string, metric?: string, limit?: number): Promise<OnchainTick[]>;
  storeMacroEvents(events: InsertMacroEvent[]): Promise<void>;
  getMacroEvents(importance?: string, limit?: number): Promise<MacroEvent[]>;
  updateConnectorHealth(health: InsertConnectorHealth): Promise<ConnectorHealth>;
  getConnectorHealth(provider?: string): Promise<ConnectorHealth[]>;
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

  // Phase A - External Connectors & Schemas Storage Implementation
  async storeMarketBars(bars: InsertMarketBar[]): Promise<void> {
    if (bars.length === 0) return;
    try {
      await db.insert(marketBars).values(bars).onConflictDoUpdate({
        target: [marketBars.symbol, marketBars.timestamp, marketBars.provider],
        set: {
          open: marketBars.open,
          high: marketBars.high,
          low: marketBars.low,
          close: marketBars.close,
          volume: marketBars.volume,
          fetchedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to store market bars', error);
      throw error;
    }
  }

  async getMarketBars(symbol: string, timeframe: string, limit = 100): Promise<MarketBar[]> {
    try {
      return await db
        .select()
        .from(marketBars)
        .where(and(eq(marketBars.symbol, symbol), eq(marketBars.timeframe, timeframe)))
        .orderBy(desc(marketBars.timestamp))
        .limit(limit);
    } catch (error) {
      logger.error('Failed to get market bars', error);
      throw error;
    }
  }

  async storeOrderbookSnaps(snaps: InsertOrderbookSnap[]): Promise<void> {
    if (snaps.length === 0) return;
    try {
      await db.insert(orderbookSnaps).values(snaps).onConflictDoUpdate({
        target: [orderbookSnaps.symbol, orderbookSnaps.timestamp, orderbookSnaps.provider],
        set: {
          bid: orderbookSnaps.bid,
          ask: orderbookSnaps.ask,
          spreadBps: orderbookSnaps.spreadBps,
          depth1bp: orderbookSnaps.depth1bp,
          depth5bp: orderbookSnaps.depth5bp,
          fetchedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to store orderbook snaps', error);
      throw error;
    }
  }

  async getOrderbookSnaps(symbol: string, limit = 100): Promise<OrderbookSnap[]> {
    try {
      return await db
        .select()
        .from(orderbookSnaps)
        .where(eq(orderbookSnaps.symbol, symbol))
        .orderBy(desc(orderbookSnaps.timestamp))
        .limit(limit);
    } catch (error) {
      logger.error('Failed to get orderbook snaps', error);
      throw error;
    }
  }

  async storeSentimentTicks(ticks: InsertSentimentTick[]): Promise<void> {
    if (ticks.length === 0) return;
    try {
      await db.insert(sentimentTicks).values(ticks).onConflictDoUpdate({
        target: [sentimentTicks.source, sentimentTicks.symbol, sentimentTicks.timestamp],
        set: {
          score: sentimentTicks.score,
          volume: sentimentTicks.volume,
          topic: sentimentTicks.topic,
          raw: sentimentTicks.raw,
          fetchedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to store sentiment ticks', error);
      throw error;
    }
  }

  async getSentimentTicks(symbol: string, source?: string, limit = 100): Promise<SentimentTick[]> {
    try {
      const conditions = [eq(sentimentTicks.symbol, symbol)];
      if (source) conditions.push(eq(sentimentTicks.source, source));
      
      return await db
        .select()
        .from(sentimentTicks)
        .where(and(...conditions))
        .orderBy(desc(sentimentTicks.timestamp))
        .limit(limit);
    } catch (error) {
      logger.error('Failed to get sentiment ticks', error);
      throw error;
    }
  }

  async storeOnchainTicks(ticks: InsertOnchainTick[]): Promise<void> {
    if (ticks.length === 0) return;
    try {
      await db.insert(onchainTicks).values(ticks).onConflictDoUpdate({
        target: [onchainTicks.chain, onchainTicks.metric, onchainTicks.timestamp],
        set: {
          value: onchainTicks.value,
          fetchedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to store onchain ticks', error);
      throw error;
    }
  }

  async getOnchainTicks(chain: string, metric?: string, limit = 100): Promise<OnchainTick[]> {
    try {
      const conditions = [eq(onchainTicks.chain, chain)];
      if (metric) conditions.push(eq(onchainTicks.metric, metric));
      
      return await db
        .select()
        .from(onchainTicks)
        .where(and(...conditions))
        .orderBy(desc(onchainTicks.timestamp))
        .limit(limit);
    } catch (error) {
      logger.error('Failed to get onchain ticks', error);
      throw error;
    }
  }

  async storeMacroEvents(events: InsertMacroEvent[]): Promise<void> {
    if (events.length === 0) return;
    try {
      await db.insert(macroEvents).values(events).onConflictDoUpdate({
        target: [macroEvents.name, macroEvents.timestamp, macroEvents.provider],
        set: {
          importance: macroEvents.importance,
          windowBeforeMs: macroEvents.windowBeforeMs,
          windowAfterMs: macroEvents.windowAfterMs,
          fetchedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to store macro events', error);
      throw error;
    }
  }

  async getMacroEvents(importance?: string, limit = 100): Promise<MacroEvent[]> {
    try {
      const conditions = importance ? [eq(macroEvents.importance, importance)] : [];
      
      return await db
        .select()
        .from(macroEvents)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(macroEvents.timestamp))
        .limit(limit);
    } catch (error) {
      logger.error('Failed to get macro events', error);
      throw error;
    }
  }

  async updateConnectorHealth(health: InsertConnectorHealth): Promise<ConnectorHealth> {
    try {
      const [updated] = await db.insert(connectorHealth).values(health).onConflictDoUpdate({
        target: connectorHealth.provider,
        set: {
          status: health.status,
          requestCount: health.requestCount,
          errorCount: health.errorCount,
          lastError: health.lastError,
          quotaCost: health.quotaCost,
          lastChecked: new Date(),
        },
      }).returning();
      return updated;
    } catch (error) {
      logger.error('Failed to update connector health', error);
      throw error;
    }
  }

  async getConnectorHealth(provider?: string): Promise<ConnectorHealth[]> {
    try {
      const conditions = provider ? [eq(connectorHealth.provider, provider)] : [];
      
      return await db
        .select()
        .from(connectorHealth)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(connectorHealth.lastChecked));
    } catch (error) {
      logger.error('Failed to get connector health', error);
      throw error;
    }
  }

  // Phase B - AI Chat Integration Storage Methods
  async storeAIChatConversation(conversation: any): Promise<void> {
    await db.insert(aiChatConversations).values(conversation)
      .onConflictDoUpdate({
        target: aiChatConversations.id,
        set: {
          messageCount: conversation.messageCount,
          lastMessage: conversation.lastMessage,
          updatedAt: new Date(),
        },
      });
  }

  async getAIChatConversations(userId: string): Promise<any[]> {
    return await db.select()
      .from(aiChatConversations)
      .where(eq(aiChatConversations.userId, userId))
      .orderBy(desc(aiChatConversations.updatedAt))
      .limit(20);
  }

  async storeAIChatMessage(message: any): Promise<void> {
    await db.insert(aiChatMessages).values(message);
  }

  async getAIChatMessages(conversationId: string): Promise<any[]> {
    return await db.select()
      .from(aiChatMessages)
      .where(eq(aiChatMessages.conversationId, conversationId))
      .orderBy(asc(aiChatMessages.timestamp));
  }
}

export const storage = new DatabaseStorage();