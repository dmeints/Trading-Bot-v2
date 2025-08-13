import { logger } from '../utils/logger.js';

// Original Context interface kept for compatibility, but RouterContext is the new standard
export interface Context {
  regime?: string;
  vol?: number;
  trend?: number;
  funding?: number;
  sentiment?: number;
  eventsEmbedding?: number[];
}

// New RouterContext with Alpha Pack features
export interface RouterContext {
  symbol: string;
  timestamp: Date;
  price: number;
  volume?: number;
  volatility?: number;
  features?: any;
  // Alpha pack features
  obi?: number;           // Order book imbalance
  ti?: number;            // Trade imbalance  
  spread_bps?: number;    // Bid-ask spread
  micro_vol?: number;     // Micro volatility
  sigmaHAR?: number;      // HAR-RV forecast
  sigmaGARCH?: number;    // GARCH forecast
  rr25?: number;          // 25-delta risk reversal
  fly25?: number;         // 25-delta butterfly
  iv_term_slope?: number; // IV term slope
  skew_z?: number;        // Skew z-score
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

// Placeholder for RouterChoice to align with the provided changes
export interface RouterChoice {
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

  // Modified choose method to use RouterContext and gather alpha features
  async choose(baseContext: RouterContext): Promise<RouterChoice> {
    try {
      const { symbol } = baseContext;

      // Gather additional context including alpha features
      const context = await this.gatherContext(baseContext);

      // Sample from posterior for each policy
      const scores = new Map<string, number>();

      for (const [policyId, posterior] of this.policies.entries()) {
        const weights = this.contextWeights.get(policyId) || [];

        // Compute expected reward as linear combination of context
        // Ensure contextVector only uses numeric values from context
        const contextVector = this.contextToVector(context);
        
        const expectedReward = weights.reduce((sum, w, i) => sum + w * (contextVector[i] || 0), 0);

        // Thompson sampling: sample from posterior
        const sampledMean = this.sampleFromNormal(posterior.mean + expectedReward, Math.sqrt(posterior.variance));

        // Exploration bonus based on uncertainty
        const explorationBonus = Math.sqrt(posterior.variance) / Math.max(1, posterior.updateCount);

        const score = sampledMean + explorationBonus;

        scores.set(policyId, score);

        logger.info(`[StrategyRouter] Policy ${policyId}: sampledMean=${sampledMean.toFixed(4)}, expReward=${expectedReward.toFixed(4)}, exploration=${explorationBonus.toFixed(4)}, score=${score.toFixed(4)}`);
      }

      // Find the policy with the highest score
      let bestPolicy = '';
      let bestScore = -Infinity;
      let bestExplorationBonus = 0;

      for (const [policyId, score] of scores.entries()) {
        if (score > bestScore) {
          bestScore = score;
          bestPolicy = policyId;
          // Retrieve exploration bonus for the best policy (assuming it's stored or re-calculable)
          const posterior = this.policies.get(policyId);
          if (posterior) {
            bestExplorationBonus = Math.sqrt(posterior.variance) / Math.max(1, posterior.updateCount);
          }
        }
      }

      if (!bestPolicy) {
        // Fallback if no policy is chosen (should not happen with initialization)
        bestPolicy = 'p_sma';
        bestScore = 0;
        bestExplorationBonus = 0;
        logger.warn(`[StrategyRouter] No policy chosen, defaulting to p_sma.`);
      }

      logger.info(`[StrategyRouter] Chose policy ${bestPolicy} with score ${bestScore.toFixed(4)}`);

      return {
        policyId: bestPolicy,
        score: bestScore,
        explorationBonus: bestExplorationBonus
      };
    } catch (error) {
      logger.error(`[StrategyRouter] Error in choose method: ${error}`);
      // Return a default or error choice
      return { policyId: 'p_sma', score: 0, explorationBonus: 0 };
    }
  }

  update(policyId: string, reward: number, context: RouterContext): PolicyPosterior {
    const posterior = this.policies.get(policyId);
    if (!posterior) {
      throw new Error(`Unknown policy: ${policyId}`);
    }

    const contextVector = this.contextToVector(context); // Use the updated context vector
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

  // Modified contextToVector to handle the extended RouterContext
  private contextToVector(context: RouterContext): number[] {
    const baseVector = [
      this.encodeRegime(context.regime || 'unknown'),
      context.vol || 0,
      context.trend || 0,
      context.funding || 0,
      context.sentiment || 0,
      // Alpha pack features
      context.obi || 0,
      context.ti || 0,
      context.spread_bps || 0,
      context.micro_vol || 0,
      context.sigmaHAR || 0,
      context.sigmaGARCH || 0,
      context.rr25 || 0,
      context.fly25 || 0,
      context.iv_term_slope || 0,
      context.skew_z || 0
    ];

    // Append events embedding if provided
    if (context.eventsEmbedding && Array.isArray(context.eventsEmbedding)) {
      baseVector.push(...context.eventsEmbedding);
    }

    return baseVector;
  }

  private encodeRegime(regime: string): number {
    switch (regime) {
      case 'bull':
        return 1;
      case 'bear':
        return -1;
      case 'sideways':
        return 0;
      default:
        return 0; // Default to neutral or unknown
    }
  }

  private sampleFromNormal(mean: number, std: number): number {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + std * z0;
  }

  // Enhanced context gathering with alpha features
  private async gatherContext(baseContext: RouterContext): Promise<RouterContext> {
    const context = { ...baseContext, timestamp: new Date(), features: {} };

    try {
      // Import alpha services dynamically to avoid circular deps
      // These imports are placeholders. Actual paths might differ based on project structure.
      const { microstructureFeatures } = await import('../microstructure/Features');
      const { volatilityModels } = await import('../volatility/Models');
      const { optionsSmile } = await import('../options/Smile');

      // Get microstructure features
      const microSnapshot = microstructureFeatures.getSnapshot(context.symbol);
      if (microSnapshot) {
        context.obi = microSnapshot.obi;
        context.ti = microSnapshot.ti;
        context.spread_bps = microSnapshot.spread_bps;
        context.micro_vol = microSnapshot.micro_vol;
      }

      // Get volatility forecasts
      // Assuming forecastVol takes symbol and time horizon (e.g., 60 minutes)
      const volForecast = await volatilityModels.forecastVol(context.symbol, 60);
      context.sigmaHAR = volForecast.sigmaHAR;
      context.sigmaGARCH = volForecast.sigmaGARCH;

      // Get options smile metrics
      const smileMetrics = optionsSmile.getSmileMetrics(context.symbol);
      if (smileMetrics) {
        context.rr25 = smileMetrics.rr25;
        context.fly25 = smileMetrics.fly25;
        context.iv_term_slope = smileMetrics.iv_term_slope;
        context.skew_z = smileMetrics.skew_z;
      }

      logger.debug(`[StrategyRouter] Enhanced context for ${context.symbol} with alpha features`);

    } catch (error) {
      logger.warn(`[StrategyRouter] Error gathering alpha context: ${error}`);
      // Continue with base context if alpha features fail
    }

    return context;
  }
}

export const strategyRouter = new StrategyRouter();