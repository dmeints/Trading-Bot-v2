
import { logger } from '../utils/logger';

export interface PolicyPerformance {
  policyId: string;
  returns: number[];
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  isChampion: boolean;
  pValue?: number;
  spaStatistic?: number;
}

export interface PromotionResult {
  promoted: boolean;
  pValue: number;
  reason: string;
  championId: string;
  challengerId: string;
}

export class PromotionService {
  private policies: Map<string, PolicyPerformance> = new Map();
  private championId: string = 'baseline';
  private promotionThreshold: number = 0.05; // p < 0.05 for promotion
  private minSampleSize: number = 50;

  constructor() {
    // Initialize baseline champion
    this.policies.set('baseline', {
      policyId: 'baseline',
      returns: [],
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0.5,
      isChampion: true
    });
  }

  addPolicyReturn(policyId: string, returnValue: number): void {
    if (!this.policies.has(policyId)) {
      this.policies.set(policyId, {
        policyId,
        returns: [],
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
        isChampion: false
      });
    }
    
    const policy = this.policies.get(policyId)!;
    policy.returns.push(returnValue);
    
    // Keep only recent returns for efficiency
    if (policy.returns.length > 1000) {
      policy.returns = policy.returns.slice(-500);
    }
    
    this.updatePolicyMetrics(policy);
  }

  private updatePolicyMetrics(policy: PolicyPerformance): void {
    if (policy.returns.length < 2) return;
    
    const returns = policy.returns;
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    const std = Math.sqrt(variance);
    
    policy.sharpeRatio = std > 0 ? mean / std : 0;
    policy.winRate = returns.filter(r => r > 0).length / returns.length;
    
    // Calculate maximum drawdown
    let peak = 0;
    let maxDD = 0;
    let cumReturn = 0;
    
    for (const ret of returns) {
      cumReturn += ret;
      if (cumReturn > peak) peak = cumReturn;
      const drawdown = peak - cumReturn;
      if (drawdown > maxDD) maxDD = drawdown;
    }
    
    policy.maxDrawdown = maxDD;
  }

  evaluatePromotion(challengerId: string): PromotionResult {
    const champion = this.policies.get(this.championId);
    const challenger = this.policies.get(challengerId);
    
    if (!champion || !challenger) {
      return {
        promoted: false,
        pValue: 1.0,
        reason: 'Missing policy data',
        championId: this.championId,
        challengerId
      };
    }
    
    if (challenger.returns.length < this.minSampleSize) {
      return {
        promoted: false,
        pValue: 1.0,
        reason: `Insufficient data: ${challenger.returns.length} < ${this.minSampleSize}`,
        championId: this.championId,
        challengerId
      };
    }
    
    // Compute Superior Predictive Ability (SPA) test
    const { pValue, spaStatistic } = this.computeSPA(champion.returns, challenger.returns);
    
    champion.pValue = pValue;
    champion.spaStatistic = spaStatistic;
    challenger.pValue = pValue;
    challenger.spaStatistic = spaStatistic;
    
    const promoted = pValue < this.promotionThreshold;
    
    if (promoted) {
      // Promote challenger to champion
      champion.isChampion = false;
      challenger.isChampion = true;
      this.championId = challengerId;
      
      logger.info(`[Promotion] ${challengerId} promoted to champion (p=${pValue.toFixed(4)})`);
    } else {
      logger.info(`[Promotion] ${challengerId} not promoted (p=${pValue.toFixed(4)})`);
    }
    
    return {
      promoted,
      pValue,
      reason: promoted ? 'Superior performance' : 'Insufficient evidence',
      championId: this.championId,
      challengerId
    };
  }

  private computeSPA(championReturns: number[], challengerReturns: number[]): { pValue: number; spaStatistic: number } {
    // Simplified SPA test implementation
    // In practice, would use more sophisticated bootstrap procedures
    
    const minLength = Math.min(championReturns.length, challengerReturns.length);
    if (minLength < 10) return { pValue: 1.0, spaStatistic: 0 };
    
    const champReturns = championReturns.slice(-minLength);
    const challReturns = challengerReturns.slice(-minLength);
    
    // Compute pairwise performance differences
    const differences: number[] = [];
    for (let i = 0; i < minLength; i++) {
      differences.push(challReturns[i] - champReturns[i]);
    }
    
    // Test if challenger significantly outperforms champion
    const meanDiff = differences.reduce((sum, d) => sum + d, 0) / differences.length;
    const variance = differences.reduce((sum, d) => sum + Math.pow(d - meanDiff, 2), 0) / (differences.length - 1);
    const std = Math.sqrt(variance);
    
    // t-statistic
    const tStat = std > 0 ? (meanDiff * Math.sqrt(differences.length)) / std : 0;
    const spaStatistic = Math.max(0, tStat); // One-sided test (challenger > champion)
    
    // Approximate p-value using normal distribution (simplified)
    const pValue = this.normalCCDF(spaStatistic);
    
    return { pValue, spaStatistic };
  }

  private normalCCDF(z: number): number {
    // Complementary cumulative distribution function of standard normal
    // P(Z > z) where Z ~ N(0,1)
    return 0.5 * (1 - this.erf(z / Math.sqrt(2)));
  }

  private erf(x: number): number {
    // Approximation of error function
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;
    
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return sign * y;
  }

  getPoliciesStatus(): PolicyPerformance[] {
    return Array.from(this.policies.values())
      .sort((a, b) => b.sharpeRatio - a.sharpeRatio);
  }

  getChampion(): PolicyPerformance | null {
    return this.policies.get(this.championId) || null;
  }

  // Simulate policy performance for testing
  simulatePolicyReturns(policyId: string, count: number, performance: 'good' | 'bad' | 'neutral' = 'neutral'): void {
    for (let i = 0; i < count; i++) {
      let returnValue: number;
      
      switch (performance) {
        case 'good':
          returnValue = 0.005 + Math.random() * 0.01; // 0.5-1.5% positive returns
          break;
        case 'bad':
          returnValue = -0.005 - Math.random() * 0.01; // -0.5 to -1.5% negative returns
          break;
        default:
          returnValue = (Math.random() - 0.5) * 0.02; // ±1% random returns
      }
      
      this.addPolicyReturn(policyId, returnValue);
    }
  }
}

export const promotionService = new PromotionService();
