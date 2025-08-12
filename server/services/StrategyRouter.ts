
import { logger } from '../utils/logger';

export interface Context {
  regime?: string;
  vol?: number;
  trend?: number;
  funding?: number;
  sentiment?: number;
  eventsEmbedding?: number[];
}

export interface PolicyPosterior {
  mean: number;
  variance: number;
  alpha: number;  // Beta distribution params for success rate
  beta: number;
  updateCount: number;
}

export interface ChoiceResult {
  policyId: string;
  score: number;
  explorationBonus: number;
}

export class StrategyRouter {
  private policies: Map<string, PolicyPosterior> = new Map();
  private contextWeights: Map<string, number[]> = new Map();

  constructor() {
    // Initialize default policies
    this.initializePolicy('p_sma');
    this.initializePolicy('p_trend');
    this.initializePolicy('p_meanrev');
  }

  private initializePolicy(policyId: string): void {
    this.policies.set(policyId, {
      mean: 0.0,
      variance: 1.0,
      alpha: 1.0,
      beta: 1.0,
      updateCount: 0
    });
    // Initialize context weights randomly
    this.contextWeights.set(policyId, [
      Math.random() * 0.2 - 0.1, // regime
      Math.random() * 0.2 - 0.1, // vol
      Math.random() * 0.2 - 0.1, // trend
      Math.random() * 0.2 - 0.1, // funding
      Math.random() * 0.2 - 0.1  // sentiment
    ]);
  }

  choose(context: Context): ChoiceResult {
    const contextVector = this.contextToVector(context);
    let bestPolicy = '';
    let bestScore = -Infinity;
    let bestExplorationBonus = 0;

    for (const [policyId, posterior] of this.policies.entries()) {
      const weights = this.contextWeights.get(policyId) || [];
      
      // Compute expected reward as linear combination of context
      const expectedReward = weights.reduce((sum, w, i) => sum + w * (contextVector[i] || 0), 0);
      
      // Thompson sampling: sample from posterior
      const sampledMean = this.sampleFromNormal(posterior.mean + expectedReward, Math.sqrt(posterior.variance));
      
      // Exploration bonus based on uncertainty
      const explorationBonus = Math.sqrt(posterior.variance) / Math.max(1, posterior.updateCount);
      
      const score = sampledMean + explorationBonus;
      
      if (score > bestScore) {
        bestScore = score;
        bestPolicy = policyId;
        bestExplorationBonus = explorationBonus;
      }
    }

    logger.info(`[StrategyRouter] Chose policy ${bestPolicy} with score ${bestScore.toFixed(4)}`);
    
    return {
      policyId: bestPolicy,
      score: bestScore,
      explorationBonus: bestExplorationBonus
    };
  }

  update(policyId: string, reward: number, context: Context): PolicyPosterior {
    const posterior = this.policies.get(policyId);
    if (!posterior) {
      throw new Error(`Unknown policy: ${policyId}`);
    }

    const contextVector = this.contextToVector(context);
    const weights = this.contextWeights.get(policyId) || [];
    
    // Update posterior using Bayesian learning
    const priorPrecision = 1.0 / posterior.variance;
    const likelihood_precision = 1.0; // Assume known noise variance
    
    const newPrecision = priorPrecision + likelihood_precision;
    const newMean = (priorPrecision * posterior.mean + likelihood_precision * reward) / newPrecision;
    const newVariance = 1.0 / newPrecision;
    
    // Update context weights with simple gradient step
    const learningRate = 0.01;
    const prediction = weights.reduce((sum, w, i) => sum + w * (contextVector[i] || 0), 0);
    const error = reward - prediction;
    
    const updatedWeights = weights.map((w, i) => w + learningRate * error * (contextVector[i] || 0));
    this.contextWeights.set(policyId, updatedWeights);
    
    // Update Beta parameters for success tracking
    const newAlpha = posterior.alpha + (reward > 0 ? 1 : 0);
    const newBeta = posterior.beta + (reward <= 0 ? 1 : 0);
    
    const updatedPosterior: PolicyPosterior = {
      mean: newMean,
      variance: newVariance,
      alpha: newAlpha,
      beta: newBeta,
      updateCount: posterior.updateCount + 1
    };
    
    this.policies.set(policyId, updatedPosterior);
    
    logger.info(`[StrategyRouter] Updated ${policyId}: mean=${newMean.toFixed(4)}, var=${newVariance.toFixed(4)}, updates=${updatedPosterior.updateCount}`);
    
    return updatedPosterior;
  }

  getPolicies(): Map<string, PolicyPosterior> {
    return new Map(this.policies);
  }

  private contextToVector(context: Context): number[] {
    return [
      context.regime === 'bull' ? 1 : context.regime === 'bear' ? -1 : 0,
      context.vol || 0,
      context.trend || 0,
      context.funding || 0,
      context.sentiment || 0
    ];
  }

  private sampleFromNormal(mean: number, std: number): number {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + std * z0;
  }
}

export const strategyRouter = new StrategyRouter();
