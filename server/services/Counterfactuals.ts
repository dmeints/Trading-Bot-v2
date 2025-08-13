
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

export class Counterfactuals {
  private loggedActions: LoggedAction[] = [];
  private shadowActions: Map<string, ShadowAction[]> = new Map();
  private policyPnL: Map<string, Map<string, number[]>> = new Map(); // policyId -> regime -> PnL[]

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
}

export const counterfactuals = new Counterfactuals();
