
import { Action } from "./buyhold";

export function decide_sma(ctx: any): Action {
  const f = ctx.features || {};
  const fast = f.sma_fast;
  const slow = f.sma_slow;
  
  if (!isFinite(fast) || !isFinite(slow)) {
    return { type: "HOLD", reason: "missing_sma" };
  }
  
  if (fast > slow) {
    return {
      type: "ENTER_LONG",
      sizePct: 1.0,
      tpBps: 0,
      slBps: 0,
      timeStopSec: 0,
      reason: "sma_long"
    };
  }
  
  if (fast < slow) {
    return { type: "EXIT", reason: "sma_exit" };
  }
  
  return { type: "HOLD", reason: "sma_hold" };
}
