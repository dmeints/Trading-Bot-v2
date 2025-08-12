
import { describe, it, expect, beforeEach } from 'vitest';
import { StrategyRouter, Context } from '../server/services/StrategyRouter';

describe('Thompson Sampling Strategy Router', () => {
  let router: StrategyRouter;

  beforeEach(() => {
    router = new StrategyRouter();
  });

  it('should choose a policy given context', () => {
    const context: Context = {
      regime: 'bull',
      vol: 0.2,
      trend: 1.1,
      funding: 0.01,
      sentiment: 0.3
    };

    const result = router.choose(context);
    
    expect(result).toHaveProperty('policyId');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('explorationBonus');
    expect(['p_sma', 'p_trend', 'p_meanrev']).toContain(result.policyId);
    expect(typeof result.score).toBe('number');
    expect(typeof result.explorationBonus).toBe('number');
  });

  it('should update policy posterior with reward', () => {
    const context: Context = { regime: 'bull', vol: 0.15 };
    const reward = 0.004;
    
    const initialPolicies = router.getPolicies();
    const initialPosterior = initialPolicies.get('p_sma')!;
    
    const updatedPosterior = router.update('p_sma', reward, context);
    
    expect(updatedPosterior.updateCount).toBe(initialPosterior.updateCount + 1);
    expect(updatedPosterior.alpha).toBeGreaterThan(initialPosterior.alpha);
    expect(updatedPosterior.variance).toBeLessThan(initialPosterior.variance);
  });

  it('should migrate probability mass toward better policy over iterations', () => {
    const context: Context = { regime: 'bull', vol: 0.2 };
    
    // Simulate p_trend being consistently better
    const iterations = 50;
    let trendWins = 0;
    let smaWins = 0;
    
    for (let i = 0; i < iterations; i++) {
      const choice = router.choose(context);
      
      // Give p_trend higher rewards, p_sma lower rewards
      const reward = choice.policyId === 'p_trend' ? 0.01 + Math.random() * 0.01 : -0.005 + Math.random() * 0.005;
      router.update(choice.policyId, reward, context);
      
      // Track wins in later iterations
      if (i > iterations / 2) {
        if (choice.policyId === 'p_trend') trendWins++;
        if (choice.policyId === 'p_sma') smaWins++;
      }
    }
    
    // After learning, p_trend should be chosen more often
    expect(trendWins).toBeGreaterThan(smaWins);
    
    // Check final posteriors
    const policies = router.getPolicies();
    const trendPosterior = policies.get('p_trend')!;
    const smaPosterior = policies.get('p_sma')!;
    
    expect(trendPosterior.mean).toBeGreaterThan(smaPosterior.mean);
  });

  it('should handle missing context values gracefully', () => {
    const context: Context = { regime: 'bear' }; // Missing other values
    
    const result = router.choose(context);
    expect(result).toHaveProperty('policyId');
    expect(result).toHaveProperty('score');
    
    // Should be able to update with partial context
    const updatedPosterior = router.update(result.policyId, 0.002, context);
    expect(updatedPosterior.updateCount).toBeGreaterThan(0);
  });
});
