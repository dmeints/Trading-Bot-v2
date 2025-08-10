/**
 * Variance Targeting for Position Sizing
 * Adjusts position sizes based on current market volatility
 */

export type TF = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

const TIMEFRAME_MINUTES: Record<TF, number> = {
  "1m": 1,
  "5m": 5,
  "15m": 15,
  "1h": 60,
  "4h": 240,
  "1d": 1440
};

/**
 * Calculate annualization factor for volatility
 */
export function annualizationFactor(tf: TF): number {
  return Math.sqrt(525_600 / TIMEFRAME_MINUTES[tf]);
}

/**
 * Calculate rolling annualized volatility percentiles
 */
export function rollingAnnualizedVolPct(
  closes: number[], 
  tf: TF, 
  window: number
): number[] {
  if (closes.length < window + 1) return [];
  
  const vols: number[] = [];
  const af = annualizationFactor(tf);
  const logs: number[] = [];
  
  // Calculate log returns
  for (let i = 1; i < closes.length; i++) {
    logs.push(Math.log(closes[i] / closes[i - 1]));
  }
  
  // Rolling window volatility calculation
  for (let i = window; i <= logs.length; i++) {
    const windowReturns = logs.slice(i - window, i);
    const mean = windowReturns.reduce((sum, r) => sum + r, 0) / windowReturns.length;
    const variance = windowReturns.reduce((sum, r) => sum + (r - mean) * (r - mean), 0) / (windowReturns.length - 1);
    const vol = Math.sqrt(variance) * af * 100; // Annualized % volatility
    vols.push(vol);
  }
  
  return vols;
}

/**
 * Calculate variance targeting multiplier
 */
export function varianceTargetMultiplier(
  volPct: number | undefined, 
  target: number = 10, 
  bounds: { min: number; max: number } = { min: 0.25, max: 2.0 }
): number {
  if (!volPct || volPct <= 0) return bounds.min;
  
  const multiplier = target / volPct;
  return Math.max(bounds.min, Math.min(bounds.max, multiplier));
}