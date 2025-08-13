
/**
 * Volatility Models Service
 * HAR-RV and GARCH(1,1) volatility forecasting
 */

import { logger } from '../../utils/logger';
import { db } from '../db';
import { marketBars } from '../../shared/schema';
import { desc, eq, gte, and } from 'drizzle-orm';

export interface VolatilityForecast {
  symbol: string;
  horizon_mins: number;
  timestamp: Date;
  sigmaHAR: number;    // HAR-RV forecast
  sigmaGARCH: number;  // GARCH(1,1) forecast
  confidence: number;  // Model confidence 0-1
}

export interface RealizedVolData {
  timestamp: Date;
  rv_daily: number;
  rv_weekly: number;
  rv_monthly: number;
  return_squared: number;
}

class VolatilityModels {
  private forecasts = new Map<string, VolatilityForecast>();
  private rvCache = new Map<string, RealizedVolData[]>();

  // HAR-RV parameters (would be fitted in practice)
  private harParams = {
    alpha: 0.0002,   // Intercept
    beta_d: 0.3,     // Daily RV coefficient
    beta_w: 0.4,     // Weekly RV coefficient  
    beta_m: 0.2      // Monthly RV coefficient
  };

  // GARCH(1,1) parameters (would be fitted in practice)
  private garchParams = {
    omega: 0.00001,  // Constant
    alpha: 0.08,     // ARCH coefficient
    beta: 0.90       // GARCH coefficient
  };

  /**
   * Forecast volatility using HAR-RV and GARCH models
   */
  async forecastVol(symbol: string, horizonMins: number = 60): Promise<VolatilityForecast> {
    try {
      // Get realized volatility data
      const rvData = await this.getRealizedVolData(symbol);
      
      if (rvData.length < 22) {
        // Fallback to simple estimation if insufficient data
        return this.generateFallbackForecast(symbol, horizonMins);
      }

      // Calculate HAR-RV forecast
      const sigmaHAR = this.calculateHARForecast(rvData);

      // Calculate GARCH(1,1) forecast  
      const sigmaGARCH = this.calculateGARCHForecast(rvData);

      // Model confidence based on data quality
      const confidence = Math.min(rvData.length / 100, 1.0);

      const forecast: VolatilityForecast = {
        symbol,
        horizon_mins: horizonMins,
        timestamp: new Date(),
        sigmaHAR,
        sigmaGARCH,
        confidence
      };

      this.forecasts.set(`${symbol}_${horizonMins}`, forecast);

      logger.debug(`[VolModels] Forecast ${symbol}: HAR=${sigmaHAR.toFixed(4)}, GARCH=${sigmaGARCH.toFixed(4)}`);

      return forecast;

    } catch (error) {
      logger.error(`[VolModels] Error forecasting ${symbol}:`, error);
      return this.generateFallbackForecast(symbol, horizonMins);
    }
  }

  /**
   * Calculate HAR-RV forecast
   * RV_t = α + β_d*RV_{t-1} + β_w*RV_{t-5:t-1} + β_m*RV_{t-22:t-1}
   */
  private calculateHARForecast(rvData: RealizedVolData[]): number {
    if (rvData.length < 22) return 0.02; // 2% fallback

    const latest = rvData[rvData.length - 1];
    
    // Daily RV (yesterday)
    const rv_d = latest.rv_daily;

    // Weekly RV (average of last 5 days)
    const weeklyData = rvData.slice(-5);
    const rv_w = weeklyData.reduce((sum, d) => sum + d.rv_daily, 0) / weeklyData.length;

    // Monthly RV (average of last 22 days)  
    const monthlyData = rvData.slice(-22);
    const rv_m = monthlyData.reduce((sum, d) => sum + d.rv_daily, 0) / monthlyData.length;

    // HAR-RV forecast
    const forecastRV = this.harParams.alpha + 
                      this.harParams.beta_d * rv_d +
                      this.harParams.beta_w * rv_w +
                      this.harParams.beta_m * rv_m;

    // Convert to volatility (sqrt of variance)
    return Math.sqrt(Math.max(forecastRV, 0.0001));
  }

  /**
   * Calculate GARCH(1,1) forecast
   * σ²_t = ω + α*r²_{t-1} + β*σ²_{t-1}
   */
  private calculateGARCHForecast(rvData: RealizedVolData[]): number {
    if (rvData.length < 2) return 0.02; // 2% fallback

    const latest = rvData[rvData.length - 1];
    const previous = rvData[rvData.length - 2];

    // Last period squared return
    const r_squared = latest.return_squared;

    // Last period conditional variance (use RV as proxy)
    const sigma_squared_prev = previous.rv_daily;

    // GARCH(1,1) forecast
    const sigma_squared = this.garchParams.omega +
                         this.garchParams.alpha * r_squared +
                         this.garchParams.beta * sigma_squared_prev;

    // Convert to volatility
    return Math.sqrt(Math.max(sigma_squared, 0.0001));
  }

  /**
   * Get realized volatility data from market bars
   */
  private async getRealizedVolData(symbol: string): Promise<RealizedVolData[]> {
    // Check cache first
    const cached = this.rvCache.get(symbol);
    if (cached && cached.length > 0) {
      return cached;
    }

    try {
      // Get last 50 days of 1-minute bars
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 50 * 24 * 60 * 60 * 1000);

      const bars = await db
        .select()
        .from(marketBars)
        .where(
          and(
            eq(marketBars.symbol, symbol),
            gte(marketBars.timestamp, startTime)
          )
        )
        .orderBy(desc(marketBars.timestamp))
        .limit(50 * 24 * 60); // 50 days of 1-min bars

      if (bars.length === 0) {
        return this.generateMockRVData(symbol);
      }

      // Calculate daily realized volatility
      const rvData = this.calculateRealizedVol(bars);
      
      this.rvCache.set(symbol, rvData);
      return rvData;

    } catch (error) {
      logger.error(`[VolModels] Error getting RV data for ${symbol}:`, error);
      return this.generateMockRVData(symbol);
    }
  }

  /**
   * Calculate realized volatility from intraday bars
   */
  private calculateRealizedVol(bars: any[]): RealizedVolData[] {
    if (bars.length === 0) return [];

    // Group bars by day
    const dailyBars = new Map<string, any[]>();
    
    for (const bar of bars) {
      const dateKey = bar.timestamp.toISOString().split('T')[0];
      if (!dailyBars.has(dateKey)) {
        dailyBars.set(dateKey, []);
      }
      dailyBars.get(dateKey)!.push(bar);
    }

    const rvData: RealizedVolData[] = [];

    for (const [date, dayBars] of dailyBars) {
      if (dayBars.length < 10) continue; // Need sufficient intraday data

      // Sort bars by timestamp
      dayBars.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Calculate sum of squared returns
      let sumSquaredReturns = 0;
      let dailyReturn = 0;

      for (let i = 1; i < dayBars.length; i++) {
        const prevClose = parseFloat(dayBars[i-1].close);
        const currentClose = parseFloat(dayBars[i].close);
        
        if (prevClose > 0) {
          const logReturn = Math.log(currentClose / prevClose);
          sumSquaredReturns += logReturn * logReturn;
        }
      }

      // Daily return for GARCH
      const firstPrice = parseFloat(dayBars[0].open);
      const lastPrice = parseFloat(dayBars[dayBars.length - 1].close);
      if (firstPrice > 0) {
        dailyReturn = Math.log(lastPrice / firstPrice);
      }

      const rv_daily = sumSquaredReturns;
      
      rvData.push({
        timestamp: new Date(date),
        rv_daily,
        rv_weekly: rv_daily, // Will be averaged later
        rv_monthly: rv_daily, // Will be averaged later
        return_squared: dailyReturn * dailyReturn
      });
    }

    return rvData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Generate mock RV data for testing
   */
  private generateMockRVData(symbol: string): RealizedVolData[] {
    const data: RealizedVolData[] = [];
    const baseVol = symbol.includes('BTC') ? 0.04 : 0.05; // 4-5% daily vol
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000);
      const rv = baseVol * baseVol * (0.5 + Math.random()); // Add randomness
      const ret = (Math.random() - 0.5) * baseVol * 2; // Daily return
      
      data.push({
        timestamp: date,
        rv_daily: rv,
        rv_weekly: rv,
        rv_monthly: rv,
        return_squared: ret * ret
      });
    }
    
    return data;
  }

  /**
   * Generate fallback forecast when insufficient data
   */
  private generateFallbackForecast(symbol: string, horizonMins: number): VolatilityForecast {
    // Use historical averages as fallback
    const baseVol = symbol.includes('BTC') ? 0.04 : 
                   symbol.includes('ETH') ? 0.05 : 0.06;
    
    // Scale by horizon
    const horizonScale = Math.sqrt(horizonMins / (24 * 60));
    const sigma = baseVol * horizonScale;

    return {
      symbol,
      horizon_mins: horizonMins,
      timestamp: new Date(),
      sigmaHAR: sigma,
      sigmaGARCH: sigma,
      confidence: 0.5 // Low confidence for fallback
    };
  }

  /**
   * Get cached forecast
   */
  getForecast(symbol: string, horizonMins: number = 60): VolatilityForecast | null {
    return this.forecasts.get(`${symbol}_${horizonMins}`) || null;
  }

  /**
   * Clear cache for symbol
   */
  clearCache(symbol: string): void {
    this.rvCache.delete(symbol);
    
    // Clear forecasts for this symbol
    for (const key of this.forecasts.keys()) {
      if (key.startsWith(symbol)) {
        this.forecasts.delete(key);
      }
    }
  }
}

export const volatilityModels = new VolatilityModels();
