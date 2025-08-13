
/**
 * Options Smile Analysis Service
 * Risk reversal, butterfly, and skew analysis
 */

import { logger } from '../../utils/logger';

export interface OptionQuote {
  symbol: string;
  strike: number;
  expiry: string;
  type: 'call' | 'put';
  iv: number;           // Implied volatility
  price?: number;       // Option price
  delta?: number;       // Option delta
  volume?: number;      // Trading volume
}

export interface OptionChain {
  symbol: string;
  timestamp: Date;
  underlying_price: number;
  options: OptionQuote[];
}

export interface SmileMetrics {
  symbol: string;
  timestamp: Date;
  rr25: number;         // 25-delta risk reversal
  fly25: number;        // 25-delta butterfly
  iv_term_slope: number; // Term structure slope
  skew_z: number;       // Skew z-score
  atm_iv: number;       // At-the-money IV
  iv_smile_curve: Array<{ strike_ratio: number; iv: number }>; // IV smile curve
}

class OptionsSmile {
  private chains = new Map<string, OptionChain>();
  private metrics = new Map<string, SmileMetrics>();

  /**
   * Store option chain and compute smile metrics
   */
  storeChain(chain: OptionChain): SmileMetrics {
    const { symbol } = chain;
    this.chains.set(symbol, chain);

    // Compute smile metrics
    const metrics = this.computeSmileMetrics(chain);
    this.metrics.set(symbol, metrics);

    logger.info(`[OptionsSmile] Updated ${symbol}: RR25=${metrics.rr25.toFixed(3)}, FLY25=${metrics.fly25.toFixed(3)}`);

    return metrics;
  }

  /**
   * Get smile metrics for symbol
   */
  getSmileMetrics(symbol: string): SmileMetrics | null {
    return this.metrics.get(symbol) || null;
  }

  /**
   * Compute comprehensive smile metrics
   */
  private computeSmileMetrics(chain: OptionChain): SmileMetrics {
    const { symbol, timestamp, underlying_price, options } = chain;

    // Group options by expiry
    const expiryGroups = this.groupByExpiry(options);
    
    // Use nearest expiry for current metrics
    const nearestExpiry = this.getNearestExpiry(expiryGroups);
    const nearOptions = expiryGroups.get(nearestExpiry) || [];

    // Calculate 25-delta risk reversal
    const rr25 = this.calculate25DeltaRiskReversal(nearOptions, underlying_price);

    // Calculate 25-delta butterfly
    const fly25 = this.calculate25DeltaButterfly(nearOptions, underlying_price);

    // Calculate ATM IV
    const atm_iv = this.calculateATMIV(nearOptions, underlying_price);

    // Calculate term structure slope
    const iv_term_slope = this.calculateTermSlope(expiryGroups, underlying_price);

    // Calculate skew z-score
    const skew_z = this.calculateSkewZScore(nearOptions, underlying_price);

    // Build IV smile curve
    const iv_smile_curve = this.buildSmileCurve(nearOptions, underlying_price);

    return {
      symbol,
      timestamp,
      rr25,
      fly25,
      iv_term_slope,
      skew_z,
      atm_iv,
      iv_smile_curve
    };
  }

  /**
   * Calculate 25-delta risk reversal (Call IV - Put IV)
   */
  private calculate25DeltaRiskReversal(options: OptionQuote[], spotPrice: number): number {
    const call25 = this.findOptionByDelta(options, 0.25, 'call', spotPrice);
    const put25 = this.findOptionByDelta(options, -0.25, 'put', spotPrice);

    if (!call25 || !put25) {
      return this.estimateRiskReversal(options, spotPrice);
    }

    return call25.iv - put25.iv;
  }

  /**
   * Calculate 25-delta butterfly spread
   */
  private calculate25DeltaButterfly(options: OptionQuote[], spotPrice: number): number {
    const call25 = this.findOptionByDelta(options, 0.25, 'call', spotPrice);
    const put25 = this.findOptionByDelta(options, -0.25, 'put', spotPrice);
    const atmCall = this.findATMOption(options, 'call', spotPrice);
    const atmPut = this.findATMOption(options, 'put', spotPrice);

    if (!call25 || !put25 || !atmCall || !atmPut) {
      return this.estimateButterfly(options, spotPrice);
    }

    const wingIV = (call25.iv + put25.iv) / 2;
    const atmIV = (atmCall.iv + atmPut.iv) / 2;

    return wingIV - atmIV;
  }

  /**
   * Calculate at-the-money implied volatility
   */
  private calculateATMIV(options: OptionQuote[], spotPrice: number): number {
    const atmCall = this.findATMOption(options, 'call', spotPrice);
    const atmPut = this.findATMOption(options, 'put', spotPrice);

    if (atmCall && atmPut) {
      return (atmCall.iv + atmPut.iv) / 2;
    } else if (atmCall) {
      return atmCall.iv;
    } else if (atmPut) {
      return atmPut.iv;
    }

    // Fallback: average all IVs
    const allIVs = options.map(opt => opt.iv).filter(iv => iv > 0);
    return allIVs.length > 0 ? allIVs.reduce((sum, iv) => sum + iv, 0) / allIVs.length : 0.2;
  }

  /**
   * Calculate term structure slope
   */
  private calculateTermSlope(expiryGroups: Map<string, OptionQuote[]>, spotPrice: number): number {
    if (expiryGroups.size < 2) return 0;

    const expiries = Array.from(expiryGroups.keys()).sort();
    const nearExpiry = expiries[0];
    const farExpiry = expiries[expiries.length - 1];

    const nearATM = this.calculateATMIV(expiryGroups.get(nearExpiry) || [], spotPrice);
    const farATM = this.calculateATMIV(expiryGroups.get(farExpiry) || [], spotPrice);

    // Days to expiry (simplified)
    const nearDays = this.getDaysToExpiry(nearExpiry);
    const farDays = this.getDaysToExpiry(farExpiry);

    if (farDays <= nearDays) return 0;

    // Slope per day
    return (farATM - nearATM) / (farDays - nearDays);
  }

  /**
   * Calculate skew z-score
   */
  private calculateSkewZScore(options: OptionQuote[], spotPrice: number): number {
    // Get IVs for OTM puts and calls
    const otmPuts = options.filter(opt => opt.type === 'put' && opt.strike < spotPrice * 0.95);
    const otmCalls = options.filter(opt => opt.type === 'call' && opt.strike > spotPrice * 1.05);

    if (otmPuts.length === 0 || otmCalls.length === 0) return 0;

    const putIVs = otmPuts.map(opt => opt.iv);
    const callIVs = otmCalls.map(opt => opt.iv);

    const avgPutIV = putIVs.reduce((sum, iv) => sum + iv, 0) / putIVs.length;
    const avgCallIV = callIVs.reduce((sum, iv) => sum + iv, 0) / callIVs.length;

    // Simple skew measure (put IV - call IV)
    const skew = avgPutIV - avgCallIV;

    // Normalize to z-score (using historical average of 0.05, std of 0.02)
    return (skew - 0.05) / 0.02;
  }

  /**
   * Build IV smile curve
   */
  private buildSmileCurve(options: OptionQuote[], spotPrice: number): Array<{ strike_ratio: number; iv: number }> {
    const curve: Array<{ strike_ratio: number; iv: number }> = [];

    // Sort options by strike
    const sortedOptions = options
      .filter(opt => opt.iv > 0)
      .sort((a, b) => a.strike - b.strike);

    for (const option of sortedOptions) {
      const strike_ratio = option.strike / spotPrice;
      if (strike_ratio >= 0.7 && strike_ratio <= 1.3) { // Focus on +/-30% strikes
        curve.push({ strike_ratio, iv: option.iv });
      }
    }

    return curve;
  }

  /**
   * Find option closest to target delta
   */
  private findOptionByDelta(options: OptionQuote[], targetDelta: number, type: 'call' | 'put', spotPrice: number): OptionQuote | null {
    const filtered = options.filter(opt => opt.type === type && opt.delta !== undefined);
    
    if (filtered.length === 0) {
      // Fallback: estimate by moneyness
      return this.findOptionByMoneyness(options, targetDelta, type, spotPrice);
    }

    let best: OptionQuote | null = null;
    let minDiff = Infinity;

    for (const option of filtered) {
      const diff = Math.abs(option.delta! - targetDelta);
      if (diff < minDiff) {
        minDiff = diff;
        best = option;
      }
    }

    return best;
  }

  /**
   * Find option by moneyness (fallback when delta not available)
   */
  private findOptionByMoneyness(options: OptionQuote[], targetDelta: number, type: 'call' | 'put', spotPrice: number): OptionQuote | null {
    // Rough delta approximation by moneyness
    let targetMoneyness: number;
    
    if (type === 'call' && targetDelta > 0) {
      targetMoneyness = 1 + (0.5 - targetDelta) * 0.4; // Rough approximation
    } else if (type === 'put' && targetDelta < 0) {
      targetMoneyness = 1 - (0.5 + targetDelta) * 0.4; // Rough approximation
    } else {
      return null;
    }

    const filtered = options.filter(opt => opt.type === type);
    let best: OptionQuote | null = null;
    let minDiff = Infinity;

    for (const option of filtered) {
      const moneyness = option.strike / spotPrice;
      const diff = Math.abs(moneyness - targetMoneyness);
      if (diff < minDiff) {
        minDiff = diff;
        best = option;
      }
    }

    return best;
  }

  /**
   * Find at-the-money option
   */
  private findATMOption(options: OptionQuote[], type: 'call' | 'put', spotPrice: number): OptionQuote | null {
    const filtered = options.filter(opt => opt.type === type);
    
    let best: OptionQuote | null = null;
    let minDiff = Infinity;

    for (const option of filtered) {
      const diff = Math.abs(option.strike - spotPrice);
      if (diff < minDiff) {
        minDiff = diff;
        best = option;
      }
    }

    return best;
  }

  /**
   * Group options by expiry
   */
  private groupByExpiry(options: OptionQuote[]): Map<string, OptionQuote[]> {
    const groups = new Map<string, OptionQuote[]>();

    for (const option of options) {
      if (!groups.has(option.expiry)) {
        groups.set(option.expiry, []);
      }
      groups.get(option.expiry)!.push(option);
    }

    return groups;
  }

  /**
   * Get nearest expiry
   */
  private getNearestExpiry(expiryGroups: Map<string, OptionQuote[]>): string {
    const expiries = Array.from(expiryGroups.keys()).sort();
    return expiries[0];
  }

  /**
   * Get days to expiry
   */
  private getDaysToExpiry(expiry: string): number {
    const expiryDate = new Date(expiry);
    const now = new Date();
    return Math.max(1, (expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  }

  /**
   * Estimate risk reversal when exact strikes not available
   */
  private estimateRiskReversal(options: OptionQuote[], spotPrice: number): number {
    const otmCalls = options.filter(opt => opt.type === 'call' && opt.strike > spotPrice);
    const otmPuts = options.filter(opt => opt.type === 'put' && opt.strike < spotPrice);

    if (otmCalls.length === 0 || otmPuts.length === 0) return 0;

    const avgCallIV = otmCalls.reduce((sum, opt) => sum + opt.iv, 0) / otmCalls.length;
    const avgPutIV = otmPuts.reduce((sum, opt) => sum + opt.iv, 0) / otmPuts.length;

    return avgCallIV - avgPutIV;
  }

  /**
   * Estimate butterfly when exact strikes not available
   */
  private estimateButterfly(options: OptionQuote[], spotPrice: number): number {
    const atmOptions = options.filter(opt => Math.abs(opt.strike - spotPrice) / spotPrice < 0.05);
    const wingOptions = options.filter(opt => Math.abs(opt.strike - spotPrice) / spotPrice > 0.15);

    if (atmOptions.length === 0 || wingOptions.length === 0) return 0;

    const atmIV = atmOptions.reduce((sum, opt) => sum + opt.iv, 0) / atmOptions.length;
    const wingIV = wingOptions.reduce((sum, opt) => sum + opt.iv, 0) / wingOptions.length;

    return wingIV - atmIV;
  }

  /**
   * Generate mock option chain for testing
   */
  generateMockChain(symbol: string, spotPrice: number = 50000): OptionChain {
    const options: OptionQuote[] = [];
    const expiry = '2024-12-31';
    
    // Generate strikes around spot price
    const strikes = [];
    for (let i = 0.8; i <= 1.2; i += 0.05) {
      strikes.push(spotPrice * i);
    }

    for (const strike of strikes) {
      const moneyness = strike / spotPrice;
      
      // Mock IV smile (higher for OTM options)
      const baseIV = 0.6;
      const smile = Math.abs(moneyness - 1) * 0.3; // Smile effect
      const iv = baseIV + smile;

      // Add call
      options.push({
        symbol,
        strike,
        expiry,
        type: 'call',
        iv,
        delta: this.estimateDelta(moneyness, 'call')
      });

      // Add put
      options.push({
        symbol,
        strike,
        expiry,
        type: 'put',
        iv: iv + 0.05, // Put skew
        delta: this.estimateDelta(moneyness, 'put')
      });
    }

    return {
      symbol,
      timestamp: new Date(),
      underlying_price: spotPrice,
      options
    };
  }

  /**
   * Estimate delta from moneyness
   */
  private estimateDelta(moneyness: number, type: 'call' | 'put'): number {
    // Rough Black-Scholes delta approximation
    const d1 = Math.log(moneyness) / 0.2; // Assume 20% vol, simplified
    const delta = type === 'call' ? 
      0.5 + 0.4 * Math.tanh(d1) : 
      -0.5 + 0.4 * Math.tanh(d1);
    
    return Math.max(-1, Math.min(1, delta));
  }
}

export const optionsSmile = new OptionsSmile();
