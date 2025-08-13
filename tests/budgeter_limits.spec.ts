
import { describe, it, expect, beforeEach } from '@jest/globals';
import { Budgeter } from '../server/services/Budgeter';

describe('Budgeter Limits', () => {
  let budgeter: Budgeter;

  beforeEach(() => {
    budgeter = new Budgeter();
  });

  it('should enforce rate limits', async () => {
    const provider = 'binance';
    
    // Check initial budget
    const initial = budgeter.checkBudget({ provider, kind: 'test' });
    expect(initial.allowed).toBe(true);

    // Simulate rapid requests to exhaust rate limit
    for (let i = 0; i < 1200; i++) {
      await budgeter.request(provider, 'test', async () => 'success');
    }

    // Should now be rate limited
    const afterExhaustion = budgeter.checkBudget({ provider, kind: 'test' });
    expect(afterExhaustion.allowed).toBe(false);
    expect(afterExhaustion.reason).toContain('Rate limit');
  });

  it('should track cost limits', () => {
    const provider = 'coingecko';
    
    // Check budget with high cost request
    const result = budgeter.checkBudget({ 
      provider, 
      kind: 'test', 
      estimatedCost: 10 
    });
    
    // Should suggest fallback due to cost
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Cost budget');
    expect(result.fallbackProvider).toBeDefined();
  });

  it('should provide fallback providers', () => {
    const provider = 'coingecko';
    
    const result = budgeter.checkBudget({ 
      provider, 
      kind: 'test', 
      estimatedCost: 10 
    });
    
    if (result.fallbackProvider) {
      expect(['coinbase', 'binance']).toContain(result.fallbackProvider);
    }
  });

  it('should reset rate limits over time', (done) => {
    const provider = 'binance';
    
    // Exhaust rate limit
    const status = budgeter.getProviderStatus(provider);
    if (status) {
      status.rateRemaining = 0;
      status.resetAt = Date.now() + 100; // Reset in 100ms
    }

    // Check that it's limited
    const limited = budgeter.checkBudget({ provider, kind: 'test' });
    expect(limited.allowed).toBe(false);

    // Wait for reset
    setTimeout(() => {
      const afterReset = budgeter.checkBudget({ provider, kind: 'test' });
      expect(afterReset.allowed).toBe(true);
      done();
    }, 150);
  });
});
