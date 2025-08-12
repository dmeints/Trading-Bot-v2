
import { logger } from '../utils/logger.js';

export enum PolicyState {
  SHADOW = 'shadow',
  PAPER = 'paper',
  LIVE = 'live'
}

export interface PolicyThresholds {
  minShadowFills: number;
  minPaperPnL: number;
  maxDrawdown: number;
  minObservationDays: number;
}

export interface PolicyStatus {
  policyId: string;
  state: PolicyState;
  shadowFills: number;
  paperPnL: number;
  maxDrawdown: number;
  observationDays: number;
  canPromote: boolean;
  promotionBlocked: string[];
}

class PolicyGuard {
  private policies: Map<string, PolicyStatus> = new Map();
  private thresholds: PolicyThresholds = {
    minShadowFills: 50,
    minPaperPnL: 0.001, // 0.1% minimum return
    maxDrawdown: -0.05, // 5% max drawdown
    minObservationDays: 7
  };

  constructor() {
    // Initialize default policies
    this.initializePolicy('p_sma');
    this.initializePolicy('p_trend');
    this.initializePolicy('p_meanrev');
  }

  private initializePolicy(policyId: string): void {
    this.policies.set(policyId, {
      policyId,
      state: PolicyState.SHADOW,
      shadowFills: 0,
      paperPnL: 0,
      maxDrawdown: 0,
      observationDays: 0,
      canPromote: false,
      promotionBlocked: []
    });
  }

  recordShadowFill(policyId: string, fillData: { price: number; quantity: number; pnl: number }): void {
    const status = this.policies.get(policyId);
    if (!status || status.state !== PolicyState.SHADOW) {
      return;
    }

    status.shadowFills += 1;
    status.paperPnL += fillData.pnl;
    status.maxDrawdown = Math.min(status.maxDrawdown, fillData.pnl);
    status.observationDays = Math.floor((Date.now() - this.getCreationTime(policyId)) / (24 * 60 * 60 * 1000));

    this.evaluatePromotion(policyId);
    
    logger.info(`[PolicyGuard] Shadow fill recorded for ${policyId}`, {
      fills: status.shadowFills,
      pnl: status.paperPnL,
      canPromote: status.canPromote
    });
  }

  recordPaperTrade(policyId: string, tradeData: { pnl: number; drawdown: number }): void {
    const status = this.policies.get(policyId);
    if (!status || status.state !== PolicyState.PAPER) {
      return;
    }

    status.paperPnL += tradeData.pnl;
    status.maxDrawdown = Math.min(status.maxDrawdown, tradeData.drawdown);
    status.observationDays = Math.floor((Date.now() - this.getCreationTime(policyId)) / (24 * 60 * 60 * 1000));

    this.evaluatePromotion(policyId);

    logger.info(`[PolicyGuard] Paper trade recorded for ${policyId}`, {
      pnl: status.paperPnL,
      drawdown: status.maxDrawdown,
      canPromote: status.canPromote
    });
  }

  private evaluatePromotion(policyId: string): void {
    const status = this.policies.get(policyId);
    if (!status) return;

    const blockers: string[] = [];

    switch (status.state) {
      case PolicyState.SHADOW:
        if (status.shadowFills < this.thresholds.minShadowFills) {
          blockers.push(`Insufficient shadow fills: ${status.shadowFills}/${this.thresholds.minShadowFills}`);
        }
        if (status.observationDays < this.thresholds.minObservationDays) {
          blockers.push(`Insufficient observation period: ${status.observationDays}/${this.thresholds.minObservationDays} days`);
        }
        break;

      case PolicyState.PAPER:
        if (status.paperPnL < this.thresholds.minPaperPnL) {
          blockers.push(`Insufficient paper PnL: ${status.paperPnL.toFixed(4)}/${this.thresholds.minPaperPnL}`);
        }
        if (status.maxDrawdown < this.thresholds.maxDrawdown) {
          blockers.push(`Excessive drawdown: ${status.maxDrawdown.toFixed(4)} > ${this.thresholds.maxDrawdown}`);
        }
        if (status.observationDays < this.thresholds.minObservationDays * 2) {
          blockers.push(`Insufficient paper observation: ${status.observationDays}/${this.thresholds.minObservationDays * 2} days`);
        }
        break;
    }

    status.promotionBlocked = blockers;
    status.canPromote = blockers.length === 0;
  }

  promotePolicy(policyId: string): boolean {
    const status = this.policies.get(policyId);
    if (!status || !status.canPromote) {
      logger.warn(`[PolicyGuard] Cannot promote ${policyId}`, { 
        blockers: status?.promotionBlocked 
      });
      return false;
    }

    switch (status.state) {
      case PolicyState.SHADOW:
        status.state = PolicyState.PAPER;
        status.paperPnL = 0; // Reset for paper tracking
        status.maxDrawdown = 0;
        logger.info(`[PolicyGuard] Promoted ${policyId} to PAPER`);
        break;

      case PolicyState.PAPER:
        status.state = PolicyState.LIVE;
        logger.info(`[PolicyGuard] Promoted ${policyId} to LIVE`);
        break;

      default:
        return false;
    }

    status.canPromote = false;
    status.promotionBlocked = [];
    this.evaluatePromotion(policyId);
    return true;
  }

  canExecuteLive(policyId: string): boolean {
    const status = this.policies.get(policyId);
    if (!status) {
      logger.warn(`[PolicyGuard] Unknown policy ${policyId} blocked from live execution`);
      return false;
    }

    const canExecute = status.state === PolicyState.LIVE;
    if (!canExecute) {
      logger.warn(`[PolicyGuard] Policy ${policyId} blocked from live execution`, {
        currentState: status.state,
        blockers: status.promotionBlocked
      });
    }

    return canExecute;
  }

  getPolicyStatus(policyId?: string): PolicyStatus | PolicyStatus[] {
    if (policyId) {
      return this.policies.get(policyId) || this.createUnknownPolicy(policyId);
    }
    return Array.from(this.policies.values());
  }

  private createUnknownPolicy(policyId: string): PolicyStatus {
    return {
      policyId,
      state: PolicyState.SHADOW,
      shadowFills: 0,
      paperPnL: 0,
      maxDrawdown: 0,
      observationDays: 0,
      canPromote: false,
      promotionBlocked: ['Policy not initialized']
    };
  }

  private getCreationTime(policyId: string): number {
    // Placeholder - in real system, this would be stored
    return Date.now() - (Math.random() * 7 * 24 * 60 * 60 * 1000); // Random time within last week
  }

  updateThresholds(newThresholds: Partial<PolicyThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    
    // Re-evaluate all policies with new thresholds
    for (const policyId of this.policies.keys()) {
      this.evaluatePromotion(policyId);
    }

    logger.info('[PolicyGuard] Updated thresholds', this.thresholds);
  }
}

export const policyGuard = new PolicyGuard();
