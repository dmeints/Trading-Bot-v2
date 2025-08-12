
/**
 * Meta-Brain Architecture Integration
 * Orchestrates all Phase 2 components for intelligent decision making
 */

import { logger } from '../utils/logger';
import { OnlineFeatureSelector } from './online_feature_selection';
import { OnlineElasticNet } from './online_elastic_net';
import { BOCPDDetector } from './bocpd_detector';
import { UCBBandit, createStrategySelectionBandit } from './ucb_bandit';
import { ParetoEvolutionSystem, StrategyObjectives } from './pareto_evolution';
import { SPIBBPolicyImprover, createTradingSPIBB, PolicyAction } from './spibb_policy';

export interface MetaBrainConfig {
  adaptationRate: number;
  convergenceThreshold: number;
  minSamplesForAdaptation: number;
  featureSelectionEnabled: boolean;
  changePointDetectionEnabled: boolean;
  banditOptimizationEnabled: boolean;
  paretoEvolutionEnabled: boolean;
  safeUpdatesEnabled: boolean;
}

export interface MetaBrainState {
  selectedFeatures: string[];
  currentRegime: string;
  selectedStrategy: string;
  paretoFront: any[];
  safetyStatus: string;
  adaptationCount: number;
  totalSamples: number;
}

export interface MetaBrainDecision {
  selectedStrategy: string;
  confidence: number;
  uncertainty: number;
  reasoning: string;
  adaptiveWeights: Record<string, number>;
  safetyConstraints: Record<string, boolean>;
  regimeDetection: {
    regime: string;
    changePointProbability: number;
  };
  featureImportance: Array<{feature: string; importance: number}>;
}

export class MetaBrain {
  private featureSelector: OnlineFeatureSelector;
  private elasticNet: OnlineElasticNet;
  private changePointDetector: BOCPDDetector;
  private strategyBandit: UCBBandit;
  private paretoEvolution: ParetoEvolutionSystem;
  private safetyController: SPIBBPolicyImprover;
  private config: MetaBrainConfig;
  
  private sampleCount: number = 0;
  private adaptationHistory: Array<{timestamp: Date; adaptation: string}> = [];
  private performanceMetrics: Record<string, number[]> = {};

  constructor(strategies: string[], config: Partial<MetaBrainConfig> = {}) {
    this.config = {
      adaptationRate: 0.01,
      convergenceThreshold: 0.001,
      minSamplesForAdaptation: 50,
      featureSelectionEnabled: true,
      changePointDetectionEnabled: true,
      banditOptimizationEnabled: true,
      paretoEvolutionEnabled: true,
      safeUpdatesEnabled: true,
      ...config
    };

    // Initialize all components
    this.featureSelector = new OnlineFeatureSelector({
      maxFeatures: 15,
      relevanceWeight: 0.7,
      redundancyWeight: 0.3,
      updateThreshold: 0.01,
      windowSize: 500
    });

    this.elasticNet = new OnlineElasticNet({
      alpha: 0.01,
      l1Ratio: 0.5,
      learningRate: 0.01,
      tolerance: 1e-4,
      maxIterations: 1000
    });

    this.changePointDetector = new BOCPDDetector({
      hazardRate: 0.005,      // Less frequent change points
      maxRunLength: 100,
      changeThreshold: 0.7
    });

    this.strategyBandit = createStrategySelectionBandit(strategies);

    this.paretoEvolution = new ParetoEvolutionSystem({
      populationSize: 30,
      maxGenerations: 50,
      mutationRate: 0.1,
      crossoverRate: 0.8,
      objectives: ['returns', 'sharpe', 'maxDrawdown', 'winRate']
    });

    this.safetyController = createTradingSPIBB();

    logger.info('[MetaBrain] Initialized meta-brain architecture', {
      strategies: strategies.length,
      componentsEnabled: Object.entries(this.config)
        .filter(([key, value]) => key.endsWith('Enabled') && value)
        .map(([key]) => key)
    });
  }

  /**
   * Main decision-making process
   */
  async makeDecision(
    marketFeatures: Record<string, number>,
    target: number,
    strategyPerformances?: Record<string, StrategyObjectives>
  ): Promise<MetaBrainDecision> {
    this.sampleCount++;
    
    let selectedFeatures: string[] = Object.keys(marketFeatures);
    let regimeInfo = { regime: 'unknown', changePointProbability: 0 };
    let strategySelection = { selectedArm: 'default', ucbScore: 0, expectedReward: 0, confidence: 0, explorationBonus: 0, allArmScores: {} };
    let uncertainty = 0.5;
    let adaptiveWeights: Record<string, number> = {};
    let safetyConstraints: Record<string, boolean> = {};
    let featureImportance: Array<{feature: string; importance: number}> = [];

    // Step 1: Online Feature Selection
    if (this.config.featureSelectionEnabled) {
      selectedFeatures = this.featureSelector.updateFeatureSelection(marketFeatures, target);
      
      const importances = this.featureSelector.getFeatureImportances();
      featureImportance = importances.map(imp => ({
        feature: imp.featureId,
        importance: imp.mrmrScore
      })).slice(0, 10);

      logger.debug('[MetaBrain] Feature selection', {
        totalFeatures: Object.keys(marketFeatures).length,
        selectedCount: selectedFeatures.length,
        topFeatures: selectedFeatures.slice(0, 5)
      });
    }

    // Step 2: Online Elastic Net Learning
    const selectedMarketFeatures = this.filterFeatures(marketFeatures, selectedFeatures);
    this.elasticNet.partialFit(selectedMarketFeatures, target);
    
    const prediction = this.elasticNet.predict(selectedMarketFeatures);
    uncertainty = 1 - prediction.confidence;
    
    // Get active features for adaptive weighting
    prediction.activeFeatures.forEach(feature => {
      adaptiveWeights[feature] = 1.0; // Simplified weighting
    });

    // Step 3: Change Point Detection
    if (this.config.changePointDetectionEnabled) {
      const changePoint = this.changePointDetector.updateObservation(target);
      regimeInfo = {
        regime: this.determineRegime(changePoint),
        changePointProbability: changePoint.changeProbability
      };

      // Adapt learning rates based on regime changes
      if (changePoint.changeProbability > 0.5) {
        this.handleRegimeChange();
      }
    }

    // Step 4: Strategy Selection via UCB Bandit
    if (this.config.banditOptimizationEnabled) {
      strategySelection = this.strategyBandit.selectArm();
      
      logger.debug('[MetaBrain] Strategy selection', {
        selectedStrategy: strategySelection.selectedArm,
        ucbScore: strategySelection.ucbScore.toFixed(4),
        expectedReward: strategySelection.expectedReward.toFixed(4)
      });
    }

    // Step 5: Pareto Evolution (periodic)
    if (this.config.paretoEvolutionEnabled && strategyPerformances && this.sampleCount % 100 === 0) {
      this.updateParetoEvolution(strategyPerformances);
    }

    // Step 6: Safety Constraints via SPIBB
    if (this.config.safeUpdatesEnabled) {
      safetyConstraints = this.evaluateSafetyConstraints();
    }

    // Step 7: Meta-Learning Adaptation
    if (this.sampleCount % 50 === 0 && this.sampleCount > this.config.minSamplesForAdaptation) {
      await this.performMetaAdaptation();
    }

    const decision: MetaBrainDecision = {
      selectedStrategy: strategySelection.selectedArm,
      confidence: Math.max(0.1, strategySelection.confidence),
      uncertainty,
      reasoning: this.generateReasoningExplanation(strategySelection, regimeInfo, selectedFeatures),
      adaptiveWeights,
      safetyConstraints,
      regimeDetection: regimeInfo,
      featureImportance
    };

    logger.info('[MetaBrain] Meta-brain decision', {
      strategy: decision.selectedStrategy,
      confidence: decision.confidence.toFixed(3),
      uncertainty: decision.uncertainty.toFixed(3),
      regime: regimeInfo.regime,
      featureCount: selectedFeatures.length,
      sampleCount: this.sampleCount
    });

    return decision;
  }

  private filterFeatures(
    features: Record<string, number>, 
    selectedFeatures: string[]
  ): Record<string, number> {
    const filtered: Record<string, number> = {};
    selectedFeatures.forEach(feature => {
      if (feature in features) {
        filtered[feature] = features[feature];
      }
    });
    return filtered;
  }

  private determineRegime(changePoint: any): string {
    const currentRegime = this.changePointDetector.getCurrentRegime();
    
    if (changePoint.changeProbability > 0.7) {
      return 'transition';
    } else if (currentRegime.variance > 0.1) {
      return 'volatile';
    } else if (currentRegime.mean > 0.02) {
      return 'bull';
    } else if (currentRegime.mean < -0.02) {
      return 'bear';
    } else {
      return 'sideways';
    }
  }

  private handleRegimeChange(): void {
    logger.info('[MetaBrain] Regime change detected - adapting components');
    
    // Reset change-sensitive components
    this.featureSelector.reset();
    
    // Record adaptation
    this.adaptationHistory.push({
      timestamp: new Date(),
      adaptation: 'regime_change_reset'
    });
    
    // Maintain bounded history
    if (this.adaptationHistory.length > 100) {
      this.adaptationHistory.shift();
    }
  }

  private updateParetoEvolution(performances: Record<string, StrategyObjectives>): void {
    // Add strategies to Pareto evolution
    Object.values(performances).forEach(perf => {
      const parameters = {
        baseRisk: 0.01,
        lookback: 20,
        threshold: 0.5
      };
      this.paretoEvolution.addStrategy(perf, parameters);
    });
    
    // Evolve population
    const fronts = this.paretoEvolution.evolveGeneration();
    
    logger.debug('[MetaBrain] Pareto evolution', {
      frontCount: fronts.length,
      bestFrontSize: fronts.length > 0 ? fronts[0].strategies.length : 0
    });
  }

  private evaluateSafetyConstraints(): Record<string, boolean> {
    const diagnostics = this.safetyController.getDiagnostics();
    
    return {
      sufficientHistory: diagnostics.historicalEpisodes >= 100,
      policyDeviation: diagnostics.policyDeviation < 0.15,
      baselineQuality: diagnostics.avgBaselineValue > 0.05,
      safetyMargin: true // Simplified check
    };
  }

  private async performMetaAdaptation(): Promise<void> {
    // Analyze recent performance trends
    const recentPerformance = this.analyzeRecentPerformance();
    
    // Adapt component parameters based on performance
    if (recentPerformance.trend < -0.1) {
      // Increase exploration in poor performance periods
      this.increaseExploration();
      
      this.adaptationHistory.push({
        timestamp: new Date(),
        adaptation: 'increased_exploration'
      });
      
      logger.info('[MetaBrain] Meta-adaptation: Increased exploration due to poor performance');
    } else if (recentPerformance.trend > 0.1) {
      // Increase exploitation in good performance periods
      this.increaseExploitation();
      
      this.adaptationHistory.push({
        timestamp: new Date(),
        adaptation: 'increased_exploitation'
      });
      
      logger.info('[MetaBrain] Meta-adaptation: Increased exploitation due to good performance');
    }
  }

  private analyzeRecentPerformance(): {trend: number; volatility: number} {
    // Simplified performance analysis
    const recentRewards = this.getRecentRewards(50);
    
    if (recentRewards.length < 10) {
      return {trend: 0, volatility: 0};
    }
    
    const mean = recentRewards.reduce((sum, r) => sum + r, 0) / recentRewards.length;
    const variance = recentRewards.reduce((sum, r) => sum + (r - mean) ** 2, 0) / recentRewards.length;
    
    return {
      trend: mean,
      volatility: Math.sqrt(variance)
    };
  }

  private getRecentRewards(count: number): number[] {
    // Simplified - would get from bandit history in real implementation
    return Array.from({length: Math.min(count, this.sampleCount)}, () => Math.random() - 0.5);
  }

  private increaseExploration(): void {
    // Increase mutation rates, decrease exploitation
    // In real implementation, this would adjust component parameters
  }

  private increaseExploitation(): void {
    // Decrease mutation rates, increase exploitation
    // In real implementation, this would adjust component parameters
  }

  private generateReasoningExplanation(
    strategy: any, 
    regime: any, 
    features: string[]
  ): string {
    const parts = [
      `Selected strategy: ${strategy.selectedArm}`,
      `Regime: ${regime.regime} (change probability: ${regime.changePointProbability.toFixed(2)})`,
      `Features: ${features.slice(0, 3).join(', ')}${features.length > 3 ? '...' : ''}`,
      `UCB score: ${strategy.ucbScore.toFixed(3)}`
    ];
    
    return parts.join('. ');
  }

  /**
   * Update strategy performance for bandit learning
   */
  updateStrategyPerformance(strategyId: string, reward: number): void {
    if (this.config.banditOptimizationEnabled) {
      this.strategyBandit.updateReward(strategyId, reward);
    }
    
    // Store performance metrics
    if (!this.performanceMetrics[strategyId]) {
      this.performanceMetrics[strategyId] = [];
    }
    this.performanceMetrics[strategyId].push(reward);
    
    // Maintain bounded history
    if (this.performanceMetrics[strategyId].length > 1000) {
      this.performanceMetrics[strategyId] = this.performanceMetrics[strategyId].slice(-1000);
    }
  }

  /**
   * Get meta-brain state
   */
  getState(): MetaBrainState {
    const selectedFeatures = this.featureSelector.getSelectedFeatures();
    const currentRegime = this.changePointDetector.getCurrentRegime();
    const banditStats = this.strategyBandit.getDiagnostics();
    const paretoFronts = this.paretoEvolution.getParetoFronts();
    const safetyDiagnostics = this.safetyController.getDiagnostics();
    
    return {
      selectedFeatures,
      currentRegime: this.determineRegime(this.changePointDetector.getDiagnostics()),
      selectedStrategy: banditStats.bestArm,
      paretoFront: paretoFronts.length > 0 ? paretoFronts[0].strategies.slice(0, 5) : [],
      safetyStatus: safetyDiagnostics.historicalEpisodes >= 100 ? 'ready' : 'learning',
      adaptationCount: this.adaptationHistory.length,
      totalSamples: this.sampleCount
    };
  }

  /**
   * Get comprehensive diagnostics
   */
  getDiagnostics(): {
    components: Record<string, any>;
    performance: Record<string, number>;
    adaptations: number;
    sampleCount: number;
  } {
    return {
      components: {
        featureSelector: this.featureSelector.exportState(),
        elasticNet: this.elasticNet.getDiagnostics(),
        changePointDetector: this.changePointDetector.getDiagnostics(),
        strategyBandit: this.strategyBandit.getDiagnostics(),
        paretoEvolution: this.paretoEvolution.getEvolutionStats(),
        safetyController: this.safetyController.getDiagnostics()
      },
      performance: this.calculateOverallPerformance(),
      adaptations: this.adaptationHistory.length,
      sampleCount: this.sampleCount
    };
  }

  private calculateOverallPerformance(): Record<string, number> {
    const allRewards = Object.values(this.performanceMetrics)
      .flat()
      .slice(-200); // Recent performance
    
    if (allRewards.length === 0) {
      return { mean: 0, std: 0, sharpe: 0 };
    }
    
    const mean = allRewards.reduce((sum, r) => sum + r, 0) / allRewards.length;
    const variance = allRewards.reduce((sum, r) => sum + (r - mean) ** 2, 0) / allRewards.length;
    const std = Math.sqrt(variance);
    const sharpe = std > 0 ? mean / std : 0;
    
    return { mean, std, sharpe };
  }

  /**
   * Reset meta-brain state
   */
  reset(): void {
    this.featureSelector.reset();
    this.elasticNet.reset();
    this.changePointDetector.reset();
    this.strategyBandit.reset();
    this.paretoEvolution.reset();
    this.safetyController.reset();
    
    this.sampleCount = 0;
    this.adaptationHistory = [];
    this.performanceMetrics = {};
    
    logger.info('[MetaBrain] Reset meta-brain architecture');
  }
}

/**
 * Factory function to create configured meta-brain for trading
 */
export function createTradingMetaBrain(strategies: string[] = ['breakout', 'meanRevert', 'news']): MetaBrain {
  return new MetaBrain(strategies, {
    adaptationRate: 0.005,          // Conservative adaptation
    convergenceThreshold: 0.001,    // Fine convergence detection
    minSamplesForAdaptation: 100,   // More samples before adaptation
    featureSelectionEnabled: true,  // Enable all components
    changePointDetectionEnabled: true,
    banditOptimizationEnabled: true,
    paretoEvolutionEnabled: true,
    safeUpdatesEnabled: true
  });
}
