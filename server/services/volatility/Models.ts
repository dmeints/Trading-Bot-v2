
/**
 * Volatility Models - HAR-RV and GARCH(1,1)
 */

import { logger } from '../../utils/logger.js';

export interface VolatilityForecast {
  symbol: string;
  horizonMins: number;
  sigmaHAR: number;
  sigmaGARCH: number;
  timestamp: Date;
}

interface PriceReturn {
  timestamp: Date;
  return: number;
  variance: number;
}

class VolatilityModels {
  private priceData = new Map<string, PriceReturn[]>();
  private garchParams = new Map<string, { omega: number; alpha: number; beta: number; sigma2: number }>();

  /**
   * Update with new price return
   */
  updateReturn(symbol: string, timestamp: Date, price: number, prevPrice: number): void {
    if (prevPrice <= 0 || price <= 0) return;

    const logReturn = Math.log(price / prevPrice);
    const variance = logReturn * logReturn;

    if (!this.priceData.has(symbol)) {
      this.priceData.set(symbol, []);
    }

    const data = this.priceData.get(symbol)!;
    data.push({ timestamp, return: logReturn, variance });

    // Keep only last 1440 minutes (1 day) of 1-minute returns
    if (data.length > 1440) {
      data.shift();
    }

    // Update GARCH parameters if we have enough data
    if (data.length >= 100) {
      this.updateGARCH(symbol, data);
    }
  }

  /**
   * Forecast volatility using HAR-RV and GARCH models
   */
  forecastVol(symbol: string, horizonMins: number = 60): VolatilityForecast {
    const data = this.priceData.get(symbol) || [];
    
    if (data.length < 20) {
      // Return reasonable defaults for new symbols
      return {
        symbol,
        horizonMins,
        sigmaHAR: 0.02,
        sigmaGARCH: 0.02,
        timestamp: new Date()
      };
    }

    const sigmaHAR = this.calculateHARRV(data, horizonMins);
    const sigmaGARCH = this.calculateGARCH(symbol, data, horizonMins);

    return {
      symbol,
      horizonMins,
      sigmaHAR,
      sigmaGARCH,
      timestamp: new Date()
    };
  }

  /**
   * Calculate HAR-RV (Heterogeneous Autoregressive Realized Volatility)
   */
  private calculateHARRV(data: PriceReturn[], horizonMins: number): number {
    if (data.length < 20) return 0.02;

    // Calculate realized variances at different frequencies
    const rv1 = this.realizedVariance(data, 1);    // 1-minute
    const rv5 = this.realizedVariance(data, 5);    // 5-minute
    const rv22 = this.realizedVariance(data, 22);  // 22-minute (daily proxy)

    // HAR coefficients (simplified - in practice would be estimated)
    const beta1 = 0.4;
    const beta5 = 0.3;
    const beta22 = 0.2;
    const alpha = 0.001;

    // HAR forecast: RV_t+1 = α + β₁·RV_t + β₅·RV_{t-5} + β₂₂·RV_{t-22}
    const forecastRV = alpha + beta1 * rv1 + beta5 * rv5 + beta22 * rv22;

    // Adjust for horizon (square root of time rule)
    const adjustedRV = forecastRV * Math.sqrt(horizonMins / 1440); // Scale to horizon

    return Math.sqrt(Math.max(0.0001, adjustedRV)); // Ensure positive
  }

  /**
   * Calculate realized variance over specified window
   */
  private realizedVariance(data: PriceReturn[], windowMins: number): number {
    if (data.length < windowMins) return 0.0004; // 2% annualized

    const recent = data.slice(-windowMins);
    const sumVariance = recent.reduce((sum, point) => sum + point.variance, 0);
    
    return sumVariance / windowMins;
  }

  /**
   * Calculate GARCH(1,1) forecast
   */
  private calculateGARCH(symbol: string, data: PriceReturn[], horizonMins: number): number {
    const params = this.garchParams.get(symbol);
    
    if (!params || data.length === 0) return 0.02;

    const lastReturn = data[data.length - 1].return;
    const lastVariance = params.sigma2;

    // GARCH(1,1): σ²_t = ω + α·r²_{t-1} + β·σ²_{t-1}
    const forecastVariance = params.omega + params.alpha * (lastReturn * lastReturn) + params.beta * lastVariance;

    // For multi-step ahead, variance accumulates
    const adjustedVariance = forecastVariance * (horizonMins / 1440); // Scale to horizon

    return Math.sqrt(Math.max(0.0001, adjustedVariance));
  }

  /**
   * Update GARCH parameters using simplified moment estimation
   */
  private updateGARCH(symbol: string, data: PriceReturn[]): void {
    if (data.length < 100) return;

    const returns = data.slice(-100).map(d => d.return);
    const variances = returns.map(r => r * r);

    // Simple moment-based estimation (in practice would use MLE)
    const meanVariance = variances.reduce((sum, v) => sum + v, 0) / variances.length;
    const omega = meanVariance * 0.1;  // Long-run variance component
    const alpha = 0.1;                 // ARCH coefficient
    const beta = 0.85;                 // GARCH coefficient

    // Ensure stationarity: α + β < 1
    const persistence = alpha + beta;
    const adjustedAlpha = persistence >= 1 ? 0.05 : alpha;
    const adjustedBeta = persistence >= 1 ? 0.9 : beta;

    this.garchParams.set(symbol, {
      omega,
      alpha: adjustedAlpha,
      beta: adjustedBeta,
      sigma2: variances[variances.length - 1] || meanVariance
    });

    logger.debug(`[VolatilityModels] Updated GARCH(${symbol}): ω=${omega.toFixed(6)}, α=${adjustedAlpha}, β=${adjustedBeta}`);
  }

  /**
   * Generate mock forecast for testing
   */
  generateMockForecast(symbol: string, horizonMins: number = 60): VolatilityForecast {
    // Generate realistic values
    const baseVol = 0.015 + Math.random() * 0.025; // 1.5% to 4%
    const noise = (Math.random() - 0.5) * 0.005;   // ±0.5% noise

    return {
      symbol,
      horizonMins,
      sigmaHAR: baseVol + noise,
      sigmaGARCH: baseVol + noise * 0.8, // Slightly different
      timestamp: new Date()
    };
  }
}

export const volatilityModels = new VolatilityModels();
