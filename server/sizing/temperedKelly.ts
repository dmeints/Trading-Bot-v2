/**
 * Tempered Kelly Position Sizing
 * Kelly criterion with risk tempering and performance-based adjustments
 */

export interface TemperedKellyParams {
  edgeBps: number;      // Expected edge in basis points
  varBps2: number;      // Variance in basis points squared
  temper: number;       // Tempering factor (0-1)
  min?: number;         // Minimum position size
  max?: number;         // Maximum position size
  score7d?: number;     // 7-day performance score for adjustment
}

/**
 * Calculate tempered Kelly fraction
 */
export function temperedKellyFraction({
  edgeBps,
  varBps2,
  temper,
  min = 0,
  max = 0.05,
  score7d = 0
}: TemperedKellyParams): number {
  
  if (varBps2 <= 0) return min;
  
  // Convert to decimal form for calculation
  const edge = edgeBps / 10_000;
  const variance = varBps2 / (10_000 * 10_000);
  
  // Basic Kelly fraction: f = edge / variance
  let kellyFraction = edge / variance;
  
  if (!isFinite(kellyFraction)) {
    kellyFraction = 0;
  }
  
  // Performance-based penalty: reduce sizing if recent performance is poor
  const performancePenalty = score7d < 0 
    ? Math.max(0.5, 1 + score7d / 100) 
    : 1;
  
  // Apply tempering and performance adjustment
  const temperedSize = kellyFraction * temper * performancePenalty;
  
  // Clamp to bounds
  return Math.max(min, Math.min(max, temperedSize));
}