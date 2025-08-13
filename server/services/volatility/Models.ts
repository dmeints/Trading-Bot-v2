import { logger } from '../../utils/logger.js';

interface VolForecast {
  sigmaHAR: number;
  sigmaGARCH: number;
  confidence: number;
}

interface PriceData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

class VolatilityModels {
  private priceHistory: Map<string, PriceData[]> = new Map();
  private garchParams: Map<string, { omega: number; alpha: number; beta: number; sigma2: number }> = new Map();

  addPriceData(symbol: string, data: PriceData): void {
    try {
      const history = this.priceHistory.get(symbol) || [];
      history.push(data);

      // Keep last 1000 observations
      if (history.length > 1000) {
        history.shift();
      }

      this.priceHistory.set(symbol, history);

      // Update GARCH parameters periodically
      if (history.length % 50 === 0 && history.length >= 100) {
        this.updateGarchParams(symbol, history);
      }

    } catch (error) {
      logger.error(`Error adding price data for ${symbol}:`, { error: String(error) });
    }
  }

  forecastVol(symbol: string, horizonMins: number = 60): VolForecast {
    try {
      const history = this.priceHistory.get(symbol);

      if (!history || history.length < 22) {
        // Generate reasonable defaults for missing data
        const baseVol = symbol === 'BTCUSDT' ? 0.6 : 0.8;
        return {
          sigmaHAR: baseVol * Math.sqrt(horizonMins / (24 * 60)),
          sigmaGARCH: baseVol * Math.sqrt(horizonMins / (24 * 60)),
          confidence: 0.3
        };
      }

      // Calculate realized variance components for HAR-RV
      const rv = this.calculateRealizedVariance(history);
      const sigmaHAR = this.harRvForecast(rv, horizonMins);

      // GARCH(1,1) forecast
      const returns = this.calculateReturns(history);
      const sigmaGARCH = this.garchForecast(symbol, returns, horizonMins);

      return {
        sigmaHAR: Math.max(0.001, sigmaHAR),
        sigmaGARCH: Math.max(0.001, sigmaGARCH),
        confidence: Math.min(0.95, history.length / 500)
      };

    } catch (error) {
      logger.error(`Error forecasting volatility for ${symbol}:`, { error: String(error) });
      return { sigmaHAR: 0.02, sigmaGARCH: 0.02, confidence: 0.1 };
    }
  }

  private calculateReturns(history: PriceData[]): number[] {
    const returns: number[] = [];

    for (let i = 1; i < history.length; i++) {
      const ret = Math.log(history[i].close / history[i - 1].close);
      if (isFinite(ret)) {
        returns.push(ret);
      }
    }

    return returns;
  }

  private calculateRealizedVariance(history: PriceData[]): number[] {
    const rv: number[] = [];

    // Calculate daily realized variance using Garman-Klass estimator
    for (const candle of history) {
      if (candle.high > 0 && candle.low > 0 && candle.open > 0 && candle.close > 0) {
        const gk = 0.5 * Math.pow(Math.log(candle.high / candle.low), 2) - 
                   (2 * Math.log(2) - 1) * Math.pow(Math.log(candle.close / candle.open), 2);

        if (isFinite(gk) && gk >= 0) {
          rv.push(gk);
        }
      }
    }

    return rv;
  }

  private harRvForecast(rv: number[], horizonMins: number): number {
    if (rv.length < 22) return 0.02;

    // HAR-RV model: RV_t+1 = β₀ + β₁*RV_t + β₂*RV_t^(w) + β₃*RV_t^(m)
    const rvDaily = rv[rv.length - 1] || 0.0004;
    const rvWeekly = rv.length >= 5 ? rv.slice(-5).reduce((a, b) => a + b, 0) / 5 : rvDaily;
    const rvMonthly = rv.length >= 22 ? rv.slice(-22).reduce((a, b) => a + b, 0) / 22 : rvDaily;

    // Simple HAR coefficients (would be estimated in practice)
    const beta0 = 0.0001;
    const beta1 = 0.3;
    const beta2 = 0.4;
    const beta3 = 0.2;

    const forecastRV = beta0 + beta1 * rvDaily + beta2 * rvWeekly + beta3 * rvMonthly;

    // Convert to volatility and scale by horizon
    return Math.sqrt(Math.max(0.00001, forecastRV) * (horizonMins / (24 * 60)));
  }

  private garchForecast(symbol: string, returns: number[], horizonMins: number): number {
    if (returns.length < 10) return 0.02;

    // Get or initialize GARCH parameters
    let params = this.garchParams.get(symbol);
    if (!params) {
      // Default GARCH(1,1) parameters
      params = {
        omega: 0.00001,  // Long-run variance
        alpha: 0.1,      // ARCH coefficient
        beta: 0.85,      // GARCH coefficient
        sigma2: this.calculateSampleVariance(returns)
      };
      this.garchParams.set(symbol, params);
    }

    // Update conditional variance with latest return
    const latestReturn = returns[returns.length - 1] || 0;
    const newSigma2 = params.omega + params.alpha * latestReturn * latestReturn + params.beta * params.sigma2;

    params.sigma2 = Math.max(0.00001, newSigma2);
    this.garchParams.set(symbol, params);

    // Multi-step forecast (simplified)
    const horizonDays = horizonMins / (24 * 60);
    const longRunVar = params.omega / (1 - params.alpha - params.beta);
    const forecastVar = longRunVar + (params.sigma2 - longRunVar) * Math.pow(params.alpha + params.beta, horizonDays);

    return Math.sqrt(Math.max(0.00001, forecastVar));
  }

  private calculateSampleVariance(returns: number[]): number {
    if (returns.length === 0) return 0.0004;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

    return Math.max(0.00001, variance);
  }

  private updateGarchParams(symbol: string, history: PriceData[]): void {
    try {
      const returns = this.calculateReturns(history.slice(-100)); // Use last 100 observations
      if (returns.length < 20) return;

      // Simple method-of-moments estimation (simplified)
      const variance = this.calculateSampleVariance(returns);
      const persistenceTarget = 0.9; // Target for alpha + beta

      const params = {
        omega: variance * (1 - persistenceTarget),
        alpha: 0.1,
        beta: persistenceTarget - 0.1,
        sigma2: variance
      };

      this.garchParams.set(symbol, params);
      logger.info(`Updated GARCH parameters for ${symbol}`, params);

    } catch (error) {
      logger.error(`Error updating GARCH params for ${symbol}:`, { error: String(error) });
    }
  }

  // Generate synthetic price history for testing
  generateSyntheticHistory(symbol: string, periods: number = 100): void {
    const basePrice = symbol === 'BTCUSDT' ? 45000 : 3000;
    let price = basePrice;
    const history: PriceData[] = [];

    for (let i = 0; i < periods; i++) {
      const volatility = 0.02; // 2% daily vol
      const return_ = (Math.random() - 0.5) * volatility * 2;
      const newPrice = price * (1 + return_);

      // Generate OHLC
      const high = newPrice * (1 + Math.random() * 0.01);
      const low = newPrice * (1 - Math.random() * 0.01);

      history.push({
        timestamp: Date.now() - (periods - i) * 24 * 60 * 60 * 1000,
        open: price,
        high,
        low,
        close: newPrice
      });

      price = newPrice;
    }

    this.priceHistory.set(symbol, history);
    this.updateGarchParams(symbol, history);
  }
}

export const volatilityModels = new VolatilityModels();
export type { VolForecast, PriceData };