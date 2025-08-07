/**
 * Real-Time Learning & Adaptation System
 * Dynamic parameter optimization based on live performance
 */

import { db } from '../db';
import { 
  learningParameters,
  performanceMetrics,
  marketRegimes,
  type LearningParameter,
  type PerformanceMetric,
  type MarketRegime
} from '../../shared/schema';
import { eq, desc, and, gte } from 'drizzle-orm';

interface ParameterUpdate {
  name: string;
  oldValue: number;
  newValue: number;
  confidence: number;
  reason: string;
}

interface MarketRegimeDetection {
  regime: 'bull' | 'bear' | 'sideways' | 'volatile';
  confidence: number;
  signals: string[];
  recommendedStrategy: string;
}

export class RealTimeLearningService {
  private learningRate = 0.1;
  private confidenceThreshold = 0.7;
  private adaptationFrequency = 3600000; // 1 hour in ms
  
  constructor() {
    // Initialize parameters lazily when first API call is made
    // this.initializeParameters();
  }

  async recordTradeOutcome(
    tradeId: string,
    symbol: string,
    action: 'buy' | 'sell',
    entryPrice: number,
    exitPrice: number,
    confidence: number,
    features: any,
    profit: number
  ): Promise<void> {
    // Record performance metric
    await db.insert(performanceMetrics).values({
      tradeId,
      symbol,
      action,
      entryPrice,
      exitPrice,
      confidence,
      profit,
      features,
      timestamp: new Date()
    });

    // Update parameter learning based on outcome
    await this.updateParametersBasedOnOutcome(
      profit > 0,
      confidence,
      features,
      profit
    );
  }

  async detectMarketRegime(marketData: any): Promise<MarketRegimeDetection> {
    const signals: string[] = [];
    let bullishSignals = 0;
    let bearishSignals = 0;
    let volatilitySignals = 0;

    // Trend analysis
    if (marketData.rsi > 60) {
      bullishSignals++;
      signals.push('RSI overbought territory');
    } else if (marketData.rsi < 40) {
      bearishSignals++;
      signals.push('RSI oversold territory');
    }

    // Volume analysis
    if (marketData.volumeRatio > 1.5) {
      volatilitySignals++;
      signals.push('High volume activity');
    }

    // Price momentum
    if (marketData.priceChange > 0.05) {
      bullishSignals++;
      signals.push('Strong upward momentum');
    } else if (marketData.priceChange < -0.05) {
      bearishSignals++;
      signals.push('Strong downward momentum');
    }

    // Volatility check
    if (marketData.volatility > 0.05) {
      volatilitySignals++;
      signals.push('High market volatility');
    }

    // Determine regime
    let regime: 'bull' | 'bear' | 'sideways' | 'volatile';
    let confidence: number;
    let recommendedStrategy: string;

    if (volatilitySignals >= 2) {
      regime = 'volatile';
      confidence = 0.8;
      recommendedStrategy = 'scalping_conservative';
    } else if (bullishSignals > bearishSignals) {
      regime = 'bull';
      confidence = Math.min(0.9, bullishSignals * 0.3);
      recommendedStrategy = 'trend_following_long';
    } else if (bearishSignals > bullishSignals) {
      regime = 'bear';
      confidence = Math.min(0.9, bearishSignals * 0.3);
      recommendedStrategy = 'trend_following_short';
    } else {
      regime = 'sideways';
      confidence = 0.6;
      recommendedStrategy = 'range_trading';
    }

    // Record regime detection
    await db.insert(marketRegimes).values({
      regime,
      confidence,
      signals: signals.join(', '),
      marketData,
      recommendedStrategy,
      timestamp: new Date()
    });

    return { regime, confidence, signals, recommendedStrategy };
  }

  async optimizeParameters(): Promise<ParameterUpdate[]> {
    const recentMetrics = await this.getRecentPerformanceMetrics(100);
    const updates: ParameterUpdate[] = [];

    if (recentMetrics.length < 10) {
      return updates; // Not enough data for optimization
    }

    // Analyze parameter performance
    const parameterAnalysis = this.analyzeParameterPerformance(recentMetrics);
    
    for (const [paramName, analysis] of Object.entries(parameterAnalysis)) {
      const currentParam = await this.getParameter(paramName);
      if (!currentParam) continue;

      const suggestedValue = this.calculateOptimalValue(
        currentParam.value,
        analysis.averageProfit,
        analysis.winRate,
        analysis.confidence
      );

      if (Math.abs(suggestedValue - currentParam.value) > 0.001) {
        // Update parameter
        await db
          .update(learningParameters)
          .set({
            value: suggestedValue,
            lastUpdated: new Date(),
            performanceHistory: {
              ...currentParam.performanceHistory,
              [Date.now()]: {
                oldValue: currentParam.value,
                newValue: suggestedValue,
                reason: `Optimization based on ${recentMetrics.length} recent trades`
              }
            }
          })
          .where(eq(learningParameters.name, paramName));

        updates.push({
          name: paramName,
          oldValue: currentParam.value,
          newValue: suggestedValue,
          confidence: analysis.confidence,
          reason: `Win rate: ${(analysis.winRate * 100).toFixed(1)}%, Avg profit: ${analysis.averageProfit.toFixed(4)}`
        });
      }
    }

    return updates;
  }

  async calibrateConfidence(): Promise<{ calibrationFactor: number; accuracy: number }> {
    const recentMetrics = await this.getRecentPerformanceMetrics(50);
    
    if (recentMetrics.length < 10) {
      return { calibrationFactor: 1.0, accuracy: 0.5 };
    }

    // Group by confidence ranges
    const confidenceBuckets = {
      low: recentMetrics.filter(m => m.confidence < 0.4),
      medium: recentMetrics.filter(m => m.confidence >= 0.4 && m.confidence < 0.7),
      high: recentMetrics.filter(m => m.confidence >= 0.7)
    };

    let totalCalibrationError = 0;
    let bucketCount = 0;

    for (const [bucket, metrics] of Object.entries(confidenceBuckets)) {
      if (metrics.length === 0) continue;
      
      const actualWinRate = metrics.filter(m => m.profit > 0).length / metrics.length;
      const averageConfidence = metrics.reduce((sum, m) => sum + m.confidence, 0) / metrics.length;
      
      totalCalibrationError += Math.abs(actualWinRate - averageConfidence);
      bucketCount++;
    }

    const accuracy = 1 - (totalCalibrationError / bucketCount);
    const calibrationFactor = accuracy > 0.8 ? 1.0 : 0.8 + (accuracy * 0.2);

    // Update calibration parameter
    await this.updateParameter('confidence_calibration', calibrationFactor);

    return { calibrationFactor, accuracy };
  }

  async getAdaptiveStrategy(marketRegime: string, userRiskTolerance: number): Promise<any> {
    const regimeParams = await this.getRegimeSpecificParameters(marketRegime);
    const riskAdjustedParams = this.adjustForRiskTolerance(regimeParams, userRiskTolerance);
    
    return {
      positionSize: riskAdjustedParams.positionSize,
      stopLoss: riskAdjustedParams.stopLoss,
      takeProfit: riskAdjustedParams.takeProfit,
      confidenceThreshold: riskAdjustedParams.confidenceThreshold,
      features: {
        sentimentWeight: riskAdjustedParams.sentimentWeight,
        technicalWeight: riskAdjustedParams.technicalWeight,
        derivativesWeight: riskAdjustedParams.derivativesWeight
      }
    };
  }

  private async initializeParameters(): Promise<void> {
    const defaultParams = [
      { name: 'position_size_multiplier', value: 0.02, category: 'risk' },
      { name: 'sentiment_weight', value: 0.3, category: 'features' },
      { name: 'technical_weight', value: 0.4, category: 'features' },
      { name: 'derivatives_weight', value: 0.2, category: 'features' },
      { name: 'confidence_threshold', value: 0.6, category: 'decision' },
      { name: 'stop_loss_multiplier', value: 0.05, category: 'risk' },
      { name: 'take_profit_multiplier', value: 0.10, category: 'risk' },
      { name: 'confidence_calibration', value: 1.0, category: 'system' }
    ];

    for (const param of defaultParams) {
      await db
        .insert(learningParameters)
        .values({
          name: param.name,
          value: param.value,
          category: param.category,
          performanceHistory: {},
          lastUpdated: new Date()
        })
        .onConflictDoNothing();
    }
  }

  private async updateParametersBasedOnOutcome(
    successful: boolean,
    confidence: number,
    features: any,
    profit: number
  ): Promise<void> {
    const learningStrength = successful ? this.learningRate : -this.learningRate * 0.5;
    
    // Update feature weights based on performance
    if (features.sentimentSignal && Math.abs(features.sentimentSignal) > 0.1) {
      const currentWeight = await this.getParameter('sentiment_weight');
      if (currentWeight) {
        const newWeight = Math.max(0.1, Math.min(0.8, 
          currentWeight.value + (learningStrength * Math.abs(features.sentimentSignal))
        ));
        await this.updateParameter('sentiment_weight', newWeight);
      }
    }

    // Update confidence threshold based on calibration
    if (confidence > 0.8 && !successful) {
      // High confidence but failed - increase threshold
      const currentThreshold = await this.getParameter('confidence_threshold');
      if (currentThreshold) {
        const newThreshold = Math.min(0.9, currentThreshold.value + 0.05);
        await this.updateParameter('confidence_threshold', newThreshold);
      }
    }
  }

  private async getRecentPerformanceMetrics(limit: number): Promise<PerformanceMetric[]> {
    return db
      .select()
      .from(performanceMetrics)
      .orderBy(desc(performanceMetrics.timestamp))
      .limit(limit);
  }

  private analyzeParameterPerformance(metrics: PerformanceMetric[]): any {
    const analysis: any = {};
    
    // Group metrics by feature characteristics
    const sentimentTrades = metrics.filter(m => m.features?.sentimentSignal);
    const technicalTrades = metrics.filter(m => m.features?.technicalSignal);
    
    if (sentimentTrades.length > 5) {
      analysis.sentiment_weight = {
        averageProfit: sentimentTrades.reduce((sum, m) => sum + m.profit, 0) / sentimentTrades.length,
        winRate: sentimentTrades.filter(m => m.profit > 0).length / sentimentTrades.length,
        confidence: Math.min(0.9, sentimentTrades.length / 20)
      };
    }

    if (technicalTrades.length > 5) {
      analysis.technical_weight = {
        averageProfit: technicalTrades.reduce((sum, m) => sum + m.profit, 0) / technicalTrades.length,
        winRate: technicalTrades.filter(m => m.profit > 0).length / technicalTrades.length,
        confidence: Math.min(0.9, technicalTrades.length / 20)
      };
    }

    return analysis;
  }

  private calculateOptimalValue(
    currentValue: number,
    averageProfit: number,
    winRate: number,
    confidence: number
  ): number {
    // Simple optimization - increase if performing well, decrease if not
    const performanceScore = (winRate * 0.6) + (Math.max(0, averageProfit) * 0.4);
    const adjustment = (performanceScore - 0.5) * this.learningRate * confidence;
    
    return Math.max(0.1, Math.min(0.9, currentValue + adjustment));
  }

  private async getParameter(name: string): Promise<LearningParameter | null> {
    const [param] = await db
      .select()
      .from(learningParameters)
      .where(eq(learningParameters.name, name));
    
    return param || null;
  }

  private async updateParameter(name: string, value: number): Promise<void> {
    await db
      .update(learningParameters)
      .set({ 
        value,
        lastUpdated: new Date()
      })
      .where(eq(learningParameters.name, name));
  }

  private async getRegimeSpecificParameters(regime: string): Promise<any> {
    const baseParams = {
      positionSize: 0.02,
      stopLoss: 0.05,
      takeProfit: 0.10,
      confidenceThreshold: 0.6,
      sentimentWeight: 0.3,
      technicalWeight: 0.4,
      derivativesWeight: 0.2
    };

    switch (regime) {
      case 'bull':
        return {
          ...baseParams,
          positionSize: 0.025,
          takeProfit: 0.15,
          sentimentWeight: 0.4
        };
      case 'bear':
        return {
          ...baseParams,
          positionSize: 0.015,
          stopLoss: 0.03,
          confidenceThreshold: 0.7
        };
      case 'volatile':
        return {
          ...baseParams,
          positionSize: 0.01,
          stopLoss: 0.02,
          takeProfit: 0.05,
          confidenceThreshold: 0.8
        };
      default:
        return baseParams;
    }
  }

  private adjustForRiskTolerance(params: any, riskTolerance: number): any {
    const riskMultiplier = 0.5 + (riskTolerance * 0.5);
    
    return {
      ...params,
      positionSize: params.positionSize * riskMultiplier,
      stopLoss: params.stopLoss * (2 - riskMultiplier),
      takeProfit: params.takeProfit * riskMultiplier
    };
  }
}

export default RealTimeLearningService;