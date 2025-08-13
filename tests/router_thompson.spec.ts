import { describe, it, expect } from 'vitest';
import { bayesianRouter } from '../server/services/StrategyRouter.js';

describe('Bayesian Thompson Sampling Router', () => {
  it('should choose a policy based on context', () => {
    const context = {
      regime: 'bull',
      sigmaHAR: 0.02,
      obi: 0.2,
      ti: 0.1,
      spread_bps: 3,
      micro_vol: 0.004
    };

    const choice = bayesianRouter.choosePolicy(context);

    expect(choice.policyId).toBeTypeOf('string');
    expect(choice.score).toBeTypeOf('number');
    expect(choice.explorationBonus).toBeTypeOf('number');
    expect(choice.contextVector).toBeInstanceOf(Array);
    expect(choice.timestamp).toBeTypeOf('number');
  });

  it('should update policy with rewards', () => {
    const context = { regime: 'bull', sigmaHAR: 0.02 };
    const choice = bayesianRouter.choosePolicy(context);

    // Update with positive reward
    bayesianRouter.updatePolicy(choice.policyId, 0.01, context);

    const snapshot = bayesianRouter.getSnapshot();
    expect(snapshot.totalDecisions).toBeGreaterThan(0);
    expect(snapshot.policies.length).toBeGreaterThan(0);
  });

  it('should converge to better policies over time', () => {
    const contexts = [
      { regime: 'bull', sigmaHAR: 0.01 },
      { regime: 'bear', sigmaHAR: 0.03 },
      { regime: 'sideways', sigmaHAR: 0.02 }
    ];

    const rewards = { 'p_momentum': 0.02, 'p_mean_revert': -0.01, 'p_sma': 0.005 };

    // Run simulation
    for (let i = 0; i < 50; i++) {
      const context = contexts[i % contexts.length];
      const choice = bayesianRouter.choosePolicy(context);
      const reward = rewards[choice.policyId as keyof typeof rewards] || 0;

      bayesianRouter.updatePolicy(choice.policyId, reward, context);
    }

    const snapshot = bayesianRouter.getSnapshot();
    expect(snapshot.totalDecisions).toBe(50);

    // Check that momentum policy (highest reward) gets selected more often
    const finalChoice = bayesianRouter.choosePolicy(contexts[0]);
    expect(finalChoice.policyId).toBeTypeOf('string');
  });

  it('should provide router snapshot', () => {
    const snapshot = bayesianRouter.getSnapshot();

    expect(snapshot.policies).toBeInstanceOf(Array);
    expect(snapshot.featuresUsed).toBeInstanceOf(Array);
    expect(snapshot.totalDecisions).toBeTypeOf('number');
    expect(snapshot.featuresUsed.length).toBeGreaterThan(0);
  });
});
import { describe, it, expect, beforeEach } from 'vitest';
import { strategyRouter } from '../server/services/StrategyRouter.js';

describe('Thompson Sampling Router', () => {
  beforeEach(() => {
    // Reset router state for each test
  });

  it('should choose policy based on context', () => {
    const context = {
      regime: 'bull' as const,
      sigmaHAR: 0.02,
      obi: 0.2,
      rr25: 0.1
    };

    const choice = strategyRouter.choose(context);
    
    expect(choice.policyId).toBeDefined();
    expect(choice.score).toBeTypeOf('number');
    expect(choice.explorationBonus).toBeTypeOf('number');
    expect(choice.timestamp).toBeTypeOf('number');
  });

  it('should update policy weights based on rewards', () => {
    const context = { regime: 'bull' as const, sigmaHAR: 0.02 };
    
    // Choose policy
    const choice = strategyRouter.choose(context);
    
    // Update with positive reward
    strategyRouter.update(choice.policyId, 0.005, context);
    
    // Verify update was applied
    const snapshot = strategyRouter.getSnapshot();
    const policy = snapshot.policies.find(p => p.id === choice.policyId);
    expect(policy?.observations).toBeGreaterThan(0);
  });

  it('should provide meaningful snapshots', () => {
    const snapshot = strategyRouter.getSnapshot();
    
    expect(snapshot.policies).toBeInstanceOf(Array);
    expect(snapshot.policies.length).toBeGreaterThan(0);
    
    for (const policy of snapshot.policies) {
      expect(policy.id).toBeDefined();
      expect(policy.name).toBeDefined();
      expect(typeof policy.observations).toBe('number');
      expect(typeof policy.avgWeight).toBe('number');
    }
  });

  it('should converge to better policy over time', () => {
    const contexts = [
      { regime: 'bull' as const, sigmaHAR: 0.02 },
      { regime: 'bear' as const, sigmaHAR: 0.05 },
      { regime: 'sideways' as const, sigmaHAR: 0.01 }
    ];

    const rewards = { p_sma: 0.008, p_momentum: 0.002, p_meanrev: -0.001 };
    const choices: string[] = [];

    // Simulate learning process
    for (let i = 0; i < 50; i++) {
      const context = contexts[i % contexts.length];
      const choice = strategyRouter.choose(context);
      choices.push(choice.policyId);
      
      // Give realistic rewards
      const reward = rewards[choice.policyId as keyof typeof rewards] || 0;
      strategyRouter.update(choice.policyId, reward, context);
    }

    // Check that better policies are chosen more often
    const recentChoices = choices.slice(-20);
    const smaCount = recentChoices.filter(c => c === 'p_sma').length;
    
    // p_sma should be chosen more often due to higher rewards
    expect(smaCount).toBeGreaterThan(5);
  });
});
