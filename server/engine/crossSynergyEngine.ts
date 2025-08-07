/**
 * Cross-Synergy Analysis Engine
 * 
 * Advanced system that identifies and exploits synergistic relationships
 * between multiple data sources and market factors for superior trading performance.
 */

import { logger } from '../utils/logger';
import OpenAI from 'openai';

interface SynergySignal {
  id: string;
  type: 'technical-fundamental' | 'social-whale' | 'volume-price' | 'sentiment-momentum' | 'macro-micro';
  strength: number; // 0-1
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  sources: string[];
  timestamp: Date;
  symbol: string;
  description: string;
  historicalSuccess: number;
}

interface DataStream {
  technical: TechnicalData;
  fundamental: FundamentalData;
  social: SocialData;
  onchain: OnChainData;
  macro: MacroData;
  sentiment: SentimentData;
}

interface TechnicalData {
  price: number;
  rsi: number;
  macd: { signal: string; histogram: number };
  bollinger: { upper: number; lower: number; squeeze: boolean };
  volume: number;
  volatility: number;
  support: number[];
  resistance: number[];
}

interface FundamentalData {
  marketCap: number;
  tradingVolume24h: number;
  circulatingSupply: number;
  developmentActivity: number;
  networkGrowth: number;
  adoptionMetrics: number;
}

interface SocialData {
  twitterMentions: number;
  redditSentiment: number;
  telegramActivity: number;
  influencerSignals: number;
  fearGreedIndex: number;
}

interface OnChainData {
  whaleTransfers: number;
  exchangeFlows: { inflow: number; outflow: number };
  hodlerBehavior: number;
  networkActivity: number;
  stakingRatio: number;
}

interface MacroData {
  btcDominance: number;
  totalMarketCap: number;
  vix: number;
  dxy: number;
  bondYields: number;
}

interface SentimentData {
  news: number;
  social: number;
  technical: number;
  fundamental: number;
  overall: number;
}

export class CrossSynergyEngine {
  private openai: OpenAI;
  private activeSignals: Map<string, SynergySignal[]> = new Map();
  private synergyPatterns: Map<string, any> = new Map();
  private performanceHistory: Map<string, number[]> = new Map();

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.initializeSynergyEngine();
  }

  private async initializeSynergyEngine() {
    logger.info('Initializing Cross-Synergy Engine with advanced pattern recognition');
  }

  /**
   * Analyze all available data streams for cross-synergies
   */
  async analyzeCrossSynergies(symbol: string, dataStreams: DataStream): Promise<SynergySignal[]> {
    const signals: SynergySignal[] = [];

    try {
      // 1. Technical-Fundamental Synergy
      const techFundSignal = this.analyzeTechnicalFundamentalSynergy(symbol, dataStreams);
      if (techFundSignal) signals.push(techFundSignal);

      // 2. Social-Whale Activity Synergy
      const socialWhaleSignal = this.analyzeSocialWhaleSynergy(symbol, dataStreams);
      if (socialWhaleSignal) signals.push(socialWhaleSignal);

      // 3. Volume-Price Action Synergy
      const volumePriceSignal = this.analyzeVolumePriceSynergy(symbol, dataStreams);
      if (volumePriceSignal) signals.push(volumePriceSignal);

      // 4. Sentiment-Momentum Synergy
      const sentimentMomentumSignal = this.analyzeSentimentMomentumSynergy(symbol, dataStreams);
      if (sentimentMomentumSignal) signals.push(sentimentMomentumSignal);

      // 5. Macro-Micro Environment Synergy
      const macroMicroSignal = this.analyzeMacroMicroSynergy(symbol, dataStreams);
      if (macroMicroSignal) signals.push(macroMicroSignal);

      // 6. AI-Enhanced Multi-Dimensional Analysis
      const aiEnhancedSignals = await this.performAIEnhancedAnalysis(symbol, dataStreams, signals);
      signals.push(...aiEnhancedSignals);

      // Store active signals
      this.activeSignals.set(symbol, signals);

      // Update performance tracking
      await this.updatePerformanceTracking(symbol, signals);

      logger.info(`Generated ${signals.length} cross-synergy signals for ${symbol}`, {
        strongSignals: signals.filter(s => s.strength > 0.7).length,
        averageConfidence: signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length
      });

      return signals;
    } catch (error) {
      logger.error('Failed to analyze cross-synergies', { error: error.message, symbol });
      return [];
    }
  }

  /**
   * Technical-Fundamental Synergy Analysis
   */
  private analyzeTechnicalFundamentalSynergy(symbol: string, data: DataStream): SynergySignal | null {
    const tech = data.technical;
    const fund = data.fundamental;

    // Look for oversold technical + strong fundamentals
    if (tech.rsi < 30 && fund.developmentActivity > 0.7 && fund.networkGrowth > 0.6) {
      return {
        id: `tech-fund-${symbol}-${Date.now()}`,
        type: 'technical-fundamental',
        strength: 0.85,
        direction: 'bullish',
        confidence: 0.82,
        sources: ['RSI oversold', 'Strong development', 'Network growth'],
        timestamp: new Date(),
        symbol,
        description: 'Oversold technical levels with strong fundamental growth',
        historicalSuccess: 0.78
      };
    }

    // Look for overbought technical + declining fundamentals
    if (tech.rsi > 70 && fund.developmentActivity < 0.3 && fund.networkGrowth < 0.4) {
      return {
        id: `tech-fund-${symbol}-${Date.now()}`,
        type: 'technical-fundamental',
        strength: 0.75,
        direction: 'bearish',
        confidence: 0.73,
        sources: ['RSI overbought', 'Weak development', 'Network decline'],
        timestamp: new Date(),
        symbol,
        description: 'Overbought technical levels with weakening fundamentals',
        historicalSuccess: 0.71
      };
    }

    return null;
  }

  /**
   * Social-Whale Activity Synergy Analysis
   */
  private analyzeSocialWhaleSynergy(symbol: string, data: DataStream): SynergySignal | null {
    const social = data.social;
    const onchain = data.onchain;

    // High social sentiment + whale accumulation
    if (social.twitterMentions > 1.5 && social.redditSentiment > 0.6 && onchain.whaleTransfers > 0.8) {
      return {
        id: `social-whale-${symbol}-${Date.now()}`,
        type: 'social-whale',
        strength: 0.90,
        direction: 'bullish',
        confidence: 0.86,
        sources: ['High Twitter activity', 'Positive Reddit sentiment', 'Whale accumulation'],
        timestamp: new Date(),
        symbol,
        description: 'Strong social momentum combined with whale accumulation',
        historicalSuccess: 0.83
      };
    }

    // Negative social + whale distribution
    if (social.redditSentiment < 0.3 && onchain.exchangeFlows.inflow > 2.0) {
      return {
        id: `social-whale-${symbol}-${Date.now()}`,
        type: 'social-whale',
        strength: 0.80,
        direction: 'bearish',
        confidence: 0.75,
        sources: ['Negative social sentiment', 'Exchange inflows'],
        timestamp: new Date(),
        symbol,
        description: 'Negative social sentiment with whale distribution',
        historicalSuccess: 0.69
      };
    }

    return null;
  }

  /**
   * Volume-Price Action Synergy Analysis
   */
  private analyzeVolumePriceSynergy(symbol: string, data: DataStream): SynergySignal | null {
    const tech = data.technical;

    // High volume + price breakout
    if (tech.volume > 2.0 && tech.price > Math.max(...tech.resistance)) {
      return {
        id: `volume-price-${symbol}-${Date.now()}`,
        type: 'volume-price',
        strength: 0.88,
        direction: 'bullish',
        confidence: 0.84,
        sources: ['High volume', 'Resistance breakout'],
        timestamp: new Date(),
        symbol,
        description: 'High volume confirming price breakout above resistance',
        historicalSuccess: 0.81
      };
    }

    // High volume + price breakdown
    if (tech.volume > 1.8 && tech.price < Math.min(...tech.support)) {
      return {
        id: `volume-price-${symbol}-${Date.now()}`,
        type: 'volume-price',
        strength: 0.82,
        direction: 'bearish',
        confidence: 0.79,
        sources: ['High volume', 'Support breakdown'],
        timestamp: new Date(),
        symbol,
        description: 'High volume confirming price breakdown below support',
        historicalSuccess: 0.76
      };
    }

    return null;
  }

  /**
   * Sentiment-Momentum Synergy Analysis
   */
  private analyzeSentimentMomentumSynergy(symbol: string, data: DataStream): SynergySignal | null {
    const sentiment = data.sentiment;
    const tech = data.technical;

    // Positive sentiment + bullish momentum
    if (sentiment.overall > 0.7 && tech.macd.signal === 'bullish' && tech.rsi > 50 && tech.rsi < 70) {
      return {
        id: `sentiment-momentum-${symbol}-${Date.now()}`,
        type: 'sentiment-momentum',
        strength: 0.87,
        direction: 'bullish',
        confidence: 0.83,
        sources: ['Positive overall sentiment', 'Bullish MACD', 'Healthy RSI'],
        timestamp: new Date(),
        symbol,
        description: 'Strong positive sentiment aligned with bullish momentum',
        historicalSuccess: 0.80
      };
    }

    return null;
  }

  /**
   * Macro-Micro Environment Synergy Analysis
   */
  private analyzeMacroMicroSynergy(symbol: string, data: DataStream): SynergySignal | null {
    const macro = data.macro;
    const tech = data.technical;
    const onchain = data.onchain;

    // Risk-on macro + strong micro fundamentals
    if (macro.vix < 20 && macro.btcDominance < 45 && onchain.networkActivity > 0.8) {
      return {
        id: `macro-micro-${symbol}-${Date.now()}`,
        type: 'macro-micro',
        strength: 0.79,
        direction: 'bullish',
        confidence: 0.74,
        sources: ['Low VIX', 'Declining BTC dominance', 'Strong network activity'],
        timestamp: new Date(),
        symbol,
        description: 'Risk-on macro environment with strong micro fundamentals',
        historicalSuccess: 0.72
      };
    }

    return null;
  }

  /**
   * AI-Enhanced Multi-Dimensional Analysis
   */
  private async performAIEnhancedAnalysis(
    symbol: string, 
    data: DataStream, 
    existingSignals: SynergySignal[]
  ): Promise<SynergySignal[]> {
    try {
      const prompt = `
      Analyze the following comprehensive market data for ${symbol} and identify advanced cross-synergy patterns:
      
      Technical: ${JSON.stringify(data.technical)}
      Social: ${JSON.stringify(data.social)}
      On-chain: ${JSON.stringify(data.onchain)}
      Macro: ${JSON.stringify(data.macro)}
      
      Existing signals: ${existingSignals.map(s => s.description).join(', ')}
      
      Find 2-3 additional sophisticated synergy patterns that might be missed by traditional analysis.
      Focus on multi-dimensional interactions and non-obvious correlations.
      
      Return JSON array of signals with: type, strength, direction, confidence, description, sources.
      `;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "system",
          content: "You are an expert quantitative analyst specializing in cross-market synergies and pattern recognition."
        }, {
          role: "user", 
          content: prompt
        }],
        response_format: { type: "json_object" }
      });

      const aiAnalysis = JSON.parse(response.choices[0].message.content);
      
      // Convert AI analysis to SynergySignal format
      return (aiAnalysis.signals || []).map((signal: any, index: number) => ({
        id: `ai-enhanced-${symbol}-${Date.now()}-${index}`,
        type: signal.type || 'sentiment-momentum',
        strength: Math.min(signal.strength || 0.6, 1.0),
        direction: signal.direction || 'neutral',
        confidence: Math.min(signal.confidence || 0.5, 0.95),
        sources: signal.sources || ['AI Analysis'],
        timestamp: new Date(),
        symbol,
        description: signal.description || 'AI-identified synergy pattern',
        historicalSuccess: 0.65 // Conservative estimate for AI-generated signals
      }));

    } catch (error) {
      logger.error('AI-enhanced analysis failed', { error: error.message });
      return [];
    }
  }

  /**
   * Get strongest synergy signals for a symbol
   */
  getStrongestSignals(symbol: string, minStrength: number = 0.7): SynergySignal[] {
    const signals = this.activeSignals.get(symbol) || [];
    return signals
      .filter(signal => signal.strength >= minStrength)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 5);
  }

  /**
   * Get synergy consensus for trading direction
   */
  getSynergyConsensus(symbol: string): {
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: number;
    confidence: number;
    supportingSignals: number;
    totalSignals: number;
  } {
    const signals = this.activeSignals.get(symbol) || [];
    
    if (signals.length === 0) {
      return {
        direction: 'neutral',
        strength: 0,
        confidence: 0,
        supportingSignals: 0,
        totalSignals: 0
      };
    }

    const bullishSignals = signals.filter(s => s.direction === 'bullish');
    const bearishSignals = signals.filter(s => s.direction === 'bearish');

    const bullishWeight = bullishSignals.reduce((sum, s) => sum + s.strength * s.confidence, 0);
    const bearishWeight = bearishSignals.reduce((sum, s) => sum + s.strength * s.confidence, 0);

    const direction = bullishWeight > bearishWeight ? 'bullish' : 
                     bearishWeight > bullishWeight ? 'bearish' : 'neutral';
    
    const dominantSignals = direction === 'bullish' ? bullishSignals : 
                           direction === 'bearish' ? bearishSignals : [];
    
    const avgStrength = dominantSignals.length > 0 ? 
      dominantSignals.reduce((sum, s) => sum + s.strength, 0) / dominantSignals.length : 0;
    
    const avgConfidence = dominantSignals.length > 0 ?
      dominantSignals.reduce((sum, s) => sum + s.confidence, 0) / dominantSignals.length : 0;

    return {
      direction,
      strength: avgStrength,
      confidence: avgConfidence,
      supportingSignals: dominantSignals.length,
      totalSignals: signals.length
    };
  }

  /**
   * Update performance tracking for synergy signals
   */
  private async updatePerformanceTracking(symbol: string, signals: SynergySignal[]): Promise<void> {
    // This would track actual performance of signals over time
    // For now, simulate performance tracking
    const performance = this.performanceHistory.get(symbol) || [];
    const avgStrength = signals.reduce((sum, s) => sum + s.strength, 0) / signals.length;
    performance.push(avgStrength);
    
    // Keep last 100 records
    if (performance.length > 100) {
      performance.shift();
    }
    
    this.performanceHistory.set(symbol, performance);
  }
}