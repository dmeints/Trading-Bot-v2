/**
 * Trade Scorecard Implementation  
 * Advanced trade performance scoring with multiple penalty factors
 */

import { TradeSnapshot, TradeScore, ScoreTerm } from "../../shared/src/stevie/score";

export type ScoreConfig = {
  latencyPenaltyPerSec: number;
  drawdownPenaltyPerBp: number;
  churnPenalty: number;
  minHoldSecs: number;
  tinyPnlBps: number;
  opportunityPenaltyPerBp: number;
  toxicityThresholdBps: number;
  toxicityPenalty: number;
};

export function scoreTrade(
  s: TradeSnapshot,
  cfg: ScoreConfig,
  prov: TradeScore["provenance"]
): TradeScore {
  const terms: { name: ScoreTerm; value: number }[] = [];
  
  // Basic P&L calculation
  const pnl_bps = ((s.exitPx - s.entryPx) * s.qty) / s.equityAtEntry * 10_000;
  terms.push({ name: "pnl_bps", value: pnl_bps });
  
  // Fee penalties
  terms.push({ name: "fees_bps", value: -s.feeBps });
  terms.push({ name: "slippage_bps", value: -s.slippageRealizedBps });
  
  // Latency penalty (execution speed matters)
  terms.push({ 
    name: "latency_penalty", 
    value: -cfg.latencyPenaltyPerSec * (s.ackMs / 1000) 
  });
  
  // Drawdown penalty (exceeding stop loss)
  const ddExcess = Math.max(0, s.maeBps - (s.slBps ?? 0));
  terms.push({ 
    name: "drawdown_penalty", 
    value: -cfg.drawdownPenaltyPerBp * ddExcess 
  });
  
  // Churn penalty (too-short trades with tiny PnL)
  const holdTime = s.exitTs - s.entryTs;
  const churn = (holdTime < cfg.minHoldSecs * 1000 && Math.abs(pnl_bps) < cfg.tinyPnlBps) 
    ? -cfg.churnPenalty 
    : 0;
  terms.push({ name: "churn_penalty", value: churn });
  
  // Opportunity cost penalty (missed potential)
  const realizedEdge = pnl_bps + s.feeBps + s.slippageRealizedBps;
  const opp = Math.max(0, s.mfeBps - Math.max(realizedEdge, 0));
  terms.push({ 
    name: "opportunity_penalty", 
    value: -cfg.opportunityPenaltyPerBp * opp 
  });
  
  // Toxicity penalty (adverse market impact)
  const tox = (s.midAfter1sBps ?? 0) <= -cfg.toxicityThresholdBps 
    ? -cfg.toxicityPenalty 
    : 0;
  terms.push({ name: "toxicity_penalty", value: tox });
  
  const total = terms.reduce((a, b) => a + b.value, 0);
  
  return { total, terms, provenance: prov };
}