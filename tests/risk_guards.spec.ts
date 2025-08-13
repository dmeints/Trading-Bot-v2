
/**
 * Risk Guards Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { riskGuards } from '../server/services/RiskGuards';

describe('Risk Guards', () => {
  beforeEach(() => {
    riskGuards.reset();
  });

  it('should allow execution within limits', () => {
    const result = riskGuards.checkExecution('BTC', 'buy', 1000);
    
    expect(result.allowed).toBe(true);
    expect(result.blocked).toBeUndefined();
    expect(result.limits).toBeDefined();
    expect(result.limits.notionalUsed).toBe(0);
  });

  it('should block execution when global notional limit exceeded', () => {
    // First execution to use up most of the limit
    riskGuards.recordExecution({
      symbol: 'BTC',
      side: 'buy',
      finalSize: 1,
      fillPrice: 200000, // $200k
      timestamp: new Date()
    });

    // Second execution should be blocked
    const result = riskGuards.checkExecution('ETH', 'buy', 100000); // $100k
    
    expect(result.allowed).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.reason).toMatch(/Global notional limit exceeded/);
  });

  it('should block execution when symbol notional limit exceeded', () => {
    const result = riskGuards.checkExecution('BTC', 'buy', 60000); // Exceeds $50k symbol cap
    
    expect(result.allowed).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.reason).toMatch(/Symbol .* notional limit exceeded/);
  });

  it('should enforce order rate limits', () => {
    // Execute multiple orders quickly to hit rate limit
    for (let i = 0; i < 12; i++) {
      const result = riskGuards.checkExecution('BTC', 'buy', 100);
      if (i < 10) {
        expect(result.allowed).toBe(true);
      } else {
        expect(result.allowed).toBe(false);
        expect(result.reason).toMatch(/Order rate limit exceeded/);
      }
      
      if (result.allowed) {
        riskGuards.recordExecution({
          symbol: 'BTC',
          side: 'buy',
          finalSize: 0.01,
          fillPrice: 50000,
          timestamp: new Date()
        });
      }
    }
  });

  it('should track notional exposure correctly', () => {
    // Record some executions
    riskGuards.recordExecution({
      symbol: 'BTC',
      side: 'buy',
      finalSize: 1,
      fillPrice: 50000,
      timestamp: new Date()
    });

    riskGuards.recordExecution({
      symbol: 'ETH',
      side: 'buy',
      finalSize: 10,
      fillPrice: 3000,
      timestamp: new Date()
    });

    const state = riskGuards.getState();
    
    expect(state.totalNotional).toBe(80000); // 50k + 30k
    expect(state.symbolNotionals['BTC']).toBe(50000);
    expect(state.symbolNotionals['ETH']).toBe(30000);
  });

  it('should activate drawdown breaker on excessive losses', () => {
    // Generate a series of losing trades
    for (let i = 0; i < 25; i++) {
      riskGuards.recordExecution({
        symbol: 'BTC',
        side: 'buy',
        finalSize: 0.1,
        fillPrice: 50000 - (i * 100), // Progressively losing money
        timestamp: new Date()
      });
    }

    const state = riskGuards.getState();
    
    // Should trigger drawdown breaker
    expect(state.drawdownBreaker.active).toBe(true);
    expect(state.drawdownBreaker.reason).toMatch(/Max drawdown exceeded/);
  });

  it('should allow sells to reduce notional exposure', () => {
    // First, build up position
    riskGuards.recordExecution({
      symbol: 'BTC',
      side: 'buy',
      finalSize: 1,
      fillPrice: 40000,
      timestamp: new Date()
    });

    let state = riskGuards.getState();
    expect(state.totalNotional).toBe(40000);

    // Now sell to reduce exposure
    riskGuards.recordExecution({
      symbol: 'BTC',
      side: 'sell',
      finalSize: 0.5,
      fillPrice: 41000,
      timestamp: new Date()
    });

    state = riskGuards.getState();
    expect(state.totalNotional).toBeLessThan(40000);
  });

  it('should reset drawdown breaker after cooldown', () => {
    // Manually activate drawdown breaker
    const state = riskGuards.getState();
    state.drawdownBreaker.active = true;
    state.drawdownBreaker.activatedAt = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago

    // Check should reset the breaker since cooldown expired
    const result = riskGuards.checkExecution('BTC', 'buy', 1000);
    
    expect(result.allowed).toBe(true);
    
    const newState = riskGuards.getState();
    expect(newState.drawdownBreaker.active).toBe(false);
  });

  it('should provide comprehensive state information', () => {
    const state = riskGuards.getState();
    
    expect(state.config).toBeDefined();
    expect(state.totalNotional).toBeDefined();
    expect(state.symbolNotionals).toBeDefined();
    expect(state.drawdownBreaker).toBeDefined();
    expect(state.orderCounts).toBeDefined();
    expect(state.recentTrades).toBeDefined();
    expect(state.lastCheck).toBeDefined();
  });
});
