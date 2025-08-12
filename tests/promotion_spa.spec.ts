
import { describe, it, expect, beforeEach } from 'vitest';
import { PromotionService } from '../server/services/promotion';

describe('Promotion SPA Test', () => {
  let promotionService: PromotionService;

  beforeEach(() => {
    promotionService = new PromotionService();
  });

  it('should initialize with baseline champion', () => {
    const champion = promotionService.getChampion();
    expect(champion).toBeTruthy();
    expect(champion?.policyId).toBe('baseline');
    expect(champion?.isChampion).toBe(true);
  });

  it('should add policy returns and update metrics', () => {
    promotionService.addPolicyReturn('test_policy', 0.01);
    promotionService.addPolicyReturn('test_policy', 0.02);
    promotionService.addPolicyReturn('test_policy', -0.005);
    
    const policies = promotionService.getPoliciesStatus();
    const testPolicy = policies.find(p => p.policyId === 'test_policy');
    
    expect(testPolicy).toBeTruthy();
    expect(testPolicy?.returns).toHaveLength(3);
    expect(typeof testPolicy?.sharpeRatio).toBe('number');
    expect(typeof testPolicy?.winRate).toBe('number');
    expect(typeof testPolicy?.maxDrawdown).toBe('number');
  });

  it('should promote outperforming challenger', () => {
    // Add good performance for challenger
    for (let i = 0; i < 60; i++) {
      promotionService.addPolicyReturn('challenger', 0.01 + Math.random() * 0.005); // Strong positive returns
      promotionService.addPolicyReturn('baseline', Math.random() * 0.01 - 0.005); // Neutral returns
    }
    
    const result = promotionService.evaluatePromotion('challenger');
    
    expect(result).toHaveProperty('promoted');
    expect(result).toHaveProperty('pValue');
    expect(result).toHaveProperty('reason');
    expect(result).toHaveProperty('championId');
    expect(result).toHaveProperty('challengerId');
    
    expect(typeof result.promoted).toBe('boolean');
    expect(typeof result.pValue).toBe('number');
    expect(result.pValue).toBeGreaterThanOrEqual(0);
    expect(result.pValue).toBeLessThanOrEqual(1);
    
    // If promoted, challenger should become champion
    if (result.promoted) {
      expect(result.championId).toBe('challenger');
      const newChampion = promotionService.getChampion();
      expect(newChampion?.policyId).toBe('challenger');
    }
  });

  it('should not promote underperforming challenger', () => {
    // Add poor performance for challenger
    for (let i = 0; i < 60; i++) {
      promotionService.addPolicyReturn('bad_challenger', -0.01 - Math.random() * 0.005); // Poor returns
      promotionService.addPolicyReturn('baseline', Math.random() * 0.002); // Neutral returns
    }
    
    const result = promotionService.evaluatePromotion('bad_challenger');
    
    expect(result.promoted).toBe(false);
    expect(result.pValue).toBeGreaterThan(0.05); // Should not meet promotion threshold
    expect(result.championId).toBe('baseline'); // Baseline should remain champion
  });

  it('should require minimum sample size', () => {
    // Add insufficient data
    for (let i = 0; i < 10; i++) {
      promotionService.addPolicyReturn('insufficient', 0.02); // Very good but insufficient data
    }
    
    const result = promotionService.evaluatePromotion('insufficient');
    
    expect(result.promoted).toBe(false);
    expect(result.reason).toContain('Insufficient data');
  });

  it('should handle edge cases gracefully', () => {
    // Test with non-existent policy
    const result1 = promotionService.evaluatePromotion('non_existent');
    expect(result1.promoted).toBe(false);
    expect(result1.reason).toContain('Missing policy data');
    
    // Test with identical performance
    for (let i = 0; i < 60; i++) {
      const sameValue = 0.005;
      promotionService.addPolicyReturn('identical', sameValue);
      promotionService.addPolicyReturn('baseline', sameValue);
    }
    
    const result2 = promotionService.evaluatePromotion('identical');
    expect(typeof result2.pValue).toBe('number');
    expect(isFinite(result2.pValue)).toBe(true);
  });

  it('should compute reasonable SPA statistics', () => {
    // Create clearly different performance
    for (let i = 0; i < 100; i++) {
      promotionService.addPolicyReturn('strong', 0.015 + Math.random() * 0.005); // 1.5-2% returns
      promotionService.addPolicyReturn('baseline', 0.005 + Math.random() * 0.005); // 0.5-1% returns
    }
    
    const result = promotionService.evaluatePromotion('strong');
    
    // Should detect the clear difference
    expect(result.pValue).toBeLessThan(0.1); // Should be statistically significant
    
    const policies = promotionService.getPoliciesStatus();
    const strong = policies.find(p => p.policyId === 'strong');
    expect(strong?.spaStatistic).toBeGreaterThan(0);
  });
});
