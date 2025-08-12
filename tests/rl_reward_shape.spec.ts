
import { describe, it, expect, beforeEach } from 'vitest';
import { RiskAwarePPO } from '../server/services/stevieRL';

describe('Risk-Aware PPO', () => {
  let ppo: RiskAwarePPO;

  beforeEach(() => {
    ppo = new RiskAwarePPO({
      lambda_tc: 0.1,
      gamma_dd: 2.0,
      cvar_threshold: -0.05,
      num_quantiles: 21
    });
  });

  it('should compute shaped reward with penalties', () => {
    const logEquityChange = 0.01; // 1% return
    const transactionCost = 0.002; // 0.2% TC
    const equityLevel = 101000; // $101k
    
    const reward = ppo.computeShapedReward(logEquityChange, transactionCost, equityLevel);
    
    // Should be positive return minus TC penalty
    expect(reward).toBeLessThan(logEquityChange); // TC penalty applied
    expect(typeof reward).toBe('number');
    expect(isFinite(reward)).toBe(true);
  });

  it('should penalize drawdowns', () => {
    // First, create a peak
    const reward1 = ppo.computeShapedReward(0.02, 0.001, 102000); // Peak
    
    // Then create a drawdown
    const reward2 = ppo.computeShapedReward(-0.01, 0.001, 101000); // Drawdown
    
    // Drawdown reward should have additional penalty
    expect(reward2).toBeLessThan(-0.01 - 0.1 * 0.001); // More negative due to DD penalty
  });

  it('should compute quantile loss correctly', () => {
    const predicted_quantiles = [];
    for (let i = 0; i < 21; i++) {
      predicted_quantiles.push((i - 10) * 0.001); // -1% to 1% range
    }
    
    const target_return = 0.002; // 0.2% actual return
    const loss = ppo.computeQuantileLoss(predicted_quantiles, target_return);
    
    expect(typeof loss).toBe('number');
    expect(isFinite(loss)).toBe(true);
    expect(loss).toBeGreaterThanOrEqual(0); // Loss should be non-negative
  });

  it('should compute CVaR correctly', () => {
    const returns = [-0.05, -0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03, 0.04, 0.05];
    const cvar = ppo.computeCVaR(returns, 0.2); // 20% CVaR (bottom 2 returns)
    
    // Should be average of worst 20% (-0.05, -0.03)
    const expected = (-0.05 + -0.03) / 2;
    expect(cvar).toBeCloseTo(expected, 3);
  });

  it('should track CVaR during training', () => {
    const metrics = ppo.trainStep(true); // Dry run
    
    expect(metrics).toHaveProperty('cvarAt5');
    expect(metrics).toHaveProperty('episodeReturn');
    expect(metrics).toHaveProperty('transactionCosts');
    expect(metrics).toHaveProperty('maxDrawdown');
    expect(metrics).toHaveProperty('sharpeRatio');
    expect(metrics).toHaveProperty('episodeLength');
    
    expect(typeof metrics.cvarAt5).toBe('number');
    expect(isFinite(metrics.cvarAt5)).toBe(true);
  });

  it('should generate valid quantile predictions', () => {
    const state = [0.1, 0.2, 0.3]; // Mock state
    const quantiles = ppo.predictQuantiles(state);
    
    expect(quantiles).toHaveLength(21);
    
    // Should be monotonically increasing
    for (let i = 1; i < quantiles.length; i++) {
      expect(quantiles[i]).toBeGreaterThanOrEqual(quantiles[i - 1]);
    }
  });

  it('should handle edge cases in reward computation', () => {
    // Zero equity change
    const reward1 = ppo.computeShapedReward(0, 0.001, 100000);
    expect(isFinite(reward1)).toBe(true);
    
    // Large equity change
    const reward2 = ppo.computeShapedReward(0.1, 0.01, 110000);
    expect(isFinite(reward2)).toBe(true);
    
    // Negative equity change
    const reward3 = ppo.computeShapedReward(-0.05, 0.002, 95000);
    expect(isFinite(reward3)).toBe(true);
  });

  it('should maintain reasonable CVaR values over multiple episodes', () => {
    const cvarValues: number[] = [];
    
    for (let i = 0; i < 5; i++) {
      const metrics = ppo.trainStep(true);
      cvarValues.push(metrics.cvarAt5);
    }
    
    // All CVaR values should be reasonable (typically negative)
    for (const cvar of cvarValues) {
      expect(isFinite(cvar)).toBe(true);
      expect(cvar).toBeGreaterThan(-1); // Not worse than -100%
      expect(cvar).toBeLessThan(1); // Should be reasonable
    }
  });
});
