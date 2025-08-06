/**
 * Meta-Learning Systems - Revolutionary Self-Improving Intelligence
 * 
 * Learning to learn, strategy immune systems, and predictive strategy generation
 */

import { storage } from '../storage';
import { logger } from '../utils/logger';
import { adaptiveLearningEngine } from './adaptiveLearning';
import { dataFusionEngine } from './dataFusionEngine';

export interface LearningPattern {
  patternId: string;
  marketCondition: string;
  successfulApproaches: string[];
  failedApproaches: string[];
  adaptationSpeed: number;
  confidence: number;
  lastSeen: Date;
}

export interface StrategyImmuneSystem {
  strategyId: string;
  healthScore: number;
  antibodies: string[];
  threats: string[];
  immunityLevel: number;
  lastCheck: Date;
}

export interface PredictiveStrategy {
  strategyId: string;
  targetMarketCondition: string;
  confidence: number;
  components: string[];
  expectedPerformance: number;
  readinessScore: number;
  generatedAt: Date;
}

export class MetaLearningEngine {
  private learningPatterns: Map<string, LearningPattern> = new Map();
  private immuneSystems: Map<string, StrategyImmuneSystem> = new Map();
  private predictiveStrategies: PredictiveStrategy[] = [];
  private metaLearningHistory: any[] = [];

  constructor() {
    this.initializeLearningPatterns();
  }

  private initializeLearningPatterns() {
    const basePatterns: LearningPattern[] = [
      {
        patternId: 'bull_market_adaptation',
        marketCondition: 'bull',
        successfulApproaches: ['momentum_following', 'breakout_trading', 'trend_continuation'],
        failedApproaches: ['mean_reversion', 'contrarian_signals'],
        adaptationSpeed: 0.8,
        confidence: 0.85,
        lastSeen: new Date()
      },
      {
        patternId: 'bear_market_adaptation',
        marketCondition: 'bear',
        successfulApproaches: ['defensive_positioning', 'volatility_trading', 'safe_haven_rotation'],
        failedApproaches: ['aggressive_growth', 'leverage_amplification'],
        adaptationSpeed: 0.9,
        confidence: 0.82,
        lastSeen: new Date()
      },
      {
        patternId: 'volatile_market_adaptation',
        marketCondition: 'volatile',
        successfulApproaches: ['rapid_adaptation', 'short_timeframes', 'risk_management'],
        failedApproaches: ['long_hold_strategies', 'high_leverage'],
        adaptationSpeed: 0.95,
        confidence: 0.78,
        lastSeen: new Date()
      },
      {
        patternId: 'sideways_market_adaptation',
        marketCondition: 'sideways',
        successfulApproaches: ['range_trading', 'theta_strategies', 'mean_reversion'],
        failedApproaches: ['trend_following', 'momentum_strategies'],
        adaptationSpeed: 0.7,
        confidence: 0.75,
        lastSeen: new Date()
      }
    ];

    basePatterns.forEach(pattern => {
      this.learningPatterns.set(pattern.patternId, pattern);
    });
  }

  async learnToLearn(userId: string): Promise<void> {
    try {
      // Analyze user's learning patterns across different market conditions
      const userTrades = await storage.getUserTrades(userId, 100);
      const marketRegimes = await this.extractMarketRegimesFromTrades(userTrades);
      
      // Identify meta-patterns in user's adaptation behavior
      const metaPatterns = this.identifyMetaPatterns(userTrades, marketRegimes);
      
      // Update learning patterns based on discoveries
      for (const pattern of metaPatterns) {
        await this.updateLearningPattern(pattern);
      }

      // Generate new learning strategies
      const newLearningApproaches = await this.generateLearningApproaches(metaPatterns);
      
      // Apply meta-learning improvements
      await this.applyMetaLearningImprovements(userId, newLearningApproaches);

      logger.info(`Meta-learning analysis completed`, { 
        userId, 
        patternsFound: metaPatterns.length,
        newApproaches: newLearningApproaches.length
      });

    } catch (error) {
      logger.error(`Meta-learning analysis failed`, { userId, error });
    }
  }

  private async extractMarketRegimesFromTrades(trades: any[]): Promise<any[]> {
    const regimes = [];
    
    for (const trade of trades) {
      const regime = await storage.getCurrentMarketRegime(trade.symbol);
      if (regime) {
        regimes.push({
          tradeId: trade.id,
          regime: regime.regime,
          timestamp: trade.createdAt,
          performance: trade.pnl || 0
        });
      }
    }
    
    return regimes;
  }

  private identifyMetaPatterns(trades: any[], regimes: any[]): any[] {
    const patterns = [];

    // Pattern 1: Adaptation speed analysis
    const adaptationSpeed = this.analyzeAdaptationSpeed(trades, regimes);
    if (adaptationSpeed) patterns.push(adaptationSpeed);

    // Pattern 2: Learning efficiency patterns
    const learningEfficiency = this.analyzeLearningEfficiency(trades);
    if (learningEfficiency) patterns.push(learningEfficiency);

    // Pattern 3: Strategy switching patterns
    const switchingPatterns = this.analyzeSwitchingPatterns(trades, regimes);
    patterns.push(...switchingPatterns);

    return patterns;
  }

  private analyzeAdaptationSpeed(trades: any[], regimes: any[]): any | null {
    if (regimes.length < 10) return null;

    // Group trades by regime transitions
    const transitions = this.identifyRegimeTransitions(regimes);
    
    if (transitions.length === 0) return null;

    // Calculate average time to adapt to new regime
    const adaptationTimes = transitions.map(transition => {
      const tradesAfterTransition = trades.filter(trade => 
        new Date(trade.createdAt) > transition.transitionTime
      ).slice(0, 5); // First 5 trades after transition

      if (tradesAfterTransition.length === 0) return null;

      const adaptationSuccess = tradesAfterTransition.filter(trade => 
        (trade.pnl || 0) > 0
      ).length / tradesAfterTransition.length;

      return {
        transitionType: `${transition.fromRegime}-to-${transition.toRegime}`,
        adaptationTime: tradesAfterTransition.length,
        successRate: adaptationSuccess
      };
    }).filter(Boolean);

    if (adaptationTimes.length === 0) return null;

    const avgAdaptationTime = adaptationTimes.reduce((sum, a) => sum + (a?.adaptationTime || 0), 0) / adaptationTimes.length;
    const avgSuccessRate = adaptationTimes.reduce((sum, a) => sum + (a?.successRate || 0), 0) / adaptationTimes.length;

    return {
      type: 'adaptation_speed',
      avgAdaptationTime,
      avgSuccessRate,
      efficiency: avgSuccessRate / Math.max(1, avgAdaptationTime),
      confidence: Math.min(0.9, adaptationTimes.length / 10)
    };
  }

  private identifyRegimeTransitions(regimes: any[]): any[] {
    const transitions = [];
    
    for (let i = 1; i < regimes.length; i++) {
      if (regimes[i].regime !== regimes[i-1].regime) {
        transitions.push({
          fromRegime: regimes[i-1].regime,
          toRegime: regimes[i].regime,
          transitionTime: new Date(regimes[i].timestamp)
        });
      }
    }
    
    return transitions;
  }

  private analyzeLearningEfficiency(trades: any[]): any | null {
    if (trades.length < 20) return null;

    // Analyze improvement over time
    const chunks = this.chunkTrades(trades, 10); // Groups of 10 trades
    const chunkPerformances = chunks.map(chunk => {
      const totalPnl = chunk.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
      const winRate = chunk.filter(trade => (trade.pnl || 0) > 0).length / chunk.length;
      return { totalPnl, winRate };
    });

    // Calculate learning trend
    const trend = this.calculatePerformanceTrend(chunkPerformances);
    
    return {
      type: 'learning_efficiency',
      trend,
      acceleration: this.calculateLearningAcceleration(chunkPerformances),
      consistency: this.calculateConsistency(chunkPerformances),
      confidence: Math.min(0.9, chunks.length / 10)
    };
  }

  private chunkTrades(trades: any[], chunkSize: number): any[][] {
    const chunks = [];
    for (let i = 0; i < trades.length; i += chunkSize) {
      chunks.push(trades.slice(i, i + chunkSize));
    }
    return chunks.filter(chunk => chunk.length === chunkSize);
  }

  private calculatePerformanceTrend(performances: any[]): number {
    if (performances.length < 3) return 0;

    // Simple linear trend calculation
    const n = performances.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += performances[i].totalPnl;
      sumXY += i * performances[i].totalPnl;
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  private calculateLearningAcceleration(performances: any[]): number {
    if (performances.length < 3) return 0;

    const trends = [];
    for (let i = 0; i < performances.length - 2; i++) {
      const segment = performances.slice(i, i + 3);
      trends.push(this.calculatePerformanceTrend(segment));
    }

    // Calculate acceleration as change in trend
    return trends.length > 1 ? 
      (trends[trends.length - 1] - trends[0]) / trends.length : 0;
  }

  private calculateConsistency(performances: any[]): number {
    if (performances.length === 0) return 0;

    const winRates = performances.map(p => p.winRate);
    const mean = winRates.reduce((sum, wr) => sum + wr, 0) / winRates.length;
    const variance = winRates.reduce((sum, wr) => sum + Math.pow(wr - mean, 2), 0) / winRates.length;
    
    // Consistency is inverse of variance (lower variance = higher consistency)
    return 1 / (1 + variance);
  }

  private analyzeSwitchingPatterns(trades: any[], regimes: any[]): any[] {
    const patterns = [];

    // Analyze strategy switching frequency
    const strategySwitches = this.identifyStrategySwitches(trades);
    
    if (strategySwitches.length > 0) {
      patterns.push({
        type: 'strategy_switching',
        frequency: strategySwitches.length / Math.max(1, trades.length / 30), // Switches per 30 trades
        effectiveness: this.calculateSwitchingEffectiveness(strategySwitches, trades),
        timing: this.analyzeSwitchingTiming(strategySwitches, regimes)
      });
    }

    return patterns;
  }

  private identifyStrategySwitches(trades: any[]): any[] {
    const switches = [];
    let currentStrategy = null;

    for (const trade of trades) {
      if (trade.strategy && trade.strategy !== currentStrategy) {
        switches.push({
          fromStrategy: currentStrategy,
          toStrategy: trade.strategy,
          timestamp: trade.createdAt,
          tradeId: trade.id
        });
        currentStrategy = trade.strategy;
      }
    }

    return switches;
  }

  private calculateSwitchingEffectiveness(switches: any[], trades: any[]): number {
    if (switches.length === 0) return 0;

    let totalImprovement = 0;

    for (const switchEvent of switches) {
      const tradesBefore = trades.filter(t => 
        new Date(t.createdAt) < new Date(switchEvent.timestamp)
      ).slice(-5); // 5 trades before switch

      const tradesAfter = trades.filter(t => 
        new Date(t.createdAt) > new Date(switchEvent.timestamp)
      ).slice(0, 5); // 5 trades after switch

      if (tradesBefore.length > 0 && tradesAfter.length > 0) {
        const performanceBefore = tradesBefore.reduce((sum, t) => sum + (t.pnl || 0), 0) / tradesBefore.length;
        const performanceAfter = tradesAfter.reduce((sum, t) => sum + (t.pnl || 0), 0) / tradesAfter.length;
        
        totalImprovement += performanceAfter - performanceBefore;
      }
    }

    return totalImprovement / switches.length;
  }

  private analyzeSwitchingTiming(switches: any[], regimes: any[]): any {
    if (switches.length === 0 || regimes.length === 0) {
      return { proactiveRatio: 0, reactiveRatio: 0 };
    }

    let proactiveSwitches = 0;
    let reactiveSwitches = 0;

    for (const switchEvent of switches) {
      const nearbyRegimeChanges = regimes.filter(regime => {
        const timeDiff = Math.abs(
          new Date(regime.timestamp).getTime() - new Date(switchEvent.timestamp).getTime()
        );
        return timeDiff < 24 * 60 * 60 * 1000; // Within 24 hours
      });

      if (nearbyRegimeChanges.length > 0) {
        const regimeChange = nearbyRegimeChanges[0];
        const switchTime = new Date(switchEvent.timestamp).getTime();
        const regimeTime = new Date(regimeChange.timestamp).getTime();

        if (switchTime < regimeTime) {
          proactiveSwitches++;
        } else {
          reactiveSwitches++;
        }
      }
    }

    const total = proactiveSwitches + reactiveSwitches;
    return {
      proactiveRatio: total > 0 ? proactiveSwitches / total : 0,
      reactiveRatio: total > 0 ? reactiveSwitches / total : 0
    };
  }

  async createStrategyImmuneSystem(strategyId: string): Promise<StrategyImmuneSystem> {
    try {
      // Analyze strategy vulnerabilities
      const vulnerabilities = await this.analyzeStrategyVulnerabilities(strategyId);
      
      // Generate antibodies (protective mechanisms)
      const antibodies = this.generateAntibodies(vulnerabilities);
      
      // Identify potential threats
      const threats = await this.identifyThreats(strategyId);
      
      // Calculate immunity level
      const immunityLevel = this.calculateImmunityLevel(antibodies, threats, vulnerabilities);

      const immuneSystem: StrategyImmuneSystem = {
        strategyId,
        healthScore: 0.8, // Initial health score
        antibodies,
        threats,
        immunityLevel,
        lastCheck: new Date()
      };

      this.immuneSystems.set(strategyId, immuneSystem);

      logger.info(`Created strategy immune system`, { 
        strategyId, 
        immunityLevel, 
        antibodyCount: antibodies.length,
        threatCount: threats.length
      });

      return immuneSystem;

    } catch (error) {
      logger.error(`Failed to create strategy immune system`, { strategyId, error });
      throw error;
    }
  }

  private async analyzeStrategyVulnerabilities(strategyId: string): Promise<string[]> {
    const vulnerabilities = [];

    // Common strategy vulnerabilities
    const commonVulnerabilities = [
      'regime_change_sensitivity',
      'volatility_spike_exposure',
      'correlation_breakdown_risk',
      'liquidity_crisis_vulnerability',
      'sentiment_whipsaw_exposure'
    ];

    // Simulate vulnerability assessment (in real implementation, analyze historical performance)
    for (const vulnerability of commonVulnerabilities) {
      if (Math.random() > 0.6) { // 40% chance of vulnerability
        vulnerabilities.push(vulnerability);
      }
    }

    return vulnerabilities;
  }

  private generateAntibodies(vulnerabilities: string[]): string[] {
    const antibodyMap: Record<string, string[]> = {
      'regime_change_sensitivity': ['dynamic_regime_detection', 'adaptive_position_sizing'],
      'volatility_spike_exposure': ['volatility_circuit_breakers', 'position_size_adjustment'],
      'correlation_breakdown_risk': ['correlation_monitoring', 'portfolio_diversification'],
      'liquidity_crisis_vulnerability': ['liquidity_checks', 'emergency_exit_protocols'],
      'sentiment_whipsaw_exposure': ['sentiment_smoothing', 'contrarian_filters']
    };

    const antibodies = [];
    for (const vulnerability of vulnerabilities) {
      const possibleAntibodies = antibodyMap[vulnerability] || [];
      antibodies.push(...possibleAntibodies);
    }

    return Array.from(new Set(antibodies)); // Remove duplicates
  }

  private async identifyThreats(strategyId: string): Promise<string[]> {
    const threats = [];

    // Market-based threats
    const marketConditions = await storage.getCurrentMarketRegime('BTC/USD');
    if (marketConditions?.volatility > 0.4) {
      threats.push('high_volatility_environment');
    }

    // Correlation-based threats
    const correlationAlerts = await dataFusionEngine.analyzeCorrelationAlerts();
    if (correlationAlerts.length > 0) {
      threats.push('correlation_risk_spike');
    }

    // Add other threat detection logic
    threats.push('regulatory_uncertainty', 'market_manipulation_risk');

    return threats;
  }

  private calculateImmunityLevel(antibodies: string[], threats: string[], vulnerabilities: string[]): number {
    const antibodyStrength = antibodies.length * 0.2;
    const threatPressure = threats.length * 0.15;
    const vulnerabilityWeakness = vulnerabilities.length * 0.1;

    const immunityLevel = Math.max(0.1, Math.min(1.0, 
      0.5 + antibodyStrength - threatPressure - vulnerabilityWeakness
    ));

    return immunityLevel;
  }

  async generatePredictiveStrategies(): Promise<PredictiveStrategy[]> {
    try {
      const newStrategies: PredictiveStrategy[] = [];

      // Predict future market conditions
      const marketPredictions = await this.predictFutureMarketConditions();

      for (const prediction of marketPredictions) {
        const strategy = await this.generateStrategyForCondition(prediction);
        if (strategy) {
          newStrategies.push(strategy);
        }
      }

      // Add to predictive strategies collection
      this.predictiveStrategies.push(...newStrategies);

      // Keep only most recent 20 strategies
      this.predictiveStrategies = this.predictiveStrategies
        .sort((a, b) => b.readinessScore - a.readinessScore)
        .slice(0, 20);

      logger.info(`Generated predictive strategies`, { 
        newCount: newStrategies.length,
        totalCount: this.predictiveStrategies.length
      });

      return newStrategies;

    } catch (error) {
      logger.error(`Failed to generate predictive strategies`, { error });
      return [];
    }
  }

  private async predictFutureMarketConditions(): Promise<any[]> {
    // Simplified market condition prediction
    const currentRegime = await storage.getCurrentMarketRegime('BTC/USD');
    const correlationData = await storage.getAllCorrelationData();
    
    const predictions = [
      {
        condition: 'bull_continuation',
        probability: currentRegime?.regime === 'bull' ? 0.7 : 0.3,
        timeframe: '7d',
        catalysts: ['institutional_adoption', 'regulatory_clarity']
      },
      {
        condition: 'volatility_spike',
        probability: correlationData.length > 10 ? 0.6 : 0.4,
        timeframe: '3d',
        catalysts: ['correlation_breakdown', 'liquidity_crisis']
      },
      {
        condition: 'regime_transition',
        probability: 0.4,
        timeframe: '14d',
        catalysts: ['macro_shift', 'sentiment_reversal']
      }
    ];

    return predictions.filter(p => p.probability > 0.5);
  }

  private async generateStrategyForCondition(prediction: any): Promise<PredictiveStrategy | null> {
    try {
      const strategyComponents = this.selectOptimalComponents(prediction.condition);
      const expectedPerformance = this.estimatePerformance(prediction, strategyComponents);
      const readinessScore = this.calculateReadinessScore(prediction, strategyComponents);

      if (readinessScore < 0.6) return null; // Only generate high-confidence strategies

      return {
        strategyId: `predictive_${prediction.condition}_${Date.now()}`,
        targetMarketCondition: prediction.condition,
        confidence: prediction.probability,
        components: strategyComponents,
        expectedPerformance,
        readinessScore,
        generatedAt: new Date()
      };

    } catch (error) {
      logger.error(`Failed to generate strategy for condition`, { prediction, error });
      return null;
    }
  }

  private selectOptimalComponents(condition: string): string[] {
    const componentMap: Record<string, string[]> = {
      'bull_continuation': ['momentum_indicators', 'breakout_detection', 'trend_following'],
      'volatility_spike': ['volatility_trading', 'option_strategies', 'risk_management'],
      'regime_transition': ['adaptive_positioning', 'regime_detection', 'defensive_hedging']
    };

    return componentMap[condition] || ['balanced_approach', 'risk_management'];
  }

  private estimatePerformance(prediction: any, components: string[]): number {
    // Simplified performance estimation
    const basePerformance = 0.1; // 10% base expected return
    const probabilityBonus = prediction.probability * 0.1;
    const componentBonus = components.length * 0.02;

    return basePerformance + probabilityBonus + componentBonus;
  }

  private calculateReadinessScore(prediction: any, components: string[]): number {
    const probabilityScore = prediction.probability;
    const componentScore = Math.min(1.0, components.length / 5);
    const timeframeScore = prediction.timeframe === '7d' ? 0.8 : 0.6;

    return (probabilityScore + componentScore + timeframeScore) / 3;
  }

  // Update and maintenance methods
  private async updateLearningPattern(pattern: any): Promise<void> {
    try {
      const existingPattern = this.learningPatterns.get(pattern.type);
      
      if (existingPattern) {
        // Update existing pattern with new learnings
        existingPattern.confidence = (existingPattern.confidence + pattern.confidence) / 2;
        existingPattern.adaptationSpeed = pattern.efficiency || existingPattern.adaptationSpeed;
        existingPattern.lastSeen = new Date();
      } else {
        // Create new learning pattern
        const newPattern: LearningPattern = {
          patternId: pattern.type,
          marketCondition: 'general',
          successfulApproaches: [],
          failedApproaches: [],
          adaptationSpeed: pattern.efficiency || 0.5,
          confidence: pattern.confidence,
          lastSeen: new Date()
        };
        
        this.learningPatterns.set(pattern.type, newPattern);
      }

      this.metaLearningHistory.push({
        timestamp: new Date(),
        patternType: pattern.type,
        update: pattern,
        action: 'pattern_update'
      });

    } catch (error) {
      logger.error(`Failed to update learning pattern`, { pattern, error });
    }
  }

  private async generateLearningApproaches(metaPatterns: any[]): Promise<string[]> {
    const approaches = [];

    for (const pattern of metaPatterns) {
      switch (pattern.type) {
        case 'adaptation_speed':
          if (pattern.efficiency < 0.5) {
            approaches.push('increase_adaptation_sensitivity');
            approaches.push('implement_early_warning_system');
          }
          break;

        case 'learning_efficiency':
          if (pattern.trend < 0) {
            approaches.push('reset_learning_parameters');
            approaches.push('diversify_learning_sources');
          }
          break;

        case 'strategy_switching':
          if (pattern.effectiveness < 0) {
            approaches.push('improve_switching_criteria');
            approaches.push('add_switching_delays');
          }
          break;
      }
    }

    return Array.from(new Set(approaches));
  }

  private async applyMetaLearningImprovements(userId: string, approaches: string[]): Promise<void> {
    for (const approach of approaches) {
      switch (approach) {
        case 'increase_adaptation_sensitivity':
          await this.increaseAdaptationSensitivity(userId);
          break;
        case 'implement_early_warning_system':
          await this.implementEarlyWarningSystem(userId);
          break;
        case 'reset_learning_parameters':
          await this.resetLearningParameters(userId);
          break;
        // Add more improvement implementations
      }
    }
  }

  private async increaseAdaptationSensitivity(userId: string): Promise<void> {
    // Adjust user's adaptation parameters
    await storage.updateUserAutomationConfig(userId, 'adaptation', {
      sensitivity: 0.8,
      responseSpeed: 'high',
      learningRate: 0.15
    });
  }

  private async implementEarlyWarningSystem(userId: string): Promise<void> {
    // Enable early warning systems
    await storage.updateUserAutomationConfig(userId, 'earlyWarning', {
      enabled: true,
      regimeChangeThreshold: 0.7,
      correlationAlertLevel: 0.85,
      volatilityThreshold: 0.4
    });
  }

  private async resetLearningParameters(userId: string): Promise<void> {
    // Reset learning parameters to defaults
    await storage.updateUserAutomationConfig(userId, 'learning', {
      resetTimestamp: new Date(),
      learningRate: 0.1,
      adaptationSpeed: 0.5,
      memoryDecay: 0.05
    });
  }

  // Public interface methods
  getLearningPatterns(): LearningPattern[] {
    return Array.from(this.learningPatterns.values());
  }

  getImmuneSystemStatus(strategyId: string): StrategyImmuneSystem | null {
    return this.immuneSystems.get(strategyId) || null;
  }

  getPredictiveStrategies(): PredictiveStrategy[] {
    return [...this.predictiveStrategies];
  }

  getMetaLearningHistory(): any[] {
    return [...this.metaLearningHistory];
  }
}

export const metaLearningEngine = new MetaLearningEngine();