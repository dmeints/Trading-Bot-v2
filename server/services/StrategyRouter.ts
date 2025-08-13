
/**
 * Strategy Router - Bayesian Thompson Sampling
 */

import { logger } from '../utils/logger.js';

export interface RouterContext {
  regime?: string;
  sigmaHAR?: number;
  sigmaGARCH?: number;
  obi?: number;
  ti?: number;
  spread_bps?: number;
  micro_vol?: number;
  rr25?: number;
  fly25?: number;
  iv_term_slope?: number;
  skew_z?: number;
  funding_rate?: number;
  sentiment_score?: number;
  whale_activity?: number;
  vol?: number;
  trend?: number;
  funding?: number;
  sentiment?: number;
}

export interface PolicyChoice {
  policyId: string;
  score: number;
  explorationBonus: number;
  confidence: number;
}

export interface PolicyUpdate {
  policyId: string;
  reward: number;
  context?: RouterContext;
}

export interface PolicyPosterior {
  alpha: number;
  beta: number;
  count: number;
  sumReward: number;
  sumRewardSq: number;
  mean: number;
  variance: number;
  updateCount: number;
}

interface PolicyStats {
  alpha: number;
  beta: number;
  count: number;
  sumReward: number;
  sumRewardSq: number;
}

class StrategyRouter {
  private policies = new Map<string, PolicyStats>();
  private lastChoice: PolicyChoice | null = null;
  private lastContext: RouterContext | null = null;
  private featureWeights = new Map<string, number>();

  constructor() {
    // Initialize known policies
    const defaultPolicies = ['p_sma', 'p_ema', 'p_breakout', 'p_mean_revert', 'p_momentum', 'p_trend', 'p_meanrev'];
    for (const policyId of defaultPolicies) {
      this.policies.set(policyId, {
        alpha: 1,
        beta: 1,
        count: 0,
        sumReward: 0,
        sumRewardSq: 0
      });
    }

    // Initialize feature weights
    this.featureWeights.set('regime_bull', 0.1);
    this.featureWeights.set('regime_bear', -0.1);
    this.featureWeights.set('regime_sideways', 0.05);
    this.featureWeights.set('sigmaHAR', -0.2);
    this.featureWeights.set('obi', 0.3);
    this.featureWeights.set('spread_bps', -0.1);
    this.featureWeights.set('rr25', 0.15);
    this.featureWeights.set('vol', -0.2);
    this.featureWeights.set('trend', 0.25);
    this.featureWeights.set('funding', -0.1);
    this.featureWeights.set('sentiment', 0.2);
  }

  /**
   * Choose policy using Thompson Sampling with contextual features
   */
  choose(context: RouterContext): PolicyChoice {
    return this.choosePolicy(context);
  }

  /**
   * Choose policy using Thompson Sampling with contextual features
   */
  choosePolicy(context: RouterContext): PolicyChoice {
    const featureVector = this.contextToFeatures(context);
    let bestPolicy = 'p_sma';
    let bestScore = -Infinity;
    let bestExploration = 0;

    for (const [policyId, stats] of this.policies) {
      // Thompson sampling: sample from Beta distribution
      const sampledMean = this.sampleBeta(stats.alpha, stats.beta);
      
      // Add contextual adjustment
      const contextualScore = this.computeContextualScore(featureVector, policyId);
      const totalScore = sampledMean + contextualScore;
      
      // Exploration bonus based on uncertainty (UCB-style)
      const explorationBonus = Math.sqrt(2 * Math.log(this.getTotalCount()) / Math.max(1, stats.count));
      const finalScore = totalScore + explorationBonus;

      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestPolicy = policyId;
        bestExploration = explorationBonus;
      }
    }

    const choice: PolicyChoice = {
      policyId: bestPolicy,
      score: bestScore,
      explorationBonus: bestExploration,
      confidence: this.getConfidence(bestPolicy)
    };

    this.lastChoice = choice;
    this.lastContext = context;

    logger.debug(`[StrategyRouter] Chose ${bestPolicy} with score ${bestScore.toFixed(3)}`);

    return choice;
  }

  /**
   * Update policy performance with observed reward
   */
  update(policyId: string, reward: number, context?: RouterContext): PolicyPosterior {
    const update: PolicyUpdate = { policyId, reward, context };
    return this.updatePolicy(update);
  }

  /**
   * Update policy performance with observed reward
   */
  updatePolicy(update: PolicyUpdate): PolicyPosterior {
    const { policyId, reward, context } = update;
    
    if (!this.policies.has(policyId)) {
      this.policies.set(policyId, { alpha: 1, beta: 1, count: 0, sumReward: 0, sumRewardSq: 0 });
    }

    const stats = this.policies.get(policyId)!;
    
    // Update Beta distribution parameters
    if (reward > 0) {
      stats.alpha += reward;
    } else {
      stats.beta += Math.abs(reward);
    }
    
    // Update running statistics
    stats.count += 1;
    stats.sumReward += reward;
    stats.sumRewardSq += reward * reward;

    // Update feature weights using simple gradient if context provided
    if (context) {
      const featureVector = this.contextToFeatures(context);
      const learningRate = 0.01;
      
      for (const [feature, value] of featureVector) {
        const currentWeight = this.featureWeights.get(feature) || 0;
        const gradient = reward * value;
        this.featureWeights.set(feature, currentWeight + learningRate * gradient);
      }
    }

    logger.debug(`[StrategyRouter] Updated ${policyId}: α=${stats.alpha.toFixed(2)}, β=${stats.beta.toFixed(2)}, reward=${reward.toFixed(4)}`);

    // Return posterior summary
    const mean = stats.count > 0 ? stats.sumReward / stats.count : 0;
    const variance = stats.count > 1 
      ? (stats.sumRewardSq / stats.count) - Math.pow(mean, 2)
      : 1;

    return {
      alpha: stats.alpha,
      beta: stats.beta,
      count: stats.count,
      sumReward: stats.sumReward,
      sumRewardSq: stats.sumRewardSq,
      mean,
      variance,
      updateCount: stats.count
    };
  }

  /**
   * Get policies map for inspection
   */
  getPolicies(): Map<string, PolicyPosterior> {
    const posteriors = new Map<string, PolicyPosterior>();
    
    for (const [policyId, stats] of this.policies) {
      const mean = stats.count > 0 ? stats.sumReward / stats.count : 0;
      const variance = stats.count > 1 
        ? (stats.sumRewardSq / stats.count) - Math.pow(mean, 2)
        : 1;

      posteriors.set(policyId, {
        alpha: stats.alpha,
        beta: stats.beta,
        count: stats.count,
        sumReward: stats.sumReward,
        sumRewardSq: stats.sumRewardSq,
        mean,
        variance,
        updateCount: stats.count
      });
    }
    
    return posteriors;
  }

  /**
   * Get current router state snapshot
   */
  getSnapshot(): any {
    return {
      lastChoice: this.lastChoice,
      lastContext: this.lastContext,
      policies: Array.from(this.policies.entries()).map(([id, stats]) => ({
        policyId: id,
        alpha: stats.alpha,
        beta: stats.beta,
        count: stats.count,
        meanReward: stats.count > 0 ? stats.sumReward / stats.count : 0,
        confidence: this.getConfidence(id)
      })),
      featureWeights: Object.fromEntries(this.featureWeights),
      totalDecisions: this.getTotalCount()
    };
  }

  /**
   * Convert context to feature vector
   */
  private contextToFeatures(context: RouterContext): Map<string, number> {
    const features = new Map<string, number>();
    
    // Regime features
    features.set('regime_bull', context.regime === 'bull' ? 1 : 0);
    features.set('regime_bear', context.regime === 'bear' ? 1 : 0);
    features.set('regime_sideways', context.regime === 'sideways' ? 1 : 0);
    
    // Volatility features
    features.set('sigmaHAR', context.sigmaHAR || 0);
    features.set('sigmaGARCH', context.sigmaGARCH || 0);
    features.set('vol', context.vol || 0);
    features.set('vol_ratio', context.sigmaHAR && context.sigmaGARCH ? context.sigmaHAR / context.sigmaGARCH : 1);
    
    // Microstructure features
    features.set('obi', context.obi || 0);
    features.set('ti', context.ti || 0);
    features.set('spread_bps', context.spread_bps || 0);
    features.set('micro_vol', context.micro_vol || 0);
    
    // Options features
    features.set('rr25', context.rr25 || 0);
    features.set('fly25', context.fly25 || 0);
    features.set('iv_term_slope', context.iv_term_slope || 0);
    features.set('skew_z', context.skew_z || 0);
    
    // Other features
    features.set('funding_rate', context.funding_rate || 0);
    features.set('funding', context.funding || 0);
    features.set('sentiment_score', context.sentiment_score || 0);
    features.set('sentiment', context.sentiment || 0);
    features.set('whale_activity', context.whale_activity || 0);
    features.set('trend', context.trend || 0);
    
    return features;
  }

  /**
   * Compute contextual score for policy
   */
  private computeContextualScore(features: Map<string, number>, policyId: string): number {
    let score = 0;
    
    for (const [feature, value] of features) {
      const weight = this.featureWeights.get(feature) || 0;
      score += weight * value;
    }
    
    // Policy-specific adjustments
    if (policyId === 'p_breakout' && features.get('obi')! > 0.1) {
      score += 0.1;
    }
    if (policyId === 'p_mean_revert' && Math.abs(features.get('obi')!) < 0.05) {
      score += 0.1;
    }
    if (policyId === 'p_trend' && features.get('trend')! > 1) {
      score += 0.15;
    }
    if (policyId === 'p_meanrev' && Math.abs(features.get('trend')!) < 0.1) {
      score += 0.1;
    }
    
    return score;
  }

  /**
   * Sample from Beta distribution (simplified)
   */
  private sampleBeta(alpha: number, beta: number): number {
    // Simplified beta sampling using ratio of uniforms
    const x = Math.pow(Math.random(), 1/alpha);
    const y = Math.pow(Math.random(), 1/beta);
    return x / (x + y);
  }

  /**
   * Get confidence level for policy
   */
  private getConfidence(policyId: string): number {
    const stats = this.policies.get(policyId);
    if (!stats || stats.count < 2) return 0;
    
    // Simple confidence based on count and variance
    const variance = (stats.sumRewardSq / stats.count) - Math.pow(stats.sumReward / stats.count, 2);
    const stdError = Math.sqrt(variance / stats.count);
    
    return Math.max(0, 1 - stdError);
  }

  /**
   * Get total decision count across all policies
   */
  private getTotalCount(): number {
    return Array.from(this.policies.values()).reduce((sum, stats) => sum + stats.count, 0) + 1;
  }

  /**
   * Get router status for health check
   */
  getStatus(): string {
    return 'active';
  }
}

export const strategyRouter = new StrategyRouter();
// Bayesian Thompson Sampling Strategy Router
import { randomNormal } from 'crypto';

interface RouterContext {
  regime?: string;
  sigmaHAR?: number;
  sigmaGARCH?: number;
  obi?: number;
  ti?: number;
  spread_bps?: number;
  micro_vol?: number;
  rr25?: number;
  fly25?: number;
  skew_z?: number;
  funding_rate?: number;
  sentiment?: number;
  onchain_flow?: number;
}

interface PolicyChoice {
  policyId: string;
  score: number;
  explorationBonus: number;
  timestamp: number;
}

interface PolicyUpdate {
  policyId: string;
  reward: number;
  context: RouterContext;
  timestamp: number;
}

interface PolicyStats {
  policyId: string;
  meanReward: number;
  variance: number;
  count: number;
  lastUpdate: number;
}

interface RouterSnapshot {
  lastChoice: PolicyChoice | null;
  sampledScores: Record<string, number>;
  featureVector: number[];
  timestamp: number;
}

class BayesianThompsonRouter {
  private policies = new Map<string, PolicyStats>();
  private lastChoice: PolicyChoice | null = null;
  private lastFeatureVector: number[] = [];
  private lastSampledScores: Record<string, number> = {};
  
  private readonly DEFAULT_POLICIES = ['p_sma', 'p_ema', 'p_rsi', 'p_mean_revert', 'p_momentum'];
  private readonly PRIOR_MEAN = 0.0;
  private readonly PRIOR_VAR = 0.1;
  private readonly MIN_VARIANCE = 0.001;

  constructor() {
    // Initialize default policies
    for (const policyId of this.DEFAULT_POLICIES) {
      this.policies.set(policyId, {
        policyId,
        meanReward: this.PRIOR_MEAN,
        variance: this.PRIOR_VAR,
        count: 0,
        lastUpdate: 0
      });
    }
  }

  choose(context: RouterContext): PolicyChoice {
    const featureVector = this.contextToFeatures(context);
    this.lastFeatureVector = featureVector;
    
    const scores: Record<string, number> = {};
    let bestPolicy = this.DEFAULT_POLICIES[0];
    let bestScore = -Infinity;
    
    // Thompson sampling: sample from posterior for each policy
    for (const [policyId, stats] of this.policies) {
      const sampledScore = this.samplePosterior(stats, featureVector);
      scores[policyId] = sampledScore;
      
      if (sampledScore > bestScore) {
        bestScore = sampledScore;
        bestPolicy = policyId;
      }
    }
    
    this.lastSampledScores = scores;
    
    // Calculate exploration bonus (uncertainty)
    const chosenStats = this.policies.get(bestPolicy)!;
    const explorationBonus = Math.sqrt(chosenStats.variance);
    
    const choice: PolicyChoice = {
      policyId: bestPolicy,
      score: bestScore,
      explorationBonus,
      timestamp: Date.now()
    };
    
    this.lastChoice = choice;
    return choice;
  }

  update(update: PolicyUpdate): void {
    const stats = this.policies.get(update.policyId);
    if (!stats) {
      // Add new policy
      this.policies.set(update.policyId, {
        policyId: update.policyId,
        meanReward: update.reward,
        variance: this.PRIOR_VAR,
        count: 1,
        lastUpdate: update.timestamp
      });
      return;
    }
    
    // Bayesian update
    const priorPrec = 1 / stats.variance;
    const likelihoodPrec = 1 / this.MIN_VARIANCE; // Assume fixed observation noise
    
    const posteriorPrec = priorPrec + likelihoodPrec;
    const posteriorMean = (priorPrec * stats.meanReward + likelihoodPrec * update.reward) / posteriorPrec;
    const posteriorVar = 1 / posteriorPrec;
    
    stats.meanReward = posteriorMean;
    stats.variance = Math.max(posteriorVar, this.MIN_VARIANCE);
    stats.count++;
    stats.lastUpdate = update.timestamp;
  }

  getSnapshot(): RouterSnapshot {
    return {
      lastChoice: this.lastChoice,
      sampledScores: { ...this.lastSampledScores },
      featureVector: [...this.lastFeatureVector],
      timestamp: Date.now()
    };
  }

  getAllPolicies(): PolicyStats[] {
    return Array.from(this.policies.values());
  }

  private contextToFeatures(context: RouterContext): number[] {
    // Convert context to feature vector
    const features: number[] = [];
    
    // Regime features (one-hot encoding)
    features.push(context.regime === 'bull' ? 1 : 0);
    features.push(context.regime === 'bear' ? 1 : 0);
    features.push(context.regime === 'sideways' ? 1 : 0);
    
    // Volatility features
    features.push(context.sigmaHAR || 0);
    features.push(context.sigmaGARCH || 0);
    
    // Microstructure features
    features.push(context.obi || 0);
    features.push(context.ti || 0);
    features.push((context.spread_bps || 0) / 100); // Normalize
    features.push(context.micro_vol || 0);
    
    // Options features
    features.push(context.rr25 || 0);
    features.push(context.fly25 || 0);
    features.push(context.skew_z || 0);
    
    // Other features
    features.push(context.funding_rate || 0);
    features.push((context.sentiment || 0) / 100); // Normalize
    features.push(context.onchain_flow || 0);
    
    return features;
  }

  private samplePosterior(stats: PolicyStats, features: number[]): number {
    // Simple linear model: score = mean + feature_effect + noise
    // In practice, this would be a proper Bayesian linear regression
    
    const baseScore = stats.meanReward;
    
    // Add feature-based adjustment (simplified)
    const featureEffect = features.reduce((sum, f, i) => sum + f * 0.1 * Math.sin(i), 0);
    
    // Sample from normal distribution
    const noise = this.sampleNormal(0, Math.sqrt(stats.variance));
    
    return baseScore + featureEffect + noise;
  }

  private sampleNormal(mean: number, std: number): number {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + std * z;
  }
}

export const strategyRouter = new BayesianThompsonRouter();
export type { RouterContext, PolicyChoice, PolicyUpdate, RouterSnapshot };
