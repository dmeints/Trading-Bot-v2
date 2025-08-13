
import { describe, it, expect, beforeEach } from '@jest/globals';
import { DataQuality } from '../server/services/DataQuality';

describe('Data Quality', () => {
  let dataQuality: DataQuality;

  beforeEach(() => {
    dataQuality = new DataQuality();
  });

  it('should validate correct OHLCV data', () => {
    const validOHLCV = {
      symbol: 'BTCUSDT',
      timestamp: Date.now(),
      open: 50000,
      high: 51000,
      low: 49000,
      close: 50500,
      volume: 1000
    };

    const result = dataQuality.validateOHLCV(validOHLCV);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid OHLCV data', () => {
    const invalidOHLCV = {
      symbol: 'BTCUSDT',
      timestamp: Date.now(),
      open: 50000,
      high: 49000, // High < Low (invalid)
      low: 51000,
      close: 50500,
      volume: 1000
    };

    const result = dataQuality.validateOHLCV(invalidOHLCV);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should validate L2 order book data', () => {
    const validL2 = {
      symbol: 'BTCUSDT',
      timestamp: Date.now(),
      bids: [[49900, 1.5], [49800, 2.0]],
      asks: [[50100, 1.2], [50200, 1.8]]
    };

    const result = dataQuality.validateL2(validL2);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect crossed book', () => {
    const crossedL2 = {
      symbol: 'BTCUSDT',
      timestamp: Date.now(),
      bids: [[50200, 1.5]], // Bid > Ask (crossed)
      asks: [[50100, 1.2]]
    };

    const result = dataQuality.validateL2(crossedL2);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('Crossed book'))).toBe(true);
  });

  it('should track metrics', () => {
    const validData = {
      symbol: 'BTCUSDT',
      timestamp: Date.now(),
      open: 50000,
      high: 51000,
      low: 49000,
      close: 50500,
      volume: 1000
    };

    dataQuality.validateOHLCV(validData);
    
    const stats = dataQuality.getStats();
    expect(stats.dataTypes.ohlcv).toBeDefined();
    expect(stats.dataTypes.ohlcv.totalRecords).toBeGreaterThan(0);
  });

  it('should detect price spikes', () => {
    // First price to establish baseline
    dataQuality.validateOHLCV({
      symbol: 'TESTCOIN',
      timestamp: Date.now(),
      open: 100,
      high: 105,
      low: 95,
      close: 100,
      volume: 1000
    });

    // Spike price
    const spikeResult = dataQuality.validateOHLCV({
      symbol: 'TESTCOIN',
      timestamp: Date.now(),
      open: 130,
      high: 135,
      low: 125,
      close: 130, // 30% spike
      volume: 1000
    });

    const anomalies = dataQuality.getAnomalies();
    expect(anomalies.some(a => a.type === 'price_spike')).toBe(true);
  });

  it('should maintain health status', () => {
    // Add some valid data
    for (let i = 0; i < 10; i++) {
      dataQuality.validateOHLCV({
        symbol: 'BTCUSDT',
        timestamp: Date.now(),
        open: 50000,
        high: 51000,
        low: 49000,
        close: 50500,
        volume: 1000
      });
    }

    expect(dataQuality.isHealthy()).toBe(true);
  });
});
