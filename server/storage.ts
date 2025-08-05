import {
  users,
  positions,
  trades,
  agentActivities,
  marketData,
  recommendations,
  portfolioSnapshots,
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
}

export const storage = new DatabaseStorage();
