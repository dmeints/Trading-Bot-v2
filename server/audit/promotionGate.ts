/**
 * Promotion Gate System
 * Controls transition from shadow trading to live trading based on performance thresholds
 */

import { TradeScore } from "../../shared/src/stevie/score";

export interface PromotionCriteria {
  minTradeCount: number;
  minWinRate: number;
  minSharpeRatio: number;
  maxDrawdownBps: number;
  minCalmarRatio: number;
  minDaysLive: number;
}

export interface PerformanceMetrics {
  tradeCount: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdownBps: number;
  calmarRatio: number;
  daysLive: number;
  avgScorePerTrade: number;
}

export interface PromotionDecision {
  approved: boolean;
  reason: string;
  criteriaResults: Record<keyof PromotionCriteria, { passed: boolean; actual: number; required: number }>;
  confidence: number;
}

export const defaultPromotionCriteria: PromotionCriteria = {
  minTradeCount: 100,        // At least 100 trades
  minWinRate: 0.52,          // At least 52% win rate
  minSharpeRatio: 1.2,       // At least 1.2 Sharpe ratio
  maxDrawdownBps: 500,       // Max 5% drawdown
  minCalmarRatio: 0.8,       // At least 0.8 Calmar ratio
  minDaysLive: 30            // At least 30 days of trading
};

/**
 * Calculate performance metrics from trade scores
 */
export function calculatePerformanceMetrics(
  scores: TradeScore[], 
  startDate: Date, 
  endDate: Date
): PerformanceMetrics {
  const tradeCount = scores.length;
  
  if (tradeCount === 0) {
    return {
      tradeCount: 0,
      winRate: 0,
      sharpeRatio: 0,
      maxDrawdownBps: 0,
      calmarRatio: 0,
      daysLive: Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)),
      avgScorePerTrade: 0
    };
  }

  // Calculate win rate
  const winningTrades = scores.filter(score => score.total > 0).length;
  const winRate = winningTrades / tradeCount;

  // Calculate average score and standard deviation
  const totalScores = scores.map(s => s.total);
  const avgScorePerTrade = totalScores.reduce((sum, score) => sum + score, 0) / tradeCount;
  const variance = totalScores.reduce((sum, score) => sum + Math.pow(score - avgScorePerTrade, 2), 0) / tradeCount;
  const stdDev = Math.sqrt(variance);

  // Calculate Sharpe ratio (assuming daily compounding)
  const sharpeRatio = stdDev > 0 ? (avgScorePerTrade / stdDev) * Math.sqrt(252) : 0;

  // Calculate maximum drawdown
  let maxDrawdownBps = 0;
  let peak = 0;
  let cumulative = 0;
  
  for (const score of totalScores) {
    cumulative += score;
    peak = Math.max(peak, cumulative);
    const drawdown = peak - cumulative;
    maxDrawdownBps = Math.max(maxDrawdownBps, drawdown);
  }

  // Calculate Calmar ratio (annual return / max drawdown)
  const annualReturn = avgScorePerTrade * 252; // Assuming daily trading
  const calmarRatio = maxDrawdownBps > 0 ? annualReturn / maxDrawdownBps : 0;

  // Calculate days live
  const daysLive = Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

  return {
    tradeCount,
    winRate,
    sharpeRatio,
    maxDrawdownBps,
    calmarRatio,
    daysLive,
    avgScorePerTrade
  };
}

/**
 * Evaluate promotion gate criteria
 */
export function evaluatePromotion(
  metrics: PerformanceMetrics,
  criteria: PromotionCriteria = defaultPromotionCriteria
): PromotionDecision {
  
  const criteriaResults: Record<keyof PromotionCriteria, { passed: boolean; actual: number; required: number }> = {
    minTradeCount: {
      passed: metrics.tradeCount >= criteria.minTradeCount,
      actual: metrics.tradeCount,
      required: criteria.minTradeCount
    },
    minWinRate: {
      passed: metrics.winRate >= criteria.minWinRate,
      actual: metrics.winRate,
      required: criteria.minWinRate
    },
    minSharpeRatio: {
      passed: metrics.sharpeRatio >= criteria.minSharpeRatio,
      actual: metrics.sharpeRatio,
      required: criteria.minSharpeRatio
    },
    maxDrawdownBps: {
      passed: metrics.maxDrawdownBps <= criteria.maxDrawdownBps,
      actual: metrics.maxDrawdownBps,
      required: criteria.maxDrawdownBps
    },
    minCalmarRatio: {
      passed: metrics.calmarRatio >= criteria.minCalmarRatio,
      actual: metrics.calmarRatio,
      required: criteria.minCalmarRatio
    },
    minDaysLive: {
      passed: metrics.daysLive >= criteria.minDaysLive,
      actual: metrics.daysLive,
      required: criteria.minDaysLive
    }
  };

  // Count passed criteria
  const passedCount = Object.values(criteriaResults).filter(r => r.passed).length;
  const totalCount = Object.keys(criteriaResults).length;
  const confidence = passedCount / totalCount;

  // All criteria must pass for promotion
  const approved = passedCount === totalCount;

  // Generate reason
  let reason: string;
  if (approved) {
    reason = `All ${totalCount} promotion criteria satisfied with ${confidence.toFixed(1)}% confidence`;
  } else {
    const failedCriteria = Object.entries(criteriaResults)
      .filter(([_, result]) => !result.passed)
      .map(([key, result]) => `${key}: ${result.actual.toFixed(3)} vs required ${result.required.toFixed(3)}`)
      .join(', ');
    reason = `Failed ${totalCount - passedCount}/${totalCount} criteria: ${failedCriteria}`;
  }

  return {
    approved,
    reason,
    criteriaResults,
    confidence
  };
}