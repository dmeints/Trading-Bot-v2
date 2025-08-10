/**
 * Stevie Score Configuration
 * Penalty and reward calculation parameters
 */

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

export const defaultScoreConfig: ScoreConfig = {
  latencyPenaltyPerSec: 0.5,
  drawdownPenaltyPerBp: 0.2,
  churnPenalty: 2,
  minHoldSecs: 15,
  tinyPnlBps: 1,
  opportunityPenaltyPerBp: 0.1,
  toxicityThresholdBps: 3,
  toxicityPenalty: 2
};