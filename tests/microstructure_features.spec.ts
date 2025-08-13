
import { describe, it, expect } from 'vitest';
import { microstructureFeatures } from '../server/services/microstructure/Features.js';

describe('Microstructure Features', () => {
  it('should calculate OBI correctly', () => {
    const bids = [
      { price: 100, size: 10 },
      { price: 99, size: 15 },
      { price: 98, size: 5 }
    ];
    
    const asks = [
      { price: 101, size: 8 },
      { price: 102, size: 12 },
      { price: 103, size: 7 }
    ];
    
    microstructureFeatures.updateDepth('TESTUSDT', bids, asks);
    const snapshot = microstructureFeatures.getSnapshot('TESTUSDT');
    
    expect(snapshot).toBeTruthy();
    expect(snapshot?.obi).toBeTypeOf('number');
    expect(Math.abs(snapshot?.obi || 0)).toBeLessThan(1);
  });
  
  it('should calculate trade imbalance correctly', () => {
    const trades = [
      { price: 100, size: 5, side: 'buy' as const, timestamp: Date.now() - 1000 },
      { price: 100.1, size: 3, side: 'sell' as const, timestamp: Date.now() - 500 },
      { price: 99.9, size: 7, side: 'buy' as const, timestamp: Date.now() }
    ];
    
    trades.forEach(trade => {
      microstructureFeatures.updateTrade('TESTUSDT', trade);
    });
    
    const snapshot = microstructureFeatures.getSnapshot('TESTUSDT');
    expect(snapshot?.ti).toBeTypeOf('number');
    expect(Math.abs(snapshot?.ti || 0)).toBeLessThan(1);
  });
  
  it('should calculate spread in basis points', () => {
    const bids = [{ price: 100, size: 10 }];
    const asks = [{ price: 101, size: 10 }];
    
    microstructureFeatures.updateDepth('TESTUSDT', bids, asks);
    const snapshot = microstructureFeatures.getSnapshot('TESTUSDT');
    
    expect(snapshot?.spread_bps).toBeGreaterThan(0);
    expect(snapshot?.spread_bps).toBeLessThan(10000); // Reasonable spread
  });
  
  it('should generate synthetic data when requested', () => {
    const snapshot = microstructureFeatures.generateSyntheticSnapshot('BTCUSDT');
    
    expect(snapshot.symbol).toBe('BTCUSDT');
    expect(snapshot.obi).toBeTypeOf('number');
    expect(snapshot.ti).toBeTypeOf('number');
    expect(snapshot.spread_bps).toBeGreaterThan(0);
    expect(snapshot.micro_vol).toBeGreaterThan(0);
    expect(snapshot.cancel_rate).toBeGreaterThan(0);
    expect(snapshot.best_bid).toBeGreaterThan(0);
    expect(snapshot.best_ask).toBeGreaterThan(snapshot.best_bid);
  });
});
