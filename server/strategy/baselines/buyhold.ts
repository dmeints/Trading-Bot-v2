
export interface Action {
  type: "ENTER_LONG" | "EXIT" | "HOLD";
  sizePct?: number;
  tpBps?: number;
  slBps?: number;
  timeStopSec?: number;
  reason?: string;
}

export function decide_buyhold(ctx: any): Action {
  // Always long 100% nominal, for benchmarking
  return {
    type: "ENTER_LONG",
    sizePct: 1.0,
    tpBps: 0,
    slBps: 0,
    timeStopSec: 0,
    reason: "buyhold"
  };
}
