/**
 * Stevie Strategy Kernel
 * Core algorithmic trading decision engine
 */

import { defaultStevieConfig, StevieConfig } from "../../shared/src/stevie/config";
import { varianceTargetMultiplier } from "../risk/varianceTarget";
import { temperedKellyFraction } from "../sizing/temperedKelly";

type Bars = { ts: number; o: number; h: number; l: number; c: number; v?: number }[];

type Features = {
  bars: Bars;
  micro: {
    spread_bps: number;
    imbalance_1: number;
    micro_vol_ewma: number;
    trade_run_len: number;
  } | null;
  costs: {
    expected_slippage_bps?: (s: number) => number;
    curve?: { sizePct: number; bps: number }[];
  } | null;
  social: {
    z: number;
    delta: number;
    spike?: boolean;
  } | null;
  onchain: {
    gas_spike_flag?: boolean;
    bias?: number;
  } | null;
  macro: {
    blackout?: boolean;
  } | null;
  regime: {
    vol_pct: number;
    trend_strength: number;
    liquidity_tier: 1 | 2 | 3;
  } | null;
  provenance: {
    datasetId?: string;
    commit: string;
    generatedAt: string;
  };
};

type Position = { symbol: string; qty: number; avgPrice: number } | null;

type Action =
  | { type: "HOLD"; reason: string }
  | {
      type: "ENTER_MARKET" | "ENTER_IOC";
      sizePct: number;
      tag: string;
      tp_bps: number;
      sl_bps: number;
      reduceOnly?: boolean;
    }
  | {
      type: "ENTER_LIMIT_MAKER";
      sizePct: number;
      price: number;
      tag: string;
      tp_bps: number;
      sl_bps: number;
      reduceOnly?: boolean;
    };

function costAt(f: Features, sizePct: number): number {
  if (!f.costs) return Infinity;

  if (f.costs.expected_slippage_bps) {
    return f.costs.expected_slippage_bps(sizePct);
  }

  const c = f.costs.curve || [];
  if (!c.length) return Infinity;

  return c.reduce((best, p) =>
    Math.abs(p.sizePct - sizePct) < Math.abs(best.sizePct - sizePct) ? p : best
  ).bps;
}

function snapback(f: Features): boolean {
  if (!f.micro || f.bars.length < 2) return false;

  const last = f.bars.at(-1)!;
  const prev = f.bars.at(-2)!;
  const delta = last.c - prev.c;
  const run = f.micro.trade_run_len;

  return (
    run > 2 &&
    Math.sign(delta) !== Math.sign(run) &&
    Math.abs(f.micro.imbalance_1) < 0.1
  );
}

export function decide(
  f: Features,
  pos: Position,
  cfg: StevieConfig = defaultStevieConfig,
  score7d: number = 0
): Action {
  // Mandatory blackout conditions
  if (f.macro?.blackout) return { type: "HOLD", reason: "macro_blackout" };
  if (f.onchain?.gas_spike_flag) return { type: "HOLD", reason: "onchain_gas_spike" };

  // Cost protection
  const expSlip = costAt(f, cfg.baseRiskPct);
  if (expSlip > cfg.costCapBps) return { type: "HOLD", reason: "slippage_cap" };

  // Extract feature values with defaults
  const vol = f.regime?.vol_pct ?? 50;
  const spread = f.micro?.spread_bps ?? 999;
  const soc = f.social?.delta ?? 0;
  const tier = f.regime?.liquidity_tier ?? 3;
  const bias = f.onchain?.bias;

  // Symbol-specific position cap
  const cap = (sym: string) => cfg.perSymbolCapPct[sym] ?? 2.0;
  const sym = "BTCUSDT"; // Primary symbol for now

  // Liquidity and bias scaling
  const scale = (base: number) => {
    const tierMultiplier = tier === 1 ? 1 : tier === 2 ? 0.7 : 0.5;
    const biasMultiplier = bias != null
      ? (1 + Math.max(-0.5, Math.min(0.5, bias)))
      : 1;
    return Math.max(0, base * tierMultiplier * (bias && bias < 0 ? 0.75 : 1));
  };

  // Calculate position size with advanced sizing
  const calculateSize = (baseSize: number) => {
    // Variance targeting
    const volMultiplier = varianceTargetMultiplier(vol);

    // Tempered Kelly sizing (simplified for MVP)
    const edgeBps = vol > cfg.volPctBreakout ? 15 : vol < cfg.volPctMeanRevert ? 10 : 5;
    const varBps2 = Math.pow(vol * 10, 2); // Rough variance estimate
    const kellyMultiplier = temperedKellyFraction({
      edgeBps,
      varBps2,
      temper: 0.25,
      min: 0.1,
      max: 1.0,
      score7d
    });

    const adjustedSize = baseSize * volMultiplier * kellyMultiplier;
    return Math.min(scale(adjustedSize), cap(sym));
  };

  // STRATEGY 1: Breakout (High volatility + Social momentum)
  if (vol > cfg.volPctBreakout && spread <= cfg.takerBps + 2 && soc > cfg.socialGo) {
    return {
      type: "ENTER_IOC",
      sizePct: calculateSize(cfg.baseRiskPct),
      tag: "breakout",
      tp_bps: cfg.tpBreakout,
      sl_bps: cfg.slBreakout
    };
  }

  // STRATEGY 2: Mean Reversion (Low volatility + Snapback signal)
  if (vol < cfg.volPctMeanRevert && snapback(f)) {
    const last = f.bars.at(-1)!.c;
    const price = last * (f.micro!.imbalance_1 < 0 ? 0.999 : 1.001);

    return {
      type: "ENTER_LIMIT_MAKER",
      sizePct: calculateSize(cfg.baseRiskPct * 0.7),
      price,
      tag: "mean_revert",
      tp_bps: cfg.tpRevert,
      sl_bps: cfg.slRevert
    };
  }

  // STRATEGY 3: News Momentum (Social spike + Good spread)
  if (f.social?.spike && spread <= cfg.takerBps) {
    return {
      type: "ENTER_IOC",
      sizePct: Math.min(cfg.baseRiskPct, cfg.newsMaxRiskPct),
      tag: "news",
      tp_bps: cfg.tpNews,
      sl_bps: cfg.slNews
    };
  }

  return { type: "HOLD", reason: "no_edge" };
}