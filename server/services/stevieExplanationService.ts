/**
 * Stevie v1.4 - Enhanced LLM Explanation Service
 * Provides detailed, contextual explanations for all trading decisions
 */

import OpenAI from 'openai';
import { featureService } from './featureService';
import VectorService from './vectorService';

interface TradeExplanation {
  decision: {
    action: 'buy' | 'sell' | 'hold';
    confidence: number;
    positionSize: number;
    reasoning: string[];
  };
  dataAnalysis: {
    technicalSignals: any;
    sentimentFactors: any;
    derivativesInsight: any;
    riskAssessment: any;
  };
  historicalContext: {
    similarScenarios: any[];
    outcomesProbability: any;
    marketRegime: string;
  };
  explanation: {
    summary: string;
    detailed: string;
    keyFactors: string[];
    riskWarnings: string[];
  };
}

export class StevieExplanationService {
  private openai: OpenAI;
  private featureService = featureService;
  private vectorService: VectorService;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // featureService is already assigned as class property
    this.vectorService = new VectorService({
      provider: 'memory',
      openaiApiKey: process.env.OPENAI_API_KEY
    });
  }

  async explainTradeDecision(
    symbol: string,
    timestamp: number,
    decision: any
  ): Promise<TradeExplanation> {
    
    // Get comprehensive feature data
    const features = await this.featureService.getFeatures(symbol);
    
    // Get historical context from vector database
    const scenarioInsights = await this.vectorService.getScenarioInsights(features);
    
    // Analyze all data components
    const dataAnalysis = this.analyzeAllDataSources(features);
    
    // Generate LLM explanation
    const explanation = await this.generateLLMExplanation(
      symbol,
      decision,
      features,
      dataAnalysis,
      scenarioInsights
    );
    
    return {
      decision: {
        action: decision.signal > 0.1 ? 'buy' : decision.signal < -0.1 ? 'sell' : 'hold',
        confidence: decision.confidence,
        positionSize: this.calculatePositionSize(decision, features),
        reasoning: this.extractKeyReasons(features, decision)
      },
      dataAnalysis,
      historicalContext: {
        similarScenarios: scenarioInsights.similarScenarios || [],
        outcomesProbability: scenarioInsights.outcomesPrediction || {},
        marketRegime: this.identifyMarketRegime(features)
      },
      explanation
    };
  }

  async generateMarketOutlook(symbols: string[]): Promise<any> {
    const marketAnalysis = [];
    
    for (const symbol of symbols) {
      const features = await this.featureService.getFeatures(symbol);
      const analysis = this.analyzeAllDataSources(features);
      
      marketAnalysis.push({
        symbol,
        outlook: this.generateOutlook(features, analysis),
        keyMetrics: this.extractKeyMetrics(features),
        riskLevel: this.assessRiskLevel(features)
      });
    }

    // Generate comprehensive market explanation with LLM
    const marketExplanation = await this.generateMarketLLMExplanation(marketAnalysis);
    
    return {
      timestamp: Date.now(),
      symbols,
      analysis: marketAnalysis,
      overallOutlook: marketExplanation,
      recommendations: this.generateRecommendations(marketAnalysis)
    };
  }

  private analyzeAllDataSources(features: any) {
    return {
      technicalSignals: {
        rsi: {
          value: features.technical?.rsi || 50,
          signal: this.interpretRSI(features.technical?.rsi || 50),
          strength: this.calculateSignalStrength('rsi', features.technical?.rsi || 50)
        },
        macd: {
          value: features.technical?.macd || 0,
          signal: features.technical?.macd > 0 ? 'bullish' : 'bearish',
          strength: Math.abs(features.technical?.macd || 0) * 10
        },
        bollinger: {
          position: features.technical?.bollingerPosition || 0.5,
          signal: this.interpretBollingerPosition(features.technical?.bollingerPosition || 0.5)
        },
        volume: {
          relative: features.technical?.volumeRatio || 1,
          trend: features.technical?.volumeTrend || 'neutral'
        }
      },
      sentimentFactors: {
        fearGreed: {
          index: features.sentiment?.fearGreedIndex || 50,
          interpretation: this.interpretFearGreed(features.sentiment?.fearGreedIndex || 50),
          tradingSignal: this.fearGreedToSignal(features.sentiment?.fearGreedIndex || 50)
        },
        socialSentiment: {
          score: features.sentiment?.sentimentScore || 0.5,
          mentions: features.sentiment?.socialMentions || 0,
          trend: features.sentiment?.sentimentTrend || 'neutral'
        },
        newsImpact: {
          score: features.sentiment?.newsImpact || 0,
          recency: features.sentiment?.newsRecency || 0
        }
      },
      derivativesInsight: {
        funding: {
          rate: features.derivatives?.fundingRate || 0,
          interpretation: this.interpretFundingRate(features.derivatives?.fundingRate || 0),
          signal: this.fundingToSignal(features.derivatives?.fundingRate || 0)
        },
        openInterest: {
          value: features.derivatives?.openInterest || 0,
          change: features.derivatives?.openInterestChange || 0,
          trend: features.derivatives?.openInterestTrend || 'stable'
        },
        leverage: {
          ratio: features.derivatives?.leverageRatio || 1,
          risk: this.assessLeverageRisk(features.derivatives?.leverageRatio || 1)
        }
      },
      riskAssessment: {
        volatility: {
          current: features.technical?.volatility || 0.02,
          percentile: features.technical?.volatilityPercentile || 50,
          trend: features.technical?.volatilityTrend || 'stable'
        },
        liquidity: {
          score: features.orderBook?.liquidityScore || 0.5,
          depth: features.orderBook?.depth || 0,
          imbalance: features.orderBook?.imbalance || 0
        },
        correlation: {
          btc: features.meta?.btcCorrelation || 0,
          market: features.meta?.marketCorrelation || 0
        }
      }
    };
  }

  private async generateLLMExplanation(
    symbol: string,
    decision: any,
    features: any,
    dataAnalysis: any,
    scenarioInsights: any
  ): Promise<any> {
    
    const prompt = `As Stevie, an expert AI trading companion, explain this trading decision for ${symbol}:

DECISION: ${decision.signal > 0.1 ? 'BUY' : decision.signal < -0.1 ? 'SELL' : 'HOLD'} (confidence: ${Math.round(decision.confidence * 100)}%)

CURRENT DATA:
• RSI: ${dataAnalysis.technicalSignals.rsi.value} (${dataAnalysis.technicalSignals.rsi.signal})
• Fear & Greed: ${dataAnalysis.sentimentFactors.fearGreed.index} (${dataAnalysis.sentimentFactors.fearGreed.interpretation})
• Funding Rate: ${(dataAnalysis.derivativesInsight.funding.rate * 100).toFixed(3)}% (${dataAnalysis.derivativesInsight.funding.interpretation})
• Volatility: ${(dataAnalysis.riskAssessment.volatility.current * 100).toFixed(2)}% (${dataAnalysis.riskAssessment.volatility.percentile}th percentile)

HISTORICAL CONTEXT:
${scenarioInsights.confidenceScore ? `Similar scenarios confidence: ${Math.round(scenarioInsights.confidenceScore * 100)}%` : 'Limited historical data'}

Please provide:
1. A conversational summary (2-3 sentences) as Stevie
2. Detailed technical reasoning
3. Key risk factors to monitor
4. Expected timeframe and targets

Keep Stevie's encouraging, data-driven personality while being precise about the analysis.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // Latest model as per blueprint
        messages: [
          {
            role: "system",
            content: "You are Stevie, an expert AI trading companion. You're encouraging, data-driven, and always explain your reasoning clearly. Use trading expertise while maintaining an approachable personality."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.7
      });

      const llmResponse = response.choices[0].message.content || "Analysis in progress...";
      
      return {
        summary: this.extractSummary(llmResponse),
        detailed: llmResponse,
        keyFactors: this.extractKeyFactors(dataAnalysis),
        riskWarnings: this.identifyRiskWarnings(dataAnalysis)
      };

    } catch (error) {
      console.error('LLM explanation error:', error);
      
      // Fallback explanation
      return {
        summary: this.generateFallbackSummary(decision, dataAnalysis),
        detailed: this.generateFallbackDetailed(decision, dataAnalysis),
        keyFactors: this.extractKeyFactors(dataAnalysis),
        riskWarnings: this.identifyRiskWarnings(dataAnalysis)
      };
    }
  }

  private async generateMarketLLMExplanation(marketAnalysis: any[]): Promise<string> {
    const prompt = `As Stevie, provide a comprehensive market outlook based on this analysis:

${marketAnalysis.map(analysis => `
${analysis.symbol}:
• Outlook: ${analysis.outlook}
• Risk Level: ${analysis.riskLevel}
• Key Metrics: ${JSON.stringify(analysis.keyMetrics, null, 2)}
`).join('\n')}

Provide an encouraging but realistic market assessment, highlighting opportunities and risks. Keep it conversational and actionable.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are Stevie, an expert AI trading companion with deep market knowledge."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 600,
        temperature: 0.7
      });

      return response.choices[0].message.content || "Market analysis in progress...";

    } catch (error) {
      console.error('Market LLM explanation error:', error);
      return this.generateFallbackMarketOutlook(marketAnalysis);
    }
  }

  // Helper methods for analysis and interpretation
  private interpretRSI(rsi: number): string {
    if (rsi < 30) return 'oversold';
    if (rsi > 70) return 'overbought';
    if (rsi < 40) return 'bearish';
    if (rsi > 60) return 'bullish';
    return 'neutral';
  }

  private interpretFearGreed(index: number): string {
    if (index < 25) return 'extreme fear';
    if (index < 45) return 'fear';
    if (index < 55) return 'neutral';
    if (index < 75) return 'greed';
    return 'extreme greed';
  }

  private interpretFundingRate(rate: number): string {
    if (rate > 0.002) return 'very high (overextended longs)';
    if (rate > 0.001) return 'elevated';
    if (rate > -0.001) return 'neutral';
    if (rate > -0.002) return 'negative (short squeeze potential)';
    return 'very negative';
  }

  private calculatePositionSize(decision: any, features: any): number {
    let baseSize = 0.02; // 2% base position
    
    // Adjust for confidence
    baseSize *= decision.confidence;
    
    // Adjust for volatility
    const volatility = features.technical?.volatility || 0.02;
    if (volatility > 0.05) baseSize *= 0.7; // Reduce in high volatility
    
    // Adjust for liquidity
    const liquidityScore = features.orderBook?.liquidityScore || 0.5;
    if (liquidityScore < 0.3) baseSize *= 0.5; // Reduce in low liquidity
    
    return Math.max(0.005, Math.min(0.05, baseSize)); // Cap between 0.5% and 5%
  }

  private extractKeyReasons(features: any, decision: any): string[] {
    const reasons = [];
    
    if (features.technical?.rsi < 30) reasons.push('RSI oversold at ' + features.technical.rsi);
    if (features.technical?.rsi > 70) reasons.push('RSI overbought at ' + features.technical.rsi);
    if (features.sentiment?.fearGreedIndex < 25) reasons.push('Extreme fear opportunity');
    if (features.derivatives?.fundingRate > 0.002) reasons.push('High funding rate warning');
    if (features.technical?.macd > 0) reasons.push('MACD bullish crossover');
    
    return reasons.slice(0, 4); // Top 4 reasons
  }

  private generateFallbackSummary(decision: any, dataAnalysis: any): string {
    const action = decision.signal > 0.1 ? 'buying' : decision.signal < -0.1 ? 'selling' : 'holding';
    const confidence = Math.round(decision.confidence * 100);
    
    return `I'm ${action} based on ${confidence}% confidence from technical and sentiment analysis. Key factors include RSI at ${dataAnalysis.technicalSignals.rsi.value} and current market sentiment.`;
  }

  private generateFallbackDetailed(decision: any, dataAnalysis: any): string {
    return `Detailed analysis: Technical indicators show ${dataAnalysis.technicalSignals.rsi.signal} RSI conditions, sentiment is ${dataAnalysis.sentimentFactors.fearGreed.interpretation}, and derivatives suggest ${dataAnalysis.derivativesInsight.funding.interpretation} funding conditions. Risk assessment indicates ${dataAnalysis.riskAssessment.volatility.trend} volatility.`;
  }

  private identifyMarketRegime(features: any): string {
    const volatility = features.technical?.volatility || 0.02;
    const fearGreed = features.sentiment?.fearGreedIndex || 50;
    
    if (volatility > 0.05 && fearGreed < 30) return 'high volatility bear';
    if (volatility > 0.05 && fearGreed > 70) return 'high volatility bull';
    if (volatility < 0.02 && fearGreed > 60) return 'low volatility bull';
    if (volatility < 0.02 && fearGreed < 40) return 'low volatility bear';
    return 'transitional';
  }

  private extractKeyFactors(dataAnalysis: any): string[] {
    return [
      `RSI: ${dataAnalysis.technicalSignals.rsi.value} (${dataAnalysis.technicalSignals.rsi.signal})`,
      `Fear & Greed: ${dataAnalysis.sentimentFactors.fearGreed.index}`,
      `Funding: ${(dataAnalysis.derivativesInsight.funding.rate * 100).toFixed(3)}%`,
      `Volatility: ${(dataAnalysis.riskAssessment.volatility.current * 100).toFixed(2)}%`
    ];
  }

  private identifyRiskWarnings(dataAnalysis: any): string[] {
    const warnings = [];
    
    if (dataAnalysis.riskAssessment.volatility.current > 0.05) {
      warnings.push('High volatility detected - consider reduced position sizing');
    }
    
    if (dataAnalysis.riskAssessment.liquidity.score < 0.3) {
      warnings.push('Low liquidity conditions - may impact execution');
    }
    
    if (Math.abs(dataAnalysis.derivativesInsight.funding.rate) > 0.002) {
      warnings.push('Extreme funding rates - potential for rapid reversals');
    }
    
    if (dataAnalysis.derivativesInsight.leverage.ratio > 3) {
      warnings.push('High leverage in market - increased systemic risk');
    }
    
    return warnings;
  }

  private calculateSignalStrength(indicator: string, value: number): number {
    switch (indicator) {
      case 'rsi':
        if (value < 20 || value > 80) return 0.9;
        if (value < 30 || value > 70) return 0.7;
        if (value < 40 || value > 60) return 0.5;
        return 0.3;
      default:
        return 0.5;
    }
  }

  private interpretBollingerPosition(position: number): string {
    if (position < 0.2) return 'near lower band';
    if (position > 0.8) return 'near upper band';
    if (position < 0.4) return 'below middle';
    if (position > 0.6) return 'above middle';
    return 'middle range';
  }

  private fearGreedToSignal(index: number): number {
    if (index < 25) return 0.3; // Buy opportunity in extreme fear
    if (index > 75) return -0.3; // Sell signal in extreme greed
    return 0;
  }

  private fundingToSignal(rate: number): number {
    if (rate > 0.002) return -0.2; // High funding suggests overextension
    if (rate < -0.001) return 0.2; // Negative funding suggests short squeeze potential
    return 0;
  }

  private assessLeverageRisk(ratio: number): string {
    if (ratio > 4) return 'very high';
    if (ratio > 3) return 'high';
    if (ratio > 2) return 'moderate';
    return 'low';
  }

  private generateOutlook(features: any, analysis: any): string {
    const signals = [
      analysis.technicalSignals.rsi.signal,
      analysis.sentimentFactors.fearGreed.tradingSignal > 0 ? 'bullish' : 'bearish',
      analysis.derivativesInsight.funding.signal > 0 ? 'positive' : 'negative'
    ];
    
    const bullishSignals = signals.filter(s => ['bullish', 'positive', 'oversold'].includes(s)).length;
    
    if (bullishSignals >= 2) return 'bullish';
    if (bullishSignals <= 1) return 'bearish';
    return 'neutral';
  }

  private extractKeyMetrics(features: any): any {
    return {
      rsi: features.technical?.rsi || 50,
      fearGreed: features.sentiment?.fearGreedIndex || 50,
      funding: features.derivatives?.fundingRate || 0,
      volatility: features.technical?.volatility || 0.02
    };
  }

  private assessRiskLevel(features: any): string {
    const volatility = features.technical?.volatility || 0.02;
    const liquidity = features.orderBook?.liquidityScore || 0.5;
    
    if (volatility > 0.05 || liquidity < 0.3) return 'high';
    if (volatility > 0.03 || liquidity < 0.5) return 'medium';
    return 'low';
  }

  private generateRecommendations(marketAnalysis: any[]): string[] {
    const recommendations = [];
    
    const bullishCount = marketAnalysis.filter(a => a.outlook === 'bullish').length;
    const bearishCount = marketAnalysis.filter(a => a.outlook === 'bearish').length;
    
    if (bullishCount > bearishCount) {
      recommendations.push('Consider increasing exposure to bullish assets');
    } else if (bearishCount > bullishCount) {
      recommendations.push('Consider defensive positioning or short opportunities');
    } else {
      recommendations.push('Mixed signals suggest cautious, balanced approach');
    }
    
    const highRiskCount = marketAnalysis.filter(a => a.riskLevel === 'high').length;
    if (highRiskCount > marketAnalysis.length / 2) {
      recommendations.push('Reduce position sizes due to elevated risk conditions');
    }
    
    return recommendations;
  }

  private extractSummary(llmResponse: string): string {
    // Extract first 2-3 sentences as summary
    const sentences = llmResponse.split('.').slice(0, 3);
    return sentences.join('.') + (sentences.length === 3 ? '.' : '');
  }

  private generateFallbackMarketOutlook(marketAnalysis: any[]): string {
    const bullish = marketAnalysis.filter(a => a.outlook === 'bullish').length;
    const bearish = marketAnalysis.filter(a => a.outlook === 'bearish').length;
    
    return `Current market shows ${bullish} bullish vs ${bearish} bearish signals across ${marketAnalysis.length} assets. Overall sentiment suggests cautious optimism with selective opportunities in lower-risk assets.`;
  }
}

export default StevieExplanationService;