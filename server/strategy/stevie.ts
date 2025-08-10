import { defaultStevieConfig, StevieConfig } from "../../shared/src/stevie/config";

// Feature types pulled from /api/features (shape must match your endpoint)
type Bars = { ts:number; o:number; h:number; l:number; c:number; v?:number }[];
type Features = {
  bars: Bars;
  micro: { spread_bps:number; imbalance_1:number; micro_vol_ewma:number; trade_run_len:number } | null;
  costs: { expected_slippage_bps: (sizePct:number)=>number } | { curve?: Array<{sizePct:number; bps:number}> } | null;
  social: { z:number; delta:number; spike?:boolean } | null;
  onchain: { gas_spike_flag?:boolean; bias?:number } | null;
  macro: { blackout?:boolean } | null;
  regime: { vol_pct:number; trend_strength:number; liquidity_tier:1|2|3 } | null;
  provenance: { datasetId?:string; commit:string; generatedAt:string };
};

type Action =
  | { type:"HOLD"; reason:string }
  | { type:"ENTER_MARKET"; sizePct:number; tag:string; tp_bps:number; sl_bps:number; reduceOnly?:boolean }
  | { type:"ENTER_IOC"; sizePct:number; tag:string; tp_bps:number; sl_bps:number; reduceOnly?:boolean }
  | { type:"ENTER_LIMIT_MAKER"; sizePct:number; price:number; tag:string; tp_bps:number; sl_bps:number; reduceOnly?:boolean };

type Position = { symbol:string; qty:number; avgPrice:number } | null;

function costAt(cfg:StevieConfig, f:Features, sizePct:number): number {
  if (!f.costs) return Number.POSITIVE_INFINITY;
  if (typeof (f.costs as any).expected_slippage_bps === "function") {
    return (f.costs as any).expected_slippage_bps(sizePct);
  }
  const curve = (f.costs as any).curve as Array<{sizePct:number; bps:number}> | undefined;
  if (!curve || !curve.length) return Number.POSITIVE_INFINITY;
  // simple piecewise nearest
  let best = curve[0].bps, bestD = Math.abs(curve[0].sizePct - sizePct);
  for (const p of curve) {
    const d = Math.abs(p.sizePct - sizePct);
    if (d < bestD) { best = p.bps; bestD = d; }
  }
  return best;
}

function scaleByLiquidity(base:number, tier:1|2|3, onchainBias:number|undefined): number {
  const t = tier === 1 ? 1.0 : tier === 2 ? 0.7 : 0.5;
  const b = onchainBias != null ? (1 + Math.max(-0.5, Math.min(0.5, onchainBias))) : 1;
  return Math.max(0, base * t * (b < 0 ? 0.75 : 1.0));
}

function snapback(f:Features): boolean {
  if (!f.micro || !f.bars.length) return false;
  const last = f.bars[f.bars.length - 1];
  const prev = f.bars[f.bars.length - 2] || last;
  const delta = last.c - prev.c;
  // Snapback if price reverted opposite to trade_run direction and imbalance flips
  const run = f.micro.trade_run_len;
  return (run > 2 && Math.sign(delta) !== Math.sign(run) && Math.abs(f.micro.imbalance_1) < 0.1);
}

export function decide(features: Features, pos: Position, cfg: StevieConfig = defaultStevieConfig): Action {
  const f = features;
  // Hard blocks
  if (f.macro?.blackout) return { type:"HOLD", reason:"macro_blackout" };
  if (f.onchain?.gas_spike_flag) return { type:"HOLD", reason:"onchain_gas_spike" };

  // slippage cap at base size
  const sizeBase = cfg.baseRiskPct;
  const expSlip = costAt(cfg, f, sizeBase);
  if (expSlip > cfg.costCapBps) return { type:"HOLD", reason:"slippage_cap" };

  const volPct = f.regime?.vol_pct ?? 50;
  const spread = f.micro?.spread_bps ?? 999;
  const socialDelta = f.social?.delta ?? 0;
  const liquidityTier = f.regime?.liquidity_tier ?? 3;
  const onBias = f.onchain?.bias;

  // Router: Breakout
  if (volPct > cfg.volPctBreakout && spread <= (cfg.takerBps + 2) && socialDelta > cfg.socialGo) {
    const size = Math.min(scaleByLiquidity(sizeBase, liquidityTier, onBias), cfg.perSymbolCapPct["BTCUSDT"] ?? 2.0);
    return { type:"ENTER_IOC", sizePct:size, tag:"breakout", tp_bps: cfg.tpBreakout, sl_bps: cfg.slBreakout, reduceOnly:false };
  }

  // Router: Mean reversion
  if (volPct < cfg.volPctMeanRevert && snapback(f)) {
    const size = Math.min(scaleByLiquidity(sizeBase*0.7, liquidityTier, onBias), cfg.perSymbolCapPct["BTCUSDT"] ?? 2.0);
    const last = f.bars[f.bars.length-1]?.c ?? 0;
    const price = last * (f.micro!.imbalance_1 < 0 ? 0.999 : 1.001);
    return { type:"ENTER_LIMIT_MAKER", sizePct:size, price, tag:"mean_revert", tp_bps: cfg.tpRevert, sl_bps: cfg.slRevert, reduceOnly:false };
  }

  // Router: News momentum
  if (f.social?.spike && spread <= cfg.takerBps) {
    const size = Math.min(cfg.baseRiskPct, cfg.newsMaxRiskPct);
    return { type:"ENTER_IOC", sizePct:size, tag:"news", tp_bps: cfg.tpNews, sl_bps: cfg.slNews, reduceOnly:false };
  }

  return { type:"HOLD", reason:"no_edge" };
}