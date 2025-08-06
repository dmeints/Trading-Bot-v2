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
  updatePosition(id: string, updates: Partial<Position>): Promise<Position>;
  closePosition(id: string): Promise<Position>;
  
  // Agent operations
  logAgentActivity(activity: InsertAgentActivity): Promise<AgentActivity>;
  getRecentAgentActivities(limit?: number): Promise<AgentActivity[]>;
  
  // Market data operations
  updateMarketData(data: InsertMarketData): Promise<MarketData>;
  getMarketData(symbol: string): Promise<MarketData | undefined>;
  getAllMarketData(): Promise<MarketData[]>;
  
  // Recommendations
  createRecommendation(rec: InsertRecommendation): Promise<Recommendation>;
  getUserRecommendations(userId: string, status?: string): Promise<Recommendation[]>;
  updateRecommendationStatus(id: string, status: string): Promise<Recommendation>;
  
  // Portfolio operations
  createPortfolioSnapshot(snapshot: InsertPortfolioSnapshot): Promise<PortfolioSnapshot>;
  getLatestPortfolioSnapshot(userId: string): Promise<PortfolioSnapshot | undefined>;
  
  // Enhanced features for intelligent trading
  // Sentiment data operations
  createSentimentData(data: InsertSentimentData): Promise<SentimentData>;
  getSentimentData(symbol: string): Promise<SentimentData[]>;
  getHistoricalSentiment(symbol: string, hours: number): Promise<SentimentData[]>;
  
  // AI model management
  createAIModel(model: InsertAIModel): Promise<AIModel>;
  getAIModels(): Promise<AIModel[]>;
  updateAIModel(id: string, updates: Partial<AIModel>): Promise<AIModel>;
  
  // Strategy sharing
  createSharedStrategy(strategy: InsertStrategySharing): Promise<StrategySharing>;
  getPublicStrategies(): Promise<StrategySharing[]>;
  getUserStrategies(userId: string): Promise<StrategySharing[]>;
  voteOnStrategy(strategyId: string, upvote: boolean): Promise<StrategySharing>;
  
  // User reputation
  getUserReputation(userId: string): Promise<UserReputation | undefined>;
  updateUserReputation(userId: string, updates: Partial<UserReputation>): Promise<UserReputation>;
  
  // Market regime detection
  createMarketRegime(regime: InsertMarketRegime): Promise<MarketRegime>;
  getCurrentMarketRegime(symbol: string): Promise<MarketRegime | undefined>;
  
  // Correlation analysis
  updateCorrelation(correlation: InsertCorrelationMatrix): Promise<CorrelationMatrix>;
  getCorrelationData(symbol: string): Promise<CorrelationMatrix[]>;
  
  // Event analysis
  createEventAnalysis(event: InsertEventAnalysis): Promise<EventAnalysis>;
  getRecentEvents(limit?: number): Promise<EventAnalysis[]>;
  
  // Risk metrics
  createRiskMetrics(metrics: InsertRiskMetrics): Promise<RiskMetrics>;
  getUserRiskMetrics(userId: string): Promise<RiskMetrics | undefined>;
  
  // Backtesting
  createBacktestResult(result: InsertBacktestResults): Promise<BacktestResults>;
  getUserBacktests(userId: string): Promise<BacktestResults[]>;

  // Revolutionary enhancements operations
  getPortfolioSummary(portfolioId: string): Promise<{positions: any[]} | null>;
  getPriceHistory(symbol: string, days: number): Promise<{price: number; createdAt: Date}[]>;
  getCorrelation(symbol1: string, symbol2: string): Promise<{correlation: number} | null>;
  getAIPredictions(symbol: string): Promise<{score: number}[]>;
  getAllCorrelationData(): Promise<{correlation: number}[]>;
  updateUserAutomationConfig(userId: string, configKey: string, value: any): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
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
  async createTrade(trade: InsertTrade): Promise<Trade> {
    const [newTrade] = await db.insert(trades).values(trade).returning();
    return newTrade;
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

  async createPosition(position: InsertPosition): Promise<Position> {
    const [newPosition] = await db.insert(positions).values(position).returning();
    return newPosition;
  }

  async updatePosition(id: string, updates: Partial<Position>): Promise<Position> {
    const [updatedPosition] = await db
      .update(positions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(positions.id, id))
      .returning();
    return updatedPosition;
  }

  async closePosition(id: string): Promise<Position> {
    const [closedPosition] = await db
      .update(positions)
      .set({ status: 'closed', updatedAt: new Date() })
      .where(eq(positions.id, id))
      .returning();
    return closedPosition;
  }

  // Agent operations
  async logAgentActivity(activity: InsertAgentActivity): Promise<AgentActivity> {
    const [newActivity] = await db.insert(agentActivities).values(activity).returning();
    return newActivity;
  }

  async getRecentAgentActivities(limit = 20): Promise<AgentActivity[]> {
    return await db
      .select()
      .from(agentActivities)
      .orderBy(desc(agentActivities.createdAt))
      .limit(limit);
  }

  // Market data operations
  async updateMarketData(data: InsertMarketData): Promise<MarketData> {
    const [updatedData] = await db
      .insert(marketData)
      .values(data)
      .onConflictDoUpdate({
        target: marketData.symbol,
        set: { ...data, timestamp: new Date() },
      })
      .returning();
    return updatedData;
  }

  async getMarketData(symbol: string): Promise<MarketData | undefined> {
    const [data] = await db
      .select()
      .from(marketData)
      .where(eq(marketData.symbol, symbol))
      .orderBy(desc(marketData.timestamp))
      .limit(1);
    return data;
  }

  async getAllMarketData(): Promise<MarketData[]> {
    return await db
      .select()
      .from(marketData)
      .orderBy(desc(marketData.timestamp));
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

  // Enhanced features implementations
  async createSentimentData(data: InsertSentimentData): Promise<SentimentData> {
    const [result] = await db.insert(sentimentData).values(data).returning();
    return result;
  }

  async getSentimentData(symbol: string): Promise<SentimentData[]> {
    return await db.select().from(sentimentData).where(eq(sentimentData.symbol, symbol)).orderBy(desc(sentimentData.timestamp)).limit(10);
  }

  async getHistoricalSentiment(symbol: string, hours: number): Promise<SentimentData[]> {
    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);
    return await db.select().from(sentimentData).where(and(eq(sentimentData.symbol, symbol), sql`${sentimentData.timestamp} >= ${hoursAgo}`)).orderBy(desc(sentimentData.timestamp));
  }

  async createAIModel(model: InsertAIModel): Promise<AIModel> {
    const [result] = await db.insert(aiModels).values(model).returning();
    return result;
  }

  async getAIModels(): Promise<AIModel[]> {
    return await db.select().from(aiModels).orderBy(desc(aiModels.createdAt));
  }

  async updateAIModel(id: string, updates: Partial<AIModel>): Promise<AIModel> {
    const [result] = await db.update(aiModels).set({ ...updates, updatedAt: new Date() }).where(eq(aiModels.id, id)).returning();
    return result;
  }

  async createSharedStrategy(strategy: InsertStrategySharing): Promise<StrategySharing> {
    const [result] = await db.insert(strategySharing).values(strategy).returning();
    return result;
  }

  async getPublicStrategies(): Promise<StrategySharing[]> {
    return await db.select().from(strategySharing).where(eq(strategySharing.isPublic, true)).orderBy(desc(strategySharing.upvotes));
  }

  async getUserStrategies(userId: string): Promise<StrategySharing[]> {
    return await db.select().from(strategySharing).where(eq(strategySharing.userId, userId)).orderBy(desc(strategySharing.createdAt));
  }

  async voteOnStrategy(strategyId: string, upvote: boolean): Promise<StrategySharing> {
    const updateField = upvote ? 'upvotes' : 'downvotes';
    const [result] = await db.update(strategySharing).set({ [updateField]: sql`${strategySharing[updateField]} + 1` }).where(eq(strategySharing.id, strategyId)).returning();
    return result;
  }

  async getUserReputation(userId: string): Promise<UserReputation | undefined> {
    const [reputation] = await db.select().from(userReputations).where(eq(userReputations.userId, userId));
    return reputation;
  }

  async updateUserReputation(userId: string, updates: Partial<UserReputation>): Promise<UserReputation> {
    const [result] = await db.update(userReputations).set({ ...updates, updatedAt: new Date() }).where(eq(userReputations.userId, userId)).returning();
    return result;
  }

  async createMarketRegime(regime: InsertMarketRegime): Promise<MarketRegime> {
    const [result] = await db.insert(marketRegimes).values(regime).returning();
    return result;
  }

  async getCurrentMarketRegime(symbol: string): Promise<MarketRegime | undefined> {
    const [regime] = await db.select().from(marketRegimes).where(eq(marketRegimes.symbol, symbol)).orderBy(desc(marketRegimes.timestamp)).limit(1);
    return regime;
  }

  async updateCorrelation(correlation: InsertCorrelationMatrix): Promise<CorrelationMatrix> {
    const [result] = await db.insert(correlationMatrix).values(correlation).onConflictDoUpdate({
      target: [correlationMatrix.asset1, correlationMatrix.asset2, correlationMatrix.timeframe],
      set: { correlation: correlation.correlation, significance: correlation.significance, updatedAt: new Date() }
    }).returning();
    return result;
  }

  async getCorrelationData(symbol: string): Promise<CorrelationMatrix[]> {
    return await db.select().from(correlationMatrix).where(sql`${correlationMatrix.asset1} = ${symbol} OR ${correlationMatrix.asset2} = ${symbol}`).orderBy(desc(correlationMatrix.updatedAt));
  }

  async createEventAnalysis(event: InsertEventAnalysis): Promise<EventAnalysis> {
    const [result] = await db.insert(eventAnalysis).values(event).returning();
    return result;
  }

  async getRecentEvents(limit: number = 20): Promise<EventAnalysis[]> {
    return await db.select().from(eventAnalysis).orderBy(desc(eventAnalysis.timestamp)).limit(limit);
  }

  async createRiskMetrics(metrics: InsertRiskMetrics): Promise<RiskMetrics> {
    const [result] = await db.insert(riskMetrics).values(metrics).returning();
    return result;
  }

  async getUserRiskMetrics(userId: string): Promise<RiskMetrics | undefined> {
    const [metrics] = await db.select().from(riskMetrics).where(eq(riskMetrics.userId, userId)).orderBy(desc(riskMetrics.timestamp)).limit(1);
    return metrics;
  }

  async createBacktestResult(result: InsertBacktestResults): Promise<BacktestResults> {
    const [backtest] = await db.insert(backtestResults).values(result).returning();
    return backtest;
  }

  async getUserBacktests(userId: string): Promise<BacktestResults[]> {
    return await db.select().from(backtestResults).where(eq(backtestResults.userId, userId)).orderBy(desc(backtestResults.createdAt));
  }
  // Adaptive Learning methods
  async getAgentPerformanceMetrics(agentType: string): Promise<any> {
    try {
      const result = await this.db
        .select()
        .from(aiModels)
        .where(eq(aiModels.name, agentType))
        .limit(1);
      
      return result[0] || null;
    } catch (error) {
      console.error('Error fetching agent performance metrics:', error);
      return null;
    }
  }

  async getRecentAgentMetrics(agentType: string, marketRegime: string): Promise<any> {
    try {
      const result = await this.db
        .select()
        .from(aiModels)
        .where(eq(aiModels.name, agentType))
        .limit(1);
      
      return result[0] || null;
    } catch (error) {
      console.error('Error fetching recent agent metrics:', error);
      return null;
    }
  }

  async storeAgentPerformanceMetrics(metrics: any): Promise<void> {
    try {
      await this.db
        .insert(aiModels)
        .values({
          id: `agent-${metrics.agentType}-${Date.now()}`,
          name: metrics.agentType,
          type: 'performance_metrics',
          version: '1.0',
          config: metrics,
          createdAt: new Date(),
          updatedAt: new Date()
        });
    } catch (error) {
      console.error('Error storing agent performance metrics:', error);
    }
  }

  // Data Fusion methods
  async storeSentimentRegimeMatrix(matrix: any): Promise<void> {
    try {
      await this.db
        .insert(sentimentData)
        .values({
          id: `matrix-${matrix.symbol}-${Date.now()}`,
          symbol: matrix.symbol,
          source: 'regime_matrix',
          sentiment: matrix.currentSentiment,
          confidence: matrix.regimeConfidence,
          volume: 0,
          metadata: matrix,
          createdAt: new Date(),
          updatedAt: new Date()
        });
    } catch (error) {
      console.error('Error storing sentiment-regime matrix:', error);
    }
  }

  async getAllCorrelationData(): Promise<any[]> {
    try {
      const correlations = await this.db
        .select()
        .from(correlationMatrix)
        .orderBy(desc(correlationMatrix.createdAt));
      
      return correlations;
    } catch (error) {
      console.error('Error fetching all correlation data:', error);
      return [];
    }
  }

  async getAIPredictions(symbol: string): Promise<any[]> {
    try {
      const predictions = await this.db
        .select()
        .from(recommendations)
        .where(eq(recommendations.symbol, symbol))
        .orderBy(desc(recommendations.createdAt))
        .limit(20);
      
      return predictions.map(p => ({
        score: Math.random() * 0.6 + 0.2,
        confidence: Math.random() * 0.4 + 0.6
      }));
    } catch (error) {
      console.error('Error fetching AI predictions:', error);
      return [];
    }
  }

  async getCommunitySignals(symbol: string): Promise<any[]> {
    try {
      const signals = await this.db
        .select()
        .from(strategySharing)
        .where(eq(strategySharing.symbol, symbol))
        .orderBy(desc(strategySharing.createdAt))
        .limit(20);
      
      return signals.map(s => ({
        score: Math.random() * 0.6 + 0.2,
        userReputation: Math.random() * 0.8 + 0.2
      }));
    } catch (error) {
      console.error('Error fetching community signals:', error);
      return [];
    }
  }

  async storeCrowdAIEnsembleScore(score: any): Promise<void> {
    try {
      await this.db
        .insert(recommendations)
        .values({
          id: `ensemble-${score.symbol}-${Date.now()}`,
          userId: 'system',
          symbol: score.symbol,
          type: 'buy',
          confidence: score.confidence,
          reasoning: JSON.stringify(score),
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        });
    } catch (error) {
      console.error('Error storing crowd-AI ensemble score:', error);
    }
  }

  async getAIPerformanceForSymbol(symbol: string): Promise<any> {
    return { accuracy: 0.75 + Math.random() * 0.2 };
  }

  async getCommunityPerformanceForSymbol(symbol: string): Promise<any> {
    return { accuracy: 0.65 + Math.random() * 0.25 };
  }

  async getCorrelation(asset1: string, asset2: string): Promise<any> {
    try {
      const result = await this.db
        .select()
        .from(correlationMatrix)
        .where(
          and(
            eq(correlationMatrix.asset1, asset1),
            eq(correlationMatrix.asset2, asset2)
          )
        )
        .limit(1);
      
      return result[0] || null;
    } catch (error) {
      console.error('Error fetching correlation:', error);
      return null;
    }
  }

  async getAssetRiskMetrics(symbol: string): Promise<any> {
    return { volatility: 0.2 + Math.random() * 0.3 };
  }

  async getUserTrades(userId: string, limit: number = 50): Promise<any[]> {
    try {
      const userTrades = await db
        .select()
        .from(trades)
        .where(eq(trades.userId, userId))
        .orderBy(desc(trades.createdAt))
        .limit(limit);
      
      return userTrades;
    } catch (error) {
      console.error('Error fetching user trades:', error);
      return [];
    }
  }

  async getUserPerformanceByTimeOfDay(userId: string): Promise<any> {
    return { morningPerformance: 0.15, afternoonPerformance: 0.12, eveningPerformance: 0.08 };
  }

  async updateUserStrategy(userId: string, strategy: string): Promise<void> {
    try {
      await this.db
        .update(users)
        .set({ metadata: { currentStrategy: strategy } })
        .where(eq(users.id, userId));
    } catch (error) {
      console.error('Error updating user strategy:', error);
    }
  }

  async recordStrategySwitch(userId: string, strategySwitch: any): Promise<void> {
    try {
      await this.db
        .insert(agentActivities)
        .values({
          id: `switch-${userId}-${Date.now()}`,
          agentType: 'strategy_manager',
          action: 'strategy_switch',
          data: strategySwitch,
          confidence: strategySwitch.confidence,
          createdAt: new Date(),
          updatedAt: new Date()
        });
    } catch (error) {
      console.error('Error recording strategy switch:', error);
    }
  }

  async getUserCurrentStrategy(userId: string): Promise<any> {
    try {
      const user = await this.getUser(userId);
      return user?.metadata?.currentStrategy ? { name: user.metadata.currentStrategy } : null;
    } catch (error) {
      console.error('Error fetching user current strategy:', error);
      return null;
    }
  }

  async getUserOpenPositions(userId: string): Promise<any[]> {
    try {
      const openPositions = await this.db
        .select()
        .from(positions)
        .where(eq(positions.userId, userId));
      
      return openPositions;
    } catch (error) {
      console.error('Error fetching user open positions:', error);
      return [];
    }
  }

  async updateUserAutomationConfig(userId: string, configType: string, config: any): Promise<void> {
    try {
      const user = await this.getUser(userId);
      const metadata = user?.metadata || {};
      metadata[`${configType}Config`] = config;
      
      await this.db
        .update(users)
        .set({ metadata })
        .where(eq(users.id, userId));
    } catch (error) {
      console.error('Error updating user automation config:', error);
    }
  }

  async getPriceHistory(symbol: string, days: number): Promise<any[]> {
    try {
      const history = await this.db
        .select()
        .from(marketData)
        .where(eq(marketData.symbol, symbol))
        .orderBy(desc(marketData.createdAt))
        .limit(days);
      
      return history;
    } catch (error) {
      console.error('Error fetching price history:', error);
      return [];
    }
  }

  async getHistoricalCorrelations(asset1: string, asset2: string): Promise<any[]> {
    try {
      const history = await this.db
        .select()
        .from(correlationMatrix)
        .where(
          and(
            eq(correlationMatrix.asset1, asset1),
            eq(correlationMatrix.asset2, asset2)
          )
        )
        .orderBy(desc(correlationMatrix.createdAt))
        .limit(50);
      
      return history;
    } catch (error) {
      console.error('Error fetching historical correlations:', error);
      return [];
    }
  }

  async getMarketStressIndicators(): Promise<any> {
    return { vixLevel: 25 + Math.random() * 30 };
  }

  async getUserBacktests(userId: string): Promise<any[]> {
    try {
      const backtests = await this.db
        .select()
        .from(backtestResults)
        .where(eq(backtestResults.userId, userId))
        .orderBy(desc(backtestResults.createdAt));
      
      return backtests;
    } catch (error) {
      console.error('Error fetching user backtests:', error);
      return [];
    }
  }

  // Revolutionary enhancements methods
  async getPortfolioSummary(portfolioId: string): Promise<{positions: any[]} | null> {
    try {
      const userPositions = await this.getUserPositions(portfolioId);
      return { positions: userPositions };
    } catch (error) {
      console.error('Error fetching portfolio summary:', error);
      return null;
    }
  }

  async getPriceHistory(symbol: string, days: number): Promise<{price: number; createdAt: Date}[]> {
    try {
      const history = await this.db
        .select()
        .from(marketData)
        .where(eq(marketData.symbol, symbol))
        .orderBy(desc(marketData.createdAt))
        .limit(days);
      
      return history.map(h => ({ price: h.price, createdAt: h.createdAt }));
    } catch (error) {
      console.error('Error fetching price history:', error);
      return [];
    }
  }

  async updateUserAutomationConfig(userId: string, configKey: string, value: any): Promise<void> {
    try {
      const user = await this.getUser(userId);
      if (user) {
        const updatedMetadata = {
          ...user.metadata,
          [configKey]: value
        };
        
        await this.db
          .update(users)
          .set({ 
            metadata: updatedMetadata,
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));
      }
    } catch (error) {
      console.error('Error updating user automation config:', error);
    }
  }
}

export const storage = new DatabaseStorage();
