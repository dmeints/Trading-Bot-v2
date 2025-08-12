
import { logger } from '../../server/utils/logger';

export interface FeatureScore {
  feature: string;
  ic: number;
  hsic: number;
  score: number;
  disabled: boolean;
}

export interface FeatureData {
  name: string;
  values: number[];
  timestamps: Date[];
}

export class FeatureGating {
  private features: Map<string, number[]> = new Map();
  private returns: number[] = [];
  private icWindow: number = 50;
  private hsicWindow: number = 30;
  private disableThreshold: number = 0.1; // Bottom 10%
  private ewmaAlpha: number = 0.1;
  private featureScores: Map<string, FeatureScore> = new Map();

  constructor() {
    // Initialize with some dummy features for testing
    this.features.set('momentum_5d', []);
    this.features.set('volatility_20d', []);
    this.features.set('volume_ratio', []);
    this.features.set('funding_rate', []);
    this.features.set('social_sentiment', []);
  }

  addFeature(name: string, value: number): void {
    if (!this.features.has(name)) {
      this.features.set(name, []);
    }
    
    const values = this.features.get(name)!;
    values.push(value);
    
    // Keep only recent history
    if (values.length > this.icWindow * 2) {
      values.splice(0, values.length - this.icWindow);
    }
  }

  addReturn(returnValue: number): void {
    this.returns.push(returnValue);
    
    // Keep only recent history
    if (this.returns.length > this.icWindow * 2) {
      this.returns.splice(0, this.returns.length - this.icWindow);
    }
    
    this.updateFeatureScores();
  }

  getFeatureRanking(): FeatureScore[] {
    const scores = Array.from(this.featureScores.values());
    return scores.sort((a, b) => b.score - a.score);
  }

  isFeatureEnabled(featureName: string): boolean {
    const score = this.featureScores.get(featureName);
    return score ? !score.disabled : true;
  }

  private updateFeatureScores(): void {
    if (this.returns.length < 10) return;

    const scores: FeatureScore[] = [];

    for (const [featureName, values] of this.features.entries()) {
      if (values.length < 10) continue;

      const ic = this.computeInformationCoefficient(values);
      const hsic = this.computeHSICLite(values);
      const combinedScore = 0.7 * Math.abs(ic) + 0.3 * hsic;

      scores.push({
        feature: featureName,
        ic,
        hsic,
        score: combinedScore,
        disabled: false
      });
    }

    // Sort by score and disable bottom decile
    scores.sort((a, b) => b.score - a.score);
    const disableCount = Math.floor(scores.length * this.disableThreshold);
    
    for (let i = scores.length - disableCount; i < scores.length; i++) {
      scores[i].disabled = true;
    }

    // Update feature scores map
    for (const score of scores) {
      this.featureScores.set(score.feature, score);
    }

    logger.info(`[FeatureGating] Updated scores for ${scores.length} features, disabled ${disableCount}`);
  }

  private computeInformationCoefficient(featureValues: number[]): number {
    const minLength = Math.min(featureValues.length, this.returns.length, this.icWindow);
    if (minLength < 5) return 0;

    // Align the arrays - feature at t, return at t+1
    const features = featureValues.slice(-minLength, -1); // t
    const futureReturns = this.returns.slice(-minLength + 1); // t+1

    if (features.length !== futureReturns.length || features.length < 2) return 0;

    return this.pearsonCorrelation(features, futureReturns);
  }

  private computeHSICLite(featureValues: number[]): number {
    const minLength = Math.min(featureValues.length, this.returns.length, this.hsicWindow);
    if (minLength < 5) return 0;

    const features = featureValues.slice(-minLength);
    const returns = this.returns.slice(-minLength);

    // Compute RBF kernel similarities
    const sigma = 1.0; // RBF bandwidth
    const n = features.length;
    
    let hsic = 0;
    const sampleSize = Math.min(n, 20); // Subsample for efficiency

    for (let i = 0; i < sampleSize; i++) {
      for (let j = 0; j < sampleSize; j++) {
        const kFeature = this.rbfKernel(features[i], features[j], sigma);
        const kReturn = this.rbfKernel(returns[i], returns[j], sigma);
        hsic += kFeature * kReturn;
      }
    }

    // Normalize by sample size
    hsic /= (sampleSize * sampleSize);
    
    // Apply centering approximation (simplified)
    const meanKFeature = this.computeMeanKernel(features, sigma);
    const meanKReturn = this.computeMeanKernel(returns, sigma);
    
    hsic = hsic - 2 * meanKFeature * meanKReturn + meanKFeature * meanKReturn;
    
    return Math.max(0, hsic); // HSIC is non-negative
  }

  private rbfKernel(x: number, y: number, sigma: number): number {
    const diff = x - y;
    return Math.exp(-(diff * diff) / (2 * sigma * sigma));
  }

  private computeMeanKernel(values: number[], sigma: number): number {
    const n = values.length;
    let sum = 0;
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        sum += this.rbfKernel(values[i], values[j], sigma);
      }
    }
    
    return sum / (n * n);
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;

    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const sumY2 = y.reduce((sum, val) => sum + val * val, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  // Simulate some features for testing
  simulateFeatures(): void {
    const momentum = Math.random() * 0.2 - 0.1;
    const volatility = Math.random() * 0.05 + 0.01;
    const volumeRatio = Math.random() * 2 + 0.5;
    const fundingRate = Math.random() * 0.001 - 0.0005;
    const sentiment = Math.random() * 2 - 1;

    this.addFeature('momentum_5d', momentum);
    this.addFeature('volatility_20d', volatility);
    this.addFeature('volume_ratio', volumeRatio);
    this.addFeature('funding_rate', fundingRate);
    this.addFeature('social_sentiment', sentiment);

    // Add a predictive feature that correlates with future returns
    const predictiveSignal = momentum * 0.5 + Math.random() * 0.05;
    this.addFeature('predictive_signal', predictiveSignal);
    
    // Add noise feature
    this.addFeature('noise_feature', Math.random() * 2 - 1);
  }
}

export const featureGating = new FeatureGating();
