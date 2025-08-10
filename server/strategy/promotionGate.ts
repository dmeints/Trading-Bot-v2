/**
 * Promotion Gate System
 * Shadow vs Live performance validation
 */

export type GateMetrics = {
  sharpe: number;
  maxDrawdownPct: number;
  profitFactor: number;
  slippageErrBps: number;
};

export type GateThresholds = {
  minSharpeDelta: number;
  maxMddWorsenPct: number;
  maxSlippageErrBps: number;
  minProfitFactor: number;
  minTrades: number;
};

export function promotionDecision({
  live,
  shadow,
  shadowTrades,
  thresholds: t
}: {
  live: GateMetrics;
  shadow: GateMetrics;
  shadowTrades: number;
  thresholds: GateThresholds;
}) {
  const reasons: string[] = [];
  
  if (shadowTrades < t.minTrades) {
    reasons.push("insufficient_trades");
  }
  
  if ((shadow.sharpe - live.sharpe) < t.minSharpeDelta) {
    reasons.push("sharpe_delta_too_small");
  }
  
  if ((shadow.maxDrawdownPct - live.maxDrawdownPct) > t.maxMddWorsenPct) {
    reasons.push("drawdown_worse");
  }
  
  if (shadow.slippageErrBps > t.maxSlippageErrBps) {
    reasons.push("slippage_err_high");
  }
  
  if (shadow.profitFactor < t.minProfitFactor) {
    reasons.push("profit_factor_low");
  }
  
  return { 
    allow: reasons.length === 0, 
    reasons 
  };
}