
/**
 * WASM Microstructure Tests
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { fastPath } from '../server/services/microstructure/FastPath';

describe('WASM Microstructure', () => {
  beforeAll(async () => {
    await fastPath.initialize();
  });

  it('should initialize WASM module successfully', () => {
    const stats = fastPath.getPerformanceStats();
    expect(stats.wasmEnabled).toBe(true);
  });

  it('should calculate OBI correctly', () => {
    const bids = [
      { price: 43000, size: 5.0 },
      { price: 42999, size: 3.0 }
    ];
    const asks = [
      { price: 43001, size: 2.0 },
      { price: 43002, size: 1.0 }
    ];
    const trades: any[] = [];

    const metrics = fastPath.calculateMetrics(bids, asks, trades);
    
    expect(metrics.obi).toBeCloseTo(0.455, 2); // (8-3)/(8+3) = 5/11
    expect(metrics.timestamp).toBeGreaterThan(0);
  });

  it('should calculate spread in basis points', () => {
    const bids = [{ price: 43000, size: 1.0 }];
    const asks = [{ price: 43002, size: 1.0 }];
    const trades: any[] = [];

    const metrics = fastPath.calculateMetrics(bids, asks, trades);
    
    // Spread = 2, Mid = 43001, BPS = (2/43001) * 10000
    expect(metrics.spread_bps).toBeCloseTo(0.465, 2);
  });

  it('should calculate trade imbalance', () => {
    const bids = [{ price: 43000, size: 1.0 }];
    const asks = [{ price: 43001, size: 1.0 }];
    const trades = [
      { price: 43000.5, size: 2.0, side: 'buy' as const, timestamp: Date.now() },
      { price: 43000.3, size: 1.0, side: 'sell' as const, timestamp: Date.now() }
    ];

    const metrics = fastPath.calculateMetrics(bids, asks, trades);
    
    // TI = (2-1)/(2+1) = 1/3
    expect(metrics.ti).toBeCloseTo(0.333, 2);
  });

  it('should handle empty order book gracefully', () => {
    const bids: any[] = [];
    const asks: any[] = [];
    const trades: any[] = [];

    const metrics = fastPath.calculateMetrics(bids, asks, trades);
    
    expect(metrics.obi).toBe(0);
    expect(metrics.ti).toBe(0);
    expect(metrics.spread_bps).toBe(0);
  });

  it('should calculate micro volatility from price history', () => {
    // Add some price history
    fastPath.rollUpdate(43000);
    fastPath.rollUpdate(43010);
    fastPath.rollUpdate(42995);
    fastPath.rollUpdate(43005);

    const bids = [{ price: 43000, size: 1.0 }];
    const asks = [{ price: 43001, size: 1.0 }];
    const trades: any[] = [];

    const metrics = fastPath.calculateMetrics(bids, asks, trades);
    
    expect(metrics.micro_vol).toBeGreaterThan(0);
    expect(isFinite(metrics.micro_vol)).toBe(true);
  });

  it('should maintain rolling price history', () => {
    const initialStats = fastPath.getPerformanceStats();
    
    // Add many price updates
    for (let i = 0; i < 50; i++) {
      fastPath.rollUpdate(43000 + Math.random() * 100);
    }
    
    const finalStats = fastPath.getPerformanceStats();
    expect(finalStats.historySize).toBeGreaterThan(initialStats.historySize);
    expect(finalStats.historySize).toBeLessThanOrEqual(1000); // Should not exceed limit
  });
});
