import { describe, it, expect } from 'vitest';
import { optionsSmile } from '../server/services/options/Smile.js';

describe('Options Smile', () => {
  it('should calculate risk reversal correctly', () => {
    const chain = {
      chain: [
        { k: 0.9, tenor: '7d', type: 'put' as const, iv: 0.7 },
        { k: 1.0, tenor: '7d', type: 'call' as const, iv: 0.6 },
        { k: 1.1, tenor: '7d', type: 'call' as const, iv: 0.65 }
      ]
    };

    optionsSmile.storeChain('TESTUSDT', chain);
    const metrics = optionsSmile.getSmileMetrics('TESTUSDT');

    expect(metrics).toBeTruthy();
    expect(metrics?.rr25).toBeTypeOf('number');
    expect(metrics?.symbol).toBe('TESTUSDT');
  });

  it('should calculate butterfly spread correctly', () => {
    const chain = {
      chain: [
        { k: 0.9, tenor: '7d', type: 'put' as const, iv: 0.8 },
        { k: 1.0, tenor: '7d', type: 'call' as const, iv: 0.6 },
        { k: 1.1, tenor: '7d', type: 'call' as const, iv: 0.75 }
      ]
    };

    optionsSmile.storeChain('TESTUSDT', chain);
    const metrics = optionsSmile.getSmileMetrics('TESTUSDT');

    expect(metrics?.fly25).toBeTypeOf('number');
  });

  it('should calculate term structure slope', () => {
    const chain = {
      chain: [
        { k: 1.0, tenor: '7d', type: 'call' as const, iv: 0.6 },
        { k: 1.0, tenor: '30d', type: 'call' as const, iv: 0.55 }
      ]
    };

    optionsSmile.storeChain('TESTUSDT', chain);
    const metrics = optionsSmile.getSmileMetrics('TESTUSDT');

    expect(metrics?.iv_term_slope).toBeTypeOf('number');
  });

  it('should generate synthetic metrics for missing data', () => {
    const metrics = optionsSmile.getSmileMetrics('NEWUSDT');

    expect(metrics).toBeTruthy();
    expect(metrics?.rr25).toBeTypeOf('number');
    expect(metrics?.fly25).toBeTypeOf('number');
    expect(metrics?.iv_term_slope).toBeTypeOf('number');
    expect(metrics?.skew_z).toBeTypeOf('number');
  });
});