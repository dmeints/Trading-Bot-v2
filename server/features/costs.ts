/**
 * Cost Modeling and Slippage Estimation
 * Real-time cost analysis for intelligent position sizing
 */

import { db } from "../db";
import { marketBars, orderbookSnapsExtended } from "@shared/schema";
import { desc, eq, gte, lte, and } from "drizzle-orm";

export interface CostFeatures {
  expected_slippage_bps: (sizePct: number) => number;
  curve: { sizePct: number; bps: number }[];
  market_impact_model: {
    temporary_bps: number;
    permanent_bps: number;
    liquidity_cost_bps: number;
  };
}

/**
 * Calculate market impact using square root model
 * Impact = volatility * sqrt(volume / average_volume) * participation_rate
 */
function calculateMarketImpact(
  volume: number,
  averageVolume: number,
  volatility: number,
  participationRate: number
): number {
  if (averageVolume === 0 || volatility === 0) return 999;
  
  const volumeRatio = volume / averageVolume;
  const sqrtComponent = Math.sqrt(Math.max(0.01, volumeRatio));
  
  // Market impact in basis points
  const impact = volatility * sqrtComponent * participationRate * 100;
  
  return Math.min(999, Math.max(0.1, impact));
}

/**
 * Build slippage curve for different position sizes
 */
function buildSlippageCurve(
  avgVolume: number,
  volatility: number,
  spread: number,
  depth: number
): { sizePct: number; bps: number }[] {
  const sizePcts = [0.1, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 5.0];
  const curve: { sizePct: number; bps: number }[] = [];
  
  for (const sizePct of sizePcts) {
    // Base spread cost
    let totalCost = spread / 2;
    
    // Market impact component
    const participationRate = Math.min(0.5, sizePct / 100); // Convert to decimal
    const volume = avgVolume * participationRate;
    const marketImpact = calculateMarketImpact(volume, avgVolume, volatility, participationRate);
    
    // Depth cost (crossing the spread)
    const depthCost = depth > 0 ? Math.min(spread, (volume / depth) * spread) : spread;
    
    totalCost = Math.max(spread / 2, totalCost + marketImpact + depthCost);
    
    curve.push({
      sizePct,
      bps: Math.round(totalCost * 100) / 100
    });
  }
  
  return curve;
}

/**
 * Create interpolation function for slippage curve
 */
function createSlippageFunction(curve: { sizePct: number; bps: number }[]): (sizePct: number) => number {
  return (sizePct: number): number => {
    if (curve.length === 0) return 999;
    if (sizePct <= 0) return curve[0].bps;
    
    // Find bracketing points
    let i = 0;
    while (i < curve.length - 1 && curve[i + 1].sizePct < sizePct) {
      i++;
    }
    
    if (i === curve.length - 1) return curve[i].bps;
    
    // Linear interpolation
    const p1 = curve[i];
    const p2 = curve[i + 1];
    const t = (sizePct - p1.sizePct) / (p2.sizePct - p1.sizePct);
    
    return p1.bps + t * (p2.bps - p1.bps);
  };
}

/**
 * Get cost features for a symbol
 */
export async function getCostFeatures(
  symbol: string,
  startTime: Date,
  endTime: Date
): Promise<CostFeatures | null> {
  try {
    // Get recent market data
    const barData = await db
      .select()
      .from(marketBars)
      .where(
        and(
          eq(marketBars.symbol, symbol),
          gte(marketBars.timestamp, startTime),
          lte(marketBars.timestamp, endTime)
        )
      )
      .orderBy(desc(marketBars.timestamp))
      .limit(100);

    const orderbookData = await db
      .select()
      .from(orderbookSnapsExtended)
      .where(
        and(
          eq(orderbookSnapsExtended.symbol, symbol),
          gte(orderbookSnapsExtended.timestamp, startTime),
          lte(orderbookSnapsExtended.timestamp, endTime)
        )
      )
      .orderBy(desc(orderbookSnapsExtended.timestamp))
      .limit(20);

    if (barData.length === 0 || orderbookData.length === 0) {
      return null;
    }

    // Calculate average volume and volatility
    const volumes = barData.map(bar => bar.volume || 0).filter(v => v > 0);
    const avgVolume = volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 0;
    
    // Calculate volatility from price changes
    const prices = barData.map(bar => bar.close);
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i-1] > 0) {
        returns.push(Math.log(prices[i] / prices[i-1]));
      }
    }
    
    let volatility = 0;
    if (returns.length > 1) {
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (returns.length - 1);
      volatility = Math.sqrt(variance * 252 * 24 * 60) * 100; // Annualized vol in %
    }

    // Get current spread and depth
    const latestOrderbook = orderbookData[0];
    const spread = latestOrderbook.spreadBps || 10;
    const depth = Math.min(
      latestOrderbook.bidDepth || 0,
      latestOrderbook.askDepth || 0
    );

    // Build slippage curve
    const curve = buildSlippageCurve(avgVolume, volatility, spread, depth);
    
    // Create slippage function
    const expected_slippage_bps = createSlippageFunction(curve);

    // Calculate market impact components
    const market_impact_model = {
      temporary_bps: spread / 2, // Half spread
      permanent_bps: Math.min(5, volatility / 10), // Fraction of volatility
      liquidity_cost_bps: Math.max(1, Math.min(10, 1000 / (depth || 100))) // Inverse depth
    };

    return {
      expected_slippage_bps,
      curve,
      market_impact_model
    };

  } catch (error) {
    console.error('Error calculating cost features:', error);
    return null;
  }
}

/**
 * Calculate optimal order size to minimize costs
 */
export function calculateOptimalSize(
  maxSizePct: number,
  costFunction: (sizePct: number) => number,
  edgeBps: number
): number {
  // Find size where marginal cost equals marginal benefit
  let optimalSize = 0.1;
  let minNetBenefit = -Infinity;
  
  for (let size = 0.1; size <= maxSizePct; size += 0.1) {
    const cost = costFunction(size);
    const netBenefit = (edgeBps - cost) * size;
    
    if (netBenefit > minNetBenefit) {
      minNetBenefit = netBenefit;
      optimalSize = size;
    }
  }
  
  return Math.min(maxSizePct, Math.max(0.1, optimalSize));
}