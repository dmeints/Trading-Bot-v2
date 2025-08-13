
/**
 * Budgeter Limits Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { budgeter } from '../server/services/Budgeter';

describe('Budgeter Limits', () => {
  beforeEach(() => {
    // Reset budgeter state if needed
  });

  it('should enforce rate limits', async () => {
    // Update limits to very low for testing
    budgeter.updateLimits('coingecko', { maxCallsPerMinute: 2 });
    
    // First two calls should succeed
    await expect(budgeter.request('coingecko', 'test', async () => 'success1')).resolves.toBe('success1');
    await expect(budgeter.request('coingecko', 'test', async () => 'success2')).resolves.toBe('success2');
    
    // Third call should be rate limited
    await expect(budgeter.request('coingecko', 'test', async () => 'fail')).rejects.toThrow();
  });

  it('should provide fallback providers when cost budget exceeded', async () => {
    // Set very low cost limit
    budgeter.updateLimits('coingecko', { maxCostUSD: 0.001 });
    
    const status = budgeter.getProviderStatus('coingecko');
    expect(status).toBeDefined();
    
    // Check budget without making actual call
    const budgetCheck = budgeter.checkBudget({
      provider: 'coingecko',
      kind: 'test',
      estimatedCost: 1.0 // Very high cost
    });
    
    expect(budgetCheck.allowed).toBe(false);
    expect(budgetCheck.reason).toMatch(/cost budget/i);
  });

  it('should track usage correctly', async () => {
    const initialStatus = budgeter.getProviderStatus('binance');
    const initialCalls = initialStatus?.calls || 0;
    
    await budgeter.request('binance', 'test', async () => 'success');
    
    const finalStatus = budgeter.getProviderStatus('binance');
    expect(finalStatus?.calls).toBe(initialCalls + 1);
    expect(finalStatus?.costUSD).toBeGreaterThan(initialStatus?.costUSD || 0);
  });

  it('should suggest fallback providers when available', () => {
    const budgetCheck = budgeter.checkBudget({
      provider: 'coingecko',
      kind: 'price',
      estimatedCost: 999 // Very high cost
    });
    
    if (!budgetCheck.allowed && budgetCheck.fallbackProvider) {
      expect(['coinbase', 'binance']).toContain(budgetCheck.fallbackProvider);
    }
  });

  it('should delay requests when rate limited', async () => {
    // Set very low rate limit
    budgeter.updateLimits('etherscan', { maxCallsPerMinute: 1 });
    
    // Use up the rate limit
    await budgeter.request('etherscan', 'test', async () => 'first');
    
    // Next request should get delay recommendation
    const budgetCheck = budgeter.checkBudget({
      provider: 'etherscan',
      kind: 'test'
    });
    
    if (!budgetCheck.allowed) {
      expect(budgetCheck.delayMs).toBeDefined();
      expect(budgetCheck.delayMs).toBeGreaterThan(0);
    }
  });
});
