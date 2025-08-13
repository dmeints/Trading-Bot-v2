
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
// Volatility Models: HAR-RV and GARCH(1,1)
interface VolForecast {
  sigmaHAR: number;
  sigmaGARCH: number;
  horizon: number;
  timestamp: number;
}

interface ReturnData {
  timestamp: number;
  return: number;
  rv: number; // Realized variance
}

class VolatilityModels {
  private symbolData = new Map<string, ReturnData[]>();
  private garchParams = new Map<string, { omega: number; alpha: number; beta: number; sigma2: number }>();
  
  private readonly MAX_HISTORY = 1440; // 24 hours of minutes

  addReturn(symbol: string, timestamp: number, price: number, prevPrice: number): void {
    if (prevPrice <= 0) return;
    
    const ret = Math.log(price / prevPrice);
    const rv = ret * ret; // Squared return as proxy for RV
    
    const data = this.getSymbolData(symbol);
    data.push({ timestamp, return: ret, rv });
    
    // Keep only recent data
    if (data.length > this.MAX_HISTORY) {
      data.shift();
    }
    
    // Update GARCH parameters
    this.updateGarch(symbol, ret);
  }

  forecastVol(symbol: string, horizonMins: number = 60): VolForecast | null {
    const data = this.symbolData.get(symbol);
    if (!data || data.length < 50) return null;
    
    const sigmaHAR = this.forecastHAR(data, horizonMins);
    const sigmaGARCH = this.forecastGARCH(symbol, horizonMins);
    
    return {
      sigmaHAR,
      sigmaGARCH,
      horizon: horizonMins,
      timestamp: Date.now()
    };
  }

  private getSymbolData(symbol: string): ReturnData[] {
    if (!this.symbolData.has(symbol)) {
      this.symbolData.set(symbol, []);
    }
    return this.symbolData.get(symbol)!;
  }

  private forecastHAR(data: ReturnData[], horizonMins: number): number {
    if (data.length < 22) return 0;
    
    // HAR-RV: RV_t = c + β_d * RV_{t-1} + β_w * RV_{t-5:t-1} + β_m * RV_{t-22:t-1}
    const recent = data.slice(-22);
    
    // Daily (last value)
    const rvDaily = recent[recent.length - 1].rv;
    
    // Weekly (last 5 values average)
    const rvWeekly = recent.slice(-5).reduce((sum, d) => sum + d.rv, 0) / 5;
    
    // Monthly (all 22 values average) 
    const rvMonthly = recent.reduce((sum, d) => sum + d.rv, 0) / recent.length;
    
    // Simple HAR coefficients (in practice, these would be estimated)
    const beta_d = 0.4;
    const beta_w = 0.3;
    const beta_m = 0.2;
    const c = 0.1;
    
    const forecastRV = c + beta_d * rvDaily + beta_w * rvWeekly + beta_m * rvMonthly;
    
    // Convert to volatility and scale by horizon
    return Math.sqrt(forecastRV * horizonMins / (24 * 60) * 252);
  }

  private updateGarch(symbol: string, currentReturn: number): void {
    if (!this.garchParams.has(symbol)) {
      // Initialize with typical crypto parameters
      this.garchParams.set(symbol, {
        omega: 0.00001,
        alpha: 0.1,
        beta: 0.85,
        sigma2: currentReturn * currentReturn
      });
      return;
    }
    
    const params = this.garchParams.get(symbol)!;
    
    // GARCH(1,1): σ²_t = ω + α * r²_{t-1} + β * σ²_{t-1}
    const newSigma2 = params.omega + params.alpha * (currentReturn * currentReturn) + params.beta * params.sigma2;
    
    params.sigma2 = Math.max(newSigma2, 0.000001); // Prevent negative variance
    
    // Simple online estimation (in practice, use MLE)
    const decay = 0.99;
    params.omega *= decay;
    params.alpha = Math.min(Math.max(params.alpha + 0.0001 * Math.random() - 0.00005, 0.05), 0.3);
    params.beta = Math.min(Math.max(params.beta + 0.0001 * Math.random() - 0.00005, 0.6), 0.95);
  }

  private forecastGARCH(symbol: string, horizonMins: number): number {
    const params = this.garchParams.get(symbol);
    if (!params) return 0;
    
    // Multi-step GARCH forecast (simplified)
    const steps = Math.max(1, Math.floor(horizonMins / 5)); // 5-min intervals
    let forecastVar = params.sigma2;
    
    // Unconditional variance for long-term forecast
    const unconditionalVar = params.omega / (1 - params.alpha - params.beta);
    
    for (let i = 1; i <= steps; i++) {
      const weight = Math.pow(params.alpha + params.beta, i - 1);
      forecastVar = weight * params.sigma2 + (1 - weight) * unconditionalVar;
    }
    
    // Convert to annualized volatility
    return Math.sqrt(forecastVar * 252 * 24 * 60 / 5); // 5-min intervals to annual
  }
}

export const volatilityModels = new VolatilityModels();
export type { VolForecast };
