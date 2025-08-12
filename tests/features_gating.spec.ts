
import { describe, it, expect, beforeEach } from 'vitest';
import { FeatureGating } from '../tools/features/gating';

describe('Feature Gating', () => {
  let gating: FeatureGating;

  beforeEach(() => {
    gating = new FeatureGating();
  });

  it('should add features and returns', () => {
    gating.addFeature('test_feature', 0.5);
    gating.addReturn(0.01);
    
    expect(gating.isFeatureEnabled('test_feature')).toBe(true);
  });

  it('should rank features by predictive power', () => {
    // Add predictive feature that correlates with returns
    for (let i = 0; i < 20; i++) {
      const signal = i * 0.01; // Trending signal
      const return_ = signal * 0.8 + Math.random() * 0.005; // Correlated return
      
      gating.addFeature('predictive_feature', signal);
      gating.addFeature('noise_feature', Math.random() * 2 - 1); // Random noise
      gating.addReturn(return_);
    }
    
    const ranking = gating.getFeatureRanking();
    expect(ranking.length).toBeGreaterThan(0);
    
    // Each feature should have required properties
    for (const score of ranking) {
      expect(score).toHaveProperty('feature');
      expect(score).toHaveProperty('ic');
      expect(score).toHaveProperty('hsic');
      expect(score).toHaveProperty('score');
      expect(score).toHaveProperty('disabled');
      expect(typeof score.ic).toBe('number');
      expect(typeof score.hsic).toBe('number');
      expect(typeof score.score).toBe('number');
      expect(typeof score.disabled).toBe('boolean');
    }
  });

  it('should disable bottom decile features', () => {
    // Add many features with varying predictive power
    const numFeatures = 10;
    
    for (let f = 0; f < numFeatures; f++) {
      for (let i = 0; i < 15; i++) {
        const signal = f < 5 ? Math.random() * 0.01 : Math.random() * 2 - 1; // First 5 are more predictive
        const return_ = f < 5 ? signal * 0.5 : Math.random() * 0.02 - 0.01;
        
        gating.addFeature(`feature_${f}`, signal);
        if (f === 0) { // Only add return once per iteration
          gating.addReturn(return_);
        }
      }
    }
    
    const ranking = gating.getFeatureRanking();
    
    if (ranking.length >= 10) {
      const disabledCount = ranking.filter(r => r.disabled).length;
      expect(disabledCount).toBeGreaterThan(0); // At least some should be disabled
      expect(disabledCount).toBeLessThanOrEqual(Math.floor(ranking.length * 0.1) + 1);
    }
  });

  it('should compute information coefficient correctly', () => {
    // Create a clearly predictive feature
    for (let i = 0; i < 30; i++) {
      const predictiveValue = i * 0.001; // Increasing trend
      const futureReturn = predictiveValue * 2 + Math.random() * 0.0001; // Strongly correlated
      
      gating.addFeature('strong_predictor', predictiveValue);
      gating.addReturn(futureReturn);
    }
    
    // Add noise feature
    for (let i = 0; i < 30; i++) {
      gating.addFeature('noise', Math.random() * 2 - 1);
    }
    
    const ranking = gating.getFeatureRanking();
    const strongPredictor = ranking.find(r => r.feature === 'strong_predictor');
    const noiseFeature = ranking.find(r => r.feature === 'noise');
    
    if (strongPredictor && noiseFeature) {
      expect(Math.abs(strongPredictor.ic)).toBeGreaterThan(Math.abs(noiseFeature.ic));
    }
  });

  it('should handle edge cases gracefully', () => {
    // Test with no data
    let ranking = gating.getFeatureRanking();
    expect(Array.isArray(ranking)).toBe(true);
    
    // Test with minimal data
    gating.addFeature('minimal', 1);
    gating.addReturn(0.01);
    
    ranking = gating.getFeatureRanking();
    expect(Array.isArray(ranking)).toBe(true);
    
    // Test with identical values
    for (let i = 0; i < 10; i++) {
      gating.addFeature('constant', 1.0);
      gating.addReturn(0.0);
    }
    
    ranking = gating.getFeatureRanking();
    const constant = ranking.find(r => r.feature === 'constant');
    if (constant) {
      expect(typeof constant.ic).toBe('number');
      expect(isFinite(constant.ic)).toBe(true);
    }
  });
});
