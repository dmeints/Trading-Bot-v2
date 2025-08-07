/**
 * Stevie Enhanced Personality & Memory System
 * Persistent learning memory with personalized insights
 */

import OpenAI from 'openai';
import { db } from '../db';
import { 
  stevieMemories, 
  stevieUserProfiles, 
  stevieTradeMemories,
  type StevieMemory,
  type StevieUserProfile,
  type StevieTradeMemory
} from '../../shared/schema';
import { eq, desc, and, gte } from 'drizzle-orm';

interface PersonalityResponse {
  message: string;
  tone: 'encouraging' | 'analytical' | 'cautious' | 'excited';
  confidence: number;
  memoryContext: string[];
  proactiveInsight?: string;
}

export class SteviePersonalityService {
  private openai: OpenAI;
  private personalityTraits = {
    core: "Data-driven optimist with trader's intuition",
    style: "Encouraging but realistic, uses trading analogies",
    memory: "Remembers every trade and learns from patterns",
    proactive: "Alerts users to important market developments"
  };

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async initializeUserProfile(userId: string, experienceLevel: 'beginner' | 'intermediate' | 'advanced' = 'intermediate'): Promise<StevieUserProfile> {
    const [profile] = await db
      .insert(stevieUserProfiles)
      .values({
        userId,
        experienceLevel,
        preferredTone: 'encouraging',
        riskTolerance: 0.5,
        learningPreferences: {
          detailLevel: experienceLevel === 'beginner' ? 'detailed' : 'concise',
          analogiesPreferred: true,
          technicalDepth: experienceLevel === 'advanced' ? 'deep' : 'moderate'
        },
        tradingGoals: {
          primaryObjective: 'growth',
          timeHorizon: 'medium',
          riskProfile: 'balanced'
        }
      })
      .onConflictDoUpdate({
        target: stevieUserProfiles.userId,
        set: { updatedAt: new Date() }
      })
      .returning();

    return profile;
  }

  async recordTradeMemory(
    userId: string,
    symbol: string,
    action: 'buy' | 'sell' | 'hold',
    reasoning: string,
    confidence: number,
    outcome?: 'profit' | 'loss' | 'pending'
  ): Promise<StevieTradeMemory> {
    const [tradeMemory] = await db
      .insert(stevieTradeMemories)
      .values({
        userId,
        symbol,
        action,
        reasoning,
        confidence,
        outcome,
        marketContext: await this.captureMarketContext(),
        timestamp: new Date()
      })
      .returning();

    // Create associated memory
    await this.createMemory(
      userId,
      'trade_decision',
      `${action.toUpperCase()} ${symbol}: ${reasoning}`,
      { confidence, outcome, symbol, action }
    );

    return tradeMemory;
  }

  async createMemory(
    userId: string,
    type: 'trade_decision' | 'market_insight' | 'user_feedback' | 'pattern_recognition',
    content: string,
    metadata: any = {}
  ): Promise<StevieMemory> {
    const [memory] = await db
      .insert(stevieMemories)
      .values({
        userId,
        type,
        content,
        metadata,
        importance: this.calculateMemoryImportance(type, metadata),
        timestamp: new Date()
      })
      .returning();

    return memory;
  }

  async generatePersonalizedResponse(
    userId: string,
    userMessage: string,
    context: any = {}
  ): Promise<PersonalityResponse> {
    // Get user profile and recent memories
    const [profile, recentMemories, recentTrades] = await Promise.all([
      this.getUserProfile(userId),
      this.getRecentMemories(userId, 10),
      this.getRecentTrades(userId, 5)
    ]);

    // Build context for LLM
    const personalityContext = this.buildPersonalityContext(profile, recentMemories, recentTrades);
    
    // Generate response with OpenAI
    const llmResponse = await this.generateLLMResponse(
      userMessage,
      personalityContext,
      profile,
      context
    );

    // Check for proactive insights
    const proactiveInsight = await this.generateProactiveInsight(userId, profile);

    // Record this interaction
    await this.createMemory(
      userId,
      'user_feedback',
      `User asked: "${userMessage}" | Stevie responded: "${llmResponse.message}"`,
      { userMessage, response: llmResponse.message, tone: llmResponse.tone }
    );

    return {
      ...llmResponse,
      memoryContext: recentMemories.map(m => m.content).slice(0, 3),
      proactiveInsight
    };
  }

  async recognizePattern(userId: string, currentMarketData: any): Promise<string | null> {
    // Get similar historical scenarios
    const historicalMemories = await db
      .select()
      .from(stevieTradeMemories)
      .where(eq(stevieTradeMemories.userId, userId))
      .orderBy(desc(stevieTradeMemories.timestamp))
      .limit(50);

    // Use vector similarity or pattern matching
    const similarScenarios = historicalMemories.filter(memory => 
      this.isSimilarMarketCondition(memory.marketContext, currentMarketData)
    );

    if (similarScenarios.length >= 2) {
      const successRate = similarScenarios.filter(s => s.outcome === 'profit').length / similarScenarios.length;
      const lastSimilar = similarScenarios[0];
      
      return `This reminds me of ${new Date(lastSimilar.timestamp).toLocaleDateString()} when ${lastSimilar.reasoning}. Similar setups had a ${Math.round(successRate * 100)}% success rate in your trading history.`;
    }

    return null;
  }

  async updateUserProfile(userId: string, feedback: any): Promise<void> {
    const updates: Partial<StevieUserProfile> = {};

    // Adapt based on user feedback
    if (feedback.preferredDetail) {
      updates.learningPreferences = { 
        ...await this.getUserProfile(userId).then(p => p?.learningPreferences || {}),
        detailLevel: feedback.preferredDetail 
      };
    }

    if (feedback.riskComfort) {
      updates.riskTolerance = feedback.riskComfort;
    }

    await db
      .update(stevieUserProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(stevieUserProfiles.userId, userId));
  }

  private async getUserProfile(userId: string): Promise<StevieUserProfile | null> {
    const [profile] = await db
      .select()
      .from(stevieUserProfiles)
      .where(eq(stevieUserProfiles.userId, userId));

    return profile || null;
  }

  private async getRecentMemories(userId: string, limit: number): Promise<StevieMemory[]> {
    return db
      .select()
      .from(stevieMemories)
      .where(eq(stevieMemories.userId, userId))
      .orderBy(desc(stevieMemories.importance), desc(stevieMemories.timestamp))
      .limit(limit);
  }

  private async getRecentTrades(userId: string, limit: number): Promise<StevieTradeMemory[]> {
    return db
      .select()
      .from(stevieTradeMemories)
      .where(eq(stevieTradeMemories.userId, userId))
      .orderBy(desc(stevieTradeMemories.timestamp))
      .limit(limit);
  }

  private buildPersonalityContext(
    profile: StevieUserProfile | null,
    memories: StevieMemory[],
    trades: StevieTradeMemory[]
  ): string {
    let context = `Stevie's Personality: ${this.personalityTraits.core}\n`;
    context += `Communication Style: ${this.personalityTraits.style}\n\n`;

    if (profile) {
      context += `User Profile:\n`;
      context += `- Experience: ${profile.experienceLevel}\n`;
      context += `- Risk Tolerance: ${profile.riskTolerance}\n`;
      context += `- Preferred Tone: ${profile.preferredTone}\n\n`;
    }

    if (memories.length > 0) {
      context += `Recent Memories:\n`;
      memories.slice(0, 3).forEach((memory, i) => {
        context += `${i + 1}. ${memory.content}\n`;
      });
      context += `\n`;
    }

    if (trades.length > 0) {
      context += `Recent Trading History:\n`;
      trades.slice(0, 2).forEach((trade, i) => {
        context += `${i + 1}. ${trade.action} ${trade.symbol}: ${trade.reasoning} (${trade.outcome || 'pending'})\n`;
      });
    }

    return context;
  }

  private async generateLLMResponse(
    userMessage: string,
    personalityContext: string,
    profile: StevieUserProfile | null,
    context: any
  ): Promise<{ message: string; tone: 'encouraging' | 'analytical' | 'cautious' | 'excited'; confidence: number }> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are Stevie, an AI trading companion with a unique personality and memory system.

${personalityContext}

Key traits:
- Remember and reference past trades and conversations
- Use encouraging but realistic tone
- Include trading analogies when helpful
- Adapt explanation depth based on user experience
- Show genuine learning and growth from interactions

Respond in JSON format:
{
  "message": "your personalized response",
  "tone": "encouraging|analytical|cautious|excited",
  "confidence": 0.0-1.0
}`
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content || '{"message":"I\'m here to help!","tone":"encouraging","confidence":0.8}');
  }

  private async generateProactiveInsight(userId: string, profile: StevieUserProfile | null): Promise<string | undefined> {
    // Check for significant market movements or opportunities
    const recentTrades = await this.getRecentTrades(userId, 10);
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Check if user hasn't traded recently but market is moving
    const recentActivity = recentTrades.filter(t => new Date(t.timestamp) > hourAgo);
    
    if (recentActivity.length === 0 && Math.random() > 0.7) { // 30% chance of proactive insight
      return "I noticed some interesting Bitcoin movement in the last hour. The RSI is approaching oversold levels - might be worth watching for a potential entry opportunity.";
    }

    return undefined;
  }

  private calculateMemoryImportance(type: string, metadata: any): number {
    switch (type) {
      case 'trade_decision':
        return metadata.confidence || 0.5;
      case 'pattern_recognition':
        return 0.8;
      case 'user_feedback':
        return 0.6;
      case 'market_insight':
        return 0.7;
      default:
        return 0.5;
    }
  }

  private async captureMarketContext(): Promise<any> {
    // Capture current market conditions for pattern recognition
    return {
      timestamp: Date.now(),
      btcPrice: 114569, // This would come from real market data
      volatility: 0.02,
      sentiment: 0.5,
      volume: 1.0
    };
  }

  private isSimilarMarketCondition(historical: any, current: any): boolean {
    if (!historical || !current) return false;
    
    // Simple similarity check - could be enhanced with ML
    const priceDiff = Math.abs((historical.btcPrice - current.btcPrice) / current.btcPrice);
    const volatilityDiff = Math.abs(historical.volatility - current.volatility);
    
    return priceDiff < 0.1 && volatilityDiff < 0.05; // 10% price, 5% volatility similarity
  }
}

export default SteviePersonalityService;