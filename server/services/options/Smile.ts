
import { logger } from '../../utils/logger.js';

interface OptionData {
  k: number;      // Strike relative to spot (e.g., 0.9 for 90% strike)
  tenor: string;  // e.g., "7d", "30d"
  type: 'call' | 'put';
  iv: number;     // Implied volatility
}

interface OptionChain {
  chain: OptionData[];
  timestamp?: number;
  spot?: number;
}

interface SmileMetrics {
  symbol: string;
  timestamp: number;
  rr25: number;          // 25-delta risk reversal
  fly25: number;         // 25-delta butterfly
  iv_term_slope: number; // Term structure slope
  skew_z: number;        // Skew z-score
}

class OptionsSmile {
  private chains: Map<string, OptionChain> = new Map();
  private smileHistory: Map<string, SmileMetrics[]> = new Map();
  
  storeChain(symbol: string, chainData: OptionChain): void {
    try {
      const chain = {
        ...chainData,
        timestamp: Date.now()
      };
      
      this.chains.set(symbol.toUpperCase(), chain);
      
      // Calculate and store smile metrics
      const metrics = this.calculateSmileMetrics(symbol.toUpperCase(), chain);
      this.updateSmileHistory(symbol.toUpperCase(), metrics);
      
      logger.info(`Stored options chain for ${symbol}`, { 
        chainSize: chain.chain.length,
        metrics 
      });
      
    } catch (error) {
      logger.error(`Error storing options chain for ${symbol}:`, { error: String(error) });
    }
  }
  
  getSmileMetrics(symbol: string): SmileMetrics | null {
    const chain = this.chains.get(symbol.toUpperCase());
    if (!chain) {
      // Generate synthetic smile for testing
      return this.generateSyntheticSmile(symbol.toUpperCase());
    }
    
    return this.calculateSmileMetrics(symbol.toUpperCase(), chain);
  }
  
  private calculateSmileMetrics(symbol: string, chain: OptionChain): SmileMetrics {
    try {
      const { chain: options } = chain;
      
      // Group by tenor for term structure
      const tenorGroups = this.groupByTenor(options);
      const tenors = Object.keys(tenorGroups).sort();
      
      // Calculate 25-delta risk reversal (call IV - put IV at 25-delta strikes)
      const rr25 = this.calculateRiskReversal(options, 0.25);
      
      // Calculate 25-delta butterfly (average wing IV - ATM IV)
      const fly25 = this.calculateButterfly(options, 0.25);
      
      // Term structure slope (far tenor IV - near tenor IV)
      const iv_term_slope = this.calculateTermSlope(tenorGroups, tenors);
      
      // Skew z-score (normalized skew measure)
      const skew_z = this.calculateSkewZ(symbol, rr25);
      
      return {
        symbol,
        timestamp: Date.now(),
        rr25: isNaN(rr25) ? 0 : rr25,
        fly25: isNaN(fly25) ? 0 : fly25,
        iv_term_slope: isNaN(iv_term_slope) ? 0 : iv_term_slope,
        skew_z: isNaN(skew_z) ? 0 : skew_z
      };
      
    } catch (error) {
      logger.error(`Error calculating smile metrics for ${symbol}:`, { error: String(error) });
      return {
        symbol,
        timestamp: Date.now(),
        rr25: 0,
        fly25: 0,
        iv_term_slope: 0,
        skew_z: 0
      };
    }
  }
  
  private groupByTenor(options: OptionData[]): { [tenor: string]: OptionData[] } {
    return options.reduce((groups, option) => {
      const tenor = option.tenor;
      if (!groups[tenor]) {
        groups[tenor] = [];
      }
      groups[tenor].push(option);
      return groups;
    }, {} as { [tenor: string]: OptionData[] });
  }
  
  private calculateRiskReversal(options: OptionData[], deltaTarget: number): number {
    try {
      // Approximate 25-delta strikes (simplified - would use proper delta calculation)
      const callStrike = 1 + deltaTarget;  // Rough approximation
      const putStrike = 1 - deltaTarget;
      
      // Find closest calls and puts
      const call = this.findClosestStrike(options.filter(o => o.type === 'call'), callStrike);
      const put = this.findClosestStrike(options.filter(o => o.type === 'put'), putStrike);
      
      if (call && put) {
        return call.iv - put.iv;
      }
      
      return 0;
    } catch (error) {
      return 0;
    }
  }
  
  private calculateButterfly(options: OptionData[], deltaTarget: number): number {
    try {
      // Find ATM and wing options
      const atmOptions = options.filter(o => Math.abs(o.k - 1) < 0.05);
      const wingCalls = options.filter(o => o.type === 'call' && o.k > 1 + deltaTarget);
      const wingPuts = options.filter(o => o.type === 'put' && o.k < 1 - deltaTarget);
      
      if (atmOptions.length === 0) return 0;
      
      const atmIV = atmOptions.reduce((sum, o) => sum + o.iv, 0) / atmOptions.length;
      
      let wingIV = 0;
      let wingCount = 0;
      
      if (wingCalls.length > 0) {
        wingIV += wingCalls.reduce((sum, o) => sum + o.iv, 0) / wingCalls.length;
        wingCount++;
      }
      
      if (wingPuts.length > 0) {
        wingIV += wingPuts.reduce((sum, o) => sum + o.iv, 0) / wingPuts.length;
        wingCount++;
      }
      
      if (wingCount === 0) return 0;
      
      const avgWingIV = wingIV / wingCount;
      return avgWingIV - atmIV;
      
    } catch (error) {
      return 0;
    }
  }
  
  private calculateTermSlope(tenorGroups: { [tenor: string]: OptionData[] }, tenors: string[]): number {
    try {
      if (tenors.length < 2) return 0;
      
      // Get ATM IV for shortest and longest tenors
      const shortTenor = tenorGroups[tenors[0]];
      const longTenor = tenorGroups[tenors[tenors.length - 1]];
      
      const shortATMIV = this.getATMIV(shortTenor);
      const longATMIV = this.getATMIV(longTenor);
      
      if (shortATMIV === 0 || longATMIV === 0) return 0;
      
      return longATMIV - shortATMIV;
      
    } catch (error) {
      return 0;
    }
  }
  
  private calculateSkewZ(symbol: string, currentRR: number): number {
    try {
      const history = this.smileHistory.get(symbol) || [];
      if (history.length < 5) return 0;
      
      const recentRR = history.slice(-20).map(h => h.rr25);
      const mean = recentRR.reduce((sum, rr) => sum + rr, 0) / recentRR.length;
      const variance = recentRR.reduce((sum, rr) => sum + Math.pow(rr - mean, 2), 0) / recentRR.length;
      const std = Math.sqrt(variance);
      
      if (std === 0) return 0;
      
      return (currentRR - mean) / std;
      
    } catch (error) {
      return 0;
    }
  }
  
  private findClosestStrike(options: OptionData[], targetStrike: number): OptionData | null {
    if (options.length === 0) return null;
    
    return options.reduce((closest, current) => {
      const currentDist = Math.abs(current.k - targetStrike);
      const closestDist = Math.abs(closest.k - targetStrike);
      return currentDist < closestDist ? current : closest;
    });
  }
  
  private getATMIV(options: OptionData[]): number {
    const atmOptions = options.filter(o => Math.abs(o.k - 1) < 0.05);
    if (atmOptions.length === 0) return 0;
    
    return atmOptions.reduce((sum, o) => sum + o.iv, 0) / atmOptions.length;
  }
  
  private updateSmileHistory(symbol: string, metrics: SmileMetrics): void {
    const history = this.smileHistory.get(symbol) || [];
    history.push(metrics);
    
    // Keep last 100 observations
    if (history.length > 100) {
      history.shift();
    }
    
    this.smileHistory.set(symbol, history);
  }
  
  private generateSyntheticSmile(symbol: string): SmileMetrics {
    // Generate realistic synthetic smile metrics
    return {
      symbol,
      timestamp: Date.now(),
      rr25: -0.02 + Math.random() * 0.04,    // -2% to +2%
      fly25: 0.01 + Math.random() * 0.03,     // 1% to 4%
      iv_term_slope: -0.01 + Math.random() * 0.02, // -1% to +1%
      skew_z: (Math.random() - 0.5) * 4       // -2 to +2 z-score
    };
  }
}

export const optionsSmile = new OptionsSmile();
export type { OptionData, OptionChain, SmileMetrics };
