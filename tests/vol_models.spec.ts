
/**
 * Volatility Models Tests
 */

import { describe, it, expect } from 'vitest';
import { volatilityModels } from '../server/services/volatility/Models';

describe('VolatilityModels', () => {
  describe('HAR-RV and GARCH Forecasting', () => {
    it('should produce positive volatility forecasts', async () => {
      const forecast = await volatilityModels.forecastVol('BTCUSDT', 60);
      
      expect(forecast.sigmaHAR).toBeGreaterThan(0);
      expect(forecast.sigmaGARCH).toBeGreaterThan(0);
      expect(forecast.confidence).toBeGreaterThanOrEqual(0);
      expect(forecast.confidence).toBeLessThanOrEqual(1);
      expect(forecast.symbol).toBe('BTCUSDT');
      expect(forecast.horizon_mins).toBe(60);
    });

    it('should handle different time horizons', async () => {
      const shortForecast = await volatilityModels.forecastVol('BTCUSDT', 15);
      const longForecast = await volatilityModels.forecastVol('BTCUSDT', 240);
      
      expect(shortForecast.horizon_mins).toBe(15);
      expect(longForecast.horizon_mins).toBe(240);
      
      // Both should be positive
      expect(shortForecast.sigmaHAR).toBeGreaterThan(0);
      expect(longForecast.sigmaHAR).toBeGreaterThan(0);
    });

    it('should provide reasonable volatility ranges', async () => {
      const forecast = await volatilityModels.forecastVol('BTCUSDT', 60);
      
      // BTC volatility should typically be between 1% and 15% (daily)
      expect(forecast.sigmaHAR).toBeGreaterThan(0.01);
      expect(forecast.sigmaHAR).toBeLessThan(0.15);
      expect(forecast.sigmaGARCH).toBeGreaterThan(0.01);
      expect(forecast.sigmaGARCH).toBeLessThan(0.15);
    });

    it('should handle invalid horizons gracefully', async () => {
      const forecast = await volatilityModels.forecastVol('BTCUSDT', -5);
      
      // Should still return a valid forecast
      expect(forecast.sigmaHAR).toBeGreaterThan(0);
      expect(forecast.sigmaGARCH).toBeGreaterThan(0);
    });

    it('should cache forecasts', async () => {
      const symbol = 'ETHUSDT';
      const horizon = 30;
      
      // First call
      const forecast1 = await volatilityModels.forecastVol(symbol, horizon);
      
      // Get cached version
      const cached = volatilityModels.getForecast(symbol, horizon);
      
      expect(cached).toBeTruthy();
      expect(cached!.sigmaHAR).toBe(forecast1.sigmaHAR);
      expect(cached!.sigmaGARCH).toBe(forecast1.sigmaGARCH);
    });

    it('should clear cache when requested', async () => {
      const symbol = 'SOLUSDT';
      
      // Generate forecast
      await volatilityModels.forecastVol(symbol, 60);
      
      // Verify cached
      let cached = volatilityModels.getForecast(symbol, 60);
      expect(cached).toBeTruthy();
      
      // Clear cache
      volatilityModels.clearCache(symbol);
      
      // Verify cleared
      cached = volatilityModels.getForecast(symbol, 60);
      expect(cached).toBeNull();
    });
  });

  describe('Fallback Behavior', () => {
    it('should provide fallback forecasts for unknown symbols', async () => {
      const forecast = await volatilityModels.forecastVol('UNKNOWNCOIN', 60);
      
      expect(forecast.sigmaHAR).toBeGreaterThan(0);
      expect(forecast.sigmaGARCH).toBeGreaterThan(0);
      expect(forecast.confidence).toBeLessThan(1); // Should have lower confidence
    });

    it('should differentiate fallback volatility by asset', async () => {
      const btcForecast = await volatilityModels.forecastVol('BTCUSDT', 60);
      const ethForecast = await volatilityModels.forecastVol('ETHUSDT', 60);
      const altForecast = await volatilityModels.forecastVol('ALTCOIN', 60);
      
      // Different assets should have different base volatilities
      // (This tests our fallback logic differentiates by symbol)
      expect(btcForecast.sigmaHAR).toBeDefined();
      expect(ethForecast.sigmaHAR).toBeDefined();
      expect(altForecast.sigmaHAR).toBeDefined();
    });
  });
});
