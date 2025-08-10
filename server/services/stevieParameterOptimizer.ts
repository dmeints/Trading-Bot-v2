/**
 * Stevie Parameter Optimizer
 * Connects RL training discoveries to real algorithm configuration
 * Enables continuous optimization of trading decision parameters
 */

import { logger } from '../utils/logger';
import { storage } from '../storage';
import { defaultStevieConfig, type StevieConfig } from '../../shared/src/stevie/config';
import { stevieDecisionEngine } from './stevieDecisionEngine';

interface ParameterOptimizationResult {
  parameterId: string;
  oldValue: number;
  newValue: number;
  performanceImprovement: number;
  confidenceLevel: number;
  testDuration: number;
  sampleSize: number;
}

interface OptimizationSession {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  baselineConfig: StevieConfig;
  optimizedConfig: StevieConfig;
  results: ParameterOptimizationResult[];
  overallImprovement: number;
  status: 'running' | 'completed' | 'failed';
}

export class StevieParameterOptimizer {
  private currentSession: OptimizationSession | null = null;
  private optimizationHistory: OptimizationSession[] = [];
  
  // Define parameter search spaces for RL optimization
  private parameterBounds = {
    volPctBreakout: { min: 60, max: 85, step: 2.5 },
    volPctMeanRevert: { min: 25, max: 45, step: 2.5 },
    socialGo: { min: 0.5, max: 1.2, step: 0.05 },
    costCapBps: { min: 4, max: 12, step: 1 },
    baseRiskPct: { min: 0.2, max: 1.0, step: 0.1 },
    newsMaxRiskPct: { min: 0.1, max: 0.8, step: 0.1 },
    tpBreakout: { min: 8, max: 15, step: 1 },
    slBreakout: { min: 4, max: 10, step: 1 },
    tpRevert: { min: 6, max: 12, step: 1 },
    slRevert: { min: 3, max: 8, step: 1 }
  };

  /**
   * Start a new parameter optimization session
   */
  async startOptimizationSession(userId: string): Promise<string> {
    if (this.currentSession && this.currentSession.status === 'running') {
      throw new Error('Optimization session already running');
    }

    const sessionId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentSession = {
      sessionId,
      startTime: new Date(),
      baselineConfig: { ...defaultStevieConfig },
      optimizedConfig: { ...defaultStevieConfig },
      results: [],
      overallImprovement: 0,
      status: 'running'
    };

    logger.info('[ParameterOptimizer] Started optimization session', {
      sessionId,
      userId,
      baselineConfig: this.currentSession.baselineConfig
    });

    return sessionId;
  }

  /**
   * Apply RL-discovered parameter improvements to algorithm configuration
   */
  async applyRLOptimization(
    parameterId: keyof StevieConfig,
    suggestedValue: number,
    performanceData: {
      sharpeRatio: number;
      totalReturn: number;
      maxDrawdown: number;
      winRate: number;
      sampleSize: number;
    }
  ): Promise<boolean> {
    if (!this.currentSession) {
      throw new Error('No active optimization session');
    }

    const bounds = this.parameterBounds[parameterId as keyof typeof this.parameterBounds];
    if (!bounds) {
      logger.warn('[ParameterOptimizer] Parameter not optimizable', { parameterId });
      return false;
    }

    // Validate suggested value is within bounds
    const clampedValue = Math.max(bounds.min, Math.min(bounds.max, suggestedValue));
    if (clampedValue !== suggestedValue) {
      logger.warn('[ParameterOptimizer] Clamped suggested value to bounds', {
        parameterId,
        suggested: suggestedValue,
        clamped: clampedValue,
        bounds
      });
    }

    // Calculate performance improvement vs baseline
    const baselinePerformance = await this.getBaselinePerformance();
    const performanceImprovement = this.calculateImprovement(performanceData, baselinePerformance);
    
    // Only apply if improvement is statistically significant
    const confidenceLevel = this.calculateConfidenceLevel(performanceData.sampleSize, performanceImprovement);
    
    if (confidenceLevel >= 0.95 && performanceImprovement > 0.02) { // 95% confidence, 2% improvement
      const oldValue = this.currentSession.optimizedConfig[parameterId] as number;
      
      // Apply the optimization
      (this.currentSession.optimizedConfig as any)[parameterId] = clampedValue;
      
      // Update the live algorithm configuration
      await this.updateLiveConfiguration(this.currentSession.optimizedConfig);
      
      // Record the optimization result
      const result: ParameterOptimizationResult = {
        parameterId,
        oldValue,
        newValue: clampedValue,
        performanceImprovement,
        confidenceLevel,
        testDuration: Date.now() - this.currentSession.startTime.getTime(),
        sampleSize: performanceData.sampleSize
      };
      
      this.currentSession.results.push(result);
      
      logger.info('[ParameterOptimizer] Applied optimization', {
        parameterId,
        oldValue,
        newValue: clampedValue,
        improvement: (performanceImprovement * 100).toFixed(2) + '%',
        confidence: (confidenceLevel * 100).toFixed(1) + '%'
      });

      return true;
    } else {
      logger.info('[ParameterOptimizer] Rejected optimization - insufficient confidence', {
        parameterId,
        improvement: (performanceImprovement * 100).toFixed(2) + '%',
        confidence: (confidenceLevel * 100).toFixed(1) + '%',
        requiredConfidence: '95%',
        requiredImprovement: '2%'
      });
      return false;
    }
  }

  /**
   * Get current optimized configuration for algorithm
   */
  getCurrentConfig(): StevieConfig {
    return this.currentSession?.optimizedConfig || defaultStevieConfig;
  }

  /**
   * Complete optimization session and generate report
   */
  async completeSession(): Promise<OptimizationSession> {
    if (!this.currentSession) {
      throw new Error('No active optimization session');
    }

    this.currentSession.endTime = new Date();
    this.currentSession.status = 'completed';
    
    // Calculate overall improvement
    this.currentSession.overallImprovement = this.currentSession.results.reduce(
      (sum, result) => sum + result.performanceImprovement, 0
    ) / Math.max(1, this.currentSession.results.length);

    // Store session in history
    this.optimizationHistory.push({ ...this.currentSession });
    
    logger.info('[ParameterOptimizer] Completed optimization session', {
      sessionId: this.currentSession.sessionId,
      duration: this.currentSession.endTime.getTime() - this.currentSession.startTime.getTime(),
      optimizationsApplied: this.currentSession.results.length,
      overallImprovement: (this.currentSession.overallImprovement * 100).toFixed(2) + '%'
    });

    const completedSession = { ...this.currentSession };
    this.currentSession = null;
    
    return completedSession;
  }

  /**
   * Generate parameter optimization suggestions for RL training
   */
  generateOptimizationTargets(): Array<{
    parameter: keyof StevieConfig;
    currentValue: number;
    searchRange: { min: number; max: number };
    priority: number;
  }> {
    const currentConfig = this.getCurrentConfig();
    const targets: Array<{
      parameter: keyof StevieConfig;
      currentValue: number;
      searchRange: { min: number; max: number };
      priority: number;
    }> = [];

    // High priority parameters that most impact trading performance
    const highPriorityParams: Array<keyof typeof this.parameterBounds> = [
      'volPctBreakout',
      'socialGo',
      'costCapBps',
      'baseRiskPct'
    ];

    const mediumPriorityParams: Array<keyof typeof this.parameterBounds> = [
      'volPctMeanRevert',
      'newsMaxRiskPct',
      'tpBreakout',
      'slBreakout'
    ];

    const lowPriorityParams: Array<keyof typeof this.parameterBounds> = [
      'tpRevert',
      'slRevert'
    ];

    // Add high priority targets
    highPriorityParams.forEach(param => {
      const bounds = this.parameterBounds[param];
      targets.push({
        parameter: param as keyof StevieConfig,
        currentValue: currentConfig[param] as number,
        searchRange: { min: bounds.min, max: bounds.max },
        priority: 3
      });
    });

    // Add medium priority targets
    mediumPriorityParams.forEach(param => {
      const bounds = this.parameterBounds[param];
      targets.push({
        parameter: param as keyof StevieConfig,
        currentValue: currentConfig[param] as number,
        searchRange: { min: bounds.min, max: bounds.max },
        priority: 2
      });
    });

    // Add low priority targets
    lowPriorityParams.forEach(param => {
      const bounds = this.parameterBounds[param];
      targets.push({
        parameter: param as keyof StevieConfig,
        currentValue: currentConfig[param] as number,
        searchRange: { min: bounds.min, max: bounds.max },
        priority: 1
      });
    });

    return targets.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Update live algorithm configuration
   */
  private async updateLiveConfiguration(config: StevieConfig): Promise<void> {
    try {
      // Update the decision engine with new configuration
      stevieDecisionEngine.updateConfiguration(config);
      
      // Store configuration in database for persistence
      await storage.storeConfiguration('stevie_algorithm', JSON.stringify(config));
      
      logger.info('[ParameterOptimizer] Updated live algorithm configuration', {
        config: JSON.stringify(config, null, 2)
      });
    } catch (error) {
      logger.error('[ParameterOptimizer] Failed to update live configuration', { error });
      throw error;
    }
  }

  /**
   * Calculate performance improvement vs baseline
   */
  private calculateImprovement(
    current: { sharpeRatio: number; totalReturn: number; maxDrawdown: number; winRate: number },
    baseline: { sharpeRatio: number; totalReturn: number; maxDrawdown: number; winRate: number }
  ): number {
    // Weighted performance improvement calculation
    const sharpeImprovement = (current.sharpeRatio - baseline.sharpeRatio) / Math.max(0.1, Math.abs(baseline.sharpeRatio));
    const returnImprovement = (current.totalReturn - baseline.totalReturn) / Math.max(0.1, Math.abs(baseline.totalReturn));
    const drawdownImprovement = (baseline.maxDrawdown - current.maxDrawdown) / Math.max(0.01, baseline.maxDrawdown);
    const winRateImprovement = (current.winRate - baseline.winRate) / Math.max(0.1, baseline.winRate);
    
    // Weighted average: Sharpe ratio is most important, then return, then drawdown, then win rate
    const weightedImprovement = (
      sharpeImprovement * 0.4 +
      returnImprovement * 0.3 +
      drawdownImprovement * 0.2 +
      winRateImprovement * 0.1
    );
    
    return weightedImprovement;
  }

  /**
   * Calculate statistical confidence level
   */
  private calculateConfidenceLevel(sampleSize: number, improvement: number): number {
    // Simple confidence calculation based on sample size and improvement magnitude
    const sampleConfidence = Math.min(1.0, sampleSize / 100); // 100+ samples = full confidence
    const improvementConfidence = Math.min(1.0, Math.abs(improvement) * 10); // 10%+ improvement = full confidence
    
    return (sampleConfidence * 0.7 + improvementConfidence * 0.3);
  }

  /**
   * Get baseline performance metrics
   */
  private async getBaselinePerformance(): Promise<{
    sharpeRatio: number;
    totalReturn: number;
    maxDrawdown: number;
    winRate: number;
  }> {
    // Use default baseline or historical performance
    return {
      sharpeRatio: 0.5,
      totalReturn: 0.08,
      maxDrawdown: 0.12,
      winRate: 0.52
    };
  }

  /**
   * Get optimization history
   */
  getOptimizationHistory(): OptimizationSession[] {
    return [...this.optimizationHistory];
  }
}

export const stevieParameterOptimizer = new StevieParameterOptimizer();