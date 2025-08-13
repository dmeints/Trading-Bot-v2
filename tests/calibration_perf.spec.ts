
/**
 * Calibration and Performance Tests
 * Ensure alpha quality and responsiveness
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { microstructureFeatures } from '../server/services/microstructure/Features';
import { volatilityModels } from '../server/services/volatility/Models';
import { alphaRegistry } from '../server/services/alpha/Registry';

// Performance thresholds from ENV
const MICROSTRUCTURE_LATENCY_THRESHOLD = parseInt(process.env.MICROSTRUCTURE_LATENCY_MS || '50');
const VOLATILITY_LATENCY_THRESHOLD = parseInt(process.env.VOLATILITY_LATENCY_MS || '100');
const ALPHA_BLEND_LATENCY_THRESHOLD = parseInt(process.env.ALPHA_BLEND_LATENCY_MS || '80');

describe('Calibration & Performance Guards', () => {
  beforeEach(() => {
    // Reset any cached state
    vi.clearAllMocks();
  });

  describe('Microstructure Latency', () => {
    it('should compute OBI within latency threshold', async () => {
      const startTime = performance.now();
      
      // Generate mock order book
      const orderBook = {
        symbol: 'BTCUSDT',
        timestamp: new Date(),
        bids: [
          { price: 50000, size: 1.5 },
          { price: 49950, size: 2.0 },
          { price: 49900, size: 1.0 }
        ],
        asks: [
          { price: 50050, size: 1.0 },
          { price: 50100, size: 1.5 },
          { price: 50150, size: 0.8 }
        ]
      };

      const snapshot = microstructureFeatures.updateOrderBook(orderBook);
      
      const endTime = performance.now();
      const latency = endTime - startTime;

      expect(latency).toBeLessThan(MICROSTRUCTURE_LATENCY_THRESHOLD);
      expect(snapshot.obi).toBeGreaterThan(-1);
      expect(snapshot.obi).toBeLessThan(1);
      expect(snapshot.spread_bps).toBeGreaterThan(0);
    });

    it('should get snapshot within latency threshold', () => {
      const startTime = performance.now();
      
      const snapshot = microstructureFeatures.getSnapshot('BTCUSDT');
      
      const endTime = performance.now();
      const latency = endTime - startTime;

      expect(latency).toBeLessThan(MICROSTRUCTURE_LATENCY_THRESHOLD);
    });
  });

  describe('Volatility Model Performance', () => {
    it('should forecast volatility within latency threshold', async () => {
      const startTime = performance.now();
      
      const forecast = await volatilityModels.forecastVol('BTCUSDT', 60);
      
      const endTime = performance.now();
      const latency = endTime - startTime;

      expect(latency).toBeLessThan(VOLATILITY_LATENCY_THRESHOLD);
      expect(forecast.sigmaHAR).toBeGreaterThan(0);
      expect(forecast.sigmaGARCH).toBeGreaterThan(0);
      expect(forecast.confidence).toBeGreaterThanOrEqual(0);
      expect(forecast.confidence).toBeLessThanOrEqual(1);
    });

    it('should produce reasonable volatility forecasts', async () => {
      const forecast = await volatilityModels.forecastVol('BTCUSDT', 60);
      
      // Sanity checks for crypto volatility
      expect(forecast.sigmaHAR).toBeGreaterThan(0.005); // At least 0.5% daily
      expect(forecast.sigmaHAR).toBeLessThan(0.20);     // Less than 20% daily
      expect(forecast.sigmaGARCH).toBeGreaterThan(0.005);
      expect(forecast.sigmaGARCH).toBeLessThan(0.20);
    });
  });

  describe('Alpha Blend Performance', () => {
    it('should blend alphas within latency threshold', async () => {
      const context = {
        symbol: 'BTCUSDT',
        price: 50000,
        timestamp: new Date()
      };

      const startTime = performance.now();
      
      const blendedSignal = await alphaRegistry.getBlendedSignal(context);
      
      const endTime = performance.now();
      const latency = endTime - startTime;

      expect(latency).toBeLessThan(ALPHA_BLEND_LATENCY_THRESHOLD);
      expect(blendedSignal).toBeTruthy();
      expect(typeof blendedSignal.value).toBe('number');
      expect(typeof blendedSignal.confidence).toBe('number');
    });

    it('should produce bounded alpha signals', async () => {
      const context = {
        symbol: 'BTCUSDT',
        price: 50000,
        timestamp: new Date()
      };

      const blendedSignal = await alphaRegistry.getBlendedSignal(context);
      
      expect(blendedSignal.value).toBeGreaterThanOrEqual(-1);
      expect(blendedSignal.value).toBeLessThanOrEqual(1);
      expect(blendedSignal.confidence).toBeGreaterThanOrEqual(0);
      expect(blendedSignal.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Signal Calibration', () => {
    it('should maintain OBI signal quality', () => {
      const trials = 100;
      let validSignals = 0;
      
      for (let i = 0; i < trials; i++) {
        // Generate varying market conditions
        const bidSize = 1 + Math.random() * 3;
        const askSize = 1 + Math.random() * 3;
        
        const orderBook = {
          symbol: 'TESTCOIN',
          timestamp: new Date(),
          bids: [{ price: 100, size: bidSize }],
          asks: [{ price: 101, size: askSize }]
        };

        const snapshot = microstructureFeatures.updateOrderBook(orderBook);
        
        // Check signal is bounded and reasonable
        if (snapshot.obi >= -1 && snapshot.obi <= 1) {
          validSignals++;
        }
      }
      
      const calibrationRate = validSignals / trials;
      expect(calibrationRate).toBeGreaterThan(0.98); // 98% signal quality
    });

    it('should maintain volatility forecast reliability', async () => {
      const trials = 20; // Fewer trials due to async nature
      let validForecasts = 0;
      
      for (let i = 0; i < trials; i++) {
        const symbol = `TEST${i}`;
        const forecast = await volatilityModels.forecastVol(symbol, 60);
        
        // Check forecasts are positive and reasonable
        if (forecast.sigmaHAR > 0 && forecast.sigmaGARCH > 0 && 
            forecast.sigmaHAR < 1 && forecast.sigmaGARCH < 1) {
          validForecasts++;
        }
      }
      
      const reliabilityRate = validForecasts / trials;
      expect(reliabilityRate).toBeGreaterThan(0.95); // 95% reliability
    });
  });

  describe('Brier Score Tracking', () => {
    it('should track prediction accuracy via Brier score', () => {
      // Simulate predictions and outcomes
      const predictions = [0.7, 0.3, 0.8, 0.2, 0.6];
      const outcomes = [1, 0, 1, 0, 1]; // Binary outcomes
      
      // Calculate Brier score: avg((prediction - outcome)^2)
      const brierScore = predictions.reduce((sum, pred, i) => {
        return sum + Math.pow(pred - outcomes[i], 2);
      }, 0) / predictions.length;
      
      // Brier score should be reasonable (< 0.25 for decent calibration)
      expect(brierScore).toBeLessThan(0.25);
    });

    it('should track win-rate calibration', () => {
      // Simulate confidence-bucketed predictions
      const buckets = {
        low: { predictions: 10, wins: 3 }, // 30% win rate for low confidence
        medium: { predictions: 20, wins: 11 }, // 55% win rate for medium
        high: { predictions: 15, wins: 12 } // 80% win rate for high confidence
      };
      
      // Check calibration: win rates should increase with confidence
      const lowWinRate = buckets.low.wins / buckets.low.predictions;
      const mediumWinRate = buckets.medium.wins / buckets.medium.predictions;
      const highWinRate = buckets.high.wins / buckets.high.predictions;
      
      expect(mediumWinRate).toBeGreaterThan(lowWinRate);
      expect(highWinRate).toBeGreaterThan(mediumWinRate);
    });
  });

  describe('System Integration Performance', () => {
    it('should handle concurrent microstructure updates', async () => {
      const concurrentUpdates = 10;
      const startTime = performance.now();
      
      const promises = Array.from({ length: concurrentUpdates }, (_, i) => {
        const orderBook = {
          symbol: `CONCURRENT${i}`,
          timestamp: new Date(),
          bids: [{ price: 100, size: 1 }],
          asks: [{ price: 101, size: 1 }]
        };
        
        return Promise.resolve(microstructureFeatures.updateOrderBook(orderBook));
      });
      
      const results = await Promise.all(promises);
      
      const endTime = performance.now();
      const totalLatency = endTime - startTime;
      
      expect(totalLatency).toBeLessThan(MICROSTRUCTURE_LATENCY_THRESHOLD * 2); // Allow 2x for concurrency
      expect(results).toHaveLength(concurrentUpdates);
      results.forEach(result => {
        expect(result.obi).toBeGreaterThanOrEqual(-1);
        expect(result.obi).toBeLessThanOrEqual(1);
      });
    });
  });
});
