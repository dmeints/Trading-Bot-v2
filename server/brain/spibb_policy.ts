
/**
 * Safe Policy Improvement with Baseline Bootstrapping (SPIBB)
 * Ensures safe policy updates with probabilistic guarantees
 */

import { logger } from '../utils/logger';

export interface SPIBBConfig {
  safetyThreshold: number;    // Minimum performance threshold
  confidenceLevel: number;    // Statistical confidence level
  bootstrapSamples: number;   // Number of bootstrap samples
  minDatasetSize: number;     // Minimum dataset size for updates
  maxPolicyDeviation: number; // Maximum allowed policy deviation
  riskToleranceRatio: number; // Risk tolerance as ratio of baseline performance
}

export interface PolicyAction {
  action: string;
  probability: number;
  expectedValue: number;
  confidence: number;
}

export interface SafetyConstraints {
  minExpectedReturn: number;
  maxDrawdownLimit: number;
  minWinRate: number;
  maxRiskMetric: number;
}

export interface SPIBBUpdate {
  isUpdateSafe: boolean;
  safetyMargin: number;
  bootstrapConfidence: number;
  constraintViolations: string[];
  updatedPolicy: Map<string, PolicyAction>;
  performanceImprovement: number;
}

export interface HistoricalEpisode {
  state: Record<string, number>;
  action: string;
  reward: number;
  nextState: Record<string, number>;
  timestamp: Date;
}

export class SPIBBPolicyImprover {
  private baselinePolicy: Map<string, PolicyAction> = new Map();
  private candidatePolicy: Map<string, PolicyAction> = new Map();
  private historicalData: HistoricalEpisode[] = [];
  private safetyConstraints: SafetyConstraints;
  private config: SPIBBConfig;

  constructor(
    safetyConstraints: SafetyConstraints,
    config: Partial<SPIBBConfig> = {}
  ) {
    this.safetyConstraints = safetyConstraints;
    this.config = {
      safetyThreshold: 0.95,      // 95% confidence in safety
      confidenceLevel: 0.95,      // 95% statistical confidence
      bootstrapSamples: 1000,     // Bootstrap sample size
      minDatasetSize: 100,        // Minimum episodes for update
      maxPolicyDeviation: 0.2,    // Maximum 20% deviation from baseline
      riskToleranceRatio: 0.9,    // Accept 10% performance degradation for safety
      ...config
    };

    logger.info('[SPIBB] Initialized safe policy improvement', {
      safetyThreshold: this.config.safetyThreshold,
      minDatasetSize: this.config.minDatasetSize
    });
  }

  /**
   * Set baseline policy from historical performance
   */
  setBaselinePolicy(policy: Map<string, PolicyAction>): void {
    this.baselinePolicy = new Map(policy);
    
    logger.info('[SPIBB] Set baseline policy', {
      actionCount: this.baselinePolicy.size,
      avgExpectedValue: this.calculateAverageExpectedValue(this.baselinePolicy)
    });
  }

  /**
   * Add historical episode data
   */
  addHistoricalEpisode(episode: HistoricalEpisode): void {
    this.historicalData.push(episode);
    
    // Maintain bounded memory
    const maxHistory = this.config.minDatasetSize * 10;
    if (this.historicalData.length > maxHistory) {
      this.historicalData = this.historicalData.slice(-maxHistory);
    }

    logger.debug('[SPIBB] Added historical episode', {
      totalEpisodes: this.historicalData.length,
      reward: episode.reward.toFixed(4)
    });
  }

  /**
   * Propose safe policy update
   */
  proposesPolicyUpdate(
    candidatePolicy: Map<string, PolicyAction>
  ): SPIBBUpdate {
    this.candidatePolicy = new Map(candidatePolicy);

    if (this.historicalData.length < this.config.minDatasetSize) {
      return {
        isUpdateSafe: false,
        safetyMargin: 0,
        bootstrapConfidence: 0,
        constraintViolations: ['Insufficient historical data'],
        updatedPolicy: new Map(this.baselinePolicy),
        performanceImprovement: 0
      };
    }

    // Step 1: Bootstrap evaluation of policies
    const bootstrapResults = this.performBootstrapEvaluation();

    // Step 2: Check safety constraints
    const constraintViolations = this.checkSafetyConstraints(bootstrapResults);

    // Step 3: Calculate safety margin
    const safetyMargin = this.calculateSafetyMargin(bootstrapResults);

    // Step 4: Determine if update is safe
    const isUpdateSafe = constraintViolations.length === 0 && 
                        safetyMargin > this.config.safetyThreshold &&
                        bootstrapResults.candidateConfidence > this.config.confidenceLevel;

    // Step 5: Create safe policy if update approved
    const updatedPolicy = isUpdateSafe ? 
      this.createSafePolicy(bootstrapResults) : 
      new Map(this.baselinePolicy);

    const performanceImprovement = bootstrapResults.candidatePerformance - 
                                 bootstrapResults.baselinePerformance;

    const update: SPIBBUpdate = {
      isUpdateSafe,
      safetyMargin,
      bootstrapConfidence: bootstrapResults.candidateConfidence,
      constraintViolations,
      updatedPolicy,
      performanceImprovement
    };

    logger.info('[SPIBB] Policy update evaluation', {
      isUpdateSafe,
      safetyMargin: safetyMargin.toFixed(3),
      performanceImprovement: performanceImprovement.toFixed(4),
      constraintViolations: constraintViolations.length
    });

    return update;
  }

  private performBootstrapEvaluation(): {
    baselinePerformance: number;
    candidatePerformance: number;
    baselineConfidence: number;
    candidateConfidence: number;
    performanceDifferences: number[];
  } {
    const baselineReturns: number[] = [];
    const candidateReturns: number[] = [];
    const performanceDifferences: number[] = [];

    // Bootstrap sampling
    for (let i = 0; i < this.config.bootstrapSamples; i++) {
      const bootstrapSample = this.createBootstrapSample();
      
      const baselineReturn = this.evaluatePolicyOnSample(this.baselinePolicy, bootstrapSample);
      const candidateReturn = this.evaluatePolicyOnSample(this.candidatePolicy, bootstrapSample);
      
      baselineReturns.push(baselineReturn);
      candidateReturns.push(candidateReturn);
      performanceDifferences.push(candidateReturn - baselineReturn);
    }

    // Calculate statistics
    const baselinePerformance = this.calculateMean(baselineReturns);
    const candidatePerformance = this.calculateMean(candidateReturns);
    
    // Calculate confidence intervals
    const baselineConfidence = this.calculateConfidenceInterval(baselineReturns, this.config.confidenceLevel);
    const candidateConfidence = this.calculateConfidenceInterval(candidateReturns, this.config.confidenceLevel);

    return {
      baselinePerformance,
      candidatePerformance,
      baselineConfidence: baselineConfidence.lower,
      candidateConfidence: candidateConfidence.lower,
      performanceDifferences
    };
  }

  private createBootstrapSample(): HistoricalEpisode[] {
    const sampleSize = Math.min(this.historicalData.length, this.config.minDatasetSize);
    const sample: HistoricalEpisode[] = [];
    
    for (let i = 0; i < sampleSize; i++) {
      const randomIndex = Math.floor(Math.random() * this.historicalData.length);
      sample.push(this.historicalData[randomIndex]);
    }
    
    return sample;
  }

  private evaluatePolicyOnSample(
    policy: Map<string, PolicyAction>,
    sample: HistoricalEpisode[]
  ): number {
    let totalReturn = 0;
    let validEpisodes = 0;

    for (const episode of sample) {
      const stateKey = this.encodeState(episode.state);
      const policyAction = policy.get(stateKey);
      
      if (policyAction && policyAction.action === episode.action) {
        totalReturn += episode.reward;
        validEpisodes++;
      }
    }

    return validEpisodes > 0 ? totalReturn / validEpisodes : 0;
  }

  private encodeState(state: Record<string, number>): string {
    // Simple state encoding - in practice, this would be more sophisticated
    return Object.entries(state)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value.toFixed(2)}`)
      .join(',');
  }

  private checkSafetyConstraints(bootstrapResults: any): string[] {
    const violations: string[] = [];

    // Check minimum expected return
    if (bootstrapResults.candidateConfidence < this.safetyConstraints.minExpectedReturn) {
      violations.push(`Expected return below minimum: ${bootstrapResults.candidateConfidence.toFixed(3)} < ${this.safetyConstraints.minExpectedReturn}`);
    }

    // Check performance degradation tolerance
    const maxAcceptableDegradation = bootstrapResults.baselinePerformance * (1 - this.config.riskToleranceRatio);
    if (bootstrapResults.candidateConfidence < maxAcceptableDegradation) {
      violations.push(`Performance degradation exceeds tolerance`);
    }

    // Check policy deviation
    const policyDeviation = this.calculatePolicyDeviation();
    if (policyDeviation > this.config.maxPolicyDeviation) {
      violations.push(`Policy deviation exceeds maximum: ${policyDeviation.toFixed(3)} > ${this.config.maxPolicyDeviation}`);
    }

    return violations;
  }

  private calculatePolicyDeviation(): number {
    let totalDeviation = 0;
    let comparedActions = 0;

    for (const [stateKey, baselineAction] of this.baselinePolicy) {
      const candidateAction = this.candidatePolicy.get(stateKey);
      
      if (candidateAction) {
        const deviation = Math.abs(candidateAction.probability - baselineAction.probability);
        totalDeviation += deviation;
        comparedActions++;
      }
    }

    return comparedActions > 0 ? totalDeviation / comparedActions : 0;
  }

  private calculateSafetyMargin(bootstrapResults: any): number {
    // Safety margin based on lower confidence bound vs baseline performance
    const improvement = bootstrapResults.candidateConfidence - bootstrapResults.baselinePerformance;
    const riskAdjustedImprovement = Math.max(0, improvement);
    
    // Convert to probability that candidate is better than baseline
    const improvementCount = bootstrapResults.performanceDifferences
      .filter((diff: number) => diff > 0).length;
    
    return improvementCount / bootstrapResults.performanceDifferences.length;
  }

  private createSafePolicy(bootstrapResults: any): Map<string, PolicyAction> {
    const safePolicy = new Map<string, PolicyAction>();

    // Blend baseline and candidate policies for safety
    const blendRatio = Math.min(0.8, this.calculateSafeBlendRatio(bootstrapResults));

    for (const [stateKey, baselineAction] of this.baselinePolicy) {
      const candidateAction = this.candidatePolicy.get(stateKey);
      
      if (candidateAction) {
        // Weighted blend of policies
        const safeAction: PolicyAction = {
          action: candidateAction.probability > baselineAction.probability ? 
                 candidateAction.action : baselineAction.action,
          probability: blendRatio * candidateAction.probability + 
                      (1 - blendRatio) * baselineAction.probability,
          expectedValue: blendRatio * candidateAction.expectedValue + 
                        (1 - blendRatio) * baselineAction.expectedValue,
          confidence: Math.min(candidateAction.confidence, baselineAction.confidence)
        };
        
        safePolicy.set(stateKey, safeAction);
      } else {
        // Keep baseline action if no candidate exists
        safePolicy.set(stateKey, baselineAction);
      }
    }

    return safePolicy;
  }

  private calculateSafeBlendRatio(bootstrapResults: any): number {
    // More conservative blending when confidence is lower
    const confidenceRatio = bootstrapResults.candidateConfidence / this.config.confidenceLevel;
    const safetyRatio = this.calculateSafetyMargin(bootstrapResults) / this.config.safetyThreshold;
    
    return Math.min(0.8, confidenceRatio * safetyRatio);
  }

  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateConfidenceInterval(
    values: number[], 
    confidenceLevel: number
  ): { lower: number; upper: number } {
    const sorted = [...values].sort((a, b) => a - b);
    const alpha = 1 - confidenceLevel;
    const lowerIndex = Math.floor(alpha / 2 * sorted.length);
    const upperIndex = Math.ceil((1 - alpha / 2) * sorted.length) - 1;
    
    return {
      lower: sorted[lowerIndex] || sorted[0],
      upper: sorted[upperIndex] || sorted[sorted.length - 1]
    };
  }

  private calculateAverageExpectedValue(policy: Map<string, PolicyAction>): number {
    if (policy.size === 0) return 0;
    
    const totalValue = Array.from(policy.values())
      .reduce((sum, action) => sum + action.expectedValue, 0);
    
    return totalValue / policy.size;
  }

  /**
   * Get SPIBB diagnostics
   */
  getDiagnostics(): {
    historicalEpisodes: number;
    baselinePolicySize: number;
    candidatePolicySize: number;
    avgBaselineValue: number;
    avgCandidateValue: number;
    policyDeviation: number;
  } {
    return {
      historicalEpisodes: this.historicalData.length,
      baselinePolicySize: this.baselinePolicy.size,
      candidatePolicySize: this.candidatePolicy.size,
      avgBaselineValue: this.calculateAverageExpectedValue(this.baselinePolicy),
      avgCandidateValue: this.calculateAverageExpectedValue(this.candidatePolicy),
      policyDeviation: this.calculatePolicyDeviation()
    };
  }

  /**
   * Reset SPIBB state
   */
  reset(): void {
    this.baselinePolicy.clear();
    this.candidatePolicy.clear();
    this.historicalData = [];
    
    logger.info('[SPIBB] Reset safe policy improvement state');
  }
}

/**
 * Factory function for trading SPIBB system
 */
export function createTradingSPIBB(): SPIBBPolicyImprover {
  const safetyConstraints: SafetyConstraints = {
    minExpectedReturn: 0.05,      // 5% minimum annual return
    maxDrawdownLimit: -0.2,       // 20% maximum drawdown
    minWinRate: 0.4,              // 40% minimum win rate
    maxRiskMetric: 2.0            // Maximum risk metric
  };

  return new SPIBBPolicyImprover(safetyConstraints, {
    safetyThreshold: 0.9,         // 90% safety confidence
    confidenceLevel: 0.95,        // 95% statistical confidence
    bootstrapSamples: 500,        // 500 bootstrap samples
    minDatasetSize: 200,          // 200 episodes minimum
    maxPolicyDeviation: 0.15,     // 15% max deviation
    riskToleranceRatio: 0.95      // 5% performance degradation tolerance
  });
}
