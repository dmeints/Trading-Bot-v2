/**
 * Trading Costs Features  
 * Slippage estimation and cost curves
 */

export interface CostFeatures {
  expected_slippage_bps?: (sizePct: number) => number;
  curve?: Array<{ sizePct: number; bps: number }>;
}

export function calculateCosts(
  symbol: string,
  avgVolume: number = 1000000,
  avgSpread: number = 5
): CostFeatures {
  console.log(`[Costs] Calculating cost structure for ${symbol}`);
  
  // Build slippage cost curve based on market characteristics
  const curve = [
    { sizePct: 0.1, bps: avgSpread * 0.5 },      // Small orders: half spread
    { sizePct: 0.5, bps: avgSpread * 0.8 },      // Medium orders: most of spread
    { sizePct: 1.0, bps: avgSpread * 1.2 },      // Large orders: spread + slippage
    { sizePct: 2.0, bps: avgSpread * 2.0 },      // Very large: significant slippage
    { sizePct: 5.0, bps: avgSpread * 5.0 },      // Huge orders: major slippage
  ];
  
  // Slippage estimation function
  const expected_slippage_bps = (sizePct: number): number => {
    if (sizePct <= 0) return 0;
    if (sizePct >= 5) return avgSpread * 5.0;
    
    // Linear interpolation between curve points
    for (let i = 0; i < curve.length - 1; i++) {
      const current = curve[i];
      const next = curve[i + 1];
      
      if (sizePct >= current.sizePct && sizePct <= next.sizePct) {
        const ratio = (sizePct - current.sizePct) / (next.sizePct - current.sizePct);
        return current.bps + ratio * (next.bps - current.bps);
      }
    }
    
    return avgSpread;
  };
  
  console.log(`[Costs] Built cost curve for ${symbol}: 0.5% size = ${expected_slippage_bps(0.5).toFixed(2)}bps`);
  
  return {
    expected_slippage_bps,
    curve
  };
}