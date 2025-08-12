
import { logger } from '../../utils/logger';

export interface RegimeState {
  regime: 'bull' | 'bear' | 'sideways' | 'volatile';
  runLength: number;
  lastChangeAt: Date;
  confidence: number;
}

export class BayesianOnlineChangePointDetection {
  private hazard: number = 1/100; // Expected change every 100 observations
  private runLengthProbs: number[] = [1.0]; // P(r_t | x_1:t)
  private returns: number[] = [];
  private currentRegime: 'bull' | 'bear' | 'sideways' | 'volatile' = 'sideways';
  private lastChangeAt: Date = new Date();
  private maxRunLength: number = 200;

  constructor(hazard: number = 1/100) {
    this.hazard = hazard;
  }

  updateWithReturn(returnValue: number): RegimeState {
    this.returns.push(returnValue);
    
    // Keep only recent history for efficiency
    if (this.returns.length > 1000) {
      this.returns = this.returns.slice(-500);
    }

    this.updateRunLengthPosterior(returnValue);
    this.detectRegimeChange();

    const mostLikelyRunLength = this.getMostLikelyRunLength();
    
    return {
      regime: this.currentRegime,
      runLength: mostLikelyRunLength,
      lastChangeAt: this.lastChangeAt,
      confidence: Math.max(...this.runLengthProbs)
    };
  }

  getCurrentRegime(): RegimeState {
    const mostLikelyRunLength = this.getMostLikelyRunLength();
    
    return {
      regime: this.currentRegime,
      runLength: mostLikelyRunLength,
      lastChangeAt: this.lastChangeAt,
      confidence: Math.max(...this.runLengthProbs)
    };
  }

  private updateRunLengthPosterior(returnValue: number): void {
    const newRunLengthProbs: number[] = [];
    
    // Compute predictive probabilities for each run length
    for (let r = 0; r < this.runLengthProbs.length; r++) {
      if (this.runLengthProbs[r] > 1e-10) { // Numerical stability
        const likelihood = this.computeLikelihood(returnValue, r);
        
        // Growth probability: no change point
        if (r + 1 < this.maxRunLength) {
          if (!newRunLengthProbs[r + 1]) newRunLengthProbs[r + 1] = 0;
          newRunLengthProbs[r + 1] += this.runLengthProbs[r] * (1 - this.hazard) * likelihood;
        }
        
        // Change point probability
        if (!newRunLengthProbs[0]) newRunLengthProbs[0] = 0;
        newRunLengthProbs[0] += this.runLengthProbs[r] * this.hazard * likelihood;
      }
    }

    // Normalize
    const total = newRunLengthProbs.reduce((sum, p) => sum + (p || 0), 0);
    if (total > 0) {
      this.runLengthProbs = newRunLengthProbs.map(p => (p || 0) / total);
    }

    // Truncate for efficiency
    if (this.runLengthProbs.length > this.maxRunLength) {
      this.runLengthProbs = this.runLengthProbs.slice(0, this.maxRunLength);
    }
  }

  private computeLikelihood(returnValue: number, runLength: number): number {
    if (runLength === 0 || this.returns.length < 2) {
      // Use default parameters for new segments
      return this.normalLikelihood(returnValue, 0, 0.02);
    }

    // Compute sample statistics for this run length
    const segmentStart = Math.max(0, this.returns.length - runLength - 1);
    const segment = this.returns.slice(segmentStart, -1); // Exclude current return
    
    if (segment.length < 2) {
      return this.normalLikelihood(returnValue, 0, 0.02);
    }

    const mean = segment.reduce((sum, r) => sum + r, 0) / segment.length;
    const variance = segment.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / Math.max(1, segment.length - 1);
    const std = Math.sqrt(Math.max(variance, 1e-6)); // Numerical stability

    return this.normalLikelihood(returnValue, mean, std);
  }

  private normalLikelihood(x: number, mean: number, std: number): number {
    const variance = std * std;
    const coefficient = 1 / Math.sqrt(2 * Math.PI * variance);
    const exponent = -Math.pow(x - mean, 2) / (2 * variance);
    return coefficient * Math.exp(exponent);
  }

  private detectRegimeChange(): void {
    // Check if change point probability is high
    const changePointProb = this.runLengthProbs[0] || 0;
    
    if (changePointProb > 0.3) { // Threshold for regime change
      this.lastChangeAt = new Date();
      this.currentRegime = this.classifyRegime();
      
      logger.info(`[BOCPD] Regime change detected: ${this.currentRegime} (prob: ${changePointProb.toFixed(3)})`);
    }
  }

  private classifyRegime(): 'bull' | 'bear' | 'sideways' | 'volatile' {
    if (this.returns.length < 20) return 'sideways';

    const recent = this.returns.slice(-20);
    const mean = recent.reduce((sum, r) => sum + r, 0) / recent.length;
    const variance = recent.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / recent.length;
    const volatility = Math.sqrt(variance);

    // Classification logic
    if (volatility > 0.03) {
      return 'volatile';
    } else if (mean > 0.001) {
      return 'bull';
    } else if (mean < -0.001) {
      return 'bear';
    } else {
      return 'sideways';
    }
  }

  private getMostLikelyRunLength(): number {
    let maxProb = 0;
    let maxIndex = 0;
    
    for (let i = 0; i < this.runLengthProbs.length; i++) {
      if (this.runLengthProbs[i] > maxProb) {
        maxProb = this.runLengthProbs[i];
        maxIndex = i;
      }
    }
    
    return maxIndex;
  }
}

export const bocpdDetector = new BayesianOnlineChangePointDetection();
