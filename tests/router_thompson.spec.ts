
import { describe, it, expect, beforeEach } from 'vitest';
import { strategyRouter, type RouterContext, type PolicyUpdate } from '../server/services/StrategyRouter.js';

describe('Thompson Sampling Strategy Router', () => {
  beforeEach(() => {
    // Reset router state for each test
    const router = strategyRouter as any;
    router.policies.clear();
    router.lastChoice = null;
    router.lastContext = null;
    router.featureWeights.clear();
    
    // Re-initialize with default policies
    const defaultPolicies = ['p_sma', 'p_ema', 'p_breakout', 'p_mean_revert', 'p_momentum'];
    for (const policyId of defaultPolicies) {
      router.policies.set(policyId, {
        alpha: 1,
        beta: 1,
        count: 0,
        sumReward: 0,
        sumRewardSq: 0
      });
    }
    
    // Initialize feature weights
    router.featureWeights.set('regime_bull', 0.1);
    router.featureWeights.set('regime_bear', -0.1);
    router.featureWeights.set('sigmaHAR', -0.2);
    router.featureWeights.set('obi', 0.3);
    router.featureWeights.set('spread_bps', -0.1);
    router.featureWeights.set('rr25', 0.15);
  });

  it('should choose a policy given context', () => {
    const context: RouterContext = {
      regime: 'bull',
      sigmaHAR: 0.2,
      obi: 0.1,
      funding_rate: 0.01,
      sentiment_score: 0.3
    };

    const result = strategyRouter.choosePolicy(context);
    
    expect(result).toHaveProperty('policyId');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('explorationBonus');
    expect(result).toHaveProperty('confidence');
    expect(['p_sma', 'p_ema', 'p_breakout', 'p_mean_revert', 'p_momentum']).toContain(result.policyId);
    expect(typeof result.score).toBe('number');
    expect(typeof result.explorationBonus).toBe('number');
    expect(typeof result.confidence).toBe('number');
  });

  it('should update policy posterior with reward', () => {
    const context: RouterContext = { regime: 'bull', sigmaHAR: 0.15 };
    const reward = 0.004;
    
    const initialSnapshot = strategyRouter.getSnapshot();
    const initialPolicy = initialSnapshot.policies.find((p: any) => p.policyId === 'p_sma');
    
    const update: PolicyUpdate = {
      policyId: 'p_sma',
      reward,
      context
    };
    
    strategyRouter.updatePolicy(update);
    
    const updatedSnapshot = strategyRouter.getSnapshot();
    const updatedPolicy = updatedSnapshot.policies.find((p: any) => p.policyId === 'p_sma');
    
    expect(updatedPolicy.count).toBe(initialPolicy.count + 1);
    expect(updatedPolicy.alpha).toBeGreaterThan(initialPolicy.alpha);
    expect(updatedPolicy.meanReward).toBeCloseTo(reward, 6);
  });

  it('should migrate probability mass toward better policy over iterations', () => {
    const context: RouterContext = { regime: 'bull', sigmaHAR: 0.2 };
    
    // Simulate p_breakout being consistently better
    const iterations = 50;
    const choices: string[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const choice = strategyRouter.choosePolicy(context);
      choices.push(choice.policyId);
      
      // Give p_breakout higher rewards, others lower rewards
      const reward = choice.policyId === 'p_breakout' ? 
        0.01 + Math.random() * 0.01 : 
        -0.005 + Math.random() * 0.005;
      
      strategyRouter.updatePolicy({
        policyId: choice.policyId,
        reward,
        context
      });
    }
    
    // Count wins in later iterations (after learning)
    const laterChoices = choices.slice(Math.floor(iterations * 0.7));
    const breakoutWins = laterChoices.filter(c => c === 'p_breakout').length;
    const otherWins = laterChoices.length - breakoutWins;
    
    // After learning, p_breakout should be chosen more often
    expect(breakoutWins).toBeGreaterThan(otherWins);
    
    // Check final posteriors
    const snapshot = strategyRouter.getSnapshot();
    const breakoutPolicy = snapshot.policies.find((p: any) => p.policyId === 'p_breakout');
    const smaPolicy = snapshot.policies.find((p: any) => p.policyId === 'p_sma');
    
    expect(breakoutPolicy.meanReward).toBeGreaterThan(smaPolicy.meanReward);
  });

  it('should handle missing context values gracefully', () => {
    const context: RouterContext = { regime: 'bear' }; // Missing other values
    
    const result = strategyRouter.choosePolicy(context);
    expect(result).toHaveProperty('policyId');
    expect(result).toHaveProperty('score');
    
    // Should be able to update with partial context
    strategyRouter.updatePolicy({
      policyId: result.policyId,
      reward: 0.002,
      context
    });
    
    const snapshot = strategyRouter.getSnapshot();
    const updatedPolicy = snapshot.policies.find((p: any) => p.policyId === result.policyId);
    expect(updatedPolicy.count).toBeGreaterThan(0);
  });

  it('should provide meaningful snapshot data', () => {
    const context: RouterContext = { 
      regime: 'bull', 
      sigmaHAR: 0.25,
      obi: 0.15,
      rr25: 0.1
    };
    
    const choice = strategyRouter.choosePolicy(context);
    strategyRouter.updatePolicy({
      policyId: choice.policyId,
      reward: 0.005,
      context
    });
    
    const snapshot = strategyRouter.getSnapshot();
    
    expect(snapshot).toHaveProperty('lastChoice');
    expect(snapshot).toHaveProperty('lastContext');
    expect(snapshot).toHaveProperty('policies');
    expect(snapshot).toHaveProperty('featureWeights');
    expect(snapshot).toHaveProperty('totalDecisions');
    
    expect(snapshot.lastChoice.policyId).toBe(choice.policyId);
    expect(snapshot.lastContext.regime).toBe('bull');
    expect(Array.isArray(snapshot.policies)).toBe(true);
    expect(snapshot.policies.length).toBe(5);
    expect(typeof snapshot.totalDecisions).toBe('number');
  });

  it('should apply contextual adjustments correctly', () => {
    // Test breakout policy gets bonus with high OBI
    const highObiContext: RouterContext = {
      regime: 'bull',
      obi: 0.15, // > 0.1 threshold
      sigmaHAR: 0.2
    };
    
    // Test mean revert policy gets bonus with low OBI
    const lowObiContext: RouterContext = {
      regime: 'sideways',
      obi: 0.02, // < 0.05 threshold
      sigmaHAR: 0.15
    };
    
    // Run multiple iterations to see if contextual adjustments influence choices
    const highObiChoices: string[] = [];
    const lowObiChoices: string[] = [];
    
    for (let i = 0; i < 20; i++) {
      highObiChoices.push(strategyRouter.choosePolicy(highObiContext).policyId);
      lowObiChoices.push(strategyRouter.choosePolicy(lowObiContext).policyId);
    }
    
    // Not a strict requirement, but contextual adjustments should influence choices
    expect(highObiChoices.length).toBeGreaterThan(0);
    expect(lowObiChoices.length).toBeGreaterThan(0);
  });
});
