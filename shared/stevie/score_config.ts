/**
 * Score Configuration for Trade Evaluation
 * Default parameters for trade scoring system
 */

import { ScoreConfig } from "../../server/strategy/scorecard";

export const defaultScoreConfig: ScoreConfig = {
  latencyPenaltyPerSec: 0.5,     // Penalty per second of latency
  drawdownPenaltyPerBp: 0.2,     // Penalty per basis point of excess drawdown
  churnPenalty: 2,               // Fixed penalty for churning trades
  minHoldSecs: 15,               // Minimum hold time to avoid churn penalty
  tinyPnlBps: 1,                 // Threshold for "tiny" P&L in basis points
  opportunityPenaltyPerBp: 0.1,  // Penalty per basis point of missed opportunity
  toxicityThresholdBps: 3,       // Threshold for detecting toxic flow
  toxicityPenalty: 2             // Penalty for toxic trades
};

// Alternative configurations for different trading styles
export const aggressiveScoreConfig: ScoreConfig = {
  ...defaultScoreConfig,
  latencyPenaltyPerSec: 1.0,     // Higher latency penalty for HFT
  drawdownPenaltyPerBp: 0.1,     // Lower drawdown penalty (more risk tolerance)
  churnPenalty: 1,               // Lower churn penalty
  minHoldSecs: 5                 // Shorter minimum hold time
};

export const conservativeScoreConfig: ScoreConfig = {
  ...defaultScoreConfig,
  latencyPenaltyPerSec: 0.2,     // Lower latency penalty
  drawdownPenaltyPerBp: 0.5,     // Higher drawdown penalty (less risk tolerance)
  churnPenalty: 5,               // Higher churn penalty
  minHoldSecs: 60                // Longer minimum hold time
};

export const scalperScoreConfig: ScoreConfig = {
  ...defaultScoreConfig,
  latencyPenaltyPerSec: 2.0,     // Very high latency penalty
  drawdownPenaltyPerBp: 0.1,     // Low drawdown penalty
  churnPenalty: 0.5,             // Very low churn penalty
  minHoldSecs: 1,                // Very short hold time
  opportunityPenaltyPerBp: 0.05, // Lower opportunity penalty
  toxicityThresholdBps: 1,       // Lower toxicity threshold
  toxicityPenalty: 5             // Higher toxicity penalty
};