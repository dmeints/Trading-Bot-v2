import { describe, it, expect } from 'vitest';
import { volatilityModels } from '../server/services/volatility/Models.js';

describe('Volatility Models', () => {
  it('should forecast positive volatility with HAR-RV', () => {
    // Generate synthetic price history
    volatilityModels.generateSyntheticHistory('TESTUSDT', 100);

    const forecast = volatilityModels.forecastVol('TESTUSDT', 60);

    expect(forecast.sigmaHAR).toBeGreaterThan(0);
    expect(forecast.sigmaHAR).toBeLessThan(1); // Reasonable vol
    expect(forecast.confidence).toBeGreaterThan(0);
    expect(forecast.confidence).toBeLessThanOrEqual(1);
  });

  it('should forecast positive volatility with GARCH', () => {
    volatilityModels.generateSyntheticHistory('TESTUSDT', 100);

    const forecast = volatilityModels.forecastVol('TESTUSDT', 60);

    expect(forecast.sigmaGARCH).toBeGreaterThan(0);
    expect(forecast.sigmaGARCH).toBeLessThan(1); // Reasonable vol
  });

  it('should handle different forecast horizons', () => {
    volatilityModels.generateSyntheticHistory('TESTUSDT', 100);

    const forecast1h = volatilityModels.forecastVol('TESTUSDT', 60);
    const forecast1d = volatilityModels.forecastVol('TESTUSDT', 1440);

    expect(forecast1d.sigmaHAR).toBeGreaterThan(forecast1h.sigmaHAR);
    expect(forecast1d.sigmaGARCH).toBeGreaterThan(forecast1h.sigmaGARCH);
  });

  it('should return reasonable defaults for missing data', () => {
    const forecast = volatilityModels.forecastVol('NEWUSDT', 60);

    expect(forecast.sigmaHAR).toBeGreaterThan(0);
    expect(forecast.sigmaGARCH).toBeGreaterThan(0);
    expect(forecast.confidence).toBeLessThan(0.5); // Low confidence for missing data
  });
});