
import { describe, it, expect, beforeEach } from 'vitest';
import { DataQuality } from '../server/services/DataQuality';

describe('Data Quality Tests', () => {
  let dataQuality: DataQuality;

  beforeEach(() => {
    dataQuality = DataQuality.getInstance();
    dataQuality.reset();
  });

  it('should validate good OHLCV data', () => {
    const goodCandle = {
      timestamp: Date.now(),
      open: 43000,
      high: 43100,
      low: 42900,
      close: 43050,
      volume: 1500,
      symbol: 'BTCUSDT'
    };

    const result = dataQuality.validateOHLCV(goodCandle);
    expect(result.valid).toBe(true);
    expect(result.sanitized).toEqual(goodCandle);
  });

  it('should reject invalid schema data', () => {
    const badCandle = {
      timestamp: Date.now(),
      open: -43000, // Negative price
      high: 43100,
      low: 42900,
      close: 43050,
      volume: 1500,
      symbol: 'BTCUSDT'
    };

    const result = dataQuality.validateOHLCV(badCandle);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Invalid price');
  });

  it('should detect price spikes', () => {
    // Add normal price history
    for (let i = 0; i < 20; i++) {
      const normalCandle = {
        timestamp: Date.now() - (20 - i) * 60000,
        open: 43000 + i,
        high: 43010 + i,
        low: 42990 + i,
        close: 43000 + i,
        volume: 1000,
        symbol: 'BTCUSDT'
      };
      dataQuality.validateOHLCV(normalCandle);
    }

    // Add spike candle
    const spikeCandle = {
      timestamp: Date.now(),
      open: 43020,
      high: 65000, // Massive spike
      low: 43020,
      close: 65000,
      volume: 1000,
      symbol: 'BTCUSDT'
    };

    const result = dataQuality.validateOHLCV(spikeCandle);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('spike');

    const stats = dataQuality.getStats();
    expect(stats.quarantinedCandles).toBe(1);
    expect(stats.spikeDetections).toBe(1);
  });

  it('should track quarantined candles', () => {
    const badCandle = {
      timestamp: Date.now(),
      open: NaN, // Invalid data
      high: 43100,
      low: 42900,
      close: 43050,
      volume: 1500,
      symbol: 'BTCUSDT'
    };

    dataQuality.validateOHLCV(badCandle);

    const quarantined = dataQuality.getQuarantinedCandles();
    expect(quarantined.length).toBe(1);

    const stats = dataQuality.getStats();
    expect(stats.quarantinedCandles).toBe(1);
    expect(stats.schemaViolations).toBe(1);
  });

  it('should validate OHLC relationships', () => {
    const invalidCandle = {
      timestamp: Date.now(),
      open: 43000,
      high: 42900, // High less than open
      low: 43100,  // Low greater than high
      close: 43050,
      volume: 1500,
      symbol: 'BTCUSDT'
    };

    const result = dataQuality.validateOHLCV(invalidCandle);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('High is less');
  });
});
