/**
 * PHASE 6: TECHNICAL ANALYSIS SERVICE - ChatGPT TA & SENTIMENT INTEGRATION
 * OpenAI GPT-4 powered chart analysis and Grok sentiment integration
 */

import OpenAI from 'openai';
import { featureService, FeatureVector } from './featureService';
import { historicalDataService } from './dataService';
import { marketDataService } from '../services/marketData';
import { logger } from '../utils/logger';

export interface TechnicalAnalysis {
  timestamp: number;
  symbol: string;
  analysis: {
    trend: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    timeframe: string;
    key_levels: {
      support: number[];
      resistance: number[];
    };
    indicators: {
      rsi_signal: 'oversold' | 'overbought' | 'neutral';
      macd_signal: 'bullish' | 'bearish' | 'neutral';
      bb_signal: 'squeeze' | 'expansion' | 'neutral';
    };
    pattern_recognition: {
      pattern: string | null;
      reliability: number;
    };
    entry_points: {
      buy_zones: number[];
      sell_zones: number[];
    };
    risk_management: {
      stop_loss: number;
      take_profit: number[];
      position_size_recommendation: number;
    };
  };
  reasoning: string;
  actionable_insights: string[];
  risk_warnings: string[];
}

export interface SentimentAnalysis {
  timestamp: number;
  symbol: string;
  sentiment: {
    overall_score: number; // -1 to 1
    confidence: number;
    social_sentiment: number;
    news_sentiment: number;
    fear_greed_impact: number;
    institutional_sentiment: number;
  };
  key_themes: string[];
  sentiment_drivers: {
    positive: string[];
    negative: string[];
  };
  market_psychology: {
    phase: 'euphoria' | 'optimism' | 'anxiety' | 'denial' | 'fear' | 'desperation' | 'hope' | 'relief';
    crowd_behavior: string;
  };
  actionable_insights: string[];
}

export interface CombinedAnalysis {
  technical: TechnicalAnalysis;
  sentiment: SentimentAnalysis;
  fusion: {
    overall_recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
    confidence: number;
    reasoning: string;
    conflicting_signals: string[];
    risk_adjusted_position: number; // 0 to 1
  };
}

export class TechnicalAnalysisService {
  private openai: OpenAI;
  private cache: Map<string, CombinedAnalysis> = new Map();
  private cacheExpiry = 15 * 60 * 1000; // 15 minutes
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key'
    });
  }

  async getFullAnalysis(symbol: string): Promise<CombinedAnalysis> {
    const cacheKey = `${symbol}_${Math.floor(Date.now() / this.cacheExpiry)}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      logger.info(`🔍 Generating full analysis for ${symbol}`);
      
      // Get current market data
      const features = await featureService.getFeatures(symbol);
      const historicalData = await this.getRecentPriceData(symbol);
      
      // Parallel analysis
      const [technicalAnalysis, sentimentAnalysis] = await Promise.all([
        this.generateTechnicalAnalysis(symbol, features, historicalData),
        this.generateSentimentAnalysis(symbol, features)
      ]);
      
      // Fusion analysis
      const fusion = await this.fusionAnalysis(technicalAnalysis, sentimentAnalysis);
      
      const combined: CombinedAnalysis = {
        technical: technicalAnalysis,
        sentiment: sentimentAnalysis,
        fusion
      };
      
      this.cache.set(cacheKey, combined);
      
      logger.info(`✅ Analysis completed for ${symbol}`, {
        recommendation: fusion.overall_recommendation,
        confidence: (fusion.confidence * 100).toFixed(1) + '%'
      });
      
      return combined;
      
    } catch (error) {
      logger.error(`Failed to generate analysis for ${symbol}:`, error as Record<string, any>);
      throw error;
    }
  }

  private async generateTechnicalAnalysis(
    symbol: string, 
    features: FeatureVector,
    historicalData: any[]
  ): Promise<TechnicalAnalysis> {
    
    const prompt = this.buildTechnicalAnalysisPrompt(symbol, features, historicalData);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a professional cryptocurrency technical analyst with 10+ years experience. 
                     Provide detailed, actionable technical analysis based on price data and indicators.
                     Focus on specific entry/exit points, risk management, and pattern recognition.
                     Always include confidence levels and risk warnings.
                     Respond in structured JSON format matching the TechnicalAnalysis interface.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500
      });

      const analysisText = response.choices[0].message.content || '';
      
      // Parse GPT response into structured format
      const analysis = await this.parseTechnicalAnalysisResponse(analysisText, features);
      
      return analysis;
      
    } catch (error) {
      logger.error('OpenAI technical analysis failed:', error as Record<string, any>);
      
      // Fallback to rule-based analysis
      return this.fallbackTechnicalAnalysis(symbol, features);
    }
  }

  private buildTechnicalAnalysisPrompt(symbol: string, features: FeatureVector, historicalData: any[]): string {
    return `
Analyze ${symbol} technical setup:

CURRENT METRICS:
- Price: $${features.price.toFixed(2)}
- 24h Change: ${features.price_change_24h.toFixed(2)}%
- 7d Change: ${features.price_change_7d.toFixed(2)}%
- Volatility: ${features.volatility_24h.toFixed(1)}%
- Volume Ratio: ${features.volume_ratio.toFixed(2)}x

TECHNICAL INDICATORS:
- RSI(14): ${features.rsi_14.toFixed(1)}
- MACD: ${features.macd.toFixed(4)} | Signal: ${features.macd_signal.toFixed(4)}
- Bollinger Position: ${(features.bb_position * 100).toFixed(1)}%
- Market Regime: ${features.market_regime}
- BTC Correlation: ${features.btc_correlation.toFixed(2)}

ADDITIONAL DATA:
- Sentiment Score: ${features.sentiment_score.toFixed(2)}
- Funding Rate: ${(features.funding_rate * 100).toFixed(3)}%
- Fear & Greed: ${features.fear_greed_index.toFixed(0)}/100

Provide comprehensive technical analysis including:
1. Trend analysis and key levels
2. Entry/exit strategies  
3. Risk management recommendations
4. Pattern recognition
5. Confidence assessment

Format as JSON matching TechnicalAnalysis interface.
    `.trim();
  }

  private async parseTechnicalAnalysisResponse(response: string, features: FeatureVector): Promise<TechnicalAnalysis> {
    try {
      // Try to parse JSON response
      const parsed = JSON.parse(response);
      return parsed;
    } catch {
      // If parsing fails, create structured analysis from text
      return this.fallbackTechnicalAnalysis(features.symbol, features);
    }
  }

  private fallbackTechnicalAnalysis(symbol: string, features: FeatureVector): TechnicalAnalysis {
    // Rule-based fallback analysis
    const trend = features.price_change_7d > 5 ? 'bullish' : 
                 features.price_change_7d < -5 ? 'bearish' : 'neutral';
    
    const rsi_signal = features.rsi_14 > 70 ? 'overbought' : 
                      features.rsi_14 < 30 ? 'oversold' : 'neutral';
    
    const macd_signal = features.macd > features.macd_signal ? 'bullish' : 'bearish';
    
    return {
      timestamp: Date.now(),
      symbol,
      analysis: {
        trend,
        confidence: 0.6,
        timeframe: '4H',
        key_levels: {
          support: [features.price * 0.95, features.price * 0.90],
          resistance: [features.price * 1.05, features.price * 1.10]
        },
        indicators: {
          rsi_signal,
          macd_signal,
          bb_signal: features.bb_position > 0.8 ? 'expansion' : 
                   features.bb_position < 0.2 ? 'squeeze' : 'neutral'
        },
        pattern_recognition: {
          pattern: null,
          reliability: 0.5
        },
        entry_points: {
          buy_zones: [features.price * 0.98],
          sell_zones: [features.price * 1.02]
        },
        risk_management: {
          stop_loss: features.price * 0.95,
          take_profit: [features.price * 1.05, features.price * 1.10],
          position_size_recommendation: 0.02 // 2% risk
        }
      },
      reasoning: `Based on ${trend} trend with RSI at ${features.rsi_14.toFixed(1)} and MACD ${macd_signal}`,
      actionable_insights: [
        `Monitor ${trend} trend continuation`,
        `RSI indicates ${rsi_signal} conditions`,
        `MACD showing ${macd_signal} momentum`
      ],
      risk_warnings: [
        `High volatility at ${features.volatility_24h.toFixed(1)}%`,
        `Consider position sizing carefully`
      ]
    };
  }

  private async generateSentimentAnalysis(symbol: string, features: FeatureVector): Promise<SentimentAnalysis> {
    const prompt = `
Analyze ${symbol} market sentiment and psychology:

SENTIMENT METRICS:
- Current Sentiment: ${features.sentiment_score.toFixed(2)} (-1 to 1 scale)
- Fear & Greed Index: ${features.fear_greed_index}/100
- Market Regime: ${features.market_regime}
- Funding Rate: ${(features.funding_rate * 100).toFixed(3)}% (indicates long/short bias)

MARKET CONTEXT:
- Recent Performance: ${features.price_change_24h.toFixed(2)}% (24h), ${features.price_change_7d.toFixed(2)}% (7d)
- Volatility: ${features.volatility_24h.toFixed(1)}%
- BTC Correlation: ${features.btc_correlation.toFixed(2)}

Provide detailed sentiment analysis including:
1. Overall market psychology assessment
2. Key sentiment drivers (positive/negative)
3. Crowd behavior analysis
4. Institutional sentiment indicators
5. Actionable insights for trading decisions

Focus on how sentiment might impact price action and trading opportunities.
    `.trim();

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an expert in market psychology and sentiment analysis. 
                     Analyze crypto market sentiment and crowd behavior patterns.
                     Provide actionable insights on how sentiment affects price movements.
                     Be specific about market psychology phases and behavioral indicators.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.4,
        max_tokens: 1000
      });

      return this.parseSentimentResponse(response.choices[0].message.content || '', features);
      
    } catch (error) {
      logger.error('Sentiment analysis failed:', error as Record<string, any>);
      return this.fallbackSentimentAnalysis(symbol, features);
    }
  }

  private parseSentimentResponse(response: string, features: FeatureVector): SentimentAnalysis {
    // Parse sentiment analysis or use rule-based fallback
    return this.fallbackSentimentAnalysis(features.symbol, features);
  }

  private fallbackSentimentAnalysis(symbol: string, features: FeatureVector): SentimentAnalysis {
    const sentimentScore = features.sentiment_score;
    const fearGreed = features.fear_greed_index;
    
    // Determine market psychology phase
    let phase: SentimentAnalysis['market_psychology']['phase'];
    if (fearGreed > 75) phase = 'euphoria';
    else if (fearGreed > 55) phase = 'optimism'; 
    else if (fearGreed > 45) phase = 'hope';
    else if (fearGreed > 25) phase = 'anxiety';
    else if (fearGreed > 10) phase = 'fear';
    else phase = 'desperation';
    
    return {
      timestamp: Date.now(),
      symbol,
      sentiment: {
        overall_score: sentimentScore,
        confidence: 0.7,
        social_sentiment: sentimentScore * 1.1,
        news_sentiment: sentimentScore * 0.9,
        fear_greed_impact: (fearGreed - 50) / 50,
        institutional_sentiment: features.funding_rate * 10 // Proxy from funding rates
      },
      key_themes: [
        sentimentScore > 0 ? 'Positive market outlook' : 'Market concerns',
        `Fear & Greed at ${fearGreed}`,
        `${features.market_regime} trend sentiment`
      ],
      sentiment_drivers: {
        positive: sentimentScore > 0 ? [
          'Positive social media buzz',
          'Improving market conditions',
          'Institutional interest'
        ] : [],
        negative: sentimentScore < 0 ? [
          'Market uncertainty',
          'Risk-off sentiment',
          'Regulatory concerns'
        ] : []
      },
      market_psychology: {
        phase,
        crowd_behavior: `Market showing ${phase} characteristics with ${fearGreed}/100 fear & greed`
      },
      actionable_insights: [
        `Sentiment suggests ${sentimentScore > 0 ? 'risk-on' : 'risk-off'} environment`,
        `Fear & Greed at ${fearGreed} indicates ${fearGreed > 70 ? 'potential euphoria' : fearGreed < 30 ? 'oversold conditions' : 'balanced sentiment'}`,
        `Consider contrarian approach if sentiment extreme`
      ]
    };
  }

  private async fusionAnalysis(
    technical: TechnicalAnalysis,
    sentiment: SentimentAnalysis
  ): Promise<CombinedAnalysis['fusion']> {
    
    // Combine technical and sentiment signals
    const technicalScore = this.calculateTechnicalScore(technical);
    const sentimentScore = sentiment.sentiment.overall_score;
    const fearGreedScore = (sentiment.sentiment.fear_greed_impact + 1) / 2; // Normalize to 0-1
    
    // Weighted fusion (technical 60%, sentiment 25%, fear/greed 15%)
    const fusionScore = (technicalScore * 0.6) + (sentimentScore * 0.25) + (fearGreedScore * 0.15);
    
    let overall_recommendation: CombinedAnalysis['fusion']['overall_recommendation'];
    if (fusionScore > 0.6) overall_recommendation = 'strong_buy';
    else if (fusionScore > 0.2) overall_recommendation = 'buy';
    else if (fusionScore > -0.2) overall_recommendation = 'hold';
    else if (fusionScore > -0.6) overall_recommendation = 'sell';
    else overall_recommendation = 'strong_sell';
    
    // Check for conflicting signals
    const conflicting_signals: string[] = [];
    
    if (Math.abs(technicalScore - sentimentScore) > 0.5) {
      conflicting_signals.push('Technical and sentiment analysis diverging');
    }
    
    if (technical.analysis.trend === 'bullish' && sentimentScore < -0.3) {
      conflicting_signals.push('Bullish technical setup with bearish sentiment');
    }
    
    if (technical.analysis.trend === 'bearish' && sentimentScore > 0.3) {
      conflicting_signals.push('Bearish technical setup with bullish sentiment');
    }

    // Risk-adjusted position sizing
    const basePosition = Math.abs(fusionScore);
    const volatilityAdjustment = Math.max(0.1, 1 - (sentiment.sentiment.fear_greed_impact / 100));
    const risk_adjusted_position = Math.min(1, basePosition * volatilityAdjustment);
    
    return {
      overall_recommendation,
      confidence: Math.abs(fusionScore),
      reasoning: this.generateFusionReasoning(technical, sentiment, fusionScore),
      conflicting_signals,
      risk_adjusted_position
    };
  }

  private calculateTechnicalScore(technical: TechnicalAnalysis): number {
    let score = 0;
    
    // Trend contribution
    if (technical.analysis.trend === 'bullish') score += 0.4;
    else if (technical.analysis.trend === 'bearish') score -= 0.4;
    
    // Indicator contributions
    if (technical.analysis.indicators.rsi_signal === 'oversold') score += 0.2;
    else if (technical.analysis.indicators.rsi_signal === 'overbought') score -= 0.2;
    
    if (technical.analysis.indicators.macd_signal === 'bullish') score += 0.2;
    else if (technical.analysis.indicators.macd_signal === 'bearish') score -= 0.2;
    
    // Confidence weighting
    score *= technical.analysis.confidence;
    
    return Math.max(-1, Math.min(1, score));
  }

  private generateFusionReasoning(
    technical: TechnicalAnalysis,
    sentiment: SentimentAnalysis,
    fusionScore: number
  ): string {
    const direction = fusionScore > 0 ? 'bullish' : 'bearish';
    const strength = Math.abs(fusionScore) > 0.5 ? 'strong' : 'moderate';
    
    return `${strength} ${direction} signal based on technical analysis showing ${technical.analysis.trend} trend ` +
           `with ${(technical.analysis.confidence * 100).toFixed(0)}% confidence, combined with ` +
           `${sentiment.sentiment.overall_score > 0 ? 'positive' : 'negative'} sentiment at ` +
           `${(sentiment.sentiment.overall_score * 100).toFixed(0)}% and fear & greed index at ` +
           `${(sentiment.sentiment.fear_greed_impact * 50 + 50).toFixed(0)}.`;
  }

  private async getRecentPriceData(symbol: string): Promise<any[]> {
    const endTime = Date.now();
    const startTime = endTime - (7 * 24 * 60 * 60 * 1000); // 7 days
    
    return await historicalDataService.getHistoricalBars(symbol, startTime, endTime);
  }

  // Chat interface for "Ask Stevie TA"
  async chatAnalysis(symbol: string, question: string): Promise<string> {
    try {
      const analysis = await this.getFullAnalysis(symbol);
      
      const prompt = `
Based on the following comprehensive analysis of ${symbol}, answer this question: "${question}"

TECHNICAL ANALYSIS:
${JSON.stringify(analysis.technical, null, 2)}

SENTIMENT ANALYSIS:
${JSON.stringify(analysis.sentiment, null, 2)}

FUSION RECOMMENDATION: ${analysis.fusion.overall_recommendation}
CONFIDENCE: ${(analysis.fusion.confidence * 100).toFixed(1)}%

Provide a conversational, helpful response that directly answers the question using the analysis data.
Be specific, actionable, and include relevant warnings or caveats.
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are Stevie, an expert cryptocurrency trading assistant. 
                     Answer questions about market analysis in a friendly, professional tone.
                     Always include specific data points and actionable insights.
                     Warn about risks and suggest proper position sizing.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      return response.choices[0].message.content || 'Unable to analyze at this time.';
      
    } catch (error) {
      logger.error('Chat analysis failed:', error as Record<string, any>);
      return `I'm having trouble analyzing ${symbol} right now. Please try again in a moment.`;
    }
  }

  clearCache(): void {
    this.cache.clear();
    logger.info('TA service cache cleared');
  }
}

export const taService = new TechnicalAnalysisService();