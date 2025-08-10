/**
 * Trade Scoring and Performance Attribution
 * Comprehensive scoring system for trade decisions and outcomes
 */

import { UnifiedFeatures } from '../features';

export interface TradeScorecard {
  tradeId: string;
  symbol: string;
  entryTime: Date;
  exitTime?: Date;
  
  // Entry scores (0-100)
  entryScore: number;
  signalStrength: number;
  riskAdjustedScore: number;
  
  // Feature contributions
  featureScores: {
    technical: number;
    regime: number;
    microstructure: number;
    social: number;
    onchain: number;
    macro: number;
  };
  
  // Risk metrics
  positionSizeScore: number;
  liquidityScore: number;
  costScore: number;
  
  // Outcome (if closed)
  pnl?: number;
  pnlPct?: number;
  holdTimeMs?: number;
  
  // Performance attribution
  actualOutcome?: 'win' | 'loss' | 'breakeven';
  expectedOutcome?: 'win' | 'loss' | 'neutral';
  surpriseFactor?: number; // How different actual was from expected
  
  // Quality metrics
  executionScore?: number; // How well the trade was executed
  timingScore?: number; // Entry/exit timing quality
  overallGrade?: 'A' | 'B' | 'C' | 'D' | 'F';
}

/**
 * Calculate comprehensive trade score
 */
export function scoreTrade(
  features: UnifiedFeatures,
  position: any = null,
  config: any = {}
): TradeScorecard {
  
  const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const entryTime = new Date();
  
  // Calculate individual feature scores
  const featureScores = {
    technical: scoreTechnicalFeatures(features),
    regime: scoreRegimeFeatures(features),
    microstructure: scoreMicrostructureFeatures(features),
    social: scoreSocialFeatures(features),
    onchain: scoreOnchainFeatures(features),
    macro: scoreMacroFeatures(features)
  };
  
  // Weighted signal strength
  const weights = {
    technical: 0.3,
    regime: 0.2,
    microstructure: 0.2,
    social: 0.1,
    onchain: 0.1,
    macro: 0.1
  };
  
  const signalStrength = Object.entries(featureScores).reduce((sum, [key, score]) => {
    return sum + score * weights[key as keyof typeof weights];
  }, 0);
  
  // Risk-adjusted scoring
  const riskFactors = calculateRiskFactors(features);
  const riskAdjustedScore = signalStrength * (1 - riskFactors.totalRisk);
  
  // Position sizing score
  const positionSizeScore = scorePositionSize(features, position);
  
  // Liquidity and cost scores
  const liquidityScore = features.micro?.liquidity_score ? features.micro.liquidity_score * 100 : 50;
  const costScore = features.costs ? Math.max(0, 100 - features.costs.total_cost_estimate_bps * 2) : 50;
  
  // Overall entry score
  const entryScore = Math.round(
    (signalStrength * 0.4) +
    (riskAdjustedScore * 0.3) +
    (positionSizeScore * 0.1) +
    (liquidityScore * 0.1) +
    (costScore * 0.1)
  );
  
  return {
    tradeId,
    symbol: features.symbol,
    entryTime,
    entryScore: Math.max(0, Math.min(100, entryScore)),
    signalStrength: Math.round(signalStrength),
    riskAdjustedScore: Math.round(riskAdjustedScore),
    featureScores,
    positionSizeScore: Math.round(positionSizeScore),
    liquidityScore: Math.round(liquidityScore),
    costScore: Math.round(costScore)
  };
}

/**
 * Score technical features
 */
function scoreTechnicalFeatures(features: UnifiedFeatures): number {
  if (features.bars.length < 5) return 30; // Insufficient data
  
  let score = 50; // Base score
  
  // Price momentum
  const recent = features.bars.slice(0, 5);
  const older = features.bars.slice(5, 10);
  
  if (recent.length >= 3 && older.length >= 3) {
    const recentAvg = recent.reduce((sum, bar) => sum + bar.c, 0) / recent.length;
    const olderAvg = older.reduce((sum, bar) => sum + bar.c, 0) / older.length;
    
    if (recentAvg > olderAvg) {
      score += 20; // Upward momentum
    } else if (recentAvg < olderAvg * 0.95) {
      score -= 20; // Strong downward momentum
    }
  }
  
  // Volume confirmation
  const avgVolume = features.bars.reduce((sum, bar) => sum + bar.v, 0) / features.bars.length;
  const recentVolume = recent.reduce((sum, bar) => sum + bar.v, 0) / recent.length;
  
  if (recentVolume > avgVolume * 1.2) {
    score += 15; // Volume confirmation
  } else if (recentVolume < avgVolume * 0.5) {
    score -= 10; // Low volume warning
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Score regime features
 */
function scoreRegimeFeatures(features: UnifiedFeatures): number {
  if (!features.regime) return 50;
  
  let score = 50;
  const regime = features.regime;
  
  // Trend strength scoring
  if (regime.trend_strength > 60) {
    score += 25; // Strong trend
  } else if (regime.trend_strength < 20) {
    score -= 15; // Weak trend
  }
  
  // Regime classification
  switch (regime.regime_classification) {
    case 'trending':
      score += 20;
      break;
    case 'ranging':
      score += 5;
      break;
    case 'volatile':
      score -= 10;
      break;
    default:
      break;
  }
  
  // Volatility adjustment
  if (regime.vol_pct > 50) {
    score -= 15; // High volatility penalty
  } else if (regime.vol_pct < 20) {
    score += 10; // Low volatility bonus
  }
  
  // Liquidity tier
  switch (regime.liquidity_tier) {
    case 1:
      score += 10; // High liquidity
      break;
    case 3:
      score -= 20; // Low liquidity penalty
      break;
    default:
      break;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Score microstructure features
 */
function scoreMicrostructureFeatures(features: UnifiedFeatures): number {
  if (!features.micro) return 50;
  
  let score = 50;
  const micro = features.micro;
  
  // Spread scoring (tighter spreads are better)
  if (micro.bid_ask_spread_bps < 10) {
    score += 20;
  } else if (micro.bid_ask_spread_bps > 50) {
    score -= 25;
  }
  
  // Liquidity score (already 0-1, convert to contribution)
  score += micro.liquidity_score * 30;
  
  // Market impact (lower is better)
  if (micro.market_impact_bps < 5) {
    score += 15;
  } else if (micro.market_impact_bps > 20) {
    score -= 20;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Score social features
 */
function scoreSocialFeatures(features: UnifiedFeatures): number {
  if (!features.social) return 50;
  
  let score = 50;
  const social = features.social;
  
  // Sentiment Z-score
  if (Math.abs(social.z) > 2) {
    score += 20; // Strong sentiment signal
  } else if (Math.abs(social.z) < 0.5) {
    score -= 5; // Weak sentiment
  }
  
  // Sentiment spike detection
  if (social.spike) {
    score += 15; // Sentiment spike can be a strong signal
  }
  
  // Confidence adjustment
  score = score * social.confidence;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Score on-chain features
 */
function scoreOnchainFeatures(features: UnifiedFeatures): number {
  if (!features.onchain) return 50;
  
  let score = 50;
  const onchain = features.onchain;
  
  // Bias scoring
  if (Math.abs(onchain.bias) > 0.3) {
    score += Math.abs(onchain.bias) * 25; // Strong on-chain bias
  }
  
  // Gas spike (can indicate increased activity)
  if (onchain.gas_spike_flag) {
    score += 10;
  }
  
  // Whale activity
  if (onchain.whale_activity_score > 0.7) {
    score += 15; // Significant whale activity
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Score macro features
 */
function scoreMacroFeatures(features: UnifiedFeatures): number {
  if (!features.macro) return 50;
  
  let score = 50;
  const macro = features.macro;
  
  // Blackout periods are negative for trading
  if (macro.blackout) {
    score -= 30;
  }
  
  // Risk-on sentiment
  if (macro.risk_on_sentiment > 0.2) {
    score += 15; // Risk-on environment
  } else if (macro.risk_on_sentiment < -0.2) {
    score -= 15; // Risk-off environment
  }
  
  // Recent impact
  if (macro.recent_impact_score > 0.5) {
    score -= 10; // High recent impact creates uncertainty
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate comprehensive risk factors
 */
function calculateRiskFactors(features: UnifiedFeatures): { 
  totalRisk: number;
  factors: Record<string, number>;
} {
  const factors: Record<string, number> = {};
  
  // Volatility risk
  if (features.regime?.vol_pct) {
    factors.volatility = Math.min(0.5, features.regime.vol_pct / 100);
  } else {
    factors.volatility = 0.2; // Default moderate volatility risk
  }
  
  // Liquidity risk
  if (features.micro?.liquidity_score) {
    factors.liquidity = 1 - features.micro.liquidity_score;
  } else {
    factors.liquidity = 0.3; // Default moderate liquidity risk
  }
  
  // Cost risk
  if (features.costs?.total_cost_estimate_bps) {
    factors.cost = Math.min(0.3, features.costs.total_cost_estimate_bps / 100);
  } else {
    factors.cost = 0.1; // Default low cost risk
  }
  
  // Macro risk
  if (features.macro?.blackout) {
    factors.macro = 0.4; // High risk during blackout periods
  } else {
    factors.macro = 0.05; // Low macro risk normally
  }
  
  // Calculate total risk (not a simple sum, use weighted combination)
  const totalRisk = Math.min(0.8, 
    factors.volatility * 0.4 +
    factors.liquidity * 0.3 +
    factors.cost * 0.2 +
    factors.macro * 0.1
  );
  
  return { totalRisk, factors };
}

/**
 * Score position sizing
 */
function scorePositionSize(features: UnifiedFeatures, position: any): number {
  // This would evaluate if the position size is appropriate
  // given the risk characteristics of the trade
  
  // Placeholder implementation
  const volatility = features.regime?.vol_pct || 30;
  const liquidity = features.micro?.liquidity_score || 0.5;
  
  // Higher volatility should lead to smaller positions
  const volatilityPenalty = Math.min(30, volatility);
  
  // Lower liquidity should lead to smaller positions
  const liquidityBonus = liquidity * 20;
  
  return Math.max(0, Math.min(100, 70 - volatilityPenalty + liquidityBonus));
}

/**
 * Update scorecard with trade outcome
 */
export function updateScorecard(
  scorecard: TradeScorecard, 
  outcome: {
    exitTime: Date;
    pnl: number;
    pnlPct: number;
  }
): TradeScorecard {
  
  const holdTimeMs = outcome.exitTime.getTime() - scorecard.entryTime.getTime();
  
  const actualOutcome: 'win' | 'loss' | 'breakeven' = 
    outcome.pnlPct > 0.1 ? 'win' :
    outcome.pnlPct < -0.1 ? 'loss' :
    'breakeven';
  
  // Calculate surprise factor
  const expectedWinProb = scorecard.entryScore / 100;
  const actualWin = actualOutcome === 'win' ? 1 : 0;
  const surpriseFactor = Math.abs(actualWin - expectedWinProb);
  
  // Calculate execution quality scores
  const timingScore = calculateTimingScore(scorecard, outcome);
  const executionScore = calculateExecutionScore(scorecard, outcome);
  
  // Overall grade
  const overallGrade = calculateOverallGrade(scorecard.entryScore, actualOutcome, timingScore, executionScore);
  
  return {
    ...scorecard,
    exitTime: outcome.exitTime,
    pnl: outcome.pnl,
    pnlPct: outcome.pnlPct,
    holdTimeMs,
    actualOutcome,
    surpriseFactor,
    timingScore,
    executionScore,
    overallGrade
  };
}

function calculateTimingScore(scorecard: TradeScorecard, outcome: any): number {
  // This would analyze if entry/exit timing was optimal
  // Placeholder implementation
  return Math.max(0, Math.min(100, scorecard.entryScore + (outcome.pnlPct > 0 ? 10 : -10)));
}

function calculateExecutionScore(scorecard: TradeScorecard, outcome: any): number {
  // This would analyze execution quality vs theoretical
  // Placeholder implementation
  return Math.max(0, Math.min(100, scorecard.costScore + (outcome.pnlPct > 0 ? 5 : -5)));
}

function calculateOverallGrade(entryScore: number, outcome: string, timingScore: number, executionScore: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  const avgScore = (entryScore + timingScore + executionScore) / 3;
  const outcomeBonus = outcome === 'win' ? 10 : outcome === 'loss' ? -10 : 0;
  const finalScore = avgScore + outcomeBonus;
  
  if (finalScore >= 90) return 'A';
  if (finalScore >= 80) return 'B';
  if (finalScore >= 70) return 'C';
  if (finalScore >= 60) return 'D';
  return 'F';
}