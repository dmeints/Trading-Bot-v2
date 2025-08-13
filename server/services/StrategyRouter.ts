
import { logger } from '../utils/logger.js';

interface Context {
  regime?: 'bull' | 'bear' | 'sideways';
  sigmaHAR?: number;
  obi?: number;
  rr25?: number;
  spread?: number;
  microVol?: number;
  cancelRate?: number;
  funding?: number;
  basis?: number;
  sentiment?: number;
  onChain?: number;
}

interface Policy {
  id: string;
  name: string;
  features: string[];
  alpha: number[];  // Prior precision
  beta: number[];   // Prior mean
  observations: number;
}

interface Choice {
  policyId: string;
  score: number;
  explorationBonus: number;
  timestamp: number;
  context: Context;
  sampledScores: Record<string, number>;
  featureVector: number[];
}

class BayesianLinearTS {
  private policies: Map<string, Policy> = new Map();
  private lastChoice?: Choice;
  private featureNames = ['regime_bull', 'regime_bear', 'sigmaHAR', 'obi', 'rr25', 'spread', 'microVol', 'cancelRate', 'funding', 'basis', 'sentiment', 'onChain'];

  constructor() {
    // Initialize default policies
    this.initializePolicies();
  }

  private initializePolicies() {
    const defaultPolicies = [
      { id: 'p_sma', name: 'SMA Crossover', features: ['regime_bull', 'sigmaHAR'] },
      { id: 'p_momentum', name: 'Momentum', features: ['obi', 'microVol'] },
      { id: 'p_meanrev', name: 'Mean Reversion', features: ['spread', 'cancelRate'] },
      { id: 'p_vol', name: 'Vol Trading', features: ['sigmaHAR', 'rr25'] },
      { id: 'p_arb', name: 'Arbitrage', features: ['basis', 'funding'] }
    ];

    for (const policy of defaultPolicies) {
      const dim = this.featureNames.length;
      this.policies.set(policy.id, {
        ...policy,
        alpha: new Array(dim).fill(1.0),  // Prior precision
        beta: new Array(dim).fill(0.0),   // Prior mean
        observations: 0
      });
    }
  }

  private contextToFeatures(context: Context): number[] {
    return [
      context.regime === 'bull' ? 1 : 0,
      context.regime === 'bear' ? 1 : 0,
      context.sigmaHAR || 0,
      context.obi || 0,
      context.rr25 || 0,
      context.spread || 0,
      context.microVol || 0,
      context.cancelRate || 0,
      context.funding || 0,
      context.basis || 0,
      context.sentiment || 0,
      context.onChain || 0
    ];
  }

  private sampleThompson(policy: Policy, features: number[]): number {
    // Thompson sampling: sample from posterior
    const dim = features.length;
    let score = 0;
    
    for (let i = 0; i < dim; i++) {
      // Sample weight from normal distribution
      const precision = policy.alpha[i];
      const mean = policy.beta[i];
      const variance = 1.0 / Math.max(precision, 0.01);
      
      // Box-Muller transform for normal sampling
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const weight = mean + Math.sqrt(variance) * z;
      
      score += weight * features[i];
    }
    
    return score;
  }

  choose(context: Context): Choice {
    const features = this.contextToFeatures(context);
    const sampledScores: Record<string, number> = {};
    let bestPolicy = '';
    let bestScore = -Infinity;

    // Sample from each policy
    for (const [policyId, policy] of this.policies) {
      const score = this.sampleThompson(policy, features);
      sampledScores[policyId] = score;
      
      if (score > bestScore) {
        bestScore = score;
        bestPolicy = policyId;
      }
    }

    const explorationBonus = this.calculateExplorationBonus(bestPolicy);

    const choice: Choice = {
      policyId: bestPolicy,
      score: bestScore,
      explorationBonus,
      timestamp: Date.now(),
      context,
      sampledScores,
      featureVector: features
    };

    this.lastChoice = choice;
    logger.info(`Router chose policy ${bestPolicy} with score ${bestScore.toFixed(4)}`);
    
    return choice;
  }

  private calculateExplorationBonus(policyId: string): number {
    const policy = this.policies.get(policyId);
    if (!policy) return 0;
    
    // Exploration bonus based on uncertainty
    const avgPrecision = policy.alpha.reduce((sum, a) => sum + a, 0) / policy.alpha.length;
    return 1.0 / Math.sqrt(avgPrecision + 1);
  }

  update(policyId: string, reward: number, context: Context): void {
    const policy = this.policies.get(policyId);
    if (!policy) {
      logger.error(`Unknown policy: ${policyId}`);
      return;
    }

    const features = this.contextToFeatures(context);
    const learningRate = 0.1;

    // Bayesian linear regression update
    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      if (Math.abs(feature) > 1e-6) {
        // Update precision (alpha) and mean (beta)
        policy.alpha[i] += learningRate * feature * feature;
        policy.beta[i] = (policy.beta[i] * (policy.alpha[i] - learningRate * feature * feature) + 
                         learningRate * feature * reward) / policy.alpha[i];
      }
    }

    policy.observations++;
    logger.info(`Updated policy ${policyId} with reward ${reward}, obs: ${policy.observations}`);
  }

  getSnapshot(): { lastChoice?: Choice; policies: Array<{ id: string; name: string; observations: number; avgWeight: number }> } {
    const policySummary = Array.from(this.policies.entries()).map(([id, policy]) => ({
      id,
      name: policy.name,
      observations: policy.observations,
      avgWeight: policy.beta.reduce((sum, w) => sum + Math.abs(w), 0) / policy.beta.length
    }));

    return {
      lastChoice: this.lastChoice,
      policies: policySummary
    };
  }
}

export const strategyRouter = new BayesianLinearTS();
