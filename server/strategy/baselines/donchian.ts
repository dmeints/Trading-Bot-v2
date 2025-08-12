
import { Action } from "./buyhold";

export function decide_donchian(ctx: any): Action {
  const hh = ctx.features?.donchian_high ?? NaN;
  const ll = ctx.features?.donchian_low ?? NaN;
  const px = ctx.features?.price ?? NaN;
  
  if (!isFinite(hh) || !isFinite(ll) || !isFinite(px)) {
    return { type: "HOLD", reason: "missing_donchian" };
  }
  
  if (px >= hh) {
    return {
      type: "ENTER_LONG",
      sizePct: 1.0,
      tpBps: 120,
      slBps: 70,
      timeStopSec: 3600,
      reason: "donchian_breakout"
    };
  }
  
  if (px <= ll) {
    return { type: "EXIT", reason: "donchian_exit" };
  }
  
  return { type: "HOLD", reason: "donchian_hold" };
}
