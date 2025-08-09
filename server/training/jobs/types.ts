/**
 * Training Job Types - Async Job System for Stevie
 */

export type TrainingState = "queued" | "preflight" | "training" | "evaluating" | "done" | "failed";

export interface TrainingRequest {
  durationHours: number;
  symbols: string[];
  skipValidation?: boolean;
  seed?: number;
  version?: string;
  features?: string[];
  maxDurationHours?: number;
  maxCostUsd?: number;
  notes?: string;
}

export interface TrainingJob extends TrainingRequest {
  jobId: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  state: TrainingState;
  progress: number; // 0..1
  phase?: string;   // e.g. "PPO epoch 4/20"
  etaSeconds?: number;
  error?: string;
  manifestPath?: string;
  artifacts?: {
    modelPath?: string;
    reportHtml?: string;
    metricsPath?: string;
  };
  metrics?: {
    sharpe?: number;
    returnPct?: number;
    maxDDPct?: number;
    ciSharpe95?: [number, number];
    winRate?: number;
    generation?: number;
    improvementPct?: number;
  };
}