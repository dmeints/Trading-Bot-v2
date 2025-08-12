
/**
 * Online Feature Selection using minimum Redundancy Maximum Relevance (mRMR)
 * Dynamically selects most informative features for trading decisions
 */

import { logger } from '../utils/logger';

export interface FeatureImportance {
  featureId: string;
  relevanceScore: number;
  redundancyScore: number;
  mrmrScore: number;
  lastUpdated: Date;
}

export interface OnlineFeatureSelectionConfig {
  maxFeatures: number;
  relevanceWeight: number;
  redundancyWeight: number;
  updateThreshold: number;
  windowSize: number;
}

export class OnlineFeatureSelector {
  private featureImportances: Map<string, FeatureImportance> = new Map();
  private featureCorrelations: Map<string, Map<string, number>> = new Map();
  private targetCorrelations: Map<string, number> = new Map();
  private sampleCount: number = 0;
  private config: OnlineFeatureSelectionConfig;

  constructor(config: Partial<OnlineFeatureSelectionConfig> = {}) {
    this.config = {
      maxFeatures: 20,
      relevanceWeight: 0.7,
      redundancyWeight: 0.3,
      updateThreshold: 0.01,
      windowSize: 1000,
      ...config
    };
  }

  /**
   * Update feature selection with new sample
   */
  updateFeatureSelection(
    features: Record<string, number>,
    target: number
  ): string[] {
    this.sampleCount++;
    
    // Update target correlations (relevance)
    this.updateTargetCorrelations(features, target);
    
    // Update feature-feature correlations (redundancy)
    this.updateFeatureCorrelations(features);
    
    // Recalculate mRMR scores
    this.updateMRMRScores();
    
    // Select top features
    const selectedFeatures = this.selectTopFeatures();
    
    logger.debug('[OnlineFeatureSelector] Updated selection', {
      totalFeatures: Object.keys(features).length,
      selectedCount: selectedFeatures.length,
      sampleCount: this.sampleCount
    });
    
    return selectedFeatures;
  }

  private updateTargetCorrelations(
    features: Record<string, number>,
    target: number
  ): void {
    for (const [featureId, value] of Object.entries(features)) {
      const currentCorr = this.targetCorrelations.get(featureId) || 0;
      
      // Online correlation update using Welford's method
      const newCorr = this.updateCorrelationOnline(currentCorr, value, target);
      this.targetCorrelations.set(featureId, newCorr);
    }
  }

  private updateFeatureCorrelations(features: Record<string, number>): void {
    const featureIds = Object.keys(features);
    
    for (let i = 0; i < featureIds.length; i++) {
      const featureA = featureIds[i];
      const valueA = features[featureA];
      
      if (!this.featureCorrelations.has(featureA)) {
        this.featureCorrelations.set(featureA, new Map());
      }
      
      for (let j = i + 1; j < featureIds.length; j++) {
        const featureB = featureIds[j];
        const valueB = features[featureB];
        
        const corrMap = this.featureCorrelations.get(featureA)!;
        const currentCorr = corrMap.get(featureB) || 0;
        
        const newCorr = this.updateCorrelationOnline(currentCorr, valueA, valueB);
        corrMap.set(featureB, newCorr);
        
        // Symmetric update
        if (!this.featureCorrelations.has(featureB)) {
          this.featureCorrelations.set(featureB, new Map());
        }
        this.featureCorrelations.get(featureB)!.set(featureA, newCorr);
      }
    }
  }

  private updateCorrelationOnline(
    currentCorr: number,
    valueA: number,
    valueB: number
  ): number {
    // Simplified online correlation update
    // In production, this would use proper running correlation calculation
    const alpha = 1.0 / Math.min(this.sampleCount, this.config.windowSize);
    const instantCorr = valueA * valueB; // Simplified correlation proxy
    
    return currentCorr * (1 - alpha) + instantCorr * alpha;
  }

  private updateMRMRScores(): void {
    for (const [featureId] of this.targetCorrelations) {
      const relevanceScore = Math.abs(this.targetCorrelations.get(featureId) || 0);
      
      // Calculate average redundancy with other features
      const featureCorrs = this.featureCorrelations.get(featureId) || new Map();
      let redundancySum = 0;
      let redundancyCount = 0;
      
      for (const [otherFeature, correlation] of featureCorrs) {
        if (otherFeature !== featureId) {
          redundancySum += Math.abs(correlation);
          redundancyCount++;
        }
      }
      
      const redundancyScore = redundancyCount > 0 ? redundancySum / redundancyCount : 0;
      
      // mRMR score: maximize relevance, minimize redundancy
      const mrmrScore = this.config.relevanceWeight * relevanceScore - 
                       this.config.redundancyWeight * redundancyScore;
      
      this.featureImportances.set(featureId, {
        featureId,
        relevanceScore,
        redundancyScore,
        mrmrScore,
        lastUpdated: new Date()
      });
    }
  }

  private selectTopFeatures(): string[] {
    const sortedFeatures = Array.from(this.featureImportances.values())
      .sort((a, b) => b.mrmrScore - a.mrmrScore)
      .slice(0, this.config.maxFeatures);
    
    return sortedFeatures.map(f => f.featureId);
  }

  /**
   * Get feature importance scores
   */
  getFeatureImportances(): FeatureImportance[] {
    return Array.from(this.featureImportances.values())
      .sort((a, b) => b.mrmrScore - a.mrmrScore);
  }

  /**
   * Get currently selected features
   */
  getSelectedFeatures(): string[] {
    return this.selectTopFeatures();
  }

  /**
   * Reset feature selection state
   */
  reset(): void {
    this.featureImportances.clear();
    this.featureCorrelations.clear();
    this.targetCorrelations.clear();
    this.sampleCount = 0;
    
    logger.info('[OnlineFeatureSelector] Reset feature selection state');
  }

  /**
   * Export state for persistence
   */
  exportState(): {
    featureImportances: FeatureImportance[];
    sampleCount: number;
    config: OnlineFeatureSelectionConfig;
  } {
    return {
      featureImportances: Array.from(this.featureImportances.values()),
      sampleCount: this.sampleCount,
      config: this.config
    };
  }

  /**
   * Import state from persistence
   */
  importState(state: {
    featureImportances: FeatureImportance[];
    sampleCount: number;
    config: OnlineFeatureSelectionConfig;
  }): void {
    this.featureImportances.clear();
    state.featureImportances.forEach(importance => {
      this.featureImportances.set(importance.featureId, importance);
    });
    
    this.sampleCount = state.sampleCount;
    this.config = { ...this.config, ...state.config };
    
    logger.info('[OnlineFeatureSelector] Imported feature selection state', {
      featuresCount: state.featureImportances.length,
      sampleCount: state.sampleCount
    });
  }
}
