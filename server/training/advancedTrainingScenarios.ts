/**
 * Advanced Training Scenarios for RL Parameter Optimization
 * Implements sophisticated training modes for different market conditions
 */

import { logger } from '../utils/logger';
import { rlAlgorithmIntegration } from './rlAlgorithmIntegration';
import { stevieParameterOptimizer } from '../services/stevieParameterOptimizer';
import { stevieDecisionEngine } from '../services/stevieDecisionEngine';
import { marketDataService } from '../services/marketData';
import { defaultStevieConfig, type StevieConfig } from '../../shared/src/stevie/config';

export interface TrainingScenario {
  id: string;
  name: string;
  description: string;
  duration: number; // minutes
  targetParameters: Array<keyof StevieConfig>;
  marketConditions: 'bull' | 'bear' | 'sideways' | 'volatile' | 'all';
  optimizationGoal: 'returns' | 'sharpe' | 'drawdown' | 'winrate' | 'balanced';
  config: {
    maxEpisodes: number;
    convergenceThreshold: number;
    aggressiveness: 'conservative' | 'moderate' | 'aggressive';
  };
}

export const TRAINING_SCENARIOS: TrainingScenario[] = [
  {
    id: 'quick_tune',
    name: 'Quick Performance Tune',
    description: 'Fast optimization of core trading parameters for immediate improvement',
    duration: 15,
    targetParameters: ['volPctBreakout', 'socialGo', 'costCapBps'],
    marketConditions: 'all',
    optimizationGoal: 'balanced',
    config: {
      maxEpisodes: 10,
      convergenceThreshold: 0.03,
      aggressiveness: 'moderate'
    }
  },
  {
    id: 'volatility_master',
    name: 'Volatility Regime Mastery',
    description: 'Optimize for different volatility conditions and breakout detection',
    duration: 30,
    targetParameters: ['volPctBreakout', 'volPctMeanRevert', 'tpBreakout', 'slBreakout'],
    marketConditions: 'volatile',
    optimizationGoal: 'sharpe',
    config: {
      maxEpisodes: 20,
      convergenceThreshold: 0.02,
      aggressiveness: 'aggressive'
    }
  },
  {
    id: 'risk_optimizer',
    name: 'Risk Management Optimization',
    description: 'Focus on drawdown reduction and position sizing optimization',
    duration: 25,
    targetParameters: ['baseRiskPct', 'costCapBps', 'slBreakout', 'slRevert'],
    marketConditions: 'all',
    optimizationGoal: 'drawdown',
    config: {
      maxEpisodes: 15,
      convergenceThreshold: 0.025,
      aggressiveness: 'conservative'
    }
  },
  {
    id: 'news_sentiment_pro',
    name: 'News & Sentiment Professional',
    description: 'Advanced optimization of social signals and news-based trading',
    duration: 35,
    targetParameters: ['socialGo', 'newsMaxRiskPct', 'tpNews', 'slNews'],
    marketConditions: 'all',
    optimizationGoal: 'returns',
    config: {
      maxEpisodes: 25,
      convergenceThreshold: 0.02,
      aggressiveness: 'moderate'
    }
  },
  {
    id: 'comprehensive_evolution',
    name: 'Comprehensive Algorithm Evolution',
    description: 'Full parameter optimization across all trading dimensions',
    duration: 60,
    targetParameters: ['volPctBreakout', 'socialGo', 'costCapBps', 'baseRiskPct', 'tpBreakout', 'slBreakout', 'newsMaxRiskPct'],
    marketConditions: 'all',
    optimizationGoal: 'balanced',
    config: {
      maxEpisodes: 40,
      convergenceThreshold: 0.015,
      aggressiveness: 'moderate'
    }
  }
];

export class AdvancedTrainingScenarios {
  private activeScenario: TrainingScenario | null = null;
  private scenarioResults: Map<string, any> = new Map();

  /**
   * Start a predefined training scenario
   */
  async startScenario(scenarioId: string, userId: string): Promise<{
    success: boolean;
    episodeId?: string;
    scenario?: TrainingScenario;
    error?: string;
  }> {
    try {
      const scenario = TRAINING_SCENARIOS.find(s => s.id === scenarioId);
      if (!scenario) {
        return { success: false, error: `Scenario '${scenarioId}' not found` };
      }

      // Check if training is already active
      const currentStatus = rlAlgorithmIntegration.getTrainingStatus();
      if (currentStatus.isTraining) {
        return { success: false, error: 'Training session already in progress' };
      }

      this.activeScenario = scenario;

      logger.info('[AdvancedTraining] Starting scenario', {
        scenarioId,
        name: scenario.name,
        duration: scenario.duration,
        targetParameters: scenario.targetParameters,
        userId
      });

      // Prepare algorithm configuration based on scenario
      await this.prepareScenarioConfiguration(scenario);

      // Start the training session with scenario-specific config
      const episodeId = await rlAlgorithmIntegration.startTrainingSession(userId, {
        maxEpisodes: scenario.config.maxEpisodes,
        convergenceThreshold: scenario.config.convergenceThreshold,
        parametersToOptimize: scenario.targetParameters
      });

      // Store scenario start data
      this.scenarioResults.set(scenarioId, {
        startTime: new Date(),
        episodeId,
        initialConfig: stevieDecisionEngine.getCurrentConfiguration(),
        targetParameters: scenario.targetParameters,
        optimizationGoal: scenario.optimizationGoal
      });

      return {
        success: true,
        episodeId,
        scenario
      };

    } catch (error) {
      logger.error('[AdvancedTraining] Failed to start scenario', { scenarioId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Prepare algorithm configuration based on scenario requirements
   */
  private async prepareScenarioConfiguration(scenario: TrainingScenario): Promise<void> {
    const currentConfig = stevieDecisionEngine.getCurrentConfiguration();
    const adjustments: Partial<StevieConfig> = {};

    // Adjust configuration based on scenario aggressiveness
    switch (scenario.config.aggressiveness) {
      case 'conservative':
        adjustments.baseRiskPct = Math.min(currentConfig.baseRiskPct, 0.3);
        adjustments.costCapBps = Math.min(currentConfig.costCapBps, 6);
        break;
      case 'aggressive':
        adjustments.baseRiskPct = Math.max(currentConfig.baseRiskPct, 0.7);
        adjustments.costCapBps = Math.max(currentConfig.costCapBps, 10);
        break;
      case 'moderate':
      default:
        // No initial adjustments for moderate
        break;
    }

    // Apply market condition specific adjustments
    if (scenario.marketConditions === 'volatile') {
      adjustments.volPctBreakout = Math.max(currentConfig.volPctBreakout, 65);
      adjustments.slBreakout = Math.max(currentConfig.slBreakout, 6);
    }

    if (Object.keys(adjustments).length > 0) {
      stevieDecisionEngine.updateConfiguration(adjustments);
      logger.info('[AdvancedTraining] Applied scenario configuration adjustments', {
        scenario: scenario.id,
        adjustments
      });
    }
  }

  /**
   * Get available training scenarios
   */
  getAvailableScenarios(): TrainingScenario[] {
    return TRAINING_SCENARIOS;
  }

  /**
   * Get scenario results and analysis
   */
  getScenarioResults(scenarioId?: string): any {
    if (scenarioId) {
      return this.scenarioResults.get(scenarioId) || null;
    }
    
    // Return all scenario results
    const results: { [key: string]: any } = {};
    this.scenarioResults.forEach((value, key) => {
      results[key] = value;
    });
    return results;
  }

  /**
   * Generate scenario recommendation based on current market conditions
   */
  async recommendScenario(): Promise<{
    recommended: TrainingScenario;
    reasoning: string;
    marketAnalysis: any;
  }> {
    try {
      // Get current market data for analysis
      const marketData = await marketDataService.getCurrentPrice('BTC');
      const recentPerformance = stevieDecisionEngine.getRecentPerformanceMetrics('BTC');
      
      // Analyze current algorithm performance
      const performanceAnalysis = this.analyzeCurrentPerformance(recentPerformance);
      
      // Select scenario based on analysis
      let recommendedScenario: TrainingScenario;
      let reasoning: string;

      if (performanceAnalysis.needsRiskManagement) {
        recommendedScenario = TRAINING_SCENARIOS.find(s => s.id === 'risk_optimizer')!;
        reasoning = 'Current performance shows high drawdown risk. Recommended risk management optimization.';
      } else if (performanceAnalysis.lowConfidence) {
        recommendedScenario = TRAINING_SCENARIOS.find(s => s.id === 'quick_tune')!;
        reasoning = 'Low decision confidence detected. Quick parameter tune recommended for immediate improvement.';
      } else if (performanceAnalysis.volatilityOpportunity) {
        recommendedScenario = TRAINING_SCENARIOS.find(s => s.id === 'volatility_master')!;
        reasoning = 'Market showing high volatility patterns. Optimize volatility-based strategies.';
      } else if (recentPerformance.decisionCount < 5) {
        recommendedScenario = TRAINING_SCENARIOS.find(s => s.id === 'comprehensive_evolution')!;
        reasoning = 'Insufficient decision history. Comprehensive optimization will improve overall performance.';
      } else {
        recommendedScenario = TRAINING_SCENARIOS.find(s => s.id === 'news_sentiment_pro')!;
        reasoning = 'Stable performance detected. Enhance news and sentiment analysis capabilities.';
      }

      return {
        recommended: recommendedScenario,
        reasoning,
        marketAnalysis: {
          currentPrice: marketData,
          recentDecisions: recentPerformance.decisionCount,
          averageConfidence: recentPerformance.averageConfidence,
          performanceFlags: performanceAnalysis
        }
      };

    } catch (error) {
      logger.error('[AdvancedTraining] Failed to generate scenario recommendation', { error });
      
      // Fallback recommendation
      return {
        recommended: TRAINING_SCENARIOS.find(s => s.id === 'quick_tune')!,
        reasoning: 'Error analyzing market conditions. Defaulting to quick performance tune.',
        marketAnalysis: { error: 'Analysis failed' }
      };
    }
  }

  /**
   * Analyze current algorithm performance to guide scenario selection
   */
  private analyzeCurrentPerformance(metrics: any): {
    needsRiskManagement: boolean;
    lowConfidence: boolean;
    volatilityOpportunity: boolean;
  } {
    return {
      needsRiskManagement: false, // Would be based on actual drawdown metrics
      lowConfidence: metrics.averageConfidence < 40,
      volatilityOpportunity: true // Would be based on market volatility analysis
    };
  }

  /**
   * Stop current scenario and generate completion report
   */
  async stopCurrentScenario(): Promise<{
    success: boolean;
    report?: any;
    error?: string;
  }> {
    try {
      if (!this.activeScenario) {
        return { success: false, error: 'No active scenario to stop' };
      }

      // Stop the training session
      await rlAlgorithmIntegration.stopTraining();

      // Generate completion report
      const scenarioId = this.activeScenario.id;
      const scenarioData = this.scenarioResults.get(scenarioId);
      
      if (scenarioData) {
        scenarioData.endTime = new Date();
        scenarioData.finalConfig = stevieDecisionEngine.getCurrentConfiguration();
        scenarioData.duration = scenarioData.endTime.getTime() - scenarioData.startTime.getTime();
        
        this.scenarioResults.set(scenarioId, scenarioData);
      }

      const report = {
        scenario: this.activeScenario,
        results: scenarioData,
        status: 'completed_manually'
      };

      this.activeScenario = null;

      logger.info('[AdvancedTraining] Scenario stopped successfully', {
        scenarioId,
        duration: scenarioData?.duration
      });

      return { success: true, report };

    } catch (error) {
      logger.error('[AdvancedTraining] Failed to stop scenario', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get current active scenario
   */
  getCurrentScenario(): TrainingScenario | null {
    return this.activeScenario;
  }
}

export const advancedTrainingScenarios = new AdvancedTrainingScenarios();