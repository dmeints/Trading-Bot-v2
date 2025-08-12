
/**
 * Promotion Gate Service
 * Manages gradual ramp-up and safe promotion to live trading
 */

import { logger } from '../utils/logger';
import { ShadowModeValidator, ShadowModeResult } from './shadowModeValidator';

export interface PromotionConfig {
  initialNotional: number;      // Starting position size (e.g., 0.005 = 0.5%)
  maxNotional: number;          // Maximum position size
  rampUpSteps: number[];        // Gradual increase steps
  performanceGates: {
    sharpeThreshold: number;
    winRateThreshold: number;
    maxDrawdownThreshold: number;
    minTradesPerStep: number;
  };
  rollbackTriggers: {
    maxConsecutiveLosses: number;
    maxDrawdownInStep: number;
    minSharpeRatio: number;
  };
}

export interface PromotionStatus {
  currentStep: number;
  currentNotional: number;
  isLive: boolean;
  canAdvance: boolean;
  needsRollback: boolean;
  stepPerformance: {
    tradesInStep: number;
    sharpeRatio: number;
    winRate: number;
    maxDrawdown: number;
    consecutiveLosses: number;
  };
  nextStepRequirements: {
    minTrades: number;
    currentTrades: number;
    performanceMet: boolean;
  };
}

export interface PromotionTrade {
  timestamp: Date;
  symbol: string;
  side: 'buy' | 'sell';
  notional: number;
  pnl: number;
  step: number;
}

/**
 * Promotion Gate
 * Manages safe transition from shadow mode to live trading
 */
export class PromotionGate {
  private config: PromotionConfig;
  private currentStep: number = 0;
  private isLive: boolean = false;
  private stepTrades: PromotionTrade[] = [];
  private allTrades: PromotionTrade[] = [];
  private consecutiveLosses: number = 0;
  private shadowValidator: ShadowModeValidator;

  constructor(config: Partial<PromotionConfig> = {}) {
    this.config = {
      initialNotional: 0.005,     // 0.5% of portfolio
      maxNotional: 0.02,          // 2% of portfolio
      rampUpSteps: [0.005, 0.01, 0.015, 0.02], // Gradual increase
      performanceGates: {
        sharpeThreshold: 1.0,
        winRateThreshold: 0.6,
        maxDrawdownThreshold: 0.02,
        minTradesPerStep: 20
      },
      rollbackTriggers: {
        maxConsecutiveLosses: 5,
        maxDrawdownInStep: 0.03,
        minSharpeRatio: 0.5
      },
      ...config
    };
  }

  /**
   * Initialize promotion process with shadow mode validation
   */
  async initializePromotion(shadowResult: ShadowModeResult): Promise<boolean> {
    if (!shadowResult.approved) {
      logger.error('[PromotionGate] Shadow mode validation failed', {
        confidence: shadowResult.confidence,
        issues: shadowResult.issues
      });
      return false;
    }

    if (shadowResult.confidence < 0.8) {
      logger.warn('[PromotionGate] Low confidence in shadow validation', {
        confidence: shadowResult.confidence
      });
      return false;
    }

    // Reset promotion state
    this.currentStep = 0;
    this.isLive = true;
    this.stepTrades = [];
    this.allTrades = [];
    this.consecutiveLosses = 0;

    logger.info('[PromotionGate] Promotion approved and initialized', {
      initialNotional: this.config.rampUpSteps[0],
      confidence: shadowResult.confidence,
      shadowSamples: shadowResult.samplesProcessed
    });

    return true;
  }

  /**
   * Process live trade and update promotion status
   */
  async processLiveTrade(
    symbol: string,
    side: 'buy' | 'sell',
    notional: number,
    pnl: number
  ): Promise<void> {
    if (!this.isLive) {
      throw new Error('Promotion gate not active');
    }

    const trade: PromotionTrade = {
      timestamp: new Date(),
      symbol,
      side,
      notional,
      pnl,
      step: this.currentStep
    };

    this.stepTrades.push(trade);
    this.allTrades.push(trade);

    // Update consecutive losses counter
    if (pnl < 0) {
      this.consecutiveLosses++;
    } else {
      this.consecutiveLosses = 0;
    }

    logger.debug('[PromotionGate] Live trade processed', {
      symbol,
      pnl: pnl.toFixed(2),
      step: this.currentStep,
      consecutiveLosses: this.consecutiveLosses
    });

    // Check for rollback triggers
    await this.checkRollbackTriggers();

    // Check for step advancement
    await this.checkStepAdvancement();
  }

  /**
   * Get current notional size based on promotion step
   */
  getCurrentNotional(): number {
    if (!this.isLive || this.currentStep >= this.config.rampUpSteps.length) {
      return 0;
    }
    return this.config.rampUpSteps[this.currentStep];
  }

  /**
   * Get promotion status
   */
  getPromotionStatus(): PromotionStatus {
    const stepPerformance = this.calculateStepPerformance();
    const nextStepRequirements = this.getNextStepRequirements();

    return {
      currentStep: this.currentStep,
      currentNotional: this.getCurrentNotional(),
      isLive: this.isLive,
      canAdvance: this.canAdvanceToNextStep(),
      needsRollback: this.needsRollback(),
      stepPerformance,
      nextStepRequirements
    };
  }

  /**
   * Manually trigger rollback
   */
  async triggerRollback(reason: string): Promise<void> {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.stepTrades = [];
      this.consecutiveLosses = 0;

      logger.warn('[PromotionGate] Rollback triggered', {
        reason,
        newStep: this.currentStep,
        newNotional: this.getCurrentNotional()
      });
    } else {
      // Rollback to shadow mode
      this.isLive = false;
      logger.error('[PromotionGate] Full rollback to shadow mode', { reason });
    }
  }

  /**
   * Manually advance to next step (admin override)
   */
  async advanceStep(adminOverride: boolean = false): Promise<boolean> {
    if (!adminOverride && !this.canAdvanceToNextStep()) {
      logger.warn('[PromotionGate] Cannot advance step - requirements not met');
      return false;
    }

    if (this.currentStep >= this.config.rampUpSteps.length - 1) {
      logger.info('[PromotionGate] Maximum promotion step reached');
      return false;
    }

    this.currentStep++;
    this.stepTrades = [];
    this.consecutiveLosses = 0;

    logger.info('[PromotionGate] Advanced to next step', {
      step: this.currentStep,
      notional: this.getCurrentNotional(),
      adminOverride
    });

    return true;
  }

  /**
   * Stop live trading and return to shadow mode
   */
  stopLiveTrading(): void {
    this.isLive = false;
    logger.info('[PromotionGate] Live trading stopped - returning to shadow mode');
  }

  /**
   * Check if rollback is needed
   */
  private async checkRollbackTriggers(): Promise<void> {
    if (!this.isLive) return;

    const triggers = this.config.rollbackTriggers;

    // Check consecutive losses
    if (this.consecutiveLosses >= triggers.maxConsecutiveLosses) {
      await this.triggerRollback(`Consecutive losses: ${this.consecutiveLosses}`);
      return;
    }

    // Check step drawdown
    const stepPerformance = this.calculateStepPerformance();
    if (stepPerformance.maxDrawdown > triggers.maxDrawdownInStep) {
      await this.triggerRollback(`Step drawdown: ${(stepPerformance.maxDrawdown * 100).toFixed(1)}%`);
      return;
    }

    // Check Sharpe ratio (if enough trades)
    if (this.stepTrades.length >= 10 && stepPerformance.sharpeRatio < triggers.minSharpeRatio) {
      await this.triggerRollback(`Low Sharpe ratio: ${stepPerformance.sharpeRatio.toFixed(2)}`);
      return;
    }
  }

  /**
   * Check if step can be advanced
   */
  private async checkStepAdvancement(): Promise<void> {
    if (!this.canAdvanceToNextStep()) return;

    logger.info('[PromotionGate] Step advancement criteria met', {
      currentStep: this.currentStep,
      tradesInStep: this.stepTrades.length
    });

    await this.advanceStep();
  }

  /**
   * Check if can advance to next step
   */
  private canAdvanceToNextStep(): boolean {
    if (!this.isLive || this.currentStep >= this.config.rampUpSteps.length - 1) {
      return false;
    }

    const gates = this.config.performanceGates;
    const stepPerformance = this.calculateStepPerformance();

    // Need minimum trades
    if (this.stepTrades.length < gates.minTradesPerStep) {
      return false;
    }

    // Performance gates
    return stepPerformance.sharpeRatio >= gates.sharpeThreshold &&
           stepPerformance.winRate >= gates.winRateThreshold &&
           stepPerformance.maxDrawdown <= gates.maxDrawdownThreshold;
  }

  /**
   * Check if rollback is needed
   */
  private needsRollback(): boolean {
    if (!this.isLive) return false;

    const triggers = this.config.rollbackTriggers;
    const stepPerformance = this.calculateStepPerformance();

    return this.consecutiveLosses >= triggers.maxConsecutiveLosses ||
           stepPerformance.maxDrawdown > triggers.maxDrawdownInStep ||
           (this.stepTrades.length >= 10 && stepPerformance.sharpeRatio < triggers.minSharpeRatio);
  }

  /**
   * Calculate performance for current step
   */
  private calculateStepPerformance() {
    if (this.stepTrades.length === 0) {
      return {
        tradesInStep: 0,
        sharpeRatio: 0,
        winRate: 0,
        maxDrawdown: 0,
        consecutiveLosses: this.consecutiveLosses
      };
    }

    const pnls = this.stepTrades.map(t => t.pnl);
    const avgPnl = pnls.reduce((sum, p) => sum + p, 0) / pnls.length;
    const pnlStd = Math.sqrt(pnls.reduce((sum, p) => sum + Math.pow(p - avgPnl, 2), 0) / pnls.length);
    const sharpeRatio = pnlStd > 0 ? (avgPnl * Math.sqrt(252)) / (pnlStd * Math.sqrt(252)) : 0;

    const winRate = this.stepTrades.filter(t => t.pnl > 0).length / this.stepTrades.length;

    // Calculate drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let cumPnl = 0;

    for (const trade of this.stepTrades) {
      cumPnl += trade.pnl;
      if (cumPnl > peak) peak = cumPnl;
      const drawdown = peak > 0 ? (peak - cumPnl) / peak : 0;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return {
      tradesInStep: this.stepTrades.length,
      sharpeRatio,
      winRate,
      maxDrawdown,
      consecutiveLosses: this.consecutiveLosses
    };
  }

  /**
   * Get next step requirements
   */
  private getNextStepRequirements() {
    const minTrades = this.config.performanceGates.minTradesPerStep;
    const currentTrades = this.stepTrades.length;
    const stepPerformance = this.calculateStepPerformance();

    const performanceMet = currentTrades >= minTrades &&
                          stepPerformance.sharpeRatio >= this.config.performanceGates.sharpeThreshold &&
                          stepPerformance.winRate >= this.config.performanceGates.winRateThreshold &&
                          stepPerformance.maxDrawdown <= this.config.performanceGates.maxDrawdownThreshold;

    return {
      minTrades,
      currentTrades,
      performanceMet
    };
  }

  /**
   * Get promotion history
   */
  getPromotionHistory() {
    const stepHistory = [];
    const currentStep = this.currentStep;

    for (let step = 0; step <= currentStep; step++) {
      const stepTrades = this.allTrades.filter(t => t.step === step);
      if (stepTrades.length > 0) {
        const stepPnl = stepTrades.reduce((sum, t) => sum + t.pnl, 0);
        const stepWinRate = stepTrades.filter(t => t.pnl > 0).length / stepTrades.length;

        stepHistory.push({
          step,
          notional: this.config.rampUpSteps[step],
          trades: stepTrades.length,
          totalPnl: stepPnl,
          winRate: stepWinRate,
          completed: step < currentStep
        });
      }
    }

    return stepHistory;
  }
}

/**
 * Factory function for creating promotion gate
 */
export function createPromotionGate(config?: Partial<PromotionConfig>): PromotionGate {
  return new PromotionGate(config);
}
