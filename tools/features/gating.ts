import { logger } from '../../server/utils/logger.js';

export interface FeatureRanking {
  feature: string;
  ic: number;
  hsic: number;
  score: number;
  disabled: boolean;
  lastUpdate: Date;
}

export class FeatureGating {
  private rankings: Map<string, FeatureRanking> = new Map();
  private featureHistory: Map<string, number[]> = new Map();
  private returnHistory: number[] = [];
  private ewmaAlpha = 0.1; // EWMA decay factor
  private disableThreshold = 0.1; // Bottom 10% get disabled

  constructor() {
    // Initialize with some default features
    this.initializeFeature('rsi', 0.15);
    this.initializeFeature('volume', 0.08);
    this.initializeFeature('momentum', 0.12);
    this.initializeFeature('noise_feature', 0.02);
  }

  private initializeFeature(name: string, initialIC: number): void {
    this.rankings.set(name, {
      feature: name,
      ic: initialIC,
      hsic: 0.0,
      score: initialIC,
      disabled: false,
      lastUpdate: new Date()
    });
    this.featureHistory.set(name, []);
  }

  updateFeatureValue(feature: string, value: number): void {
    if (!this.featureHistory.has(feature)) {
      this.featureHistory.set(feature, []);
    }

    const history = this.featureHistory.get(feature)!;
    history.push(value);

    // Keep only last 100 values for efficiency
    if (history.length > 100) {
      history.shift();
    }
  }

  updateReturn(returnValue: number): void {
    this.returnHistory.push(returnValue);

    // Keep only last 100 returns
    if (this.returnHistory.length > 100) {
      this.returnHistory.shift();
    }

    // Update IC for all features if we have enough data
    if (this.returnHistory.length >= 20) {
      this.updateInformationCoefficients();
      this.updateHSICScores();
      this.updateFeatureScores();
      this.disableLowPerformers();
    }
  }

  private updateInformationCoefficients(): void {
    for (const [featureName, history] of this.featureHistory.entries()) {
      if (history.length >= 20) {
        const ic = this.computeIC(history, this.returnHistory);
        const ranking = this.rankings.get(featureName);
        if (ranking) {
          // EWMA update
          ranking.ic = (1 - this.ewmaAlpha) * ranking.ic + this.ewmaAlpha * ic;
          ranking.lastUpdate = new Date();
        }
      }
    }
  }

  private computeIC(features: number[], returns: number[]): number {
    // Information Coefficient: correlation between feature at t and return at t+1
    const minLength = Math.min(features.length, returns.length - 1);
    if (minLength < 10) return 0;

    const featuresAligned = features.slice(-minLength);
    const returnsAligned = returns.slice(1, 1 + minLength); // t+1 returns

    return this.pearsonCorrelation(featuresAligned, returnsAligned);
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n === 0) return 0;

    const meanX = x.reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let sumXSquared = 0;
    let sumYSquared = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - meanX;
      const yDiff = y[i] - meanY;
      numerator += xDiff * yDiff;
      sumXSquared += xDiff * xDiff;
      sumYSquared += yDiff * yDiff;
    }

    const denominator = Math.sqrt(sumXSquared * sumYSquared);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private updateHSICScores(): void {
    // HSIC-lite proxy using RBF similarities in small batches
    for (const [featureName, history] of this.featureHistory.entries()) {
      if (history.length >= 20) {
        const hsic = this.computeHSICLite(history, this.returnHistory);
        const ranking = this.rankings.get(featureName);
        if (ranking) {
          ranking.hsic = (1 - this.ewmaAlpha) * ranking.hsic + this.ewmaAlpha * hsic;
        }
      }
    }
  }

  private computeHSICLite(features: number[], returns: number[]): number {
    // Simplified HSIC using RBF kernel similarities
    const batchSize = Math.min(20, features.length);
    const gamma = 1.0; // RBF bandwidth

    let hsicSum = 0;
    for (let i = 0; i < batchSize - 1; i++) {
      for (let j = i + 1; j < batchSize; j++) {
        // RBF kernel for features
        const featureSim = Math.exp(-gamma * Math.pow(features[i] - features[j], 2));
        // RBF kernel for returns  
        const returnSim = Math.exp(-gamma * Math.pow(returns[i] - returns[j], 2));
        hsicSum += featureSim * returnSim;
      }
    }

    return hsicSum / (batchSize * (batchSize - 1) / 2);
  }

  private updateFeatureScores(): void {
    for (const ranking of this.rankings.values()) {
      // Combine IC and HSIC with weights
      ranking.score = 0.7 * Math.abs(ranking.ic) + 0.3 * ranking.hsic;
    }
  }

  private disableLowPerformers(): void {
    const sortedRankings = Array.from(this.rankings.values())
      .sort((a, b) => b.score - a.score);

    const disableCount = Math.floor(sortedRankings.length * this.disableThreshold);

    // Enable all first
    for (const ranking of sortedRankings) {
      ranking.disabled = false;
    }

    // Disable bottom performers
    for (let i = sortedRankings.length - disableCount; i < sortedRankings.length; i++) {
      sortedRankings[i].disabled = true;
      logger.info(`[FeatureGating] Disabled feature ${sortedRankings[i].feature} (score: ${sortedRankings[i].score.toFixed(4)})`);
    }
  }

  getRanking(): FeatureRanking[] {
    return Array.from(this.rankings.values())
      .sort((a, b) => b.score - a.score);
  }

  isFeatureEnabled(feature: string): boolean {
    const ranking = this.rankings.get(feature);
    return ranking ? !ranking.disabled : true; // Default to enabled
  }
}

export const featureGating = new FeatureGating();