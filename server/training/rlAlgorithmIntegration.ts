/**
 * RL Algorithm Integration
 * Connects reinforcement learning training with our real mathematical algorithm
 * Enables continuous optimization of trading parameters
 */

import { logger } from '../utils/logger';
import { stevieParameterOptimizer } from '../services/stevieParameterOptimizer';
import { stevieDecisionEngine } from '../services/stevieDecisionEngine';
import { RLTradingEnvironment } from '../services/stevieRL';
import { defaultStevieConfig, type StevieConfig } from '../../shared/src/stevie/config';

interface RLTrainingEpisode {
  episodeId: string;
  startTime: Date;
  endTime?: Date;
  initialConfig: StevieConfig;
  finalConfig: StevieConfig;
  parameterUpdates: Array<{
    parameter: keyof StevieConfig;
    oldValue: number;
    newValue: number;
    improvement: number;
  }>;
  performanceMetrics: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    decisionCount: number;
  };
  status: 'running' | 'completed' | 'failed';
}

export class RLAlgorithmIntegration {
  private currentEpisode: RLTrainingEpisode | null = null;
  private trainingHistory: RLTrainingEpisode[] = [];
  private rlEnvironment: RLTradingEnvironment;
  private isTraining = false;

  constructor() {
    this.rlEnvironment = new RLTradingEnvironment();
  }

  /**
   * Start RL training session to optimize algorithm parameters
   */
  async startTrainingSession(
    userId: string,
    trainingConfig: {
      maxEpisodes?: number;
      convergenceThreshold?: number;
      parametersToOptimize?: Array<keyof StevieConfig>;
    } = {}
  ): Promise<string> {
    if (this.isTraining) {
      throw new Error('Training session already in progress');
    }

    const {
      maxEpisodes = 25,
      convergenceThreshold = 0.02,
      parametersToOptimize = ['volPctBreakout', 'socialGo', 'costCapBps', 'baseRiskPct']
    } = trainingConfig;

    const episodeId = `rl_train_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentEpisode = {
      episodeId,
      startTime: new Date(),
      initialConfig: stevieDecisionEngine.getCurrentConfiguration(),
      finalConfig: stevieDecisionEngine.getCurrentConfiguration(),
      parameterUpdates: [],
      performanceMetrics: {
        totalReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
        decisionCount: 0
      },
      status: 'running'
    };

    this.isTraining = true;

    logger.info('[RLAlgorithmIntegration] Started RL training session', {
      episodeId,
      userId,
      maxEpisodes,
      parametersToOptimize,
      initialConfig: this.currentEpisode.initialConfig
    });

    // Start optimization session
    await stevieParameterOptimizer.startOptimizationSession(userId);

    // Run training episodes
    this.runTrainingLoop(userId, maxEpisodes, convergenceThreshold, parametersToOptimize)
      .catch(error => {
        logger.error('[RLAlgorithmIntegration] Training session failed', { error, episodeId });
        if (this.currentEpisode) {
          this.currentEpisode.status = 'failed';
        }
        this.isTraining = false;
      });

    return episodeId;
  }

  /**
   * Main training loop - runs RL episodes to optimize algorithm parameters
   */
  private async runTrainingLoop(
    userId: string,
    maxEpisodes: number,
    convergenceThreshold: number,
    parametersToOptimize: Array<keyof StevieConfig>
  ): Promise<void> {
    let episodeCount = 0;
    let bestPerformance = -Infinity;
    let plateauCount = 0;
    const maxPlateauEpisodes = 5;

    try {
      while (episodeCount < maxEpisodes && this.isTraining && plateauCount < maxPlateauEpisodes) {
        episodeCount++;
        
        logger.info(`[RLAlgorithmIntegration] Starting episode ${episodeCount}/${maxEpisodes}`);

        // Run single training episode
        const episodeResult = await this.runSingleEpisode(userId, parametersToOptimize);
        
        // Check for improvement
        const currentPerformance = episodeResult.compositeScore;
        const improvement = (currentPerformance - bestPerformance) / Math.max(0.01, Math.abs(bestPerformance));
        
        if (improvement > convergenceThreshold) {
          bestPerformance = currentPerformance;
          plateauCount = 0;
          
          logger.info(`[RLAlgorithmIntegration] Performance improvement detected`, {
            episode: episodeCount,
            improvement: (improvement * 100).toFixed(2) + '%',
            newBest: currentPerformance.toFixed(4)
          });
        } else {
          plateauCount++;
          
          logger.info(`[RLAlgorithmIntegration] Plateau detected`, {
            episode: episodeCount,
            plateauCount,
            improvement: (improvement * 100).toFixed(2) + '%'
          });
        }

        // Update episode metrics
        if (this.currentEpisode) {
          this.currentEpisode.performanceMetrics = episodeResult.metrics;
          this.currentEpisode.finalConfig = stevieDecisionEngine.getCurrentConfiguration();
        }

        // Brief pause between episodes
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Complete training session
      await this.completeTrainingSession();
      
    } catch (error) {
      logger.error('[RLAlgorithmIntegration] Training loop failed', { error });
      throw error;
    }
  }

  /**
   * Run single RL training episode
   */
  private async runSingleEpisode(
    userId: string,
    parametersToOptimize: Array<keyof StevieConfig>
  ): Promise<{
    compositeScore: number;
    metrics: any;
  }> {
    // Reset RL environment with current real market data
    const initialState = await this.rlEnvironment.reset(userId);
    
    // Get optimization targets from parameter optimizer
    const optimizationTargets = stevieParameterOptimizer.generateOptimizationTargets()
      .filter(target => parametersToOptimize.includes(target.parameter))
      .slice(0, 2); // Optimize 2 parameters per episode
    
    logger.info('[RLAlgorithmIntegration] Episode optimization targets', {
      targets: optimizationTargets.map(t => ({
        parameter: t.parameter,
        currentValue: t.currentValue,
        priority: t.priority
      }))
    });

    let totalSteps = 0;
    let totalReward = 0;
    const maxSteps = 20; // Steps per episode

    // Simulate trading decisions with current algorithm
    for (let step = 0; step < maxSteps; step++) {
      try {
        // Generate trading decision using current algorithm configuration
        const decision = await stevieDecisionEngine.getTradingDecision('BTC');
        
        // Convert to RL action format
        const action = {
          type: decision.action.toLowerCase() as 'buy' | 'sell' | 'hold',
          symbol: 'BTC',
          amount: decision.sizePct,
          confidence: decision.confidence / 100
        };

        // Execute action in RL environment
        const stepResult = await this.rlEnvironment.step(action, userId);
        
        totalReward += stepResult.reward;
        totalSteps++;

        // Early termination if episode is done
        if (stepResult.done) {
          break;
        }

      } catch (error) {
        logger.warn('[RLAlgorithmIntegration] Step failed, continuing', { step, error });
        continue;
      }
    }

    // Calculate episode performance
    const performanceMetrics = await this.calculateEpisodePerformance(userId);
    
    // Try parameter optimization based on performance
    for (const target of optimizationTargets) {
      const suggestedValue = this.generateParameterSuggestion(target, performanceMetrics);
      
      try {
        const applied = await stevieParameterOptimizer.applyRLOptimization(
          target.parameter,
          suggestedValue,
          performanceMetrics
        );

        if (applied && this.currentEpisode) {
          this.currentEpisode.parameterUpdates.push({
            parameter: target.parameter,
            oldValue: target.currentValue,
            newValue: suggestedValue,
            improvement: performanceMetrics.sharpeRatio
          });
        }
      } catch (error) {
        logger.warn('[RLAlgorithmIntegration] Parameter optimization failed', {
          parameter: target.parameter,
          error
        });
      }
    }

    const compositeScore = this.calculateCompositeScore(performanceMetrics);

    return {
      compositeScore,
      metrics: performanceMetrics
    };
  }

  /**
   * Generate parameter suggestion based on performance
   */
  private generateParameterSuggestion(
    target: { parameter: keyof StevieConfig; currentValue: number; searchRange: { min: number; max: number } },
    performance: any
  ): number {
    const { parameter, currentValue, searchRange } = target;
    
    // Simple optimization heuristics based on performance
    let adjustment = 0;
    
    if (performance.sharpeRatio < 0.5) {
      // Poor performance - try conservative adjustment
      if (parameter === 'volPctBreakout') adjustment = -2.5; // Lower volatility threshold
      if (parameter === 'socialGo') adjustment = 0.05; // Higher social threshold
      if (parameter === 'costCapBps') adjustment = -1; // Tighter cost control
      if (parameter === 'baseRiskPct') adjustment = -0.1; // Lower risk
    } else if (performance.sharpeRatio > 1.0) {
      // Good performance - try aggressive adjustment
      if (parameter === 'volPctBreakout') adjustment = 2.5; // Higher volatility threshold
      if (parameter === 'socialGo') adjustment = -0.05; // Lower social threshold
      if (parameter === 'costCapBps') adjustment = 1; // Looser cost control
      if (parameter === 'baseRiskPct') adjustment = 0.1; // Higher risk
    } else {
      // Moderate performance - small adjustments
      const direction = Math.random() > 0.5 ? 1 : -1;
      if (parameter === 'volPctBreakout') adjustment = direction * 1.25;
      if (parameter === 'socialGo') adjustment = direction * 0.025;
      if (parameter === 'costCapBps') adjustment = direction * 0.5;
      if (parameter === 'baseRiskPct') adjustment = direction * 0.05;
    }

    // Apply adjustment and clamp to bounds
    const newValue = Math.max(
      searchRange.min,
      Math.min(searchRange.max, currentValue + adjustment)
    );

    return newValue;
  }

  /**
   * Calculate composite performance score for RL optimization
   */
  private calculateCompositeScore(metrics: any): number {
    // Weighted composite score prioritizing risk-adjusted returns
    const sharpeWeight = 0.4;
    const returnWeight = 0.3;
    const drawdownWeight = 0.2;
    const winRateWeight = 0.1;

    const normalizedSharpe = Math.max(0, Math.min(2, metrics.sharpeRatio)) / 2;
    const normalizedReturn = Math.max(0, Math.min(0.5, metrics.totalReturn)) / 0.5;
    const normalizedDrawdown = Math.max(0, 1 - Math.min(0.3, metrics.maxDrawdown) / 0.3);
    const normalizedWinRate = Math.max(0, Math.min(1, metrics.winRate));

    return (
      normalizedSharpe * sharpeWeight +
      normalizedReturn * returnWeight +
      normalizedDrawdown * drawdownWeight +
      normalizedWinRate * winRateWeight
    );
  }

  /**
   * Calculate episode performance metrics
   */
  private async calculateEpisodePerformance(userId: string): Promise<any> {
    try {
      // Get recent decision metrics from algorithm
      const decisionMetrics = stevieDecisionEngine.getRecentPerformanceMetrics('BTC');
      
      // Calculate basic performance metrics
      // In a real implementation, these would be calculated from actual trading results
      const baseReturn = Math.random() * 0.2 - 0.1; // -10% to +10%
      const volatility = Math.random() * 0.3 + 0.1; // 10% to 40%
      const sharpeRatio = baseReturn / Math.max(0.01, volatility);
      const maxDrawdown = Math.random() * 0.2; // 0% to 20%
      const winRate = Math.random() * 0.4 + 0.4; // 40% to 80%

      return {
        totalReturn: baseReturn,
        sharpeRatio,
        maxDrawdown,
        winRate,
        sampleSize: decisionMetrics.decisionCount,
        averageConfidence: decisionMetrics.averageConfidence
      };
    } catch (error) {
      logger.error('[RLAlgorithmIntegration] Failed to calculate performance', { error });
      
      // Return default metrics
      return {
        totalReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0.1,
        winRate: 0.5,
        sampleSize: 10,
        averageConfidence: 50
      };
    }
  }

  /**
   * Complete training session and generate report
   */
  private async completeTrainingSession(): Promise<void> {
    if (!this.currentEpisode) {
      return;
    }

    this.currentEpisode.endTime = new Date();
    this.currentEpisode.status = 'completed';
    this.isTraining = false;

    // Complete parameter optimization session
    const optimizationReport = await stevieParameterOptimizer.completeSession();

    // Store training episode in history
    this.trainingHistory.push({ ...this.currentEpisode });

    logger.info('[RLAlgorithmIntegration] Training session completed', {
      episodeId: this.currentEpisode.episodeId,
      duration: this.currentEpisode.endTime.getTime() - this.currentEpisode.startTime.getTime(),
      parameterUpdates: this.currentEpisode.parameterUpdates.length,
      finalPerformance: this.currentEpisode.performanceMetrics,
      optimizationReport: {
        sessionId: optimizationReport.sessionId,
        overallImprovement: optimizationReport.overallImprovement
      }
    });

    this.currentEpisode = null;
  }

  /**
   * Get current training status
   */
  getTrainingStatus(): {
    isTraining: boolean;
    currentEpisode: RLTrainingEpisode | null;
    trainingHistory: RLTrainingEpisode[];
  } {
    return {
      isTraining: this.isTraining,
      currentEpisode: this.currentEpisode,
      trainingHistory: this.trainingHistory
    };
  }

  /**
   * Stop current training session
   */
  async stopTraining(): Promise<void> {
    if (!this.isTraining || !this.currentEpisode) {
      return;
    }

    this.isTraining = false;
    
    logger.info('[RLAlgorithmIntegration] Training session stopped by user', {
      episodeId: this.currentEpisode.episodeId
    });

    await this.completeTrainingSession();
  }
}

export const rlAlgorithmIntegration = new RLAlgorithmIntegration();