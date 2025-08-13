
import { describe, it, expect, beforeEach } from 'vitest';
import { PortfolioService } from '../server/services/portfolio';

describe('Portfolio Constraints', () => {
  let portfolioService: PortfolioService;

  beforeEach(() => {
    portfolioService = new PortfolioService();
  });

  it('should optimize portfolio with CVaR and vol constraints', () => {
    const request = {
      symbols: ['BTCUSDT', 'ETHUSDT'],
      cvarBudget: 0.05, // 5% CVaR budget
      volTarget: 0.02   // 2% volatility target
    };
    
    const result = portfolioService.optimizePortfolio(request);
    
    expect(result).toHaveProperty('weights');
    expect(result).toHaveProperty('achievedVol');
    expect(result).toHaveProperty('cvarBudgetUsed');
    expect(result).toHaveProperty('expectedReturn');
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('iterations');
    
    expect(typeof result.achievedVol).toBe('number');
    expect(typeof result.cvarBudgetUsed).toBe('number');
    expect(typeof result.expectedReturn).toBe('number');
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.iterations).toBe('number');
  });

  it('should satisfy weight constraints', () => {
    const request = {
      symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
      cvarBudget: 0.04,
      volTarget: 0.025
    };
    
    const result = portfolioService.optimizePortfolio(request);
    
    // Weights should sum to 1
    const weightSum = Object.values(result.weights).reduce((sum, w) => sum + w, 0);
    expect(weightSum).toBeCloseTo(1.0, 3);
    
    // All weights should be non-negative
    for (const weight of Object.values(result.weights)) {
      expect(weight).toBeGreaterThanOrEqual(0);
    }
    
    // Should have weights for all symbols
    for (const symbol of request.symbols) {
      expect(result.weights).toHaveProperty(symbol);
    }
  });

  it('should approximately achieve volatility target', () => {
    const request = {
      symbols: ['BTCUSDT', 'ETHUSDT'],
      cvarBudget: 0.06,
      volTarget: 0.03
    };
    
    const result = portfolioService.optimizePortfolio(request);
    
    // Should be reasonably close to target (within 50% tolerance for simplified model)
    const volDifference = Math.abs(result.achievedVol - request.volTarget);
    const tolerance = request.volTarget * 0.5;
    expect(volDifference).toBeLessThan(tolerance);
  });

  it('should respect CVaR budget constraint', () => {
    const request = {
      symbols: ['BTCUSDT', 'ETHUSDT'],
      cvarBudget: 0.03, // Tight CVaR budget
      volTarget: 0.02
    };
    
    const result = portfolioService.optimizePortfolio(request);
    
    // CVaR used should not exceed budget (with small tolerance for numerical errors)
    expect(result.cvarBudgetUsed).toBeLessThanOrEqual(request.cvarBudget + 0.001);
  });

  it('should handle single asset portfolio', () => {
    const request = {
      symbols: ['BTCUSDT'],
      cvarBudget: 0.05,
      volTarget: 0.04
    };
    
    const result = portfolioService.optimizePortfolio(request);
    
    expect(result.weights['BTCUSDT']).toBeCloseTo(1.0, 3);
    expect(result.success).toBe(true);
  });

  it('should handle unrealistic constraints gracefully', () => {
    const request = {
      symbols: ['BTCUSDT', 'ETHUSDT'],
      cvarBudget: 0.001, // Very tight CVaR budget
      volTarget: 0.001   // Very low vol target
    };
    
    const result = portfolioService.optimizePortfolio(request);
    
    // Should still return a valid result even if constraints are hard to satisfy
    expect(result).toHaveProperty('weights');
    expect(result).toHaveProperty('success');
    
    const weightSum = Object.values(result.weights).reduce((sum, w) => sum + w, 0);
    expect(weightSum).toBeCloseTo(1.0, 2);
  });

  it('should handle multiple assets correctly', () => {
    const request = {
      symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT'],
      cvarBudget: 0.04,
      volTarget: 0.025
    };
    
    const result = portfolioService.optimizePortfolio(request);
    
    expect(Object.keys(result.weights)).toHaveLength(4);
    
    // Should diversify (not put everything in one asset)
    const weights = Object.values(result.weights);
    const maxWeight = Math.max(...weights);
    expect(maxWeight).toBeLessThan(0.8); // No more than 80% in single asset
  });

  it('should produce deterministic results', () => {
    const request = {
      symbols: ['BTCUSDT', 'ETHUSDT'],
      cvarBudget: 0.05,
      volTarget: 0.02
    };
    
    const result1 = portfolioService.optimizePortfolio(request);
    const result2 = portfolioService.optimizePortfolio(request);
    
    // Results should be similar (allowing for small numerical differences)
    expect(result1.achievedVol).toBeCloseTo(result2.achievedVol, 2);
    expect(result1.cvarBudgetUsed).toBeCloseTo(result2.cvarBudgetUsed, 2);
    
    for (const symbol of request.symbols) {
      expect(result1.weights[symbol]).toBeCloseTo(result2.weights[symbol], 2);
    }
  });
});
import { describe, it, expect } from 'vitest';
import { portfolioOptimizer } from '../server/services/portfolio.js';

describe('Portfolio Constraints', () => {
  it('should optimize portfolio with CVaR constraints', async () => {
    const constraints = {
      symbols: ['BTCUSDT', 'ETHUSDT'],
      cvarBudget: 0.05,
      volTarget: 0.02
    };
    
    const result = await portfolioOptimizer.optimize(constraints);
    
    expect(result).toBeDefined();
    expect(result.feasible).toBe(true);
    expect(result.weights).toBeDefined();
    expect(Object.keys(result.weights)).toEqual(constraints.symbols);
    
    // Check weights sum to 1
    const weightSum = Object.values(result.weights).reduce((a, b) => a + b, 0);
    expect(Math.abs(weightSum - 1.0)).toBeLessThan(0.01);
    
    // Check CVaR constraint
    expect(result.metrics.cvar95).toBeLessThanOrEqual(constraints.cvarBudget * 1.1);
  });

  it('should calculate Kelly fractions correctly', async () => {
    const constraints = {
      symbols: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'],
      cvarBudget: 0.1,
      volTarget: 0.03
    };
    
    const result = await portfolioOptimizer.optimize(constraints);
    
    expect(result.kellyFractions).toBeDefined();
    expect(Object.keys(result.kellyFractions)).toEqual(constraints.symbols);
    
    // Kelly fractions should be reasonable (0-0.5)
    Object.values(result.kellyFractions).forEach(fraction => {
      expect(fraction).toBeGreaterThanOrEqual(0);
      expect(fraction).toBeLessThanOrEqual(0.5);
    });
  });

  it('should handle vol targeting', async () => {
    const lowVolTarget = {
      symbols: ['BTCUSDT', 'ETHUSDT'],
      cvarBudget: 0.08,
      volTarget: 0.01 // Low vol target
    };
    
    const result = await portfolioOptimizer.optimize(lowVolTarget);
    
    expect(result.metrics.volatility).toBeLessThanOrEqual(0.015); // Should be close to target
  });

  it('should provide CVaR scaling for execution', () => {
    const scale = portfolioOptimizer.getCVaRScale('BTCUSDT', 0.05);
    
    expect(scale).toBeGreaterThan(0);
    expect(scale).toBeLessThanOrEqual(1);
  });
});
