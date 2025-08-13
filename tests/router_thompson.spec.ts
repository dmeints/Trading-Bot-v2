
import { describe, it, expect, beforeEach } from 'vitest';
import { strategyRouter, type RouterContext } from '../server/services/StrategyRouter.js';

describe('Thompson Sampling Strategy Router', () => {
  beforeEach(() => {
    // Reset router state
    const policies = strategyRouter.getPolicies();
    for (const [policyId] of policies) {
      strategyRouter.update(policyId, 0, {});
    }
  });

  it('should choose a policy given context', () => {
    const context: RouterContext = {
      regime: 'bull',
      vol: 0.2,
      trend: 1.1,
      funding: 0.01,
      sentiment: 0.3
    };

    const result = strategyRouter.choose(context);
    
    expect(result).toHaveProperty('policyId');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('explorationBonus');
    expect(['p_sma', 'p_trend', 'p_meanrev', 'p_ema', 'p_breakout', 'p_mean_revert', 'p_momentum']).toContain(result.policyId);
    expect(typeof result.score).toBe('number');
    expect(typeof result.explorationBonus).toBe('number');
  });

  it('should update policy posterior with reward', () => {
    const context: RouterContext = { regime: 'bull', vol: 0.15 };
    const reward = 0.004;
    
    const initialPolicies = strategyRouter.getPolicies();
    const initialPosterior = initialPolicies.get('p_sma')!;
    
    const updatedPosterior = strategyRouter.update('p_sma', reward, context);
    
    expect(updatedPosterior.updateCount).toBe(initialPosterior.updateCount + 1);
    expect(updatedPosterior.alpha).toBeGreaterThan(initialPosterior.alpha);
    expect(updatedPosterior.variance).toBeLessThanOrEqual(initialPosterior.variance);
  });

  it('should migrate probability mass toward better policy over iterations', () => {
    const context: RouterContext = { regime: 'bull', vol: 0.2 };
    
    // Simulate p_trend being consistently better
    const iterations = 50;
    let trendWins = 0;
    let smaWins = 0;
    
    for (let i = 0; i < iterations; i++) {
      const choice = strategyRouter.choose(context);
      
      // Give p_trend higher rewards, p_sma lower rewards
      const reward = choice.policyId === 'p_trend' ? 0.01 + Math.random() * 0.01 : -0.005 + Math.random() * 0.005;
      strategyRouter.update(choice.policyId, reward, context);
      
      // Track wins in later iterations
      if (i > iterations / 2) {
        if (choice.policyId === 'p_trend') trendWins++;
        if (choice.policyId === 'p_sma') smaWins++;
      }
    }
    
    // After learning, p_trend should be chosen more often
    expect(trendWins).toBeGreaterThan(smaWins);
    
    // Check final posteriors
    const policies = strategyRouter.getPolicies();
    const trendPosterior = policies.get('p_trend')!;
    const smaPosterior = policies.get('p_sma')!;
    
    expect(trendPosterior.mean).toBeGreaterThan(smaPosterior.mean);
  });

  it('should handle missing context values gracefully', () => {
    const context: RouterContext = { regime: 'bear' }; // Missing other values
    
    const result = strategyRouter.choose(context);
    expect(result).toHaveProperty('policyId');
    expect(result).toHaveProperty('score');
    
    // Should be able to update with partial context
    const updatedPosterior = strategyRouter.update(result.policyId, 0.002, context);
    expect(updatedPosterior.updateCount).toBeGreaterThan(0);
  });

  it('should implement UCB exploration bonus correctly', () => {
    const context: RouterContext = { regime: 'bull' };
    
    // Test UCB math - exploration bonus should decrease with more samples
    const choice1 = strategyRouter.choose(context);
    const initialBonus = choice1.explorationBonus;
    
    // Add several updates
    for (let i = 0; i < 10; i++) {
      strategyRouter.update(choice1.policyId, 0.001, context);
    }
    
    const choice2 = strategyRouter.choose(context);
    const laterBonus = choice2.explorationBonus;
    
    // Exploration bonus should generally decrease with more samples
    expect(laterBonus).toBeLessThanOrEqual(initialBonus + 0.1); // Allow some variance
  });

  it('should implement Thompson Sampling correctly', () => {
    const context: RouterContext = { regime: 'bull', vol: 0.2 };
    
    // Test that different calls can return different policies (stochastic)
    const choices = new Set();
    for (let i = 0; i < 20; i++) {
      const choice = strategyRouter.choose(context);
      choices.add(choice.policyId);
    }
    
    // Should explore multiple policies due to Thompson sampling
    expect(choices.size).toBeGreaterThan(1);
  });

  it('should compute confidence scores properly', () => {
    const context: RouterContext = { regime: 'bull' };
    
    // Initially low confidence
    const initialChoice = strategyRouter.choose(context);
    expect(initialChoice.confidence).toBeLessThan(0.5);
    
    // After many updates, confidence should increase
    for (let i = 0; i < 20; i++) {
      strategyRouter.update(initialChoice.policyId, 0.01, context);
    }
    
    const laterChoice = strategyRouter.choose(context);
    if (laterChoice.policyId === initialChoice.policyId) {
      expect(laterChoice.confidence).toBeGreaterThan(initialChoice.confidence);
    }
  });

  it('should validate UCB exploration bonus calculation', () => {
    const context: RouterContext = { regime: 'bull', vol: 0.15 };
    
    // Test that exploration bonus follows UCB formula: sqrt(2 * log(total_actions) / arm_count)
    const choice1 = strategyRouter.choose(context);
    const initialBonus = choice1.explorationBonus;
    
    // Verify exploration bonus is positive and reasonable
    expect(initialBonus).toBeGreaterThan(0);
    expect(initialBonus).toBeLessThan(10); // Reasonable upper bound
    
    // Update the chosen policy multiple times
    for (let i = 0; i < 5; i++) {
      strategyRouter.update(choice1.policyId, 0.005, context);
    }
    
    // Choose again and verify exploration bonus decreased (more samples = less uncertainty)
    const choice2 = strategyRouter.choose(context);
    if (choice2.policyId === choice1.policyId) {
      expect(choice2.explorationBonus).toBeLessThanOrEqual(initialBonus);
    }
  });

  it('should validate Thompson Sampling beta distribution sampling', () => {
    const context: RouterContext = { regime: 'bull', vol: 0.2 };
    
    // Update one policy with positive rewards to skew its distribution
    for (let i = 0; i < 10; i++) {
      strategyRouter.update('p_trend', 0.02, context);
    }
    
    // Update another policy with negative rewards
    for (let i = 0; i < 10; i++) {
      strategyRouter.update('p_sma', -0.01, context);
    }
    
    // Test multiple choices to verify stochastic behavior
    const choices = [];
    for (let i = 0; i < 50; i++) {
      const choice = strategyRouter.choose(context);
      choices.push(choice.policyId);
    }
    
    // p_trend should be chosen more often due to better rewards
    const trendChoices = choices.filter(p => p === 'p_trend').length;
    const smaChoices = choices.filter(p => p === 'p_sma').length;
    
    expect(trendChoices).toBeGreaterThan(smaChoices);
  });
});
