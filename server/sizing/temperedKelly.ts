/**
 * Tempered Kelly Sizing
 * Risk-adjusted position sizing with performance penalties
 */

export function temperedKellyFraction({
  edgeBps,
  varBps2,
  temper,
  min = 0,
  max = 0.05,
  score7d = 0
}: {
  edgeBps: number;
  varBps2: number;
  temper: number;
  min?: number;
  max?: number;
  score7d?: number;
}): number {
  if (varBps2 <= 0) return min;
  
  // Convert basis points to decimal
  const e = edgeBps / 10_000;
  const v = varBps2 / (10_000 * 10_000);
  
  // Kelly fraction calculation
  let f = e / v;
  if (!isFinite(f)) f = 0;
  
  // Performance-based penalty
  const penalty = score7d < 0 ? Math.max(0.5, 1 + score7d / 100) : 1;
  
  // Apply tempering and penalty
  const out = f * temper * penalty;
  
  return Math.max(min, Math.min(max, out));
}