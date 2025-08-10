import { describe, it, expect } from "vitest";
import { decide } from "./stevie";
import { defaultStevieConfig } from "../../shared/src/stevie/config";

const baseF = () => ({
  bars: [{ts:1,o:1,h:1,l:1,c:100},{ts:2,o:1,h:1,l:1,c:100.1}],
  micro: { spread_bps: 5, imbalance_1: 0.05, micro_vol_ewma: 1, trade_run_len: 3 },
  costs: { expected_slippage_bps: (s:number)=> 4 + s },
  social: { z: 1.1, delta: 0, spike:false },
  onchain: { gas_spike_flag:false, bias:0 },
  macro: { blackout:false },
  regime: { vol_pct: 50, trend_strength: 0.5, liquidity_tier: 1 },
  provenance: { commit:"test", generatedAt:new Date().toISOString() }
});

describe("stevie router", () => {
  it("holds on blackout", () => {
    const f = baseF(); (f.macro as any).blackout = true;
    const a = decide(f as any, null, defaultStevieConfig);
    expect(a.type).toBe("HOLD");
  });

  it("fires breakout when vol high, spread ok, social rising", () => {
    const f = baseF(); (f.regime as any).vol_pct = 80; (f.social as any).delta = 1.0; (f.micro as any).spread_bps = 8;
    const a = decide(f as any, null, { ...defaultStevieConfig, takerBps: 7 });
    expect(a.type).toBe("ENTER_IOC");
    expect((a as any).tag).toBe("breakout");
  });

  it("fires mean-revert when vol low and snapback", () => {
    const f = baseF(); (f.regime as any).vol_pct = 30; (f.micro as any).trade_run_len = 4; (f.bars[1] as any).c = 99.9;
    const a = decide(f as any, null, defaultStevieConfig);
    expect(a.type).toBe("ENTER_LIMIT_MAKER");
    expect((a as any).tag).toBe("mean_revert");
  });

  it("blocks on slippage cap", () => {
    const f = baseF(); (f.costs as any).expected_slippage_bps = () => 999;
    const a = decide(f as any, null, defaultStevieConfig);
    expect(a.type).toBe("HOLD");
  });
});