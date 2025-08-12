
/**
 * Online Elastic Net Model with Partial Fitting
 * Incrementally learns linear relationships with L1/L2 regularization
 */

import { logger } from '../utils/logger';

export interface ElasticNetConfig {
  alpha: number;        // Overall regularization strength
  l1Ratio: number;      // L1/L2 balance (0=Ridge, 1=Lasso)
  learningRate: number; // Learning rate for SGD
  tolerance: number;    // Convergence tolerance
  maxIterations: number;
}

export interface ElasticNetPrediction {
  prediction: number;
  confidence: number;
  activeFeatures: string[];
  l1Penalty: number;
  l2Penalty: number;
}

export class OnlineElasticNet {
  private weights: Map<string, number> = new Map();
  private featureMeans: Map<string, number> = new Map();
  private featureStds: Map<string, number> = new Map();
  private sampleCount: number = 0;
  private config: ElasticNetConfig;
  private convergenceHistory: number[] = [];

  constructor(config: Partial<ElasticNetConfig> = {}) {
    this.config = {
      alpha: 0.01,
      l1Ratio: 0.5,
      learningRate: 0.01,
      tolerance: 1e-4,
      maxIterations: 1000,
      ...config
    };
  }

  /**
   * Partial fit on new sample
   */
  partialFit(
    features: Record<string, number>,
    target: number,
    sampleWeight: number = 1.0
  ): void {
    this.sampleCount++;
    
    // Update feature statistics (online normalization)
    this.updateFeatureStatistics(features);
    
    // Normalize features
    const normalizedFeatures = this.normalizeFeatures(features);
    
    // Compute prediction with current weights
    const prediction = this.predictNormalized(normalizedFeatures);
    const error = target - prediction;
    
    // Elastic net gradient descent update
    this.updateWeights(normalizedFeatures, error, sampleWeight);
    
    // Track convergence
    this.convergenceHistory.push(Math.abs(error));
    if (this.convergenceHistory.length > 100) {
      this.convergenceHistory.shift();
    }
    
    logger.debug('[OnlineElasticNet] Partial fit completed', {
      sampleCount: this.sampleCount,
      error: error.toFixed(4),
      activeWeights: this.getActiveFeatureCount()
    });
  }

  private updateFeatureStatistics(features: Record<string, number>): void {
    for (const [featureId, value] of Object.entries(features)) {
      // Online mean update
      const currentMean = this.featureMeans.get(featureId) || 0;
      const newMean = currentMean + (value - currentMean) / this.sampleCount;
      this.featureMeans.set(featureId, newMean);
      
      // Online standard deviation update (simplified)
      const currentStd = this.featureStds.get(featureId) || 1;
      const meanDiff = value - newMean;
      const newStd = Math.max(0.01, Math.sqrt(
        (currentStd * currentStd * (this.sampleCount - 1) + meanDiff * meanDiff) / this.sampleCount
      ));
      this.featureStds.set(featureId, newStd);
    }
  }

  private normalizeFeatures(features: Record<string, number>): Record<string, number> {
    const normalized: Record<string, number> = {};
    
    for (const [featureId, value] of Object.entries(features)) {
      const mean = this.featureMeans.get(featureId) || 0;
      const std = this.featureStds.get(featureId) || 1;
      normalized[featureId] = (value - mean) / std;
    }
    
    return normalized;
  }

  private predictNormalized(normalizedFeatures: Record<string, number>): number {
    let prediction = 0;
    
    for (const [featureId, value] of Object.entries(normalizedFeatures)) {
      const weight = this.weights.get(featureId) || 0;
      prediction += weight * value;
    }
    
    return prediction;
  }

  private updateWeights(
    normalizedFeatures: Record<string, number>,
    error: number,
    sampleWeight: number
  ): void {
    const learningRate = this.config.learningRate / Math.sqrt(this.sampleCount);
    
    for (const [featureId, value] of Object.entries(normalizedFeatures)) {
      const currentWeight = this.weights.get(featureId) || 0;
      
      // Gradient of loss function
      const gradient = -error * value * sampleWeight;
      
      // L1 and L2 regularization gradients
      const l1Gradient = this.config.alpha * this.config.l1Ratio * Math.sign(currentWeight);
      const l2Gradient = this.config.alpha * (1 - this.config.l1Ratio) * currentWeight;
      
      // Combined gradient
      const totalGradient = gradient + l1Gradient + l2Gradient;
      
      // Weight update
      let newWeight = currentWeight - learningRate * totalGradient;
      
      // Soft thresholding for L1 regularization (promotes sparsity)
      const threshold = learningRate * this.config.alpha * this.config.l1Ratio;
      if (Math.abs(newWeight) <= threshold) {
        newWeight = 0;
      } else {
        newWeight = Math.sign(newWeight) * (Math.abs(newWeight) - threshold);
      }
      
      this.weights.set(featureId, newWeight);
    }
  }

  /**
   * Make prediction with uncertainty estimate
   */
  predict(features: Record<string, number>): ElasticNetPrediction {
    if (this.sampleCount < 10) {
      return {
        prediction: 0,
        confidence: 0,
        activeFeatures: [],
        l1Penalty: 0,
        l2Penalty: 0
      };
    }
    
    const normalizedFeatures = this.normalizeFeatures(features);
    const prediction = this.predictNormalized(normalizedFeatures);
    
    // Calculate confidence based on feature coverage and convergence
    const featureCoverage = this.calculateFeatureCoverage(features);
    const convergenceScore = this.calculateConvergenceScore();
    const confidence = Math.min(0.95, featureCoverage * convergenceScore);
    
    // Get active features (non-zero weights)
    const activeFeatures = Array.from(this.weights.entries())
      .filter(([_, weight]) => Math.abs(weight) > 1e-6)
      .map(([featureId, _]) => featureId);
    
    // Calculate penalty terms
    const l1Penalty = this.calculateL1Penalty();
    const l2Penalty = this.calculateL2Penalty();
    
    return {
      prediction,
      confidence,
      activeFeatures,
      l1Penalty,
      l2Penalty
    };
  }

  private calculateFeatureCoverage(features: Record<string, number>): number {
    const knownFeatures = new Set(this.featureMeans.keys());
    const inputFeatures = new Set(Object.keys(features));
    const intersection = new Set([...knownFeatures].filter(f => inputFeatures.has(f)));
    
    return intersection.size / Math.max(knownFeatures.size, 1);
  }

  private calculateConvergenceScore(): number {
    if (this.convergenceHistory.length < 10) return 0.5;
    
    const recentErrors = this.convergenceHistory.slice(-10);
    const avgError = recentErrors.reduce((sum, err) => sum + err, 0) / recentErrors.length;
    const errorStd = Math.sqrt(
      recentErrors.reduce((sum, err) => sum + (err - avgError) ** 2, 0) / recentErrors.length
    );
    
    // High convergence score when errors are low and stable
    return Math.exp(-avgError) * Math.exp(-errorStd);
  }

  private calculateL1Penalty(): number {
    return Array.from(this.weights.values())
      .reduce((sum, weight) => sum + Math.abs(weight), 0);
  }

  private calculateL2Penalty(): number {
    return Math.sqrt(
      Array.from(this.weights.values())
        .reduce((sum, weight) => sum + weight * weight, 0)
    );
  }

  private getActiveFeatureCount(): number {
    return Array.from(this.weights.values())
      .filter(weight => Math.abs(weight) > 1e-6)
      .length;
  }

  /**
   * Get model diagnostics
   */
  getDiagnostics(): {
    sampleCount: number;
    activeFeatures: number;
    totalFeatures: number;
    sparsity: number;
    recentError: number;
    convergenceScore: number;
  } {
    const activeFeatures = this.getActiveFeatureCount();
    const totalFeatures = this.weights.size;
    const sparsity = totalFeatures > 0 ? 1 - (activeFeatures / totalFeatures) : 0;
    const recentError = this.convergenceHistory.length > 0 
      ? this.convergenceHistory[this.convergenceHistory.length - 1] 
      : 0;
    const convergenceScore = this.calculateConvergenceScore();
    
    return {
      sampleCount: this.sampleCount,
      activeFeatures,
      totalFeatures,
      sparsity,
      recentError,
      convergenceScore
    };
  }

  /**
   * Get feature weights
   */
  getWeights(): Map<string, number> {
    return new Map(this.weights);
  }

  /**
   * Reset model state
   */
  reset(): void {
    this.weights.clear();
    this.featureMeans.clear();
    this.featureStds.clear();
    this.sampleCount = 0;
    this.convergenceHistory = [];
    
    logger.info('[OnlineElasticNet] Reset model state');
  }
}
