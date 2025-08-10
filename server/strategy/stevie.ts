/**
 * Stevie Strategy Kernel
 * Core mathematical decision engine with breakout/mean-revert detection
 */

import { defaultStevieConfig, StevieConfig } from "../../shared/src/stevie/config";
import { UnifiedFeatures } from "../features";

type Bars = { ts: number; o: number; h: number; l: number; c: number; v?: number }[];

type Features = {
  bars: Bars;
  micro: { 
    spread_bps: number; 
    imbalance_1: number; 
    micro_vol_ewma: number; 
    trade_run_len: number 
  } | null;
  costs: { 
    expected_slippage_bps?: (s: number) => number; 
    curve?: { sizePct: number; bps: number }[] 
  } | null;
  social: { z: number; delta: number; spike?: boolean } | null;
  onchain: { gas_spike_flag?: boolean; bias?: number } | null;
  macro: { blackout?: boolean } | null;
  regime: { vol_pct: number; trend_strength: number; liquidity_tier: 1 | 2 | 3 } | null;
  provenance: { datasetId?: string; commit: string; generatedAt: string };
};

type Position = { symbol: string; qty: number; avgPrice: number } | null;

type Action =
  | { type: "HOLD"; reason: string }
  | { type: "ENTER_MARKET" | "ENTER_IOC"; sizePct: number; tag: string; tp_bps: number; sl_bps: number; reduceOnly?: boolean }
  | { type: "ENTER_LIMIT_MAKER"; sizePct: number; price: number; tag: string; tp_bps: number; sl_bps: number; reduceOnly?: boolean };

/**
 * Calculate expected cost for a given position size
 */
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

/**
 * Detect mean reversion snapback conditions
 */
function snapback(f: Features): boolean {
  if (!f.micro || f.bars.length < 2) return false;
  
  const last = f.bars.at(-1)!;
  const prev = f.bars.at(-2)!;
  const delta = last.c - prev.c;
  const run = f.micro.trade_run_len;
  
  // Snapback: price moved against established trend with low imbalance
  return (run > 2 && Math.sign(delta) !== Math.sign(run) && Math.abs(f.micro.imbalance_1) < 0.1);
}

/**
 * Core Stevie decision function
 */
export function decide(
  f: Features, 
  pos: Position, 
  cfg: StevieConfig = defaultStevieConfig
): Action {
  
  // Hard stops - always hold during these conditions
  if (f.macro?.blackout) {
    return { type: "HOLD", reason: "macro_blackout" };
  }
  
  if (f.onchain?.gas_spike_flag) {
    return { type: "HOLD", reason: "onchain_gas_spike" };
  }
  
  // Cost protection - don't trade if slippage too high
  const expSlip = costAt(f, cfg.baseRiskPct);
  if (expSlip > cfg.costCapBps) {
    return { type: "HOLD", reason: "slippage_cap" };
  }
  
  // Extract key metrics with defaults
  const vol = f.regime?.vol_pct ?? 50;
  const spread = f.micro?.spread_bps ?? 999;
  const soc = f.social?.delta ?? 0;
  const tier = f.regime?.liquidity_tier ?? 3;
  const bias = f.onchain?.bias;
  
  // Symbol-specific position cap
  const cap = (sym: string) => cfg.perSymbolCapPct[sym] ?? 2.0;
  const sym = "BTCUSDT"; // Default symbol
  
  // Risk scaling function based on liquidity tier and on-chain bias
  const scale = (base: number): number => {
    const tierMultiplier = tier === 1 ? 1 : tier === 2 ? 0.7 : 0.5;
    const biasMultiplier = bias != null ? (1 + Math.max(-0.5, Math.min(0.5, bias))) : 1;
    return Math.max(0, base * tierMultiplier * (bias && bias < 0 ? 0.75 : 1));
  };

  // Strategy 1: Volatility Breakout
  // High volatility + tight spreads + positive social momentum = breakout entry
  if (vol > cfg.volPctBreakout && spread <= cfg.takerBps + 2 && soc > cfg.socialGo) {
    return {
      type: "ENTER_IOC",
      sizePct: Math.min(scale(cfg.baseRiskPct), cap(sym)),
      tag: "breakout",
      tp_bps: cfg.tpBreakout,
      sl_bps: cfg.slBreakout
    };
  }

  // Strategy 2: Mean Reversion
  // Low volatility + snapback pattern = mean reversion entry
  if (vol < cfg.volPctMeanRevert && snapback(f)) {
    const last = f.bars.at(-1)!.c;
    // Place limit order slightly inside the spread
    const price = last * (f.micro!.imbalance_1 < 0 ? 0.999 : 1.001);
    
    return {
      type: "ENTER_LIMIT_MAKER",
      sizePct: Math.min(scale(cfg.baseRiskPct * 0.7), cap(sym)),
      price,
      tag: "mean_revert",
      tp_bps: cfg.tpRevert,
      sl_bps: cfg.slRevert
    };
  }

  // Strategy 3: News/Social Spike
  // Social sentiment spike + tight spreads = news-driven entry
  if (f.social?.spike && spread <= cfg.takerBps) {
    return {
      type: "ENTER_IOC",
      sizePct: Math.min(cfg.baseRiskPct, cfg.newsMaxRiskPct),
      tag: "news",
      tp_bps: cfg.tpNews,
      sl_bps: cfg.slNews
    };
  }

  // Default: No edge detected
  return { type: "HOLD", reason: "no_edge" };
}

/**
 * Enhanced decision function with features from UnifiedFeatures
 */
export function decideWithUnifiedFeatures(
  unifiedFeatures: UnifiedFeatures,
  position: Position,
  config: StevieConfig = defaultStevieConfig
): Action {
  // Convert UnifiedFeatures to legacy Features format for compatibility
  const features: Features = {
    bars: unifiedFeatures.bars,
    micro: unifiedFeatures.micro,
    costs: unifiedFeatures.costs,
    social: unifiedFeatures.social,
    onchain: unifiedFeatures.onchain,
    macro: unifiedFeatures.macro,
    regime: unifiedFeatures.regime,
    provenance: unifiedFeatures.provenance
  };

  return decide(features, position, config);
}