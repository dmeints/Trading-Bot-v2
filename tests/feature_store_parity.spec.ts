
import { describe, it, expect, beforeEach } from '@jest/globals';
import { FeatureStore } from '../server/services/featureStore';

describe('Feature Store Parity', () => {
  let featureStore: FeatureStore;

  beforeEach(() => {
    featureStore = new FeatureStore();
  });

  it('should store and retrieve features', () => {
    const symbol = 'BTCUSDT';
    const features = { sma_20: 50000, rsi: 65, volume: 1000 };

    featureStore.putFeature(symbol, features);
    
    const latest = featureStore.getLatest(symbol);
    expect(latest).toBeDefined();
    expect(latest?.features.sma_20).toBe(50000);
    expect(latest?.symbol).toBe(symbol);
  });

  it('should maintain feature windows', () => {
    const symbol = 'BTCUSDT';
    const features = { sma_20: 50000, rsi: 65 };

    // Add multiple features over time
    for (let i = 0; i < 5; i++) {
      featureStore.putFeature(symbol, { ...features, timestamp: i });
    }

    const window = featureStore.getWindow(symbol, 1000000); // Large window
    expect(window.features.length).toBe(5);
    expect(window.symbol).toBe(symbol);
  });

  it('should store backtest features', () => {
    const symbol = 'BTCUSDT';
    const features = { sma_20: 50000, rsi: 65 };
    const timestamp = Date.now() - 86400000; // 1 day ago

    featureStore.putBacktestFeature(symbol, features, timestamp);

    // Should not affect online features
    const latest = featureStore.getLatest(symbol);
    expect(latest).toBeNull();
  });

  it('should check feature parity', () => {
    const symbol = 'BTCUSDT';
    const features = { sma_20: 50000, rsi: 65 };
    const timestamp = Date.now();

    // Store identical features in both stores
    featureStore.putFeature(symbol, features);
    featureStore.putBacktestFeature(symbol, features, timestamp);

    const parity = featureStore.checkParity(symbol, timestamp, 0.001);
    expect(parity.hasParity).toBe(true);
    expect(parity.mismatches.length).toBe(0);
  });

  it('should detect parity mismatches', () => {
    const symbol = 'BTCUSDT';
    const timestamp = Date.now();

    // Store different features
    featureStore.putFeature(symbol, { sma_20: 50000, rsi: 65 });
    featureStore.putBacktestFeature(symbol, { sma_20: 49000, rsi: 70 }, timestamp);

    const parity = featureStore.checkParity(symbol, timestamp, 0.001);
    expect(parity.hasParity).toBe(false);
    expect(parity.mismatches.length).toBeGreaterThan(0);
  });

  it('should generate parity report', () => {
    const symbol = 'BTCUSDT';
    const features = { sma_20: 50000, rsi: 65 };

    featureStore.putFeature(symbol, features);

    const report = featureStore.getParityReport();
    expect(report.symbols[symbol]).toBeDefined();
    expect(report.timestamp).toBeDefined();
  });

  it('should provide statistics', () => {
    const symbol = 'BTCUSDT';
    featureStore.putFeature(symbol, { sma_20: 50000 });

    const stats = featureStore.getStats();
    expect(stats.onlineSymbols).toBe(1);
    expect(stats.totalOnlineFeatures).toBe(1);
  });
});
