/**
 * Stevie Trade Scoring System
 * Comprehensive trade performance evaluation
 */

export type ScoreTerm = 
  | "pnl_bps"
  | "fees_bps"
  | "slippage_bps"
  | "latency_penalty"
  | "drawdown_penalty"
  | "churn_penalty"
  | "opportunity_penalty"
  | "toxicity_penalty";

export type TradeSnapshot = {
  symbol: string;
  entryTs: number;
  exitTs: number;
  entryPx: number;
  exitPx: number;
  qty: number;
  equityAtEntry: number;
  feeBps: number;
  slippageForecastBps?: number;
  slippageRealizedBps: number;
  ackMs: number;
  mfeBps: number; // Maximum Favorable Excursion
  maeBps: number; // Maximum Adverse Excursion
  midAfter1sBps?: number;
  tpBps?: number; // Take Profit
  slBps?: number; // Stop Loss
};

export type TradeScore = {
  total: number;
  terms: {
    name: ScoreTerm;
    value: number;
  }[];
  provenance: {
    runId?: string;
    datasetId?: string;
    commit: string;
    generatedAt: string;
  };
};