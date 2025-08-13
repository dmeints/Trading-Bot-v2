
/**
 * Options IV Smile/Skew Analysis
 */

import { logger } from '../../utils/logger.js';

export interface OptionChainEntry {
  k: number;           // Strike ratio (K/S)
  tenor: string;       // Time to expiry
  type: 'call' | 'put';
  iv: number;          // Implied volatility
}

export interface OptionChain {
  symbol: string;
  timestamp: Date;
  spot: number;
  chain: OptionChainEntry[];
}

export interface SmileMetrics {
  symbol: string;
  rr25: number;        // 25-delta risk reversal
  fly25: number;       // 25-delta butterfly
  iv_term_slope: number; // Term structure slope
  skew_z: number;      // Skew z-score
  timestamp: Date;
}

class OptionsSmile {
  private chainStore = new Map<string, OptionChain>();

  /**
   * Store options chain snapshot
   */
  storeChain(symbol: string, chain: OptionChainEntry[], spot: number = 1): void {
    const chainData: OptionChain = {
      symbol: symbol.toUpperCase(),
      timestamp: new Date(),
      spot,
      chain
    };

    this.chainStore.set(symbol.toUpperCase(), chainData);
    logger.debug(`[OptionsSmile] Stored chain for ${symbol} with ${chain.length} options`);
  }

  /**
   * Calculate smile metrics from stored chain
   */
  calculateMetrics(symbol: string): SmileMetrics | null {
    const chainData = this.chainStore.get(symbol.toUpperCase());
    
    if (!chainData || chainData.chain.length === 0) {
      return null;
    }

    const { chain, spot } = chainData;

    // Calculate 25-delta risk reversal and butterfly
    const { rr25, fly25 } = this.calculate25DeltaMetrics(chain, spot);
    
    // Calculate term structure slope
    const iv_term_slope = this.calculateTermSlope(chain);
    
    // Calculate skew z-score
    const skew_z = this.calculateSkewZ(chain, spot);

    return {
      symbol: symbol.toUpperCase(),
      rr25,
      fly25,
      iv_term_slope,
      skew_z,
      timestamp: new Date()
    };
  }

  /**
   * Calculate 25-delta risk reversal and butterfly
   */
  private calculate25DeltaMetrics(chain: OptionChainEntry[], spot: number): { rr25: number; fly25: number } {
    // For simplicity, approximate 25-delta strikes as ~0.9 and ~1.1 moneyness
    const calls = chain.filter(opt => opt.type === 'call');
    const puts = chain.filter(opt => opt.type === 'put');

    // Find strikes closest to 25-delta levels
    const call25 = this.findClosestStrike(calls, 1.1); // OTM call
    const put25 = this.findClosestStrike(puts, 0.9);   // OTM put
    const atmCall = this.findClosestStrike(calls, 1.0);
    const atmPut = this.findClosestStrike(puts, 1.0);

    // Risk Reversal = IV(Call_25δ) - IV(Put_25δ)
    const rr25 = (call25?.iv || 0) - (put25?.iv || 0);

    // Butterfly = (IV(Call_25δ) + IV(Put_25δ))/2 - IV(ATM)
    const avgOTM = ((call25?.iv || 0) + (put25?.iv || 0)) / 2;
    const atmIV = ((atmCall?.iv || 0) + (atmPut?.iv || 0)) / 2;
    const fly25 = avgOTM - atmIV;

    return { rr25, fly25 };
  }

  /**
   * Find option closest to target moneyness
   */
  private findClosestStrike(options: OptionChainEntry[], targetK: number): OptionChainEntry | null {
    if (options.length === 0) return null;

    let closest = options[0];
    let minDiff = Math.abs(closest.k - targetK);

    for (const option of options) {
      const diff = Math.abs(option.k - targetK);
      if (diff < minDiff) {
        minDiff = diff;
        closest = option;
      }
    }

    return closest;
  }

  /**
   * Calculate term structure slope
   */
  private calculateTermSlope(chain: OptionChainEntry[]): number {
    // Group by tenor and calculate average IV
    const tenorIVs = new Map<string, number[]>();
    
    for (const option of chain) {
      if (!tenorIVs.has(option.tenor)) {
        tenorIVs.set(option.tenor, []);
      }
      tenorIVs.get(option.tenor)!.push(option.iv);
    }

    const tenorAvgs: Array<{ tenor: string; avgIV: number; days: number }> = [];
    
    for (const [tenor, ivs] of tenorIVs) {
      const avgIV = ivs.reduce((sum, iv) => sum + iv, 0) / ivs.length;
      const days = this.tenorToDays(tenor);
      tenorAvgs.push({ tenor, avgIV, days });
    }

    if (tenorAvgs.length < 2) return 0;

    // Sort by days and calculate slope
    tenorAvgs.sort((a, b) => a.days - b.days);
    
    const shortTerm = tenorAvgs[0];
    const longTerm = tenorAvgs[tenorAvgs.length - 1];
    
    if (longTerm.days === shortTerm.days) return 0;
    
    // Slope in IV per day
    return (longTerm.avgIV - shortTerm.avgIV) / (longTerm.days - shortTerm.days);
  }

  /**
   * Convert tenor string to days
   */
  private tenorToDays(tenor: string): number {
    const match = tenor.match(/(\d+)([dwmy])/);
    if (!match) return 30; // Default

    const [, num, unit] = match;
    const value = parseInt(num, 10);

    switch (unit) {
      case 'd': return value;
      case 'w': return value * 7;
      case 'm': return value * 30;
      case 'y': return value * 365;
      default: return 30;
    }
  }

  /**
   * Calculate skew z-score
   */
  private calculateSkewZ(chain: OptionChainEntry[], spot: number): number {
    // Calculate IV smile slope at different strikes
    const puts = chain.filter(opt => opt.type === 'put');
    const calls = chain.filter(opt => opt.type === 'call');
    
    if (puts.length < 2 && calls.length < 2) return 0;

    // Combine puts and calls, convert to moneyness
    const allOptions = [...puts, ...calls].map(opt => ({
      moneyness: opt.k,
      iv: opt.iv
    }));

    allOptions.sort((a, b) => a.moneyness - b.moneyness);

    if (allOptions.length < 3) return 0;

    // Calculate slope between OTM put and OTM call
    const otmPut = allOptions.find(opt => opt.moneyness < 0.95);
    const otmCall = allOptions.find(opt => opt.moneyness > 1.05);

    if (!otmPut || !otmCall) return 0;

    const slope = (otmCall.iv - otmPut.iv) / (otmCall.moneyness - otmPut.moneyness);
    
    // Normalize to z-score (simplified)
    return slope / 0.1; // Assume std dev of 0.1 for skew
  }

  /**
   * Generate mock metrics for testing
   */
  generateMockMetrics(symbol: string): SmileMetrics {
    return {
      symbol: symbol.toUpperCase(),
      rr25: (Math.random() - 0.5) * 0.2,        // ±10% RR
      fly25: Math.random() * 0.05,              // 0-5% butterfly
      iv_term_slope: (Math.random() - 0.5) * 0.001, // ±0.1% per day
      skew_z: (Math.random() - 0.5) * 4,        // ±2 std devs
      timestamp: new Date()
    };
  }
}

export const optionsSmile = new OptionsSmile();
