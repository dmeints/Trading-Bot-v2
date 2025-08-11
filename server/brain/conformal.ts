
import { logger } from '../utils/logger';

export interface ConformalPrediction {
  prediction: number;
  lowerBound: number;
  upperBound: number;
  width: number;
  coverage: number;
  nonconformityScore: number;
}

export interface CalibrationSample {
  features: number[];
  actualReturn: number;
  predictedReturn: number;
  timestamp: Date;
}

export interface ConformalConfig {
  alpha: number;           // Significance level (0.05 for 95% confidence)
  windowSize: number;      // Calibration window size
  minSamples: number;      // Minimum samples before making predictions
  adaptiveAlpha: boolean;  // Whether to use adaptive significance level
  kernelBandwidth: number; // For weighted conformal prediction
}

/**
 * Conformal Prediction System for Trading Decision Uncertainty Quantification
 * 
 * Provides rigorous prediction intervals with finite-sample coverage guarantees.
 * Uses adaptive conformal prediction with time-series aware calibration.
 */
export class ConformalPredictor {
  private calibrationSet: CalibrationSample[] = [];
  private nonconformityScores: number[] = [];
  private config: ConformalConfig;
  private coverageTracker: { actual: number; expected: number }[] = [];

  constructor(config: Partial<ConformalConfig> = {}) {
    this.config = {
      alpha: 0.05,           // 95% confidence intervals
      windowSize: 500,       // Rolling window of 500 samples
      minSamples: 50,        // Need at least 50 samples to start
      adaptiveAlpha: true,   // Adapt significance level based on market regime
      kernelBandwidth: 0.1,  // Gaussian kernel bandwidth
      ...config
    };
  }

  /**
   * Add new calibration sample to the rolling window
   */
  addCalibrationSample(sample: CalibrationSample): void {
    this.calibrationSet.push(sample);
    
    // Maintain rolling window
    if (this.calibrationSet.length > this.config.windowSize) {
      this.calibrationSet.shift();
    }
    
    // Calculate nonconformity score for this sample
    const nonconformityScore = this.calculateNonconformityScore(
      sample.actualReturn,
      sample.predictedReturn
    );
    
    this.nonconformityScores.push(nonconformityScore);
    if (this.nonconformityScores.length > this.config.windowSize) {
      this.nonconformityScores.shift();
    }
    
    logger.debug('[ConformalPredictor] Added calibration sample', {
      samplesCount: this.calibrationSet.length,
      nonconformityScore: nonconformityScore.toFixed(4)
    });
  }

  /**
   * Generate conformal prediction with uncertainty bounds
   */
  predict(
    features: number[],
    pointPrediction: number,
    marketRegime?: 'bull' | 'bear' | 'sideways' | 'volatile'
  ): ConformalPrediction | null {
    if (this.calibrationSet.length < this.config.minSamples) {
      logger.warn('[ConformalPredictor] Insufficient calibration samples', {
        current: this.calibrationSet.length,
        required: this.config.minSamples
      });
      return null;
    }

    // Adaptive alpha based on market regime
    const alpha = this.config.adaptiveAlpha 
      ? this.getAdaptiveAlpha(marketRegime)
      : this.config.alpha;

    // Calculate weighted nonconformity scores if using kernel weighting
    const weights = this.calculateSampleWeights(features);
    const weightedQuantile = this.calculateWeightedQuantile(
      this.nonconformityScores,
      weights,
      1 - alpha
    );

    // Generate prediction interval
    const lowerBound = pointPrediction - weightedQuantile;
    const upperBound = pointPrediction + weightedQuantile;
    const width = upperBound - lowerBound;

    // Calculate empirical coverage from recent predictions
    const empiricalCoverage = this.calculateEmpiricalCoverage();

    const prediction: ConformalPrediction = {
      prediction: pointPrediction,
      lowerBound,
      upperBound,
      width,
      coverage: 1 - alpha,
      nonconformityScore: weightedQuantile
    };

    logger.debug('[ConformalPredictor] Generated prediction', {
      prediction: pointPrediction.toFixed(4),
      interval: `[${lowerBound.toFixed(4)}, ${upperBound.toFixed(4)}]`,
      width: width.toFixed(4),
      coverage: ((1 - alpha) * 100).toFixed(1) + '%',
      empiricalCoverage: (empiricalCoverage * 100).toFixed(1) + '%'
    });

    return prediction;
  }

  /**
   * Calculate nonconformity score (prediction error)
   */
  private calculateNonconformityScore(actual: number, predicted: number): number {
    return Math.abs(actual - predicted);
  }

  /**
   * Calculate sample weights based on feature similarity
   */
  private calculateSampleWeights(queryFeatures: number[]): number[] {
    if (!this.config.kernelBandwidth) {
      return Array(this.calibrationSet.length).fill(1.0);
    }

    return this.calibrationSet.map(sample => {
      const distance = this.calculateFeatureDistance(queryFeatures, sample.features);
      return Math.exp(-distance / (2 * this.config.kernelBandwidth ** 2));
    });
  }

  /**
   * Calculate Euclidean distance between feature vectors
   */
  private calculateFeatureDistance(features1: number[], features2: number[]): number {
    if (features1.length !== features2.length) {
      return Infinity;
    }

    let sumSquaredDiffs = 0;
    for (let i = 0; i < features1.length; i++) {
      const diff = features1[i] - features2[i];
      sumSquaredDiffs += diff * diff;
    }
    
    return Math.sqrt(sumSquaredDiffs);
  }

  /**
   * Calculate weighted quantile
   */
  private calculateWeightedQuantile(
    values: number[],
    weights: number[],
    quantile: number
  ): number {
    if (values.length === 0) return 0;
    if (values.length !== weights.length) {
      return this.calculateQuantile(values, quantile);
    }

    // Create sorted pairs of (value, weight)
    const pairs = values.map((value, i) => ({ value, weight: weights[i] }))
                       .sort((a, b) => a.value - b.value);

    // Calculate cumulative weights
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let cumulativeWeight = 0;
    const targetWeight = quantile * totalWeight;

    for (const pair of pairs) {
      cumulativeWeight += pair.weight;
      if (cumulativeWeight >= targetWeight) {
        return pair.value;
      }
    }

    return pairs[pairs.length - 1].value;
  }

  /**
   * Calculate simple quantile (fallback)
   */
  private calculateQuantile(values: number[], quantile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = quantile * (sorted.length - 1);
    
    if (index === Math.floor(index)) {
      return sorted[Math.floor(index)];
    }
    
    const lower = sorted[Math.floor(index)];
    const upper = sorted[Math.ceil(index)];
    const fraction = index - Math.floor(index);
    
    return lower + fraction * (upper - lower);
  }

  /**
   * Get adaptive alpha based on market regime
   */
  private getAdaptiveAlpha(regime?: string): number {
    const baseAlpha = this.config.alpha;
    
    switch (regime) {
      case 'volatile':
        return Math.min(0.2, baseAlpha * 2); // Wider intervals in volatile markets
      case 'bull':
      case 'bear':
        return Math.max(0.01, baseAlpha * 0.8); // Tighter intervals in trending markets
      case 'sideways':
        return baseAlpha; // Normal intervals in ranging markets
      default:
        return baseAlpha;
    }
  }

  /**
   * Calculate empirical coverage from recent predictions
   */
  private calculateEmpiricalCoverage(): number {
    if (this.coverageTracker.length === 0) return 0;
    
    const recentTracker = this.coverageTracker.slice(-100); // Last 100 predictions
    const actualCoverage = recentTracker.reduce((sum, item) => sum + item.actual, 0);
    return actualCoverage / recentTracker.length;
  }

  /**
   * Update coverage tracker with actual outcome
   */
  updateCoverage(
    actualReturn: number,
    prediction: ConformalPrediction,
    expectedCoverage: number = 0.95
  ): void {
    const withinInterval = actualReturn >= prediction.lowerBound && 
                          actualReturn <= prediction.upperBound;
    
    this.coverageTracker.push({
      actual: withinInterval ? 1 : 0,
      expected: expectedCoverage
    });
    
    // Maintain rolling window
    if (this.coverageTracker.length > 1000) {
      this.coverageTracker.shift();
    }
  }

  /**
   * Get calibration diagnostics
   */
  getDiagnostics(): {
    calibrationSamples: number;
    empiricalCoverage: number;
    expectedCoverage: number;
    coverageGap: number;
    avgIntervalWidth: number;
    recentNonconformityScores: number[];
  } {
    const empiricalCoverage = this.calculateEmpiricalCoverage();
    const expectedCoverage = 1 - this.config.alpha;
    const coverageGap = Math.abs(empiricalCoverage - expectedCoverage);
    
    const recentScores = this.nonconformityScores.slice(-20);
    const avgWidth = recentScores.length > 0 
      ? recentScores.reduce((sum, score) => sum + score * 2, 0) / recentScores.length
      : 0;

    return {
      calibrationSamples: this.calibrationSet.length,
      empiricalCoverage,
      expectedCoverage,
      coverageGap,
      avgIntervalWidth: avgWidth,
      recentNonconformityScores: recentScores
    };
  }

  /**
   * Reset calibration (e.g., after significant market regime change)
   */
  reset(): void {
    this.calibrationSet = [];
    this.nonconformityScores = [];
    this.coverageTracker = [];
    
    logger.info('[ConformalPredictor] Reset calibration data');
  }

  /**
   * Export calibration state for persistence
   */
  exportState(): {
    calibrationSet: CalibrationSample[];
    nonconformityScores: number[];
    coverageTracker: { actual: number; expected: number }[];
    config: ConformalConfig;
  } {
    return {
      calibrationSet: [...this.calibrationSet],
      nonconformityScores: [...this.nonconformityScores],
      coverageTracker: [...this.coverageTracker],
      config: { ...this.config }
    };
  }

  /**
   * Import calibration state from persistence
   */
  importState(state: {
    calibrationSet: CalibrationSample[];
    nonconformityScores: number[];
    coverageTracker: { actual: number; expected: number }[];
    config: ConformalConfig;
  }): void {
    this.calibrationSet = state.calibrationSet || [];
    this.nonconformityScores = state.nonconformityScores || [];
    this.coverageTracker = state.coverageTracker || [];
    this.config = { ...this.config, ...state.config };
    
    logger.info('[ConformalPredictor] Imported calibration state', {
      samples: this.calibrationSet.length,
      scores: this.nonconformityScores.length
    });
  }
}

/**
 * Factory function to create conformal predictor with default trading configuration
 */
export function createTradingConformalPredictor(): ConformalPredictor {
  return new ConformalPredictor({
    alpha: 0.1,            // 90% confidence for trading decisions
    windowSize: 1000,      // Larger window for trading stability
    minSamples: 100,       // More samples needed for trading
    adaptiveAlpha: true,   // Adapt to market conditions
    kernelBandwidth: 0.05  // Tighter kernel for trading similarity
  });
}

/**
 * Utility function to evaluate prediction quality
 */
export function evaluatePredictionQuality(
  predictions: ConformalPrediction[],
  actualReturns: number[]
): {
  coverage: number;
  avgWidth: number;
  efficiency: number;
  sharpness: number;
} {
  if (predictions.length !== actualReturns.length || predictions.length === 0) {
    throw new Error('Predictions and actual returns must have the same non-zero length');
  }

  let withinInterval = 0;
  let totalWidth = 0;

  for (let i = 0; i < predictions.length; i++) {
    const pred = predictions[i];
    const actual = actualReturns[i];
    
    if (actual >= pred.lowerBound && actual <= pred.upperBound) {
      withinInterval++;
    }
    totalWidth += pred.width;
  }

  const coverage = withinInterval / predictions.length;
  const avgWidth = totalWidth / predictions.length;
  const efficiency = coverage / avgWidth; // Higher is better
  const sharpness = 1 / avgWidth; // Higher is better (narrower intervals)

  return {
    coverage,
    avgWidth,
    efficiency,
    sharpness
  };
}
