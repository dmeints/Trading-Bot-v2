/**
 * Default Score Configuration
 */

export interface ScoreConfig {
  latencyPenaltyPerSec: number;
  drawdownPenaltyPerBp: number;
  churnPenalty: number;
  minHoldSecs: number;
  tinyPnlBps: number;
  opportunityPenaltyPerBp: number;
  toxicityThresholdBps: number;
  toxicityPenalty: number;
}

export const defaultScoreConfig: ScoreConfig = {
  latencyPenaltyPerSec: 0.5,       // 0.5 bps penalty per second of latency
  drawdownPenaltyPerBp: 0.2,       // 0.2 bps penalty per bp of excess drawdown
  churnPenalty: 2,                 // 2 bps penalty for churning trades
  minHoldSecs: 15,                 // Minimum hold time to avoid churn penalty
  tinyPnlBps: 1,                   // P&L threshold for churn detection
  opportunityPenaltyPerBp: 0.1,    // 0.1 bps penalty per bp of missed opportunity
  toxicityThresholdBps: 3,         // 3 bps adverse move threshold for toxicity
  toxicityPenalty: 2               // 2 bps penalty for toxic trades
};