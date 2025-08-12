
/**
 * Shadow Mode Validator for Safe Promotion
 * Validates conformal prediction performance before live deployment
 */

import { logger } from '../utils/logger';
import { ConformalPredictor, ConformalPrediction } from '../brain/conformal';
import { createTradingConformalPredictor } from '../brain/conformal';

export interface ShadowModeConfig {
  validationPeriodHours: number;
  requiredSamples: number;
  performanceThresholds: {
    minCoverage: number;
    maxCoverageGap: number;
    maxIntervalWidth: number;
    minSharpeRatio: number;
    maxDrawdown: number;
  };
  promotionCriteria: {
    consistencyWindow: number;
    minSuccessRate: number;
    maxVolatility: number;
  };
}

export interface ShadowModeResult {
  approved: boolean;
  confidence: number;
  validationPeriodHours: number;
  samplesProcessed: number;
  performanceMetrics: {
    coverage: number;
    coverageGap: number;
    avgIntervalWidth: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
  };
  thresholdChecks: {
    coverageCheck: boolean;
    gapCheck: boolean;
    widthCheck: boolean;
    sharpeCheck: boolean;
    drawdownCheck: boolean;
  };
  issues: string[];
  recommendations: string[];
}

export interface ShadowTrade {
  timestamp: Date;
  symbol: string;
  prediction: ConformalPrediction;
  actualReturn: number;
  withinInterval: boolean;
  pnl: number;
  confidence: number;
}

/**
 * Shadow Mode Validator
 * Runs conformal predictions in parallel with live system without executing trades
 */
export class ShadowModeValidator {
  private config: ShadowModeConfig;
  private conformalPredictor: ConformalPredictor;
  private shadowTrades: ShadowTrade[] = [];
  private validationStartTime: Date;
  private isRunning: boolean = false;

  constructor(config: Partial<ShadowModeConfig> = {}) {
    this.config = {
      validationPeriodHours: 24,
      requiredSamples: 100,
      performanceThresholds: {
        minCoverage: 0.85,      // 85% minimum coverage
        maxCoverageGap: 0.1,    // 10% maximum gap from expected
        maxIntervalWidth: 0.15, // 15% maximum average interval width
        minSharpeRatio: 1.2,    // Minimum Sharpe ratio
        maxDrawdown: 0.05       // 5% maximum drawdown
      },
      promotionCriteria: {
        consistencyWindow: 50,   // Look at last 50 trades
        minSuccessRate: 0.8,     // 80% success rate
        maxVolatility: 0.03      // 3% maximum P&L volatility
      },
      ...config
    };

    this.conformalPredictor = createTradingConformalPredictor();
    this.validationStartTime = new Date();
  }

  /**
   * Start shadow mode validation
   */
  async startValidation(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Shadow mode validation already running');
    }

    this.isRunning = true;
    this.validationStartTime = new Date();
    this.shadowTrades = [];

    logger.info('[ShadowMode] Starting validation period', {
      duration: `${this.config.validationPeriodHours}h`,
      requiredSamples: this.config.requiredSamples
    });

    // Initialize conformal predictor with recent data
    await this.initializeConformalPredictor();
  }

  /**
   * Stop shadow mode validation
   */
  stopValidation(): void {
    this.isRunning = false;
    logger.info('[ShadowMode] Validation stopped', {
      samplesCollected: this.shadowTrades.length
    });
  }

  /**
   * Process shadow trade (called for each market decision)
   */
  async processShadowTrade(
    symbol: string,
    features: number[],
    pointPrediction: number,
    marketRegime?: string
  ): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Generate conformal prediction
      const prediction = this.conformalPredictor.predict(
        features,
        pointPrediction,
        marketRegime as any
      );

      if (!prediction) {
        logger.warn('[ShadowMode] No prediction generated', { symbol });
        return;
      }

      // Store shadow trade (actual return will be updated later)
      const shadowTrade: ShadowTrade = {
        timestamp: new Date(),
        symbol,
        prediction,
        actualReturn: 0, // Will be updated when actual return is known
        withinInterval: false,
        pnl: 0,
        confidence: prediction.coverage
      };

      this.shadowTrades.push(shadowTrade);

      // Maintain rolling window
      if (this.shadowTrades.length > this.config.requiredSamples * 2) {
        this.shadowTrades.shift();
      }

      logger.debug('[ShadowMode] Shadow trade processed', {
        symbol,
        prediction: prediction.prediction.toFixed(4),
        interval: `[${prediction.lowerBound.toFixed(4)}, ${prediction.upperBound.toFixed(4)}]`,
        totalTrades: this.shadowTrades.length
      });

    } catch (error) {
      logger.error('[ShadowMode] Error processing shadow trade', error);
    }
  }

  /**
   * Update shadow trade with actual outcome
   */
  updateShadowTradeOutcome(
    symbol: string,
    timestamp: Date,
    actualReturn: number
  ): void {
    // Find matching shadow trade (within 1 minute tolerance)
    const trade = this.shadowTrades.find(t => 
      t.symbol === symbol &&
      Math.abs(t.timestamp.getTime() - timestamp.getTime()) < 60000 &&
      t.actualReturn === 0 // Not yet updated
    );

    if (!trade) {
      logger.warn('[ShadowMode] No matching shadow trade found', { 
        symbol, 
        timestamp: timestamp.toISOString() 
      });
      return;
    }

    // Update with actual outcome
    trade.actualReturn = actualReturn;
    trade.withinInterval = actualReturn >= trade.prediction.lowerBound && 
                          actualReturn <= trade.prediction.upperBound;
    
    // Calculate P&L (assuming $1000 position size for consistency)
    trade.pnl = 1000 * actualReturn;

    // Update conformal predictor calibration
    this.conformalPredictor.addCalibrationSample({
      features: [], // Would need to store features
      actualReturn,
      predictedReturn: trade.prediction.prediction,
      timestamp: trade.timestamp
    });

    logger.debug('[ShadowMode] Shadow trade outcome updated', {
      symbol,
      actualReturn: actualReturn.toFixed(4),
      withinInterval: trade.withinInterval,
      pnl: trade.pnl.toFixed(2)
    });
  }

  /**
   * Generate validation result
   */
  async generateValidationResult(): Promise<ShadowModeResult> {
    const completedTrades = this.shadowTrades.filter(t => t.actualReturn !== 0);
    
    if (completedTrades.length < this.config.requiredSamples) {
      return {
        approved: false,
        confidence: 0,
        validationPeriodHours: this.getValidationHours(),
        samplesProcessed: completedTrades.length,
        performanceMetrics: this.getDefaultMetrics(),
        thresholdChecks: this.getDefaultThresholds(),
        issues: [`Insufficient samples: ${completedTrades.length} < ${this.config.requiredSamples}`],
        recommendations: ['Continue validation period to collect more samples']
      };
    }

    // Calculate performance metrics
    const metrics = this.calculatePerformanceMetrics(completedTrades);
    const thresholds = this.checkThresholds(metrics);
    const consistency = this.checkConsistency(completedTrades);

    // Determine approval
    const allThresholdsPassed = Object.values(thresholds).every(check => check);
    const approved = allThresholdsPassed && consistency.passed;

    // Generate issues and recommendations
    const issues = this.generateIssues(metrics, thresholds, consistency);
    const recommendations = this.generateRecommendations(metrics, thresholds, consistency);

    // Calculate confidence score
    const confidence = this.calculateConfidenceScore(metrics, thresholds, consistency);

    return {
      approved,
      confidence,
      validationPeriodHours: this.getValidationHours(),
      samplesProcessed: completedTrades.length,
      performanceMetrics: metrics,
      thresholdChecks: thresholds,
      issues,
      recommendations
    };
  }

  /**
   * Initialize conformal predictor with recent historical data
   */
  private async initializeConformalPredictor(): Promise<void> {
    // In production, this would load recent trading data
    // For now, we'll just ensure the predictor is ready
    logger.info('[ShadowMode] Conformal predictor initialized');
  }

  /**
   * Calculate comprehensive performance metrics
   */
  private calculatePerformanceMetrics(trades: ShadowTrade[]) {
    const coverage = trades.filter(t => t.withinInterval).length / trades.length;
    const expectedCoverage = trades.length > 0 ? trades[0].prediction.coverage : 0.9;
    const coverageGap = Math.abs(coverage - expectedCoverage);
    
    const avgIntervalWidth = trades.reduce((sum, t) => sum + t.prediction.width, 0) / trades.length;
    
    const returns = trades.map(t => t.actualReturn);
    const pnls = trades.map(t => t.pnl);
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = volatility > 0 ? (avgReturn * Math.sqrt(252)) / (volatility * Math.sqrt(252)) : 0;
    
    // Calculate drawdown
    let peak = pnls[0];
    let maxDrawdown = 0;
    for (const pnl of pnls) {
      if (pnl > peak) peak = pnl;
      const drawdown = (peak - pnl) / Math.abs(peak);
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    const winRate = trades.filter(t => t.pnl > 0).length / trades.length;
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);
    
    const avgWin = winningTrades.length > 0 ? 
      winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? 
      Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length) : 1;
    
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;

    return {
      coverage,
      coverageGap,
      avgIntervalWidth,
      sharpeRatio,
      maxDrawdown,
      winRate,
      profitFactor
    };
  }

  /**
   * Check performance against thresholds
   */
  private checkThresholds(metrics: any) {
    return {
      coverageCheck: metrics.coverage >= this.config.performanceThresholds.minCoverage,
      gapCheck: metrics.coverageGap <= this.config.performanceThresholds.maxCoverageGap,
      widthCheck: metrics.avgIntervalWidth <= this.config.performanceThresholds.maxIntervalWidth,
      sharpeCheck: metrics.sharpeRatio >= this.config.performanceThresholds.minSharpeRatio,
      drawdownCheck: metrics.maxDrawdown <= this.config.performanceThresholds.maxDrawdown
    };
  }

  /**
   * Check consistency over recent window
   */
  private checkConsistency(trades: ShadowTrade[]) {
    const recentTrades = trades.slice(-this.config.promotionCriteria.consistencyWindow);
    
    if (recentTrades.length < this.config.promotionCriteria.consistencyWindow) {
      return { passed: false, reason: 'Insufficient recent trades' };
    }

    const successRate = recentTrades.filter(t => t.withinInterval).length / recentTrades.length;
    const returns = recentTrades.map(t => t.actualReturn);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);

    const passed = successRate >= this.config.promotionCriteria.minSuccessRate &&
                  volatility <= this.config.promotionCriteria.maxVolatility;

    return {
      passed,
      successRate,
      volatility,
      reason: passed ? 'Consistency check passed' : 'Consistency requirements not met'
    };
  }

  /**
   * Generate issues list
   */
  private generateIssues(metrics: any, thresholds: any, consistency: any): string[] {
    const issues: string[] = [];

    if (!thresholds.coverageCheck) {
      issues.push(`Coverage below threshold: ${(metrics.coverage * 100).toFixed(1)}% < ${(this.config.performanceThresholds.minCoverage * 100).toFixed(1)}%`);
    }

    if (!thresholds.gapCheck) {
      issues.push(`Coverage gap too large: ${(metrics.coverageGap * 100).toFixed(1)}% > ${(this.config.performanceThresholds.maxCoverageGap * 100).toFixed(1)}%`);
    }

    if (!thresholds.widthCheck) {
      issues.push(`Interval width too large: ${(metrics.avgIntervalWidth * 100).toFixed(1)}% > ${(this.config.performanceThresholds.maxIntervalWidth * 100).toFixed(1)}%`);
    }

    if (!thresholds.sharpeCheck) {
      issues.push(`Sharpe ratio below threshold: ${metrics.sharpeRatio.toFixed(2)} < ${this.config.performanceThresholds.minSharpeRatio}`);
    }

    if (!thresholds.drawdownCheck) {
      issues.push(`Drawdown too high: ${(metrics.maxDrawdown * 100).toFixed(1)}% > ${(this.config.performanceThresholds.maxDrawdown * 100).toFixed(1)}%`);
    }

    if (!consistency.passed) {
      issues.push(`Consistency issue: ${consistency.reason}`);
    }

    return issues;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(metrics: any, thresholds: any, consistency: any): string[] {
    const recommendations: string[] = [];

    if (!thresholds.coverageCheck) {
      recommendations.push('Increase calibration window size or adjust alpha parameter');
    }

    if (!thresholds.widthCheck) {
      recommendations.push('Reduce kernel bandwidth or improve feature engineering');
    }

    if (!thresholds.sharpeCheck) {
      recommendations.push('Review position sizing or market timing strategy');
    }

    if (!consistency.passed) {
      recommendations.push('Extend validation period for more stable performance assessment');
    }

    if (thresholds.coverageCheck && thresholds.gapCheck) {
      recommendations.push('Coverage performance is good - consider gradual ramp-up');
    }

    return recommendations;
  }

  /**
   * Calculate confidence score (0-1)
   */
  private calculateConfidenceScore(metrics: any, thresholds: any, consistency: any): number {
    let score = 0;

    // Coverage contribution (30%)
    if (thresholds.coverageCheck) score += 0.3;
    if (thresholds.gapCheck) score += 0.1;

    // Risk contribution (30%)
    if (thresholds.drawdownCheck) score += 0.15;
    if (thresholds.sharpeCheck) score += 0.15;

    // Precision contribution (20%)
    if (thresholds.widthCheck) score += 0.2;

    // Consistency contribution (20%)
    if (consistency.passed) score += 0.2;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get validation period in hours
   */
  private getValidationHours(): number {
    const elapsed = Date.now() - this.validationStartTime.getTime();
    return elapsed / (1000 * 60 * 60);
  }

  /**
   * Get default metrics for insufficient data
   */
  private getDefaultMetrics() {
    return {
      coverage: 0,
      coverageGap: 1,
      avgIntervalWidth: 1,
      sharpeRatio: 0,
      maxDrawdown: 1,
      winRate: 0,
      profitFactor: 0
    };
  }

  /**
   * Get default threshold checks
   */
  private getDefaultThresholds() {
    return {
      coverageCheck: false,
      gapCheck: false,
      widthCheck: false,
      sharpeCheck: false,
      drawdownCheck: false
    };
  }

  /**
   * Get current validation status
   */
  getValidationStatus() {
    return {
      isRunning: this.isRunning,
      startTime: this.validationStartTime,
      elapsedHours: this.getValidationHours(),
      samplesCollected: this.shadowTrades.length,
      completedTrades: this.shadowTrades.filter(t => t.actualReturn !== 0).length,
      requiredSamples: this.config.requiredSamples
    };
  }
}

/**
 * Factory function for creating shadow mode validator
 */
export function createShadowModeValidator(config?: Partial<ShadowModeConfig>): ShadowModeValidator {
  return new ShadowModeValidator(config);
}
