/**
 * Real-Time Optimization Engine - Revolutionary Live Performance Enhancement
 * 
 * Continuous parameter optimization, dynamic model selection, and adaptive cooling/heating periods
 */

import { storage } from '../storage';
import { logger } from '../utils/logger';
import { adaptiveLearningEngine } from './adaptiveLearning';
import { quantumAnalyticsEngine } from './quantumAnalytics';

export interface OptimizationTarget {
  targetId: string;
  type: 'parameter' | 'model' | 'strategy' | 'allocation';
  currentValue: any;
  optimizedValue: any;
  expectedImprovement: number;
  confidence: number;
  lastOptimized: Date;
}

export interface PerformanceFeedback {
  userId: string;
  timestamp: Date;
  metrics: {
    returns: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    volatility: number;
  };
  contextualFactors: {
    marketRegime: string;
    volatility: number;
    sentiment: number;
  };
}

export interface DynamicModel {
  modelId: string;
  modelType: string;
  performance: number;
  confidence: number;
  marketConditions: string[];
  lastUsed: Date;
  effectiveness: number;
}

export interface AdaptivePeriod {
  periodType: 'cooling' | 'heating';
  duration: number;
  trigger: string;
  parameters: {
    sensitivity: number;
    responsiveness: number;
    riskTolerance: number;
  };
  startTime: Date;
  endTime?: Date;
}

export class RealTimeOptimizationEngine {
  private optimizationTargets: Map<string, OptimizationTarget[]> = new Map();
  private performanceHistory: Map<string, PerformanceFeedback[]> = new Map();
  private availableModels: Map<string, DynamicModel> = new Map();
  private adaptivePeriods: Map<string, AdaptivePeriod> = new Map();
  private optimizationActive = false;
  private optimizationInterval?: NodeJS.Timeout;

  constructor() {
    this.initializeDynamicModels();
  }

  private initializeDynamicModels() {
    const models: DynamicModel[] = [
      {
        modelId: 'trend_following_v2',
        modelType: 'trend_following',
        performance: 0.75,
        confidence: 0.8,
        marketConditions: ['bull', 'trending'],
        lastUsed: new Date(),
        effectiveness: 0.72
      },
      {
        modelId: 'mean_reversion_v3',
        modelType: 'mean_reversion',
        performance: 0.68,
        confidence: 0.85,
        marketConditions: ['sideways', 'range_bound'],
        lastUsed: new Date(),
        effectiveness: 0.69
      },
      {
        modelId: 'volatility_adaptive_v1',
        modelType: 'volatility_trading',
        performance: 0.82,
        confidence: 0.9,
        marketConditions: ['volatile', 'uncertain'],
        lastUsed: new Date(),
        effectiveness: 0.78
      },
      {
        modelId: 'sentiment_driven_v2',
        modelType: 'sentiment_based',
        performance: 0.65,
        confidence: 0.7,
        marketConditions: ['news_driven', 'social_trending'],
        lastUsed: new Date(),
        effectiveness: 0.64
      },
      {
        modelId: 'quantum_ensemble_v1',
        modelType: 'quantum_analytics',
        performance: 0.88,
        confidence: 0.95,
        marketConditions: ['complex', 'multi_dimensional'],
        lastUsed: new Date(),
        effectiveness: 0.85
      }
    ];

    models.forEach(model => {
      this.availableModels.set(model.modelId, model);
    });
  }

  async startRealTimeOptimization(userId: string): Promise<void> {
    try {
      this.optimizationActive = true;

      // Start continuous optimization loop
      this.optimizationInterval = setInterval(async () => {
        if (this.optimizationActive) {
          await this.performContinuousOptimization(userId);
        }
      }, 30000); // Every 30 seconds

      logger.info(`Started real-time optimization`, { userId });

    } catch (error) {
      logger.error(`Failed to start real-time optimization`, { userId, error });
    }
  }

  private async performContinuousOptimization(userId: string): Promise<void> {
    try {
      // Collect live performance feedback
      const feedback = await this.collectPerformanceFeedback(userId);
      
      if (feedback) {
        // Store feedback
        this.storePerformanceFeedback(userId, feedback);
        
        // Optimize based on feedback
        await this.optimizeBasedOnFeedback(userId, feedback);
        
        // Check if model switching is needed
        await this.evaluateModelSelection(userId, feedback);
        
        // Adjust adaptive periods
        await this.adjustAdaptivePeriods(userId, feedback);
      }

    } catch (error) {
      logger.error(`Continuous optimization failed`, { userId, error });
    }
  }

  private async collectPerformanceFeedback(userId: string): Promise<PerformanceFeedback | null> {
    try {
      // Get recent trading performance
      const recentTrades = await storage.getUserTrades(userId, 10);
      if (recentTrades.length === 0) return null;

      // Calculate performance metrics
      const returns = recentTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
      const winningTrades = recentTrades.filter(trade => (trade.pnl || 0) > 0);
      const winRate = winningTrades.length / recentTrades.length;
      
      // Calculate Sharpe ratio (simplified)
      const avgReturn = returns / recentTrades.length;
      const returnVariance = recentTrades.reduce((sum, trade) => {
        const tradePnl = trade.pnl || 0;
        return sum + Math.pow(tradePnl - avgReturn, 2);
      }, 0) / recentTrades.length;
      const volatility = Math.sqrt(returnVariance);
      const sharpeRatio = volatility > 0 ? avgReturn / volatility : 0;

      // Calculate max drawdown
      let maxDrawdown = 0;
      let peak = 0;
      let cumulative = 0;
      
      for (const trade of recentTrades) {
        cumulative += trade.pnl || 0;
        if (cumulative > peak) peak = cumulative;
        const drawdown = (peak - cumulative) / Math.max(peak, 1);
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }

      // Get contextual factors
      const marketRegime = await storage.getCurrentMarketRegime('BTC/USD');
      const sentimentData = await storage.getSentimentData('BTC/USD');
      const avgSentiment = sentimentData.length > 0 ? 
        sentimentData.slice(0, 5).reduce((sum, s) => sum + s.sentiment, 0) / 5 : 0;

      return {
        userId,
        timestamp: new Date(),
        metrics: {
          returns,
          sharpeRatio,
          maxDrawdown,
          winRate,
          volatility
        },
        contextualFactors: {
          marketRegime: marketRegime?.regime || 'unknown',
          volatility: marketRegime?.volatility || 0.3,
          sentiment: avgSentiment
        }
      };

    } catch (error) {
      logger.error(`Failed to collect performance feedback`, { userId, error });
      return null;
    }
  }

  private storePerformanceFeedback(userId: string, feedback: PerformanceFeedback): void {
    const history = this.performanceHistory.get(userId) || [];
    history.push(feedback);
    
    // Keep only recent history (last 100 feedback points)
    if (history.length > 100) {
      history.shift();
    }
    
    this.performanceHistory.set(userId, history);
  }

  private async optimizeBasedOnFeedback(userId: string, feedback: PerformanceFeedback): Promise<void> {
    try {
      const optimizations: OptimizationTarget[] = [];

      // Parameter optimization based on performance
      if (feedback.metrics.sharpeRatio < 0.5) {
        optimizations.push(await this.optimizeRiskParameters(userId, feedback));
      }

      if (feedback.metrics.maxDrawdown > 0.15) {
        optimizations.push(await this.optimizePositionSizing(userId, feedback));
      }

      if (feedback.metrics.winRate < 0.4) {
        optimizations.push(await this.optimizeEntryConditions(userId, feedback));
      }

      // Store optimizations
      this.optimizationTargets.set(userId, optimizations.filter(Boolean));

      // Apply optimizations
      for (const optimization of optimizations) {
        if (optimization && optimization.confidence > 0.6) {
          await this.applyOptimization(userId, optimization);
        }
      }

      logger.info(`Applied performance-based optimizations`, {
        userId,
        optimizationCount: optimizations.length,
        avgConfidence: optimizations.reduce((sum, opt) => sum + (opt?.confidence || 0), 0) / optimizations.length
      });

    } catch (error) {
      logger.error(`Failed to optimize based on feedback`, { userId, error });
    }
  }

  private async optimizeRiskParameters(userId: string, feedback: PerformanceFeedback): Promise<OptimizationTarget> {
    const currentRiskTolerance = 0.1; // Assume current 10% risk per trade
    
    // Adjust risk based on performance and market conditions
    let optimizedRisk = currentRiskTolerance;
    
    if (feedback.metrics.volatility > 0.4) {
      optimizedRisk *= 0.8; // Reduce risk in high volatility
    }
    
    if (feedback.contextualFactors.marketRegime === 'bear') {
      optimizedRisk *= 0.7; // Reduce risk in bear markets
    }
    
    if (feedback.metrics.winRate > 0.6) {
      optimizedRisk *= 1.2; // Increase risk when performing well
    }

    optimizedRisk = Math.max(0.02, Math.min(0.25, optimizedRisk));
    
    const expectedImprovement = Math.abs(optimizedRisk - currentRiskTolerance) * 
                               feedback.metrics.sharpeRatio * 0.1;

    return {
      targetId: 'risk_tolerance',
      type: 'parameter',
      currentValue: currentRiskTolerance,
      optimizedValue: optimizedRisk,
      expectedImprovement,
      confidence: 0.8,
      lastOptimized: new Date()
    };
  }

  private async optimizePositionSizing(userId: string, feedback: PerformanceFeedback): Promise<OptimizationTarget> {
    const currentPositionSize = 0.1; // Assume current 10% position size
    
    // Optimize based on Kelly Criterion and drawdown history
    const history = this.performanceHistory.get(userId) || [];
    const recentDrawdowns = history.slice(-10).map(h => h.metrics.maxDrawdown);
    const avgDrawdown = recentDrawdowns.reduce((sum, dd) => sum + dd, 0) / recentDrawdowns.length;
    
    let optimizedSize = currentPositionSize;
    
    if (avgDrawdown > 0.1) {
      optimizedSize *= 0.8; // Reduce position size if drawdowns are high
    }
    
    // Adjust for market volatility
    optimizedSize *= (1 - feedback.contextualFactors.volatility * 0.5);
    
    optimizedSize = Math.max(0.02, Math.min(0.2, optimizedSize));
    
    const expectedImprovement = (currentPositionSize - optimizedSize) * 
                               feedback.metrics.maxDrawdown * 0.5;

    return {
      targetId: 'position_sizing',
      type: 'parameter',
      currentValue: currentPositionSize,
      optimizedValue: optimizedSize,
      expectedImprovement,
      confidence: 0.75,
      lastOptimized: new Date()
    };
  }

  private async optimizeEntryConditions(userId: string, feedback: PerformanceFeedback): Promise<OptimizationTarget> {
    const currentConditions = ['rsi_oversold', 'macd_bullish'];
    
    // Suggest additional conditions based on market regime
    let optimizedConditions = [...currentConditions];
    
    if (feedback.contextualFactors.marketRegime === 'volatile') {
      optimizedConditions.push('volatility_breakout');
    }
    
    if (Math.abs(feedback.contextualFactors.sentiment) > 0.3) {
      optimizedConditions.push('sentiment_confirmation');
    }
    
    if (feedback.metrics.winRate < 0.3) {
      optimizedConditions.push('volume_confirmation');
    }

    const expectedImprovement = (optimizedConditions.length - currentConditions.length) * 0.05;

    return {
      targetId: 'entry_conditions',
      type: 'parameter',
      currentValue: currentConditions,
      optimizedValue: optimizedConditions,
      expectedImprovement,
      confidence: 0.7,
      lastOptimized: new Date()
    };
  }

  private async applyOptimization(userId: string, optimization: OptimizationTarget): Promise<void> {
    try {
      // Apply the optimization through user configuration update
      const configKey = `optimization_${optimization.targetId}`;
      await storage.updateUserAutomationConfig(userId, configKey, {
        value: optimization.optimizedValue,
        appliedAt: new Date(),
        expectedImprovement: optimization.expectedImprovement,
        confidence: optimization.confidence
      });

      logger.info(`Applied optimization`, {
        userId,
        targetId: optimization.targetId,
        optimization: optimization.optimizedValue,
        confidence: optimization.confidence
      });

    } catch (error) {
      logger.error(`Failed to apply optimization`, { userId, optimization, error });
    }
  }

  async evaluateModelSelection(userId: string, feedback: PerformanceFeedback): Promise<void> {
    try {
      const currentModel = await this.getCurrentModel(userId);
      const optimalModel = await this.selectOptimalModel(feedback);
      
      if (optimalModel && optimalModel.modelId !== currentModel?.modelId) {
        const switchConfidence = this.calculateSwitchConfidence(currentModel, optimalModel, feedback);
        
        if (switchConfidence > 0.7) {
          await this.switchModel(userId, optimalModel);
        }
      }

    } catch (error) {
      logger.error(`Failed to evaluate model selection`, { userId, error });
    }
  }

  private async getCurrentModel(userId: string): Promise<DynamicModel | null> {
    try {
      const user = await storage.getUser(userId);
      const currentModelId = user?.metadata?.currentModel;
      return currentModelId ? this.availableModels.get(currentModelId) || null : null;
    } catch (error) {
      return null;
    }
  }

  private async selectOptimalModel(feedback: PerformanceFeedback): Promise<DynamicModel | null> {
    const marketCondition = feedback.contextualFactors.marketRegime;
    
    // Score all models based on current conditions
    const modelScores = new Map<string, number>();
    
    for (const [modelId, model] of this.availableModels) {
      let score = model.performance * 0.4 + model.confidence * 0.3 + model.effectiveness * 0.3;
      
      // Boost score if model is suitable for current market conditions
      if (model.marketConditions.includes(marketCondition)) {
        score *= 1.2;
      }
      
      // Recent usage bonus (models that were used recently and performed well)
      const daysSinceUsed = (Date.now() - model.lastUsed.getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceUsed < 7) {
        score *= (1 + (7 - daysSinceUsed) / 14);
      }
      
      modelScores.set(modelId, score);
    }
    
    // Select model with highest score
    const bestModelId = Array.from(modelScores.entries())
      .reduce((best, current) => current[1] > best[1] ? current : best)[0];
    
    return this.availableModels.get(bestModelId) || null;
  }

  private calculateSwitchConfidence(
    currentModel: DynamicModel | null, 
    newModel: DynamicModel, 
    feedback: PerformanceFeedback
  ): number {
    if (!currentModel) return 0.9; // High confidence if no current model
    
    // Calculate performance gap
    const performanceGap = newModel.performance - currentModel.performance;
    const effectivenessGap = newModel.effectiveness - currentModel.effectiveness;
    
    // Recent performance factor
    const recentPerformance = feedback.metrics.sharpeRatio;
    const performanceFactor = recentPerformance < 0.3 ? 1.2 : 0.8; // Higher confidence to switch if performing poorly
    
    // Market condition alignment
    const marketCondition = feedback.contextualFactors.marketRegime;
    const alignmentBonus = newModel.marketConditions.includes(marketCondition) ? 0.2 : 0;
    
    const baseConfidence = (performanceGap + effectivenessGap) * 0.5;
    return Math.max(0.1, Math.min(0.95, 
      (baseConfidence * performanceFactor + alignmentBonus) * newModel.confidence
    ));
  }

  private async switchModel(userId: string, newModel: DynamicModel): Promise<void> {
    try {
      // Update user's current model
      await storage.updateUserAutomationConfig(userId, 'currentModel', newModel.modelId);
      
      // Update model usage
      newModel.lastUsed = new Date();
      this.availableModels.set(newModel.modelId, newModel);
      
      logger.info(`Switched to optimal model`, {
        userId,
        newModel: newModel.modelId,
        modelType: newModel.modelType,
        performance: newModel.performance
      });

    } catch (error) {
      logger.error(`Failed to switch model`, { userId, newModel, error });
    }
  }

  async adjustAdaptivePeriods(userId: string, feedback: PerformanceFeedback): Promise<void> {
    try {
      const currentPeriod = this.adaptivePeriods.get(userId);
      const marketVolatility = feedback.contextualFactors.volatility;
      const performance = feedback.metrics.sharpeRatio;
      
      // Determine if we need cooling or heating period
      let newPeriodType: 'cooling' | 'heating';
      let duration: number;
      let trigger: string;
      
      if (performance < 0.2 || marketVolatility > 0.5) {
        // Cooling period - reduce activity, increase caution
        newPeriodType = 'cooling';
        duration = Math.min(3600000, marketVolatility * 7200000); // 1-2 hours max
        trigger = performance < 0.2 ? 'poor_performance' : 'high_volatility';
      } else if (performance > 0.8 && marketVolatility < 0.3) {
        // Heating period - increase activity, take advantage
        newPeriodType = 'heating';
        duration = Math.min(1800000, (performance - 0.5) * 3600000); // 30 minutes max
        trigger = 'good_performance_low_volatility';
      } else {
        // No period change needed
        return;
      }
      
      // Check if we should change period
      if (!currentPeriod || currentPeriod.periodType !== newPeriodType) {
        const parameters = this.calculatePeriodParameters(newPeriodType, feedback);
        
        const newPeriod: AdaptivePeriod = {
          periodType: newPeriodType,
          duration,
          trigger,
          parameters,
          startTime: new Date(),
          endTime: new Date(Date.now() + duration)
        };
        
        this.adaptivePeriods.set(userId, newPeriod);
        
        // Apply period settings
        await this.applyPeriodSettings(userId, newPeriod);
        
        logger.info(`Started adaptive period`, {
          userId,
          periodType: newPeriodType,
          duration: duration / 60000, // minutes
          trigger
        });
      }

    } catch (error) {
      logger.error(`Failed to adjust adaptive periods`, { userId, error });
    }
  }

  private calculatePeriodParameters(periodType: 'cooling' | 'heating', feedback: PerformanceFeedback): any {
    if (periodType === 'cooling') {
      return {
        sensitivity: 0.3, // Lower sensitivity
        responsiveness: 0.4, // Slower response
        riskTolerance: 0.5 // Lower risk tolerance
      };
    } else {
      return {
        sensitivity: 0.8, // Higher sensitivity
        responsiveness: 0.9, // Faster response
        riskTolerance: 1.2 // Higher risk tolerance
      };
    }
  }

  private async applyPeriodSettings(userId: string, period: AdaptivePeriod): Promise<void> {
    try {
      await storage.updateUserAutomationConfig(userId, 'adaptivePeriod', {
        type: period.periodType,
        parameters: period.parameters,
        startTime: period.startTime,
        endTime: period.endTime
      });
    } catch (error) {
      logger.error(`Failed to apply period settings`, { userId, period, error });
    }
  }

  async stopRealTimeOptimization(): Promise<void> {
    this.optimizationActive = false;
    
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = undefined;
    }
    
    logger.info(`Stopped real-time optimization`);
  }

  // Public interface methods
  getOptimizationTargets(userId: string): OptimizationTarget[] {
    return this.optimizationTargets.get(userId) || [];
  }

  getPerformanceHistory(userId: string): PerformanceFeedback[] {
    return this.performanceHistory.get(userId) || [];
  }

  getAvailableModels(): DynamicModel[] {
    return Array.from(this.availableModels.values());
  }

  getCurrentAdaptivePeriod(userId: string): AdaptivePeriod | null {
    return this.adaptivePeriods.get(userId) || null;
  }

  getOptimizationStatus(): any {
    return {
      active: this.optimizationActive,
      userCount: this.optimizationTargets.size,
      totalOptimizations: Array.from(this.optimizationTargets.values())
        .reduce((sum, targets) => sum + targets.length, 0),
      activeModels: this.availableModels.size
    };
  }
}

export const realTimeOptimizationEngine = new RealTimeOptimizationEngine();