/**
 * Mixture-of-Experts Trading Policy
 * Combines expert recommendations using learned gating
 */

import { logger } from '../utils/logger';
import { StateVector, RegimeState } from './state_space';
import { ExpertGating, GatingWeights } from './gating';
import { BreakoutExpert } from './experts/breakout';
import { MeanReversionExpert } from './experts/meanRevert';
import { ExpertAction } from './experts/breakout';

export interface PolicyDecision {
  action: ExpertAction;
  expertWeights: GatingWeights[];
  dominantExpert: string;
  ensembleConfidence: number;
  reasoning: string;
  abstain: boolean;
  abstainReason?: string;
}

export interface PolicyParams {
  minConfidenceThreshold: number;
  maxSizeLimit: number;
  abstainThreshold: number;
  ensembleMethod: 'weighted_average' | 'winner_takes_all' | 'confidence_weighted';
}

export class MixtureOfExpertsPolicy {
  private gating: ExpertGating;
  private experts: Map<string, any> = new Map();
  private decisionHistory: PolicyDecision[] = [];

  constructor(
    private readonly params: PolicyParams = {
      minConfidenceThreshold: 0.3,
      maxSizeLimit: 0.20,
      abstainThreshold: 0.5,
      ensembleMethod: 'confidence_weighted'
    }
  ) {
    this.gating = new ExpertGating();
    this.initializeExperts();
  }

  private initializeExperts(): void {
    this.experts.set('breakout', new BreakoutExpert());
    this.experts.set('meanRevert', new MeanReversionExpert());
    // Additional experts would be added here:
    // this.experts.set('news', new NewsExpert());
    // this.experts.set('pairs', new PairsExpert());
  }

  /**
   * Main policy decision function
   */
  async decide(
    state: StateVector,
    regimes: RegimeState[],
    features: any,
    conformalUncertainty?: number
  ): Promise<PolicyDecision> {
    const expertIds = Array.from(this.experts.keys());

    // Check for early abstention due to uncertainty
    if (conformalUncertainty && conformalUncertainty > this.params.abstainThreshold) {
      return this.abstainDecision('High conformal uncertainty', conformalUncertainty);
    }

    // Get expert gating weights
    const expertWeights = await this.gating.computeGating(state, regimes, expertIds, features);

    // Get individual expert recommendations
    const expertActions: Map<string, ExpertAction> = new Map();

    for (const expertId of expertIds) {
      const expert = this.experts.get(expertId);
      if (expert && expert.decide) {
        try {
          const action = await expert.decide(state, regimes, features);
          expertActions.set(expertId, action);
        } catch (error) {
          logger.warn(`[Policy] Expert ${expertId} failed`, { error });
          expertActions.set(expertId, this.getHoldAction(`Expert ${expertId} error`));
        }
      }
    }

    // Combine expert recommendations
    const ensembleDecision = this.combineExpertActions(expertActions, expertWeights);

    // Apply policy-level constraints and validation
    const finalDecision = this.applyConstraints(ensembleDecision, expertWeights);

    // Store decision history
    this.decisionHistory.push(finalDecision);
    if (this.decisionHistory.length > 1000) {
      this.decisionHistory.shift();
    }

    logger.info('[Policy] Decision made', {
      action: finalDecision.action.type,
      size: finalDecision.action.sizePct.toFixed(4),
      confidence: finalDecision.ensembleConfidence.toFixed(3),
      dominant: finalDecision.dominantExpert,
      abstain: finalDecision.abstain
    });

    return finalDecision;
  }

  private combineExpertActions(
    expertActions: Map<string, ExpertAction>,
    expertWeights: GatingWeights[]
  ): ExpertAction {
    const validActions = Array.from(expertActions.entries())
      .filter(([_, action]) => action.type !== 'HOLD')
      .filter(([expertId, _]) => expertWeights.find(w => w.expertId === expertId)?.weight > 0.01);

    if (validActions.length === 0) {
      return this.getHoldAction('No valid expert actions');
    }

    switch (this.params.ensembleMethod) {
      case 'weighted_average':
        return this.weightedAverageEnsemble(validActions, expertWeights);

      case 'winner_takes_all':
        return this.winnerTakesAllEnsemble(validActions, expertWeights);

      case 'confidence_weighted':
      default:
        return this.confidenceWeightedEnsemble(validActions, expertWeights);
    }
  }

  private confidenceWeightedEnsemble(
    validActions: [string, ExpertAction][],
    expertWeights: GatingWeights[]
  ): ExpertAction {
    let totalWeight = 0;
    let weightedSize = 0;
    let weightedTpBps = 0;
    let weightedSlBps = 0;
    let weightedConfidence = 0;
    let buyWeight = 0;
    let sellWeight = 0;
    let marketWeight = 0;
    let limitWeight = 0;

    const reasoning: string[] = [];

    for (const [expertId, action] of validActions) {
      const gatingWeight = expertWeights.find(w => w.expertId === expertId)?.weight || 0;
      const confidenceWeight = action.confidence;
      const combinedWeight = gatingWeight * confidenceWeight;

      if (combinedWeight < 0.01) continue;

      totalWeight += combinedWeight;
      weightedSize += action.sizePct * combinedWeight;
      weightedTpBps += action.tpBps * combinedWeight;
      weightedSlBps += action.slBps * combinedWeight;
      weightedConfidence += action.confidence * combinedWeight;

      // Vote on side
      if (action.side === 'buy') buyWeight += combinedWeight;
      else sellWeight += combinedWeight;

      // Vote on order type
      if (action.type === 'ENTER_MARKET') marketWeight += combinedWeight;
      else limitWeight += combinedWeight;

      reasoning.push(`${expertId}(${(combinedWeight/totalWeight*100).toFixed(0)}%)`);
    }

    if (totalWeight === 0) {
      return this.getHoldAction('No weighted expert consensus');
    }

    // Determine final action parameters
    const finalSizePct = weightedSize / totalWeight;
    const finalTpBps = Math.round(weightedTpBps / totalWeight);
    const finalSlBps = Math.round(weightedSlBps / totalWeight);
    const finalConfidence = weightedConfidence / totalWeight;
    const finalSide = buyWeight > sellWeight ? 'buy' : 'sell';
    const finalType = marketWeight > limitWeight ? 'ENTER_MARKET' : 'ENTER_LIMIT';

    // Calculate entry price for limit orders
    let entryPrice: number | undefined;
    if (finalType === 'ENTER_LIMIT') {
      entryPrice = this.calculateEnsembleEntryPrice(validActions, expertWeights, finalSide);
    }

    return {
      type: finalType,
      sizePct: finalSizePct,
      side: finalSide,
      confidence: finalConfidence,
      tpBps: finalTpBps,
      slBps: finalSlBps,
      price: entryPrice,
      reasoning: `Ensemble: ${reasoning.join(', ')}`
    };
  }

  private weightedAverageEnsemble(
    validActions: [string, ExpertAction][],
    expertWeights: GatingWeights[]
  ): ExpertAction {
    // Similar to confidence weighted but uses only gating weights
    let totalWeight = 0;
    let weightedSize = 0;
    let buyVotes = 0;
    let sellVotes = 0;

    for (const [expertId, action] of validActions) {
      const weight = expertWeights.find(w => w.expertId === expertId)?.weight || 0;
      totalWeight += weight;
      weightedSize += action.sizePct * weight;

      if (action.side === 'buy') buyVotes += weight;
      else sellVotes += weight;
    }

    if (totalWeight === 0) {
      return this.getHoldAction('No gating weight consensus');
    }

    return {
      type: 'ENTER_MARKET',
      sizePct: weightedSize / totalWeight,
      side: buyVotes > sellVotes ? 'buy' : 'sell',
      confidence: 0.5,
      tpBps: 100,
      slBps: 75,
      reasoning: 'Weighted average ensemble'
    };
  }

  private winnerTakesAllEnsemble(
    validActions: [string, ExpertAction][],
    expertWeights: GatingWeights[]
  ): ExpertAction {
    // Pick the expert with highest gating weight
    let maxWeight = 0;
    let winnerAction: ExpertAction | null = null;
    let winnerExpert = '';

    for (const [expertId, action] of validActions) {
      const weight = expertWeights.find(w => w.expertId === expertId)?.weight || 0;
      if (weight > maxWeight) {
        maxWeight = weight;
        winnerAction = action;
        winnerExpert = expertId;
      }
    }

    if (!winnerAction) {
      return this.getHoldAction('No winner in winner-takes-all');
    }

    return {
      ...winnerAction,
      reasoning: `Winner: ${winnerExpert} (${(maxWeight*100).toFixed(1)}%)`
    };
  }

  private calculateEnsembleEntryPrice(
    validActions: [string, ExpertAction][],
    expertWeights: GatingWeights[],
    side: 'buy' | 'sell'
  ): number {
    let totalWeight = 0;
    let weightedPrice = 0;

    for (const [expertId, action] of validActions) {
      if (action.side === side && action.price) {
        const weight = expertWeights.find(w => w.expertId === expertId)?.weight || 0;
        totalWeight += weight;
        weightedPrice += action.price * weight;
      }
    }

    return totalWeight > 0 ? weightedPrice / totalWeight : 0;
  }

  private applyConstraints(
    ensembleDecision: ExpertAction,
    expertWeights: GatingWeights[]
  ): PolicyDecision {
    let finalAction = { ...ensembleDecision };
    let abstain = false;
    let abstainReason: string | undefined;

    // Size limits
    if (finalAction.sizePct > this.params.maxSizeLimit) {
      finalAction.sizePct = this.params.maxSizeLimit;
      logger.warn('[Policy] Size capped at maximum limit', {
        original: ensembleDecision.sizePct,
        capped: this.params.maxSizeLimit
      });
    }

    // Confidence threshold
    if (finalAction.confidence < this.params.minConfidenceThreshold) {
      abstain = true;
      abstainReason = `Confidence below threshold (${finalAction.confidence.toFixed(3)} < ${this.params.minConfidenceThreshold})`;
    }

    // Minimum size threshold
    if (finalAction.sizePct < 0.005) { // 0.5% minimum
      abstain = true;
      abstainReason = `Position size too small (${finalAction.sizePct.toFixed(4)})`;
    }

    // Override to HOLD if abstaining
    if (abstain) {
      finalAction = this.getHoldAction(abstainReason!);
    }

    const dominantExpert = expertWeights.reduce((prev, curr) => 
      prev.weight > curr.weight ? prev : curr
    ).expertId;

    const ensembleConfidence = this.calculateEnsembleConfidence(expertWeights, ensembleDecision);

    return {
      action: finalAction,
      expertWeights,
      dominantExpert,
      ensembleConfidence,
      reasoning: finalAction.reasoning,
      abstain,
      abstainReason
    };
  }

  private calculateEnsembleConfidence(
    expertWeights: GatingWeights[],
    ensembleDecision: ExpertAction
  ): number {
    // Ensemble confidence based on agreement and individual confidence
    const maxWeight = Math.max(...expertWeights.map(w => w.weight));
    const weightEntropy = this.calculateWeightEntropy(expertWeights);
    const normalizedEntropy = weightEntropy / Math.log(expertWeights.length);

    // High confidence when:
    // 1. Individual expert confidence is high
    // 2. Gating weights are concentrated (low entropy)
    const concentrationBonus = 1 - normalizedEntropy;

    return Math.min(0.95, ensembleDecision.confidence * (0.7 + 0.3 * concentrationBonus));
  }

  private calculateWeightEntropy(weights: GatingWeights[]): number {
    return -weights.reduce((entropy, w) => {
      if (w.weight > 0) {
        entropy += w.weight * Math.log(w.weight);
      }
      return entropy;
    }, 0);
  }

  private getHoldAction(reason: string): ExpertAction {
    return {
      type: 'HOLD',
      sizePct: 0,
      side: 'buy',
      confidence: 0,
      tpBps: 0,
      slBps: 0,
      reasoning: reason
    };
  }

  private abstainDecision(reason: string, uncertainty?: number): PolicyDecision {
    return {
      action: this.getHoldAction(reason),
      expertWeights: [],
      dominantExpert: 'none',
      ensembleConfidence: 0,
      reasoning: reason,
      abstain: true,
      abstainReason: reason + (uncertainty ? ` (uncertainty: ${uncertainty.toFixed(3)})` : '')
    };
  }

  /**
   * Update expert performance based on trade outcome
   */
  async updatePerformance(expertId: string, tradeReturn: number): Promise<void> {
    this.gating.updatePerformance(expertId, tradeReturn);
  }

  /**
   * Get policy performance statistics
   */
  getPerformanceStats(): {
    expertStats: Record<string, any>;
    policyStats: {
      totalDecisions: number;
      abstainRate: number;
      averageConfidence: number;
      averageSize: number;
    };
  } {
    const expertStats = this.gating.getPerformanceStats();

    const recentDecisions = this.decisionHistory.slice(-100);
    const abstainCount = recentDecisions.filter(d => d.abstain).length;
    const avgConfidence = recentDecisions.length > 0 
      ? recentDecisions.reduce((sum, d) => sum + d.ensembleConfidence, 0) / recentDecisions.length 
      : 0;
    const avgSize = recentDecisions.length > 0
      ? recentDecisions.reduce((sum, d) => sum + d.action.sizePct, 0) / recentDecisions.length
      : 0;

    return {
      expertStats,
      policyStats: {
        totalDecisions: this.decisionHistory.length,
        abstainRate: recentDecisions.length > 0 ? abstainCount / recentDecisions.length : 0,
        averageConfidence: avgConfidence,
        averageSize: avgSize
      }
    };
  }

  /**
   * Reset policy state
   */
  reset(): void {
    this.gating.reset();
    this.experts.forEach(expert => {
      if (expert.reset) expert.reset();
    });
    this.decisionHistory = [];
  }
}