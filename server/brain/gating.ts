
/**
 * Expert Gating Mechanism
 * Softmax gating with toxicity and macro penalties
 */

import { logger } from '../utils/logger';
import { StateVector, RegimeState } from './state_space';

export interface GatingWeights {
  expertId: string;
  weight: number;
  logit: number;
  penalties: {
    toxicity: number;
    macro: number;
    regime: number;
  };
}

export interface GatingParams {
  gamma_toxicity: number;
  gamma_macro: number;
  temperature: number;
  regimeBonus: number[];
}

export class ExpertGating {
  private expertPerformance: Map<string, number[]> = new Map();
  private readonly performanceWindow: number = 100;

  constructor(
    private readonly params: GatingParams = {
      gamma_toxicity: 2.0,
      gamma_macro: 5.0,
      temperature: 1.0,
      regimeBonus: [0.5, 0.3, 0.2, -0.8] // Bonus for each regime
    }
  ) {}

  /**
   * Compute expert gating weights using softmax with penalties
   */
  async computeGating(
    state: StateVector,
    regimes: RegimeState[],
    expertIds: string[],
    features: any
  ): Promise<GatingWeights[]> {
    const logits: number[] = [];

    for (let i = 0; i < expertIds.length; i++) {
      const expertId = expertIds[i];
      
      // Base logit from learned gating network (simplified as regime affinity)
      const baseLogit = this.computeBaseLogit(expertId, state, regimes);

      // Toxicity penalty
      const toxicityPenalty = this.computeToxicityPenalty(features);

      // Macro blackout penalty  
      const macroPenalty = this.computeMacroPenalty(features);

      // Regime alignment bonus
      const regimeBonus = this.computeRegimeBonus(expertId, regimes);

      // Final logit with penalties
      const finalLogit = baseLogit 
        - this.params.gamma_toxicity * toxicityPenalty
        - this.params.gamma_macro * macroPenalty
        + regimeBonus;

      logits.push(finalLogit);

      logger.debug(`[Gating] Expert ${expertId}`, {
        baseLogit: baseLogit.toFixed(3),
        toxicityPenalty: toxicityPenalty.toFixed(3),
        macroPenalty: macroPenalty.toFixed(3),
        regimeBonus: regimeBonus.toFixed(3),
        finalLogit: finalLogit.toFixed(3)
      });
    }

    // Apply softmax with temperature
    const weights = this.softmax(logits, this.params.temperature);

    // Create gating weights result
    const gatingWeights: GatingWeights[] = expertIds.map((expertId, i) => ({
      expertId,
      weight: weights[i],
      logit: logits[i],
      penalties: {
        toxicity: this.computeToxicityPenalty(features),
        macro: this.computeMacroPenalty(features),
        regime: -this.computeRegimeBonus(expertId, regimes) // Negative because it's actually a bonus
      }
    }));

    const dominantExpert = gatingWeights.reduce((prev, curr) => 
      prev.weight > curr.weight ? prev : curr
    );

    logger.info('[Gating] Expert allocation', {
      dominant: dominantExpert.expertId,
      weight: dominantExpert.weight.toFixed(3),
      distribution: gatingWeights.map(g => `${g.expertId}:${g.weight.toFixed(2)}`).join(', ')
    });

    return gatingWeights;
  }

  private computeBaseLogit(expertId: string, state: StateVector, regimes: RegimeState[]): number {
    // Expert-specific regime affinity
    const expertAffinities: Record<string, number[]> = {
      'breakout': [0.2, 0.8, 0.6, 0.1],     // Prefers high-vol trending
      'meanRevert': [0.8, 0.2, 0.3, 0.4],   // Prefers low-vol mean revert
      'news': [0.3, 0.4, 0.9, 0.2],         // Prefers news-driven
      'pairs': [0.6, 0.5, 0.4, 0.3]         // Neutral preference
    };

    const affinities = expertAffinities[expertId] || [0.25, 0.25, 0.25, 0.25];

    // Weighted affinity score
    let affinityScore = 0;
    regimes.forEach((regime, i) => {
      if (i < affinities.length) {
        affinityScore += regime.probability * affinities[i];
      }
    });

    // State-based features (learned gating network would go here)
    const stateFeatures = [
      state.volatility,
      Math.abs(state.momentum),
      Math.abs(state.sentimentScore),
      state.spread,
      Math.abs(state.imbalance)
    ];

    // Simple linear combination (replace with neural network in production)
    const stateScore = stateFeatures.reduce((sum, f, i) => 
      sum + f * this.getExpertStateWeight(expertId, i), 0
    );

    // Historical performance bonus
    const performanceBonus = this.getPerformanceBonus(expertId);

    return affinityScore + stateScore + performanceBonus;
  }

  private getExpertStateWeight(expertId: string, featureIndex: number): number {
    // Expert-specific feature weights (would be learned)
    const weights: Record<string, number[]> = {
      'breakout': [0.3, 0.5, 0.2, -0.3, 0.1],    // High momentum, volatility
      'meanRevert': [-0.4, -0.2, -0.3, 0.4, 0.2], // Low volatility, momentum
      'news': [0.1, 0.2, 0.6, 0.0, 0.1],         // High sentiment
      'pairs': [0.0, 0.1, 0.0, 0.3, 0.3]         // Spread, imbalance focus
    };

    const expertWeights = weights[expertId] || [0, 0, 0, 0, 0];
    return expertWeights[featureIndex] || 0;
  }

  private computeToxicityPenalty(features: any): number {
    if (!features.toxicity) return 0;

    // High toxicity → high penalty
    const toxicity = Math.max(0, Math.min(1, features.toxicity));
    return toxicity * toxicity; // Quadratic penalty
  }

  private computeMacroPenalty(features: any): number {
    if (!features.macroBlackout) return 0;
    return 1.0; // Full penalty during blackout
  }

  private computeRegimeBonus(expertId: string, regimes: RegimeState[]): number {
    // Regime-specific bonuses for each expert
    const expertRegimeBonuses: Record<string, number[]> = {
      'breakout': [0.0, 0.5, 0.3, -0.8],   // Penalty in stress regime
      'meanRevert': [0.4, -0.2, 0.1, 0.2], // Bonus in calm regime  
      'news': [0.1, 0.2, 0.6, -0.3],       // Bonus in news regime
      'pairs': [0.2, 0.1, 0.0, 0.4]        // Bonus in stress (pairs uncorrelated)
    };

    const bonuses = expertRegimeBonuses[expertId] || [0, 0, 0, 0];
    
    let totalBonus = 0;
    regimes.forEach((regime, i) => {
      if (i < bonuses.length) {
        totalBonus += regime.probability * bonuses[i];
      }
    });

    return totalBonus;
  }

  private getPerformanceBonus(expertId: string): number {
    const performance = this.expertPerformance.get(expertId);
    if (!performance || performance.length < 10) return 0;

    // Average recent performance
    const recentPerf = performance.slice(-20);
    const avgPerf = recentPerf.reduce((sum, p) => sum + p, 0) / recentPerf.length;

    // Bonus for good performance, penalty for poor
    return Math.max(-0.5, Math.min(0.5, avgPerf * 2));
  }

  private softmax(logits: number[], temperature: number = 1.0): number[] {
    const maxLogit = Math.max(...logits);
    const scaledLogits = logits.map(l => (l - maxLogit) / temperature);
    const expLogits = scaledLogits.map(l => Math.exp(l));
    const sumExp = expLogits.reduce((sum, exp) => sum + exp, 0);
    
    return expLogits.map(exp => exp / sumExp);
  }

  /**
   * Update expert performance based on trade outcome
   */
  updatePerformance(expertId: string, tradeReturn: number): void {
    if (!this.expertPerformance.has(expertId)) {
      this.expertPerformance.set(expertId, []);
    }

    const performance = this.expertPerformance.get(expertId)!;
    performance.push(tradeReturn);

    if (performance.length > this.performanceWindow) {
      performance.shift();
    }

    logger.debug(`[Gating] Updated ${expertId} performance`, {
      tradeReturn: tradeReturn.toFixed(4),
      recentAvg: this.getPerformanceBonus(expertId).toFixed(4),
      sampleSize: performance.length
    });
  }

  /**
   * Get expert performance statistics
   */
  getPerformanceStats(): Record<string, {
    avgReturn: number;
    winRate: number;
    sampleSize: number;
    sharpe: number;
  }> {
    const stats: Record<string, any> = {};

    this.expertPerformance.forEach((performance, expertId) => {
      if (performance.length === 0) {
        stats[expertId] = { avgReturn: 0, winRate: 0, sampleSize: 0, sharpe: 0 };
        return;
      }

      const avgReturn = performance.reduce((sum, p) => sum + p, 0) / performance.length;
      const winRate = performance.filter(p => p > 0).length / performance.length;
      const variance = performance.reduce((sum, p) => sum + Math.pow(p - avgReturn, 2), 0) / performance.length;
      const sharpe = variance > 0 ? avgReturn / Math.sqrt(variance) : 0;

      stats[expertId] = {
        avgReturn,
        winRate,
        sampleSize: performance.length,
        sharpe
      };
    });

    return stats;
  }

  /**
   * Reset all expert performance history
   */
  reset(): void {
    this.expertPerformance.clear();
  }

  /**
   * Update gating parameters
   */
  updateParameters(newParams: Partial<GatingParams>): void {
    Object.assign(this.params, newParams);
    logger.info('[Gating] Parameters updated', newParams);
  }
}
