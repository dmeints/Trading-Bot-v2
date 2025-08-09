import type { Provenance } from "./provenance";
export type Timeframe = "1m"|"5m"|"1h"|"1d";

export interface BenchRunRequest {
  strategy: string; version: string; symbols: string[];
  timeframe: Timeframe; fromIso: string; toIso: string;
  feeBps: number; slipBps: number; rngSeed?: number;
}

export interface BenchHeadline {
  cashGrowthScore: number; totalReturnPct: number; sharpe: number; sortino: number;
  winRatePct: number; maxDrawdownPct: number; profitFactor: number;
}

export interface BenchRunResult {
  runId: string; status: "queued"|"running"|"done"|"error";
  headline?: BenchHeadline; provenance?: Provenance; error?: string;
}

export interface BenchCompareDelta {
  sharpe: number; totalReturnPct: number; winRatePct: number;
  maxDrawdownPct: number; profitFactor: number; cashGrowthScore: number;
}