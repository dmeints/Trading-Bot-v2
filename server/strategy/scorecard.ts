/**
 * Trade Scoring Implementation
 * Calculates comprehensive reward/penalty metrics for trades
 */

import { TradeSnapshot, TradeScore, ScoreTerm } from "../../shared/src/stevie/score";
import { ScoreConfig } from "../../shared/src/stevie/score_config";

export function scoreTrade(
  s: TradeSnapshot, 
  cfg: ScoreConfig, 
  prov: TradeScore["provenance"]
): TradeScore {
  const terms: { name: ScoreTerm; value: number }[] = [];
  
  // 1. Raw P&L in basis points
  const pnl_bps = ((s.exitPx - s.entryPx) * s.qty) / s.equityAtEntry * 10_000;
  terms.push({ name: "pnl_bps", value: pnl_bps });
  
  // 2. Trading fees penalty
  terms.push({ name: "fees_bps", value: -s.feeBps });
  
  // 3. Slippage penalty
  terms.push({ name: "slippage_bps", value: -s.slippageRealizedBps });
  
  // 4. Latency penalty (slower execution = worse)
  terms.push({ 
    name: "latency_penalty", 
    value: -cfg.latencyPenaltyPerSec * (s.ackMs / 1000) 
  });
  
  // 5. Drawdown penalty (exceeded stop loss)
  const ddExcess = Math.max(0, s.maeBps - (s.slBps ?? 0));
  terms.push({ 
    name: "drawdown_penalty", 
    value: -cfg.drawdownPenaltyPerBp * ddExcess 
  });
  
  // 6. Churn penalty (short hold time with tiny profit)
  const holdTimeSec = (s.exitTs - s.entryTs) / 1000;
  const churn = (holdTimeSec < cfg.minHoldSecs && Math.abs(pnl_bps) < cfg.tinyPnlBps) 
    ? -cfg.churnPenalty 
    : 0;
  terms.push({ name: "churn_penalty", value: churn });
  
  // 7. Opportunity cost penalty (could have captured more)
  const realizedEdge = pnl_bps + s.feeBps + s.slippageRealizedBps;
  const opp = Math.max(0, s.mfeBps - Math.max(realizedEdge, 0));
  terms.push({ 
    name: "opportunity_penalty", 
    value: -cfg.opportunityPenaltyPerBp * opp 
  });
  
  // 8. Toxicity penalty (moved market against us after trade)
  const tox = (s.midAfter1sBps ?? 0) <= -cfg.toxicityThresholdBps 
    ? -cfg.toxicityPenalty 
    : 0;
  terms.push({ name: "toxicity_penalty", value: tox });
  
  const total = terms.reduce((sum, term) => sum + term.value, 0);
  
  return { total, terms, provenance: prov };
}