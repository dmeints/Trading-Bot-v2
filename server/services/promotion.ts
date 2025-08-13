
import { logger } from '../utils/logger.js';

interface PerformanceRecord {
  strategy: string;
  returns: number[];
  timestamps: number[];
  sharpe: number;
  maxDrawdown: number;
  totalReturn: number;
}

interface SPATestResult {
  pValue: number;
  testStatistic: number;
  significant: boolean;
  confidence: number;
}

interface PromotionStatus {
  champion: string;
  challenger: string | null;
  testResult: SPATestResult | null;
  promoted: boolean;
  lastUpdate: number;
  outcomeMessage: string;
}

class PromotionService {
  private performanceHistory: Map<string, PerformanceRecord> = new Map();
  private currentChampion: string = 'baseline_sma';
  private currentChallenger: string | null = null;
  private lastPromotion: PromotionStatus | null = null;
  
  private readonly MIN_SAMPLE_SIZE = 50;
  private readonly PROMOTION_THRESHOLD = 0.05; // p < 0.05
  
  constructor() {
    this.initializeBaseline();
  }
  
  private initializeBaseline(): void {
    // Initialize baseline strategy performance
    const baselineReturns = Array.from({ length: 252 }, () => 
      0.08 / 252 + (Math.random() - 0.5) * 0.02); // 8% annual with noise
    
    this.performanceHistory.set('baseline_sma', {
      strategy: 'baseline_sma',
      returns: baselineReturns,
      timestamps: baselineReturns.map((_, i) => Date.now() - (252 - i) * 24 * 60 * 60 * 1000),
      sharpe: this.calculateSharpe(baselineReturns),
      maxDrawdown: this.calculateMaxDrawdown(baselineReturns),
      totalReturn: baselineReturns.reduce((acc, r) => acc * (1 + r), 1) - 1
    });
  }
  
  recordPerformance(strategy: string, returns: number[]): void {
    try {
      const existing = this.performanceHistory.get(strategy);
      const timestamps = returns.map((_, i) => Date.now() - (returns.length - 1 - i) * 60 * 60 * 1000);
      
      if (existing) {
        // Append new returns
        existing.returns.push(...returns);
        existing.timestamps.push(...timestamps);
        
        // Keep rolling window (last 252 observations)
        if (existing.returns.length > 252) {
          const excess = existing.returns.length - 252;
          existing.returns = existing.returns.slice(excess);
          existing.timestamps = existing.timestamps.slice(excess);
        }
        
        // Recalculate metrics
        existing.sharpe = this.calculateSharpe(existing.returns);
        existing.maxDrawdown = this.calculateMaxDrawdown(existing.returns);
        existing.totalReturn = existing.returns.reduce((acc, r) => acc * (1 + r), 1) - 1;
        
      } else {
        // New strategy
        this.performanceHistory.set(strategy, {
          strategy,
          returns: [...returns],
          timestamps,
          sharpe: this.calculateSharpe(returns),
          maxDrawdown: this.calculateMaxDrawdown(returns),
          totalReturn: returns.reduce((acc, r) => acc * (1 + r), 1) - 1
        });
      }
      
      // Check if this could be a challenger
      this.evaluateChallenger(strategy);
      
    } catch (error) {
      logger.error(`Error recording performance for ${strategy}:`, error);
    }
  }
  
  private calculateSharpe(returns: number[]): number {
    if (returns.length < 2) return 0;
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((acc, r) => acc + (r - mean) ** 2, 0) / returns.length;
    const volatility = Math.sqrt(variance);
    
    return volatility > 0 ? mean / volatility * Math.sqrt(252) : 0; // Annualized
  }
  
  private calculateMaxDrawdown(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    let equity = 1;
    let peak = 1;
    let maxDD = 0;
    
    for (const ret of returns) {
      equity *= (1 + ret);
      peak = Math.max(peak, equity);
      const drawdown = (peak - equity) / peak;
      maxDD = Math.max(maxDD, drawdown);
    }
    
    return maxDD;
  }
  
  private evaluateChallenger(strategy: string): void {
    if (strategy === this.currentChampion) return;
    
    const record = this.performanceHistory.get(strategy);
    if (!record || record.returns.length < this.MIN_SAMPLE_SIZE) return;
    
    // Only consider as challenger if significantly outperforming
    const championRecord = this.performanceHistory.get(this.currentChampion);
    if (!championRecord) return;
    
    if (record.sharpe > championRecord.sharpe * 1.1 && record.maxDrawdown < championRecord.maxDrawdown * 1.2) {
      this.currentChallenger = strategy;
      logger.info(`New challenger identified: ${strategy}`, {
        challengerSharpe: record.sharpe,
        championSharpe: championRecord.sharpe
      });
    }
  }
  
  runPromotionTest(): PromotionStatus {
    try {
      if (!this.currentChallenger) {
        return {
          champion: this.currentChampion,
          challenger: null,
          testResult: null,
          promoted: false,
          lastUpdate: Date.now(),
          outcomeMessage: 'No challenger available'
        };
      }
      
      const championRecord = this.performanceHistory.get(this.currentChampion);
      const challengerRecord = this.performanceHistory.get(this.currentChallenger);
      
      if (!championRecord || !challengerRecord) {
        return {
          champion: this.currentChampion,
          challenger: this.currentChallenger,
          testResult: null,
          promoted: false,
          lastUpdate: Date.now(),
          outcomeMessage: 'Insufficient data for testing'
        };
      }
      
      // Run Hansen SPA test
      const spaResult = this.hansenSPATest(championRecord.returns, challengerRecord.returns);
      
      // Decide promotion
      const promoted = spaResult.significant && spaResult.pValue < this.PROMOTION_THRESHOLD;
      
      let outcomeMessage = '';
      if (promoted) {
        this.currentChampion = this.currentChallenger;
        this.currentChallenger = null;
        outcomeMessage = `Promoted ${this.currentChampion} (p=${spaResult.pValue.toFixed(4)})`;
        
        logger.info('Strategy promoted:', {
          newChampion: this.currentChampion,
          pValue: spaResult.pValue,
          testStatistic: spaResult.testStatistic
        });
      } else {
        outcomeMessage = `Challenger ${this.currentChallenger} not promoted (p=${spaResult.pValue.toFixed(4)})`;
        this.currentChallenger = null; // Reset challenger
      }
      
      const result: PromotionStatus = {
        champion: this.currentChampion,
        challenger: promoted ? null : this.currentChallenger,
        testResult: spaResult,
        promoted,
        lastUpdate: Date.now(),
        outcomeMessage
      };
      
      this.lastPromotion = result;
      return result;
      
    } catch (error) {
      logger.error('Error in promotion test:', error);
      
      return {
        champion: this.currentChampion,
        challenger: this.currentChallenger,
        testResult: null,
        promoted: false,
        lastUpdate: Date.now(),
        outcomeMessage: `Error in promotion test: ${error}`
      };
    }
  }
  
  private hansenSPATest(championReturns: number[], challengerReturns: number[]): SPATestResult {
    try {
      // Align series lengths
      const minLength = Math.min(championReturns.length, challengerReturns.length);
      const champReturns = championReturns.slice(-minLength);
      const challReturns = challengerReturns.slice(-minLength);
      
      if (minLength < this.MIN_SAMPLE_SIZE) {
        return {
          pValue: 1.0,
          testStatistic: 0,
          significant: false,
          confidence: 0
        };
      }
      
      // Calculate excess returns (challenger - champion)
      const excessReturns = challReturns.map((r, i) => r - champReturns[i]);
      
      // Test statistic: mean excess return / std error
      const meanExcess = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length;
      const variance = excessReturns.reduce((acc, r) => acc + (r - meanExcess) ** 2, 0) / excessReturns.length;
      const stdError = Math.sqrt(variance / excessReturns.length);
      
      const testStatistic = stdError > 0 ? meanExcess / stdError : 0;
      
      // Simplified p-value calculation (using normal approximation)
      const pValue = this.calculatePValue(testStatistic, minLength);
      
      // Additional Hansen SPA adjustment (simplified)
      const adjustedPValue = Math.min(1.0, pValue * 1.2); // Conservative adjustment
      
      return {
        pValue: adjustedPValue,
        testStatistic,
        significant: adjustedPValue < this.PROMOTION_THRESHOLD,
        confidence: 1 - adjustedPValue
      };
      
    } catch (error) {
      logger.error('Error in Hansen SPA test:', error);
      return {
        pValue: 1.0,
        testStatistic: 0,
        significant: false,
        confidence: 0
      };
    }
  }
  
  private calculatePValue(testStat: number, sampleSize: number): number {
    // Simplified p-value calculation using normal distribution
    // For a two-tailed test
    const absZ = Math.abs(testStat);
    
    // Approximate p-value using complementary error function
    const pValue = 2 * (1 - this.normalCDF(absZ));
    
    // Apply small sample correction
    const correction = Math.max(1, Math.sqrt(50 / sampleSize));
    
    return Math.min(1.0, pValue * correction);
  }
  
  private normalCDF(z: number): number {
    // Approximate normal CDF using error function approximation
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    
    return z > 0 ? 1 - prob : prob;
  }
  
  getPromotionStatus(): PromotionStatus {
    if (this.lastPromotion) {
      return { ...this.lastPromotion };
    }
    
    return {
      champion: this.currentChampion,
      challenger: this.currentChallenger,
      testResult: null,
      promoted: false,
      lastUpdate: Date.now(),
      outcomeMessage: 'No promotion tests run yet'
    };
  }
  
  // Simulate some performance for demo
  simulatePerformance(): void {
    const strategies = ['adaptive_momentum', 'risk_parity', 'ml_ensemble', 'regime_aware'];
    
    strategies.forEach(strategy => {
      const returns = Array.from({ length: 20 }, () => 
        0.1 / 252 + (Math.random() - 0.5) * 0.03); // Slightly better returns
      
      this.recordPerformance(strategy, returns);
    });
  }
}

export const promotionService = new PromotionService();
export type { PromotionStatus, SPATestResult, PerformanceRecord };
