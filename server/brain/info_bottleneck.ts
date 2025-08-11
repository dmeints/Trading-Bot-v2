
/**
 * Information Bottleneck Feature Selection
 * Selects sparse feature sets that maximize predictive information under budget constraints
 */

import { logger } from '../utils/logger';

export interface FeatureStream {
  id: string;
  name: string;
  value: number;
  cost: number;
  reliability: number;
  lastUpdate: Date;
  source: string;
}

export interface BottleneckSelection {
  selectedFeatures: string[];
  predictiveInfo: number;
  totalCost: number;
  budgetUtilization: number;
  rationale: string;
}

export interface FeatureCorrelation {
  featureId: string;
  returnCorrelation: number;
  pValue: number;
  sampleSize: number;
}

export class InformationBottleneck {
  private featureHistory: Map<string, number[]> = new Map();
  private returnHistory: number[] = [];
  private readonly maxHistory: number = 1000;
  private readonly minSamples: number = 30;

  constructor(
    private readonly budget: number = 100,
    private readonly maxFeatures: number = 10
  ) {}

  /**
   * Select optimal feature subset using greedy submodular optimization
   */
  async selectFeatures(
    availableFeatures: FeatureStream[],
    targetReturn?: number
  ): Promise<BottleneckSelection> {
    // Filter reliable features
    const validFeatures = availableFeatures.filter(f => 
      f.reliability > 0.7 && 
      !isNaN(f.value) && 
      f.cost > 0
    );

    if (validFeatures.length === 0) {
      return {
        selectedFeatures: [],
        predictiveInfo: 0,
        totalCost: 0,
        budgetUtilization: 0,
        rationale: 'No valid features available'
      };
    }

    // Update feature history
    this.updateFeatureHistory(validFeatures, targetReturn);

    // Compute feature correlations with returns
    const correlations = await this.computeFeatureCorrelations(validFeatures);

    // Greedy submodular selection
    const selection = this.greedySelection(correlations, validFeatures);

    logger.debug('[InfoBottleneck] Feature selection', {
      totalFeatures: validFeatures.length,
      selected: selection.selectedFeatures.length,
      cost: selection.totalCost,
      budget: this.budget,
      predictiveInfo: selection.predictiveInfo.toFixed(4)
    });

    return selection;
  }

  private updateFeatureHistory(features: FeatureStream[], targetReturn?: number): void {
    // Update feature values
    features.forEach(feature => {
      if (!this.featureHistory.has(feature.id)) {
        this.featureHistory.set(feature.id, []);
      }
      
      const history = this.featureHistory.get(feature.id)!;
      history.push(feature.value);
      
      if (history.length > this.maxHistory) {
        history.shift();
      }
    });

    // Update return history if provided
    if (targetReturn !== undefined) {
      this.returnHistory.push(targetReturn);
      if (this.returnHistory.length > this.maxHistory) {
        this.returnHistory.shift();
      }
    }
  }

  private async computeFeatureCorrelations(features: FeatureStream[]): Promise<FeatureCorrelation[]> {
    if (this.returnHistory.length < this.minSamples) {
      // Not enough history, use heuristic ranking
      return features.map(f => ({
        featureId: f.id,
        returnCorrelation: Math.random() * 0.2 - 0.1, // Small random correlation
        pValue: 0.5,
        sampleSize: 0
      }));
    }

    const correlations: FeatureCorrelation[] = [];

    for (const feature of features) {
      const featureValues = this.featureHistory.get(feature.id);
      if (!featureValues || featureValues.length < this.minSamples) {
        correlations.push({
          featureId: feature.id,
          returnCorrelation: 0,
          pValue: 1.0,
          sampleSize: featureValues?.length || 0
        });
        continue;
      }

      // Compute correlation with returns
      const correlation = this.pearsonCorrelation(
        featureValues.slice(-this.returnHistory.length),
        this.returnHistory
      );

      // Simple t-test for significance
      const n = Math.min(featureValues.length, this.returnHistory.length);
      const tStat = correlation * Math.sqrt((n - 2) / (1 - correlation * correlation));
      const pValue = this.tTestPValue(tStat, n - 2);

      correlations.push({
        featureId: feature.id,
        returnCorrelation: correlation,
        pValue,
        sampleSize: n
      });
    }

    return correlations;
  }

  private greedySelection(
    correlations: FeatureCorrelation[],
    features: FeatureStream[]
  ): BottleneckSelection {
    const featureMap = new Map(features.map(f => [f.id, f]));
    const selected: string[] = [];
    let totalCost = 0;
    let totalInfo = 0;

    // Sort by information gain per cost ratio
    const candidates = correlations
      .map(corr => {
        const feature = featureMap.get(corr.featureId)!;
        const infoGain = Math.abs(corr.returnCorrelation) * (1 - corr.pValue); // Weighted by significance
        const efficiency = infoGain / feature.cost;
        return { ...corr, feature, infoGain, efficiency };
      })
      .filter(c => c.infoGain > 0)
      .sort((a, b) => b.efficiency - a.efficiency);

    // Greedy selection under constraints
    for (const candidate of candidates) {
      if (selected.length >= this.maxFeatures) break;
      if (totalCost + candidate.feature.cost > this.budget) continue;

      // Check if this feature adds significant new information
      const redundancy = this.computeRedundancy(candidate.featureId, selected);
      if (redundancy > 0.8) continue; // Skip highly redundant features

      selected.push(candidate.featureId);
      totalCost += candidate.feature.cost;
      totalInfo += candidate.infoGain * (1 - redundancy); // Discount for redundancy
    }

    // If no features selected, pick the most efficient one within budget
    if (selected.length === 0 && candidates.length > 0) {
      const cheapest = candidates.find(c => c.feature.cost <= this.budget);
      if (cheapest) {
        selected.push(cheapest.featureId);
        totalCost = cheapest.feature.cost;
        totalInfo = cheapest.infoGain;
      }
    }

    const rationale = this.generateRationale(selected, correlations, featureMap);

    return {
      selectedFeatures: selected,
      predictiveInfo: totalInfo,
      totalCost,
      budgetUtilization: totalCost / this.budget,
      rationale
    };
  }

  private computeRedundancy(featureId: string, selectedFeatures: string[]): number {
    if (selectedFeatures.length === 0) return 0;

    const featureValues = this.featureHistory.get(featureId);
    if (!featureValues || featureValues.length < this.minSamples) return 0;

    let maxCorr = 0;
    for (const selectedId of selectedFeatures) {
      const selectedValues = this.featureHistory.get(selectedId);
      if (!selectedValues || selectedValues.length < this.minSamples) continue;

      const corr = Math.abs(this.pearsonCorrelation(featureValues, selectedValues));
      maxCorr = Math.max(maxCorr, corr);
    }

    return maxCorr;
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const xSlice = x.slice(-n);
    const ySlice = y.slice(-n);

    const meanX = xSlice.reduce((sum, val) => sum + val, 0) / n;
    const meanY = ySlice.reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let sumXX = 0;
    let sumYY = 0;

    for (let i = 0; i < n; i++) {
      const deltaX = xSlice[i] - meanX;
      const deltaY = ySlice[i] - meanY;
      numerator += deltaX * deltaY;
      sumXX += deltaX * deltaX;
      sumYY += deltaY * deltaY;
    }

    const denominator = Math.sqrt(sumXX * sumYY);
    return denominator > 0 ? numerator / denominator : 0;
  }

  private tTestPValue(tStat: number, df: number): number {
    // Simplified p-value approximation
    const absTStat = Math.abs(tStat);
    if (df <= 1) return 1.0;
    
    // Rough approximation: p ≈ 2 * (1 - Φ(|t|/√2))
    const standardized = absTStat / Math.sqrt(2);
    const pValue = 2 * (1 - this.standardNormalCDF(standardized));
    return Math.min(1.0, Math.max(0.0, pValue));
  }

  private standardNormalCDF(x: number): number {
    // Approximation of standard normal CDF
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  private erf(x: number): number {
    // Approximation of error function
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  private generateRationale(
    selected: string[],
    correlations: FeatureCorrelation[],
    featureMap: Map<string, FeatureStream>
  ): string {
    if (selected.length === 0) {
      return 'No features met selection criteria under budget constraints';
    }

    const topFeatures = selected
      .map(id => {
        const corr = correlations.find(c => c.featureId === id);
        const feature = featureMap.get(id);
        return { id, corr, feature };
      })
      .filter(f => f.corr && f.feature)
      .sort((a, b) => Math.abs(b.corr!.returnCorrelation) - Math.abs(a.corr!.returnCorrelation))
      .slice(0, 3);

    const descriptions = topFeatures.map(f => 
      `${f.feature!.name} (r=${f.corr!.returnCorrelation.toFixed(3)})`
    );

    return `Selected ${selected.length} features: ${descriptions.join(', ')}`;
  }

  /**
   * Compute current information content of selected features
   */
  async computeInformation(selectedFeatures: string[]): Promise<number> {
    if (selectedFeatures.length === 0 || this.returnHistory.length < this.minSamples) {
      return 0;
    }

    let totalInfo = 0;
    const n = this.returnHistory.length;

    for (const featureId of selectedFeatures) {
      const featureValues = this.featureHistory.get(featureId);
      if (!featureValues || featureValues.length < this.minSamples) continue;

      const correlation = this.pearsonCorrelation(
        featureValues.slice(-n),
        this.returnHistory
      );

      // Information content approximation: I(X;Y) ≈ -0.5 * log(1 - r²)
      const r2 = correlation * correlation;
      const info = r2 > 0.001 ? -0.5 * Math.log(1 - r2) : 0;
      totalInfo += info;
    }

    return totalInfo;
  }

  /**
   * Reset feature history (for backtesting)
   */
  reset(): void {
    this.featureHistory.clear();
    this.returnHistory = [];
  }

  /**
   * Get feature statistics
   */
  getFeatureStats(): {
    featureCount: number;
    historyLength: number;
    returnSamples: number;
  } {
    return {
      featureCount: this.featureHistory.size,
      historyLength: Math.max(...Array.from(this.featureHistory.values()).map(h => h.length), 0),
      returnSamples: this.returnHistory.length
    };
  }
}
