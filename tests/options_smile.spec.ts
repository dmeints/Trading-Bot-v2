
/**
 * Options Smile & Skew Tests
 */

import { describe, it, expect } from 'vitest';
import { optionsSmile } from '../server/services/options/Smile';

describe('OptionsSmile', () => {
  describe('Risk Reversal Calculation', () => {
    it('should calculate 25-delta risk reversal correctly', () => {
      const chain = [
        { k: 0.9, tenor: '7d', type: 'put' as const, iv: 0.65 },
        { k: 1.0, tenor: '7d', type: 'call' as const, iv: 0.60 },
        { k: 1.1, tenor: '7d', type: 'call' as const, iv: 0.58 }
      ];

      optionsSmile.storeChain('BTCUSDT', chain, 50000);
      const metrics = optionsSmile.getMetrics('BTCUSDT');

      expect(metrics).toBeTruthy();
      expect(metrics!.rr25).toBeCloseTo(-0.07, 2); // Call IV - Put IV = 0.58 - 0.65
    });

    it('should handle missing strikes gracefully', () => {
      const chain = [
        { k: 1.0, tenor: '7d', type: 'call' as const, iv: 0.60 }
      ];

      optionsSmile.storeChain('ETHUSDT', chain, 3000);
      const metrics = optionsSmile.getMetrics('ETHUSDT');

      expect(metrics).toBeTruthy();
      expect(metrics!.rr25).toBe(0); // Should return 0 when strikes missing
      expect(metrics!.fly25).toBe(0);
    });
  });

  describe('Butterfly Calculation', () => {
    it('should calculate 25-delta butterfly correctly', () => {
      const chain = [
        { k: 0.9, tenor: '7d', type: 'put' as const, iv: 0.65 },
        { k: 1.0, tenor: '7d', type: 'call' as const, iv: 0.60 },
        { k: 1.1, tenor: '7d', type: 'call' as const, iv: 0.58 }
      ];

      optionsSmile.storeChain('BTCUSDT', chain, 50000);
      const metrics = optionsSmile.getMetrics('BTCUSDT');

      expect(metrics).toBeTruthy();
      // BF25 = (Call IV + Put IV)/2 - ATM IV = (0.58 + 0.65)/2 - 0.60 = 0.015
      expect(metrics!.fly25).toBeCloseTo(0.015, 3);
    });
  });

  describe('Term Structure Slope', () => {
    it('should calculate term structure slope', () => {
      const chain = [
        { k: 1.0, tenor: '7d', type: 'call' as const, iv: 0.60 },
        { k: 1.0, tenor: '30d', type: 'call' as const, iv: 0.55 }
      ];

      optionsSmile.storeChain('BTCUSDT', chain, 50000);
      const metrics = optionsSmile.getMetrics('BTCUSDT');

      expect(metrics).toBeTruthy();
      // Slope = (0.55 - 0.60) / (30 - 7) = -0.05 / 23 ≈ -0.0022
      expect(metrics!.iv_term_slope).toBeLessThan(0);
    });

    it('should handle single tenor gracefully', () => {
      const chain = [
        { k: 1.0, tenor: '7d', type: 'call' as const, iv: 0.60 }
      ];

      optionsSmile.storeChain('SOLUSDT', chain, 100);
      const metrics = optionsSmile.getMetrics('SOLUSDT');

      expect(metrics).toBeTruthy();
      expect(metrics!.iv_term_slope).toBe(0); // No slope with single point
    });
  });

  describe('Skew Z-Score', () => {
    it('should calculate skew z-score', () => {
      const chain = [
        { k: 0.8, tenor: '7d', type: 'call' as const, iv: 0.70 },
        { k: 0.8, tenor: '7d', type: 'put' as const, iv: 0.75 },
        { k: 1.0, tenor: '7d', type: 'call' as const, iv: 0.60 },
        { k: 1.0, tenor: '7d', type: 'put' as const, iv: 0.62 },
        { k: 1.2, tenor: '7d', type: 'call' as const, iv: 0.55 },
        { k: 1.2, tenor: '7d', type: 'put' as const, iv: 0.58 }
      ];

      optionsSmile.storeChain('BTCUSDT', chain, 50000);
      const metrics = optionsSmile.getMetrics('BTCUSDT');

      expect(metrics).toBeTruthy();
      expect(typeof metrics!.skew_z).toBe('number');
      expect(metrics!.skew_z).toBeGreaterThan(-5);
      expect(metrics!.skew_z).toBeLessThan(5);
    });
  });

  describe('Mock Data Generation', () => {
    it('should generate realistic mock option chain', () => {
      const chain = optionsSmile.generateMockChain('BTCUSDT');

      expect(chain.symbol).toBe('BTCUSDT');
      expect(chain.chain.length).toBeGreaterThan(0);
      expect(chain.spot).toBeGreaterThan(0);

      // Check all options have valid structure
      for (const option of chain.chain) {
        expect(option.k).toBeGreaterThan(0);
        expect(option.iv).toBeGreaterThan(0);
        expect(option.iv).toBeLessThan(2); // Less than 200% IV
        expect(['call', 'put']).toContain(option.type);
        expect(option.tenor).toMatch(/\d+[dwy]/);
      }
    });

    it('should compute metrics from mock data', () => {
      optionsSmile.generateMockChain('ETHUSDT');
      const metrics = optionsSmile.getMetrics('ETHUSDT');

      expect(metrics).toBeTruthy();
      expect(metrics!.atm_iv).toBeGreaterThan(0);
      expect(typeof metrics!.rr25).toBe('number');
      expect(typeof metrics!.fly25).toBe('number');
      expect(typeof metrics!.iv_term_slope).toBe('number');
      expect(typeof metrics!.skew_z).toBe('number');
    });
  });
});
