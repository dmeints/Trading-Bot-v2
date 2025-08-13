
import { featureGating, FeatureRanking } from '../../../tools/features/gating.js';

export { FeatureRanking } from '../../../tools/features/gating.js';

export class FeatureStore {
  getRanking(): FeatureRanking[] {
    return featureGating.getRanking();
  }

  updateIC(feature: string, ic: number): void {
    // This would update feature values in real implementation
    featureGating.updateFeatureValue(feature, ic);
  }

  updateReturn(returnValue: number): void {
    featureGating.updateReturn(returnValue);
  }

  isEnabled(feature: string): boolean {
    return featureGating.isFeatureEnabled(feature);
  }
}

export const featureStore = new FeatureStore();
