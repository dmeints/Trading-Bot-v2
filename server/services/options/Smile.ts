
/**
 * Options Smile & Skew Features Service
 * Compute IV smile metrics, risk reversal, butterfly, term structure
 */

import { logger } from '../../utils/logger';

export interface OptionData {
  k: number;        // Strike ratio (K/S)
  tenor: string;    // Time to expiry (e.g., "7d", "30d")
  type: 'call' | 'put';
  iv: number;       // Implied volatility
}

export interface OptionChain {
  symbol: string;
  timestamp: Date;
  spot: number;
  chain: OptionData[];
}

export interface SmileMetrics {
  symbol: string;
  timestamp: Date;
  rr25: number;        // 25-delta risk reversal
  fly25: number;       // 25-delta butterfly
  iv_term_slope: number; // Term structure slope
  skew_z: number;      // Skew z-score
  atm_iv: number;      // At-the-money IV
}

class OptionsSmile {
  private chains = new Map<string, OptionChain>();
  private metrics = new Map<string, SmileMetrics>();

  /**
   * Store option chain snapshot
   */
  storeChain(symbol: string, chain: OptionData[], spot?: number): OptionChain {
    const timestamp = new Date();
    const estimatedSpot = spot || this.estimateSpot(chain);
    
    const optionChain: OptionChain = {
      symbol,
      timestamp,
      spot: estimatedSpot,
      chain: chain.map(opt => ({
        ...opt,
        k: opt.k // Assume k is already strike ratio K/S
      }))
    };

    this.chains.set(symbol, optionChain);
    
    // Compute metrics immediately
    const metrics = this.computeSmileMetrics(optionChain);
    this.metrics.set(symbol, metrics);

    logger.debug(`[OptionsSmile] Stored chain for ${symbol}: ${chain.length} options, ATM IV: ${metrics.atm_iv.toFixed(3)}`);

    return optionChain;
  }

  /**
   * Get computed smile metrics
   */
  getMetrics(symbol: string): SmileMetrics | null {
    return this.metrics.get(symbol) || null;
  }

  /**
   * Get stored chain
   */
  getChain(symbol: string): OptionChain | null {
    return this.chains.get(symbol) || null;
  }

  /**
   * Compute smile metrics from option chain
   */
  private computeSmileMetrics(chain: OptionChain): SmileMetrics {
    const { symbol, timestamp } = chain;

    // Get ATM IV (closest to K=1.0)
    const atm_iv = this.getATMVolatility(chain);

    // Compute 25-delta risk reversal and butterfly
    const { rr25, fly25 } = this.compute25DeltaMetrics(chain);

    // Compute term structure slope
    const iv_term_slope = this.computeTermSlope(chain);

    // Compute skew z-score
    const skew_z = this.computeSkewZScore(chain);

    return {
      symbol,
      timestamp,
      rr25,
      fly25,
      iv_term_slope,
      skew_z,
      atm_iv
    };
  }

  /**
   * Get at-the-money volatility (closest to K=1.0)
   */
  private getATMVolatility(chain: OptionChain): number {
    let closestOption = chain.chain[0];
    let minDistance = Math.abs(closestOption.k - 1.0);

    for (const option of chain.chain) {
      const distance = Math.abs(option.k - 1.0);
      if (distance < minDistance) {
        minDistance = distance;
        closestOption = option;
      }
    }

    return closestOption.iv;
  }

  /**
   * Compute 25-delta risk reversal and butterfly
   * RR25 = IV(25Δ Call) - IV(25Δ Put)
   * BF25 = [IV(25Δ Call) + IV(25Δ Put)]/2 - IV(ATM)
   */
  private compute25DeltaMetrics(chain: OptionChain): { rr25: number; fly25: number } {
    // Approximate 25-delta strikes as K=0.9 (put) and K=1.1 (call)
    const call25 = this.findClosestOption(chain, 1.1, 'call');
    const put25 = this.findClosestOption(chain, 0.9, 'put');
    const atm = this.getATMVolatility(chain);

    if (!call25 || !put25) {
      return { rr25: 0, fly25: 0 };
    }

    const rr25 = call25.iv - put25.iv;
    const fly25 = (call25.iv + put25.iv) / 2 - atm;

    return { rr25, fly25 };
  }

  /**
   * Find closest option to target strike and type
   */
  private findClosestOption(chain: OptionChain, targetK: number, type: 'call' | 'put'): OptionData | null {
    const options = chain.chain.filter(opt => opt.type === type);
    
    if (options.length === 0) return null;

    let closest = options[0];
    let minDistance = Math.abs(closest.k - targetK);

    for (const option of options) {
      const distance = Math.abs(option.k - targetK);
      if (distance < minDistance) {
        minDistance = distance;
        closest = option;
      }
    }

    return closest;
  }

  /**
   * Compute term structure slope
   * Slope of IV vs time to expiry
   */
  private computeTermSlope(chain: OptionChain): number {
    // Group by tenor and get ATM IV for each
    const tenorIVs = new Map<string, number>();
    const tenorDays = new Map<string, number>();

    // Convert tenor strings to days
    const tenorToDays = (tenor: string): number => {
      const match = tenor.match(/(\d+)([dwy])/);
      if (!match) return 7; // Default 7 days

      const value = parseInt(match[1]);
      const unit = match[2];

      switch (unit) {
        case 'd': return value;
        case 'w': return value * 7;
        case 'y': return value * 365;
        default: return value;
      }
    };

    // Get ATM IV for each tenor
    for (const option of chain.chain) {
      const days = tenorToDays(option.tenor);
      const currentIV = tenorIVs.get(option.tenor);
      
      if (!currentIV || Math.abs(option.k - 1.0) < 0.1) {
        tenorIVs.set(option.tenor, option.iv);
        tenorDays.set(option.tenor, days);
      }
    }

    // Calculate slope using simple linear regression
    if (tenorIVs.size < 2) return 0;

    const points: Array<[number, number]> = [];
    for (const [tenor, iv] of tenorIVs) {
      const days = tenorDays.get(tenor)!;
      points.push([days, iv]);
    }

    // Simple slope calculation
    if (points.length < 2) return 0;

    const [x1, y1] = points[0];
    const [x2, y2] = points[points.length - 1];

    return (y2 - y1) / (x2 - x1);
  }

  /**
   * Compute skew z-score
   * Standardized measure of put-call skew
   */
  private computeSkewZScore(chain: OptionChain): number {
    const skews: number[] = [];

    // Calculate skew at different strikes
    for (let k = 0.8; k <= 1.2; k += 0.1) {
      const call = this.findClosestOption(chain, k, 'call');
      const put = this.findClosestOption(chain, k, 'put');

      if (call && put) {
        const skew = call.iv - put.iv;
        skews.push(skew);
      }
    }

    if (skews.length === 0) return 0;

    // Calculate z-score
    const mean = skews.reduce((sum, s) => sum + s, 0) / skews.length;
    const variance = skews.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / skews.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    // Return z-score of the most recent skew
    const latestSkew = skews[skews.length - 1];
    return (latestSkew - mean) / stdDev;
  }

  /**
   * Estimate spot price from option chain
   */
  private estimateSpot(chain: OptionData[]): number {
    // Simple estimation: average of strikes weighted by proximity to ATM
    const atmOptions = chain.filter(opt => Math.abs(opt.k - 1.0) < 0.1);
    
    if (atmOptions.length === 0) {
      return 50000; // Default fallback for BTC
    }

    // Assume strikes are already ratios, so spot = 1.0 reference
    return 50000; // For BTC, could be parameterized
  }

  /**
   * Generate mock option chain for testing
   */
  generateMockChain(symbol: string): OptionChain {
    const spot = symbol.includes('BTC') ? 50000 : 3000;
    const baseIV = 0.6;
    
    const chain: OptionData[] = [];
    
    // Generate options at various strikes and tenors
    const strikes = [0.8, 0.9, 1.0, 1.1, 1.2];
    const tenors = ['7d', '30d', '90d'];

    for (const k of strikes) {
      for (const tenor of tenors) {
        // Add some skew: puts more expensive, calls cheaper at extremes
        const skewAdjustment = (k - 1.0) * 0.1;
        
        chain.push({
          k,
          tenor,
          type: 'call',
          iv: baseIV - skewAdjustment + Math.random() * 0.1
        });

        chain.push({
          k,
          tenor,
          type: 'put',
          iv: baseIV + skewAdjustment + Math.random() * 0.1
        });
      }
    }

    return this.storeChain(symbol, chain, spot);
  }
}

export const optionsSmile = new OptionsSmile();
// Options IV Smile: Risk Reversal, Butterfly, Term Slope, Skew Z
interface OptionQuote {
  k: number; // Strike ratio (K/S)
  tenor: string; // e.g., "7d", "30d"
  type: 'call' | 'put';
  iv: number; // Implied volatility
}

interface OptionChain {
  chain: OptionQuote[];
  timestamp?: number;
}

interface SmileMetrics {
  rr25: number; // 25 delta risk reversal
  fly25: number; // 25 delta butterfly
  iv_term_slope: number; // Term structure slope
  skew_z: number; // Skew z-score
  timestamp: number;
}

class OptionsSmile {
  private chains = new Map<string, OptionChain>();
  
  storeChain(symbol: string, chain: OptionQuote[]): void {
    this.chains.set(symbol, {
      chain: chain.map(opt => ({
        ...opt,
        k: Number(opt.k),
        iv: Number(opt.iv)
      })),
      timestamp: Date.now()
    });
  }

  getSmileMetrics(symbol: string): SmileMetrics | null {
    const chainData = this.chains.get(symbol);
    if (!chainData || chainData.chain.length === 0) return null;

    const { chain } = chainData;
    
    const rr25 = this.calculateRiskReversal(chain);
    const fly25 = this.calculateButterfly(chain);
    const iv_term_slope = this.calculateTermSlope(chain);
    const skew_z = this.calculateSkewZ(chain);

    return {
      rr25,
      fly25,
      iv_term_slope,
      skew_z,
      timestamp: Date.now()
    };
  }

  private calculateRiskReversal(chain: OptionQuote[]): number {
    // 25 delta risk reversal = IV(25d call) - IV(25d put)
    // Approximate 25 delta with strikes around 1.1 (call) and 0.9 (put)
    
    const call25d = this.findClosestOption(chain, 1.1, 'call');
    const put25d = this.findClosestOption(chain, 0.9, 'put');
    
    if (!call25d || !put25d) return 0;
    
    return call25d.iv - put25d.iv;
  }

  private calculateButterfly(chain: OptionQuote[]): number {
    // 25 delta butterfly = (IV(25d call) + IV(25d put)) / 2 - IV(ATM)
    
    const call25d = this.findClosestOption(chain, 1.1, 'call');
    const put25d = this.findClosestOption(chain, 0.9, 'put');
    const atmOption = this.findClosestOption(chain, 1.0, 'call') || this.findClosestOption(chain, 1.0, 'put');
    
    if (!call25d || !put25d || !atmOption) return 0;
    
    return (call25d.iv + put25d.iv) / 2 - atmOption.iv;
  }

  private calculateTermSlope(chain: OptionQuote[]): number {
    // Term structure slope: IV difference between long and short tenors
    
    const shortTenor = chain.filter(opt => this.tenorToDays(opt.tenor) <= 7);
    const longTenor = chain.filter(opt => this.tenorToDays(opt.tenor) >= 30);
    
    if (shortTenor.length === 0 || longTenor.length === 0) return 0;
    
    const shortIV = shortTenor.reduce((sum, opt) => sum + opt.iv, 0) / shortTenor.length;
    const longIV = longTenor.reduce((sum, opt) => sum + opt.iv, 0) / longTenor.length;
    
    return longIV - shortIV;
  }

  private calculateSkewZ(chain: OptionQuote[]): number {
    // Skew z-score: standardized measure of IV skew
    
    if (chain.length < 3) return 0;
    
    // Group by tenor, calculate skew for each
    const tenorGroups = new Map<string, OptionQuote[]>();
    
    for (const opt of chain) {
      if (!tenorGroups.has(opt.tenor)) {
        tenorGroups.set(opt.tenor, []);
      }
      tenorGroups.get(opt.tenor)!.push(opt);
    }
    
    let totalSkew = 0;
    let count = 0;
    
    for (const [tenor, options] of tenorGroups) {
      if (options.length < 3) continue;
      
      // Sort by strike
      options.sort((a, b) => a.k - b.k);
      
      // Simple skew: slope of IV vs log-moneyness
      const skew = this.calculateIVSlope(options);
      totalSkew += skew;
      count++;
    }
    
    if (count === 0) return 0;
    
    const avgSkew = totalSkew / count;
    
    // Z-score (simplified - in practice, use historical distribution)
    const historicalMean = -0.1; // Typical negative skew
    const historicalStd = 0.2;
    
    return (avgSkew - historicalMean) / historicalStd;
  }

  private findClosestOption(chain: OptionQuote[], targetK: number, type: 'call' | 'put'): OptionQuote | null {
    const filtered = chain.filter(opt => opt.type === type);
    if (filtered.length === 0) return null;
    
    return filtered.reduce((closest, current) => 
      Math.abs(current.k - targetK) < Math.abs(closest.k - targetK) ? current : closest
    );
  }

  private tenorToDays(tenor: string): number {
    const match = tenor.match(/(\d+)([dw])/);
    if (!match) return 7; // Default
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    return unit === 'd' ? value : value * 7;
  }

  private calculateIVSlope(options: OptionQuote[]): number {
    if (options.length < 2) return 0;
    
    // Linear regression of IV vs log(K/S)
    const n = options.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (const opt of options) {
      const x = Math.log(opt.k); // log-moneyness
      const y = opt.iv;
      
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return isFinite(slope) ? slope : 0;
  }
}

export const optionsSmile = new OptionsSmile();
export type { OptionQuote, SmileMetrics };
