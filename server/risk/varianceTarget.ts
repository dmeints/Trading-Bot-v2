/**
 * Variance Targeting System
 * Dynamic position sizing based on volatility
 */

export type TF = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

const M: Record<TF, number> = {
  "1m": 1,
  "5m": 5,
  "15m": 15,
  "1h": 60,
  "4h": 240,
  "1d": 1440
};

export function annualizationFactor(tf: TF): number {
  return Math.sqrt(525_600 / M[tf]);
}

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
  
  // Calculate rolling volatility
  for (let i = window; i <= logs.length; i++) {
    const segment = logs.slice(i - window, i);
    const mean = segment.reduce((a, b) => a + b, 0) / segment.length;
    const variance = segment.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (segment.length - 1);
    vols.push(Math.sqrt(variance) * af * 100);
  }
  
  return vols;
}

export function varianceTargetMultiplier(
  volPct: number | undefined,
  target: number = 10,
  bounds: { min: number; max: number } = { min: 0.25, max: 2.0 }
): number {
  if (!volPct || volPct <= 0) return bounds.min;
  
  const multiplier = target / volPct;
  return Math.max(bounds.min, Math.min(bounds.max, multiplier));
}