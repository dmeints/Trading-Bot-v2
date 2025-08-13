import { logger } from '../utils/logger.js';

export interface CounterfactualSummary {
  policyId: string;
  regime: string;
  shadowPnL: number;
  actualPnL: number;
  bias: number;
  mse: number;
  sampleCount: number;
}

interface LoggedAction {
  timestamp: Date;
  context: any;
  action: any;
  reward: number;
  propensityScore: number;
  regime: string;
}

interface ShadowAction {
  policyId: string;
  timestamp: Date;
  context: any;
  action: any;
  propensityScore: number;
  regime: string;
}

// Assuming PolicyEvaluation and CounterfactualLog are defined elsewhere or intended to be defined.
// Based on the changes, CounterfactualLog is modified, and PolicyEvaluation is used in evaluatePolicy.
interface PolicyEvaluation {
  policyId: string;
  estimatedValue: number;
  confidence: number;
  sampleSize: number;
}

interface CounterfactualLog {
  timestamp: number;
  actualAction: string;
  shadowActions: string[];
  context: any;
  reward: number;
  propensityScore: number;
  regime?: string;
  importance_weight?: number;
}

export class Counterfactuals {
  private loggedActions: LoggedAction[] = [];
  private shadowActions: Map<string, ShadowAction[]> = new Map();
  private policyPnL: Map<string, Map<string, number[]>> = new Map(); // policyId -> regime -> PnL[]

  // Placeholder for the logs array mentioned in the changes.
  // Assuming it's intended to store CounterfactualLog objects.
  private logs: CounterfactualLog[] = [];
  private maxLogs: number = 1000; // Default max logs

  recordLoggedAction(context: any, action: any, reward: number, regime: string): void {
    // Mock propensity score (probability of taking this action under logging policy)
    const propensityScore = 0.1 + Math.random() * 0.8; // Random between 0.1 and 0.9

    this.loggedActions.push({
      timestamp: new Date(),
      context,
      action,
      reward,
      propensityScore,
      regime
    });

    // Keep only recent actions
    if (this.loggedActions.length > 1000) {
      this.loggedActions = this.loggedActions.slice(-500);
    }
  }

  recordShadowAction(policyId: string, context: any, action: any, regime: string): void {
    if (!this.shadowActions.has(policyId)) {
      this.shadowActions.set(policyId, []);
    }

    // Mock propensity score for shadow policy
    const propensityScore = 0.05 + Math.random() * 0.9;

    this.shadowActions.get(policyId)!.push({
      policyId,
      timestamp: new Date(),
      context,
      action,
      propensityScore,
      regime
    });

    // Keep only recent shadow actions
    const shadowList = this.shadowActions.get(policyId)!;
    if (shadowList.length > 1000) {
      this.shadowActions.set(policyId, shadowList.slice(-500));
    }
  }

  getSummary(): CounterfactualSummary[] {
    const summaries: CounterfactualSummary[] = [];

    for (const [policyId, shadowList] of this.shadowActions.entries()) {
      const regimes = ['bull', 'bear', 'sideways', 'volatile'];

      for (const regime of regimes) {
        const summary = this.computeDoublyRobustEstimate(policyId, regime);
        if (summary) {
          summaries.push(summary);
        }
      }
    }

    return summaries.sort((a, b) => b.shadowPnL - a.shadowPnL);
  }

  private computeDoublyRobustEstimate(policyId: string, regime: string): CounterfactualSummary | null {
    const shadowActions = this.shadowActions.get(policyId)?.filter(s => s.regime === regime) || [];
    const loggedActions = this.loggedActions.filter(l => l.regime === regime);

    if (shadowActions.length === 0 || loggedActions.length === 0) {
      return null;
    }

    // Doubly Robust estimator: DR = Direct Method + Importance Sampling correction
    let directMethodEstimate = 0;
    let importanceSamplingCorrection = 0;
    let actualPnL = 0;
    let sampleCount = 0;

    // Compute direct method estimate (model-based)
    for (const shadowAction of shadowActions) {
      // Mock regression model estimate
      const modelPrediction = this.mockRegressionModel(shadowAction.context, shadowAction.action);
      directMethodEstimate += modelPrediction;
    }
    directMethodEstimate /= Math.max(1, shadowActions.length);

    // Compute importance sampling correction
    for (const loggedAction of loggedActions.slice(-100)) { // Use recent 100 actions
      // Find matching shadow action (simplified matching)
      const matchingShadow = shadowActions.find(s => 
        Math.abs(s.timestamp.getTime() - loggedAction.timestamp.getTime()) < 60000 // Within 1 minute
      );

      if (matchingShadow) {
        // Importance weight = π_target(a|x) / π_logging(a|x)
        const importanceWeight = Math.min(10, matchingShadow.propensityScore / Math.max(0.01, loggedAction.propensityScore));

        // Model prediction for logged action
        const modelPrediction = this.mockRegressionModel(loggedAction.context, loggedAction.action);

        // IS correction: w * (r - model_prediction)
        importanceSamplingCorrection += importanceWeight * (loggedAction.reward - modelPrediction);
        actualPnL += loggedAction.reward;
        sampleCount++;
      }
    }

    if (sampleCount > 0) {
      importanceSamplingCorrection /= sampleCount;
      actualPnL /= sampleCount;
    }

    // Doubly Robust estimate
    const shadowPnL = directMethodEstimate + importanceSamplingCorrection;

    // Compute bias and MSE (simplified)
    const bias = Math.abs(shadowPnL - actualPnL);
    const mse = bias * bias; // Simplified MSE

    logger.info(`[Counterfactuals] ${policyId} in ${regime}: shadowPnL=${shadowPnL.toFixed(4)}, actualPnL=${actualPnL.toFixed(4)}, bias=${bias.toFixed(4)}`);

    return {
      policyId,
      regime,
      shadowPnL,
      actualPnL,
      bias,
      mse,
      sampleCount
    };
  }

  private mockRegressionModel(context: any, action: any): number {
    // Mock regression model that predicts reward given context and action
    const contextFeature = (context.vol || 0) + (context.trend || 0) + (context.sentiment || 0);
    const actionFeature = action.size || action.direction || 0;

    // Simple linear model
    return 0.001 * contextFeature + 0.002 * actionFeature + (Math.random() - 0.5) * 0.001;
  }

  // Simulate some data for testing
  simulateData(policyId: string): void {
    const regimes = ['bull', 'bear', 'sideways', 'volatile'];

    for (let i = 0; i < 50; i++) {
      const regime = regimes[Math.floor(Math.random() * regimes.length)];
      const context = {
        vol: Math.random() * 0.1,
        trend: (Math.random() - 0.5) * 0.2,
        sentiment: Math.random()
      };

      const action = {
        size: Math.random() * 1000,
        direction: Math.random() > 0.5 ? 1 : -1
      };

      const reward = (Math.random() - 0.5) * 0.02;

      // Record as both logged and shadow action
      this.recordLoggedAction(context, action, reward, regime);
      this.recordShadowAction(policyId, context, action, regime);
    }
  }

  // New methods added based on the changes:

  logCounterfactual(log: CounterfactualLog): void {
    // Calculate importance weight for doubly robust estimation
    log.importance_weight = this.calculateImportanceWeight(log);

    this.logs.push(log);

    // Keep rolling window
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  private calculateImportanceWeight(log: CounterfactualLog): number {
    try {
      // Simple importance weight calculation
      // In practice, this would use behavior policy probability
      const numActions = log.shadowActions.length + 1;
      const uniformProb = 1.0 / numActions;

      // Assume propensity score is probability of taking actual action
      const propensity = Math.max(0.01, Math.min(0.99, log.propensityScore));

      return uniformProb / propensity;
    } catch {
      return 1.0;
    }
  }

  evaluatePolicy(policyId: string): PolicyEvaluation {
    const policyLogs = this.logs.filter(log => 
      log.actualAction === policyId || log.shadowActions.includes(policyId));

    if (policyLogs.length === 0) {
      return {
        policyId,
        estimatedValue: 0,
        confidence: 0,
        sampleSize: 0
      };
    }

    // Doubly Robust Estimator
    const drEstimate = this.doublyRobustEstimate(policyId, policyLogs);

    return {
      policyId,
      estimatedValue: drEstimate.value,
      confidence: drEstimate.confidence,
      sampleSize: policyLogs.length
    };
  }

  private doublyRobustEstimate(policyId: string, logs: CounterfactualLog[]): { value: number; confidence: number } {
    try {
      let ipwSum = 0; // Inverse Propensity Weighting
      let dmSum = 0;  // Direct Method
      let weightSum = 0;

      for (const log of logs) {
        // IPW component: importance weighted actual rewards
        if (log.actualAction === policyId) {
          const weight = log.importance_weight || 1.0;
          ipwSum += weight * log.reward;
          weightSum += weight;
        }

        // DM component: predicted reward for this policy under this context
        // For now, use average reward as predictor (would use regression model in practice)
        const predictedReward = this.predictReward(policyId, log.context);
        dmSum += predictedReward;
      }

      // Combine IPW and DM estimates
      const ipwEstimate = weightSum > 0 ? ipwSum / weightSum : 0;
      const dmEstimate = logs.length > 0 ? dmSum / logs.length : 0;

      // Doubly robust combination (simplified)
      const drValue = 0.7 * ipwEstimate + 0.3 * dmEstimate;

      // Confidence based on sample size and variance
      const variance = this.calculateVariance(logs, drValue);
      const confidence = Math.max(0, 1 - Math.sqrt(variance) / Math.max(0.001, Math.abs(drValue)));

      return {
        value: drValue,
        confidence: Math.min(0.99, confidence)
      };

    } catch (error) {
      logger.error(`Error in doubly robust estimation for ${policyId}:`, error);

      // Fallback to simple average
      const values = logs.map(log => log.reward);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;

      return {
        value: mean,
        confidence: 0.5
      };
    }
  }

  private predictReward(policyId: string, context: any): number {
    // Simplified reward prediction based on historical performance
    // In practice, this would use a trained regression model

    const historicalPerf = {
      'p_momentum': 0.002,
      'p_breakout': 0.001,
      'p_mean_revert': -0.0005,
      'p_sma': 0.0008,
      'p_vol_target': 0.0003
    };

    const baseReward = historicalPerf[policyId as keyof typeof historicalPerf] || 0;

    // Adjust based on context (simplified)
    let contextAdjustment = 0;
    if (context?.regime === 'bull') contextAdjustment += 0.0002;
    if (context?.regime === 'bear') contextAdjustment -= 0.0003;
    if (context?.volatility > 0.03) contextAdjustment -= 0.0001;

    return baseReward + contextAdjustment;
  }

  private calculateVariance(logs: CounterfactualLog[], mean: number): number {
    if (logs.length < 2) return 0;

    const variance = logs.reduce((acc, log) => {
      return acc + Math.pow(log.reward - mean, 2);
    }, 0) / logs.length;

    return variance;
  }
}

export const counterfactuals = new Counterfactuals();