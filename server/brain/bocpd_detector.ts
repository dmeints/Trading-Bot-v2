
/**
 * Bayesian Online Change Point Detection (BOCPD)
 * Detects regime changes in market conditions in real-time
 */

import { logger } from '../utils/logger';

export interface ChangePoint {
  timestamp: Date;
  runLength: number;
  probability: number;
  growthProbability: number;
  changeProbability: number;
}

export interface RegimeState {
  runLength: number;
  probability: number;
  mean: number;
  variance: number;
  sampleCount: number;
}

export interface BOCPDConfig {
  hazardRate: number;      // Prior probability of change point
  alpha0: number;          // Prior shape parameter
  beta0: number;           // Prior scale parameter  
  kappa0: number;          // Prior precision parameter
  mu0: number;             // Prior mean parameter
  maxRunLength: number;    // Maximum run length to track
  changeThreshold: number; // Threshold for change point detection
}

export class BOCPDDetector {
  private runLengthDistribution: number[] = [];
  private regimeStates: RegimeState[] = [];
  private changePointHistory: ChangePoint[] = [];
  private config: BOCPDConfig;
  private sampleCount: number = 0;

  constructor(config: Partial<BOCPDConfig> = {}) {
    this.config = {
      hazardRate: 0.01,        // 1% chance of change point per sample
      alpha0: 1.0,             // Uninformative prior
      beta0: 1.0,
      kappa0: 1.0,
      mu0: 0.0,
      maxRunLength: 200,       // Track up to 200 samples back
      changeThreshold: 0.5,    // 50% probability threshold
      ...config
    };
    
    // Initialize with single regime
    this.runLengthDistribution = [1.0];
    this.regimeStates = [this.createInitialRegime()];
  }

  private createInitialRegime(): RegimeState {
    return {
      runLength: 0,
      probability: 1.0,
      mean: this.config.mu0,
      variance: this.config.beta0 / this.config.alpha0,
      sampleCount: 0
    };
  }

  /**
   * Process new observation and update change point beliefs
   */
  updateObservation(value: number): ChangePoint {
    this.sampleCount++;
    
    // Step 1: Calculate predictive probabilities for each run length
    const predictiveProbabilities = this.calculatePredictiveProbabilities(value);
    
    // Step 2: Calculate growth probabilities (no change point)
    const growthProbabilities = this.calculateGrowthProbabilities(predictiveProbabilities);
    
    // Step 3: Calculate change point probability (new regime starts)
    const changePointProbability = this.calculateChangePointProbability(predictiveProbabilities);
    
    // Step 4: Update run length distribution
    this.updateRunLengthDistribution(growthProbabilities, changePointProbability);
    
    // Step 5: Update regime states
    this.updateRegimeStates(value);
    
    // Step 6: Detect change points
    const changePoint = this.detectChangePoint();
    
    // Step 7: Maintain bounded memory
    this.maintainBoundedMemory();
    
    if (changePoint.changeProbability > this.config.changeThreshold) {
      logger.info('[BOCPDDetector] Change point detected', {
        timestamp: changePoint.timestamp,
        probability: changePoint.changeProbability.toFixed(3),
        runLength: changePoint.runLength
      });
    }
    
    return changePoint;
  }

  private calculatePredictiveProbabilities(value: number): number[] {
    const probabilities: number[] = [];
    
    for (let r = 0; r < this.runLengthDistribution.length; r++) {
      const regime = this.regimeStates[r];
      
      // Student's t-distribution for Bayesian linear regression
      const n = regime.sampleCount + this.config.kappa0;
      const alpha = this.config.alpha0 + regime.sampleCount / 2;
      const beta = this.config.beta0 + 
                   (regime.sampleCount * regime.variance + 
                    this.config.kappa0 * regime.sampleCount * (regime.mean - this.config.mu0) ** 2 / n) / 2;
      
      const sigma2 = beta * (n + 1) / (alpha * n);
      const predictiveMean = (this.config.kappa0 * this.config.mu0 + regime.sampleCount * regime.mean) / n;
      
      // Simplified predictive probability (normally would use t-distribution)
      const diff = value - predictiveMean;
      const predictiveProb = Math.exp(-0.5 * diff * diff / sigma2) / Math.sqrt(2 * Math.PI * sigma2);
      
      probabilities.push(predictiveProb);
    }
    
    return probabilities;
  }

  private calculateGrowthProbabilities(predictiveProbabilities: number[]): number[] {
    const growthProbs: number[] = [];
    
    for (let r = 0; r < this.runLengthDistribution.length; r++) {
      const growthProb = this.runLengthDistribution[r] * 
                        predictiveProbabilities[r] * 
                        (1 - this.config.hazardRate);
      growthProbs.push(growthProb);
    }
    
    return growthProbs;
  }

  private calculateChangePointProbability(predictiveProbabilities: number[]): number {
    let changeProb = 0;
    
    for (let r = 0; r < this.runLengthDistribution.length; r++) {
      changeProb += this.runLengthDistribution[r] * 
                   predictiveProbabilities[r] * 
                   this.config.hazardRate;
    }
    
    return changeProb;
  }

  private updateRunLengthDistribution(
    growthProbabilities: number[], 
    changePointProbability: number
  ): void {
    const newDistribution = [changePointProbability];
    
    // Shift growth probabilities (increment run lengths)
    for (let i = 0; i < growthProbabilities.length && i < this.config.maxRunLength - 1; i++) {
      newDistribution.push(growthProbabilities[i]);
    }
    
    // Normalize distribution
    const total = newDistribution.reduce((sum, p) => sum + p, 0);
    if (total > 0) {
      for (let i = 0; i < newDistribution.length; i++) {
        newDistribution[i] /= total;
      }
    }
    
    this.runLengthDistribution = newDistribution;
  }

  private updateRegimeStates(value: number): void {
    const newRegimeStates: RegimeState[] = [this.createInitialRegime()];
    
    // Update existing regimes
    for (let r = 0; r < this.regimeStates.length && r < this.config.maxRunLength - 1; r++) {
      const regime = this.regimeStates[r];
      
      // Online update of sufficient statistics
      const newSampleCount = regime.sampleCount + 1;
      const delta = value - regime.mean;
      const newMean = regime.mean + delta / newSampleCount;
      const delta2 = value - newMean;
      const newVariance = regime.variance + (delta * delta2 - regime.variance) / newSampleCount;
      
      newRegimeStates.push({
        runLength: regime.runLength + 1,
        probability: this.runLengthDistribution[r + 1] || 0,
        mean: newMean,
        variance: Math.max(1e-6, newVariance),
        sampleCount: newSampleCount
      });
    }
    
    this.regimeStates = newRegimeStates;
  }

  private detectChangePoint(): ChangePoint {
    // Find most probable run length
    let maxProb = 0;
    let maxRunLength = 0;
    
    for (let r = 0; r < this.runLengthDistribution.length; r++) {
      if (this.runLengthDistribution[r] > maxProb) {
        maxProb = this.runLengthDistribution[r];
        maxRunLength = r;
      }
    }
    
    // Change point probability is probability that run length = 0
    const changeProbability = this.runLengthDistribution[0] || 0;
    const growthProbability = 1 - changeProbability;
    
    const changePoint: ChangePoint = {
      timestamp: new Date(),
      runLength: maxRunLength,
      probability: maxProb,
      growthProbability,
      changeProbability
    };
    
    // Store in history
    this.changePointHistory.push(changePoint);
    if (this.changePointHistory.length > 1000) {
      this.changePointHistory.shift();
    }
    
    return changePoint;
  }

  private maintainBoundedMemory(): void {
    // Truncate distributions to maintain bounded memory
    if (this.runLengthDistribution.length > this.config.maxRunLength) {
      this.runLengthDistribution = this.runLengthDistribution.slice(0, this.config.maxRunLength);
    }
    
    if (this.regimeStates.length > this.config.maxRunLength) {
      this.regimeStates = this.regimeStates.slice(0, this.config.maxRunLength);
    }
  }

  /**
   * Get current regime information
   */
  getCurrentRegime(): RegimeState {
    // Return most probable regime
    let maxProb = 0;
    let currentRegime = this.regimeStates[0];
    
    for (let r = 0; r < this.regimeStates.length; r++) {
      if (this.runLengthDistribution[r] > maxProb) {
        maxProb = this.runLengthDistribution[r];
        currentRegime = this.regimeStates[r];
      }
    }
    
    return currentRegime;
  }

  /**
   * Get recent change points
   */
  getRecentChangePoints(lookbackSamples: number = 100): ChangePoint[] {
    const cutoff = new Date(Date.now() - lookbackSamples * 1000); // Assume 1 sample per second
    return this.changePointHistory.filter(cp => cp.timestamp >= cutoff);
  }

  /**
   * Get BOCPD diagnostics
   */
  getDiagnostics(): {
    sampleCount: number;
    currentRunLength: number;
    changePointProbability: number;
    regimeCount: number;
    recentChangePoints: number;
  } {
    const currentRegime = this.getCurrentRegime();
    const recentChangePoints = this.getRecentChangePoints(100)
      .filter(cp => cp.changeProbability > this.config.changeThreshold).length;
    
    return {
      sampleCount: this.sampleCount,
      currentRunLength: currentRegime.runLength,
      changePointProbability: this.runLengthDistribution[0] || 0,
      regimeCount: this.regimeStates.length,
      recentChangePoints
    };
  }

  /**
   * Reset detector state
   */
  reset(): void {
    this.runLengthDistribution = [1.0];
    this.regimeStates = [this.createInitialRegime()];
    this.changePointHistory = [];
    this.sampleCount = 0;
    
    logger.info('[BOCPDDetector] Reset change point detection state');
  }
}
