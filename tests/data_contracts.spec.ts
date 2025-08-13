
import { describe, it, expect } from '@jest/globals';
import { OHLCVSchema, ExecutionRequestSchema } from '../server/contracts/ohlcv';
import { ExecutionRequestSchema as ExecSchema } from '../server/contracts/exec';

describe('Data Contracts', () => {
  it('should validate OHLCV schema', () => {
    const validOHLCV = {
      symbol: 'BTCUSDT',
      timestamp: Date.now(),
      open: 50000,
      high: 51000,
      low: 49000,
      close: 50500,
      volume: 1000
    };

    const result = OHLCVSchema.safeParse(validOHLCV);
    expect(result.success).toBe(true);
  });

  it('should reject invalid OHLCV data', () => {
    const invalidOHLCV = {
      symbol: '', // Invalid empty symbol
      timestamp: -1, // Invalid negative timestamp
      open: -50000, // Invalid negative price
      high: 51000,
      low: 49000,
      close: 50500,
      volume: -1000 // Invalid negative volume
    };

    const result = OHLCVSchema.safeParse(invalidOHLCV);
    expect(result.success).toBe(false);
  });

  it('should validate execution requests', () => {
    const validExecution = {
      symbol: 'BTCUSDT',
      side: 'buy',
      type: 'market',
      quantity: 0.1,
      timeInForce: 'GTC'
    };

    const result = ExecSchema.safeParse(validExecution);
    expect(result.success).toBe(true);
  });

  it('should enforce execution constraints', () => {
    const invalidExecution = {
      symbol: 'BTCUSDT',
      side: 'invalid_side', // Invalid side
      type: 'market',
      quantity: -0.1, // Invalid negative quantity
      timeInForce: 'GTC'
    };

    const result = ExecSchema.safeParse(invalidExecution);
    expect(result.success).toBe(false);
  });
});
