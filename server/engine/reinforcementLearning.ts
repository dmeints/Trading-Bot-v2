/**
 * Reinforcement Learning Engine
 * 
 * Self-improving trading intelligence that learns from every trade outcome
 * to enhance future decision-making capabilities.
 */

import { logger } from '../utils/logger';
import { storage } from '../storage';
import OpenAI from 'openai';

interface TradeOutcome {
  tradeId: string;
  symbol: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  marketConditions: MarketContext;
  aiRecommendation: string;
  actualOutcome: 'profitable' | 'loss' | 'breakeven';
  confidence: number;
  timeframe: string;
}

interface MarketContext {
  volatility: number;
  trend: 'bullish' | 'bearish' | 'sideways';
  volume: number;
  rsi: number;
  macdSignal: string;
  newssentiment: number;
  socialSentiment: number;
  whaleActivity: boolean;
}

interface LearningPattern {
  id: string;
  contextHash: string;
  successRate: number;
  avgPnl: number;
  sampleSize: number;
  lastUpdated: Date;
  marketConditions: Partial<MarketContext>;
  strategies: string[];
  confidence: number;
}

export class ReinforcementLearningEngine {
  private openai: OpenAI;
  private learningPatterns: Map<string, LearningPattern> = new Map();
  private tradingMemory: TradeOutcome[] = [];
  private learningRate = 0.1;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.initializeLearningSystem();
  }

  /**
   * Initialize the learning system with historical patterns
   */
  private async initializeLearningSystem() {
    try {
      // Load existing learning patterns from storage
      await this.loadHistoricalPatterns();
      
      // Initialize base trading strategies
      await this.initializeBaseStrategies();
      
      logger.info('Reinforcement Learning Engine initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize RL Engine', { error: error.message });
    }
  }

  /**
   * Record trade outcome for learning
   */
  async recordTradeOutcome(outcome: TradeOutcome): Promise<void> {
    try {
      this.tradingMemory.push(outcome);
      
      // Generate context hash for pattern matching
      const contextHash = this.generateContextHash(outcome.marketConditions);
      
      // Update learning patterns
      await this.updateLearningPattern(contextHash, outcome);
      
      // Perform cross-synergy analysis
      await this.performCrossSynergyAnalysis(outcome);
      
      // Store in persistent memory
      await this.persistLearningData(outcome);
      
      logger.info('Trade outcome recorded for learning', {
        tradeId: outcome.tradeId,
        pnl: outcome.pnl,
        contextHash
      });
    } catch (error) {
      logger.error('Failed to record trade outcome', { error: error.message });
    }
  }

  /**
   * Get AI-enhanced trading recommendation based on learned patterns
   */
  async getEnhancedRecommendation(
    symbol: string, 
    currentMarketContext: MarketContext
  ): Promise<{
    action: 'buy' | 'sell' | 'hold';
    confidence: number;
    reasoning: string;
    riskLevel: 'low' | 'medium' | 'high';
    suggestedPositionSize: number;
    stopLoss: number;
    takeProfit: number;
    learningInsights: string[];
  }> {
    try {
      const contextHash = this.generateContextHash(currentMarketContext);
      const matchingPattern = this.learningPatterns.get(contextHash);
      
      // Generate base AI recommendation
      const baseRecommendation = await this.generateBaseRecommendation(
        symbol, 
        currentMarketContext
      );
      
      // Apply learning enhancement
      const learningBonus = matchingPattern ? 
        this.calculateLearningBonus(matchingPattern) : 0;
      
      // Cross-synergy analysis
      const crossSynergyInsights = await this.analyzeCrossSynergies(
        symbol, 
        currentMarketContext
      );
      
      // Generate final enhanced recommendation
      const enhancedConfidence = Math.min(
        baseRecommendation.confidence + learningBonus, 
        0.95
      );
      
      return {
        action: baseRecommendation.action,
        confidence: enhancedConfidence,
        reasoning: baseRecommendation.reasoning + 
          (matchingPattern ? ` Enhanced by ${matchingPattern.sampleSize} similar patterns` : ''),
        riskLevel: this.calculateRiskLevel(currentMarketContext, enhancedConfidence),
        suggestedPositionSize: this.calculatePositionSize(enhancedConfidence),
        stopLoss: baseRecommendation.stopLoss,
        takeProfit: baseRecommendation.takeProfit,
        learningInsights: crossSynergyInsights
      };
    } catch (error) {
      logger.error('Failed to generate enhanced recommendation', { error: error.message });
      throw error;
    }
  }

  /**
   * Analyze cross-synergies across different market aspects
   */
  private async analyzeCrossSynergies(
    symbol: string, 
    context: MarketContext
  ): Promise<string[]> {
    const insights: string[] = [];
    
    try {
      // Technical-Fundamental Synergy
      if (context.rsi < 30 && context.newssentiment > 0.6) {
        insights.push('Technical oversold + positive news sentiment = Strong reversal potential');
      }
      
      // Social-Whale Activity Synergy
      if (context.socialSentiment > 0.7 && context.whaleActivity) {
        insights.push('High social sentiment + whale activity = Momentum acceleration likely');
      }
      
      // Volume-Volatility Synergy
      if (context.volume > 1.5 && context.volatility > 0.8) {
        insights.push('High volume + high volatility = Breakout confirmation strong');
      }
      
      // Pattern Recognition Synergy
      const similarPatterns = this.findSimilarHistoricalPatterns(context);
      if (similarPatterns.length > 0) {
        const avgSuccess = similarPatterns.reduce((sum, p) => sum + p.successRate, 0) / similarPatterns.length;
        insights.push(`Historical pattern match: ${avgSuccess.toFixed(1)}% success rate in similar conditions`);
      }
      
      // Multi-timeframe Synergy
      const timeframeSynergy = await this.analyzeTimeframeSynergy(symbol, context);
      insights.push(timeframeSynergy);
      
      return insights;
    } catch (error) {
      logger.error('Failed to analyze cross-synergies', { error: error.message });
      return ['Cross-synergy analysis temporarily unavailable'];
    }
  }

  /**
   * Perform comprehensive cross-synergy analysis
   */
  private async performCrossSynergyAnalysis(outcome: TradeOutcome): Promise<void> {
    try {
      // Analyze what combinations led to success
      const synergiesAnalysis = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "system",
          content: "You are a trading pattern analyst. Identify the key synergies between different market factors that led to this trade outcome."
        }, {
          role: "user",
          content: `
          Trade Outcome: ${outcome.actualOutcome}
          P&L: ${outcome.pnl}
          Market Context: ${JSON.stringify(outcome.marketConditions)}
          AI Recommendation: ${outcome.aiRecommendation}
          
          Identify the key synergies and patterns that contributed to this outcome.
          `
        }],
        response_format: { type: "json_object" }
      });
      
      const analysis = JSON.parse(synergiesAnalysis.choices[0].message.content);
      
      // Store synergy patterns
      await this.storeSynergyPattern(outcome.symbol, analysis);
      
    } catch (error) {
      logger.error('Cross-synergy analysis failed', { error: error.message });
    }
  }

  /**
   * Generate context hash for pattern matching
   */
  private generateContextHash(context: MarketContext): string {
    const factors = [
      Math.round(context.volatility * 10),
      context.trend,
      Math.round(context.rsi / 10),
      context.macdSignal,
      Math.round(context.newssentiment * 10),
      Math.round(context.socialSentiment * 10),
      context.whaleActivity ? 1 : 0
    ];
    
    return factors.join('-');
  }

  /**
   * Update learning pattern based on trade outcome
   */
  private async updateLearningPattern(
    contextHash: string, 
    outcome: TradeOutcome
  ): Promise<void> {
    const existing = this.learningPatterns.get(contextHash);
    
    if (existing) {
      // Update existing pattern
      const newSampleSize = existing.sampleSize + 1;
      const isSuccess = outcome.actualOutcome === 'profitable';
      const newSuccessCount = existing.successRate * existing.sampleSize + (isSuccess ? 1 : 0);
      
      existing.successRate = newSuccessCount / newSampleSize;
      existing.avgPnl = (existing.avgPnl * existing.sampleSize + outcome.pnl) / newSampleSize;
      existing.sampleSize = newSampleSize;
      existing.lastUpdated = new Date();
      existing.confidence = Math.min(existing.confidence + this.learningRate, 0.95);
    } else {
      // Create new pattern
      this.learningPatterns.set(contextHash, {
        id: `pattern-${contextHash}-${Date.now()}`,
        contextHash,
        successRate: outcome.actualOutcome === 'profitable' ? 1 : 0,
        avgPnl: outcome.pnl,
        sampleSize: 1,
        lastUpdated: new Date(),
        marketConditions: outcome.marketConditions,
        strategies: [outcome.aiRecommendation],
        confidence: 0.1
      });
    }
  }

  /**
   * Calculate learning bonus based on historical pattern performance
   */
  private calculateLearningBonus(pattern: LearningPattern): number {
    if (pattern.sampleSize < 5) return 0;
    
    const baseBonus = pattern.successRate > 0.7 ? 0.2 : 
                     pattern.successRate > 0.5 ? 0.1 : -0.1;
    
    const confidenceMultiplier = pattern.confidence;
    const sampleSizeMultiplier = Math.min(pattern.sampleSize / 50, 1);
    
    return baseBonus * confidenceMultiplier * sampleSizeMultiplier;
  }

  /**
   * Find similar historical patterns
   */
  private findSimilarHistoricalPatterns(context: MarketContext): LearningPattern[] {
    return Array.from(this.learningPatterns.values()).filter(pattern => {
      if (!pattern.marketConditions) return false;
      
      const similarity = this.calculateContextSimilarity(
        context, 
        pattern.marketConditions as MarketContext
      );
      
      return similarity > 0.8 && pattern.sampleSize >= 3;
    });
  }

  /**
   * Calculate similarity between market contexts
   */
  private calculateContextSimilarity(
    context1: MarketContext, 
    context2: MarketContext
  ): number {
    let matches = 0;
    let total = 0;
    
    // Trend similarity
    total++;
    if (context1.trend === context2.trend) matches++;
    
    // RSI similarity (within 20 points)
    total++;
    if (Math.abs(context1.rsi - context2.rsi) <= 20) matches++;
    
    // Volatility similarity
    total++;
    if (Math.abs(context1.volatility - context2.volatility) <= 0.3) matches++;
    
    // Sentiment similarity
    total++;
    if (Math.abs(context1.newssentiment - context2.newssentiment) <= 0.3) matches++;
    
    return matches / total;
  }

  /**
   * Analyze multi-timeframe synergies
   */
  private async analyzeTimeframeSynergy(
    symbol: string, 
    context: MarketContext
  ): Promise<string> {
    // This would integrate with actual market data
    // For now, provide intelligent analysis based on context
    
    if (context.trend === 'bullish' && context.rsi < 70) {
      return 'Multi-timeframe alignment: Short-term pullback in strong uptrend = Buy opportunity';
    } else if (context.trend === 'bearish' && context.rsi > 30) {
      return 'Multi-timeframe alignment: Short-term rally in downtrend = Sell opportunity';
    }
    
    return 'Multi-timeframe analysis: Mixed signals, wait for clearer directional bias';
  }

  /**
   * Generate base AI recommendation using advanced prompting
   */
  private async generateBaseRecommendation(
    symbol: string, 
    context: MarketContext
  ): Promise<{
    action: 'buy' | 'sell' | 'hold';
    confidence: number;
    reasoning: string;
    stopLoss: number;
    takeProfit: number;
  }> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "system",
          content: `You are an expert trading AI with access to comprehensive market analysis. 
          Provide specific trading recommendations based on technical, fundamental, and sentiment data.`
        }, {
          role: "user",
          content: `
          Symbol: ${symbol}
          Market Context: ${JSON.stringify(context)}
          
          Provide a trading recommendation with specific entry/exit levels and reasoning.
          Response must be in JSON format with fields: action, confidence, reasoning, stopLoss, takeProfit.
          `
        }],
        response_format: { type: "json_object" }
      });
      
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error('Failed to generate base recommendation', { error: error.message });
      // Fallback recommendation
      return {
        action: 'hold',
        confidence: 0.3,
        reasoning: 'AI recommendation temporarily unavailable',
        stopLoss: 0.95,
        takeProfit: 1.05
      };
    }
  }

  /**
   * Calculate risk level based on market conditions and confidence
   */
  private calculateRiskLevel(
    context: MarketContext, 
    confidence: number
  ): 'low' | 'medium' | 'high' {
    const volatilityRisk = context.volatility > 0.8 ? 2 : context.volatility > 0.5 ? 1 : 0;
    const confidenceRisk = confidence < 0.6 ? 2 : confidence < 0.8 ? 1 : 0;
    const trendRisk = context.trend === 'sideways' ? 1 : 0;
    
    const totalRisk = volatilityRisk + confidenceRisk + trendRisk;
    
    if (totalRisk >= 4) return 'high';
    if (totalRisk >= 2) return 'medium';
    return 'low';
  }

  /**
   * Calculate position size based on confidence
   */
  private calculatePositionSize(confidence: number): number {
    // Kelly Criterion inspired sizing
    const baseSize = 0.02; // 2% base position
    const confidenceMultiplier = confidence > 0.8 ? 2 : confidence > 0.6 ? 1.5 : 1;
    
    return Math.min(baseSize * confidenceMultiplier, 0.05); // Max 5% position
  }

  // Additional helper methods...
  private async loadHistoricalPatterns(): Promise<void> {
    // Load from database or file system
  }

  private async initializeBaseStrategies(): Promise<void> {
    // Initialize with proven trading strategies
  }

  private async persistLearningData(outcome: TradeOutcome): Promise<void> {
    // Store in database for persistence
  }

  private async storeSynergyPattern(symbol: string, analysis: any): Promise<void> {
    // Store cross-synergy insights
  }
}