/**
 * Microstructure Feature Engineering
 * Real-time market microstructure indicators for Stevie's trading decisions
 */

import { db } from "../db";
import { marketBars, orderbookSnapsExtended } from "@shared/schema";
import { desc, eq, gte, lte, and } from "drizzle-orm";

export interface MicrostructureFeatures {
  spread_bps: number;
  imbalance_1: number;
  micro_vol_ewma: number;
  trade_run_len: number;
  depth_ratio: number;
  price_impact_1bp: number;
}

/**
 * Calculate bid-ask spread in basis points
 */
function calculateSpreadBps(bid: number, ask: number): number {
  if (bid <= 0 || ask <= 0 || ask <= bid) return 9999; // Invalid spread
  const mid = (bid + ask) / 2;
  return ((ask - bid) / mid) * 10000;
}

/**
 * Calculate order book imbalance at level 1
 */
function calculateImbalance(bidSize: number, askSize: number): number {
  const total = bidSize + askSize;
  if (total === 0) return 0;
  return (bidSize - askSize) / total;
}

/**
 * Calculate exponentially weighted moving average of volatility
 */
function calculateMicroVolEWMA(prices: number[], alpha: number = 0.1): number {
  if (prices.length < 2) return 0;
  
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i-1] > 0) {
      returns.push(Math.log(prices[i] / prices[i-1]));
    }
  }
  
  if (returns.length === 0) return 0;
  
  let ewma = returns[0] * returns[0]; // Initial variance
  for (let i = 1; i < returns.length; i++) {
    ewma = alpha * (returns[i] * returns[i]) + (1 - alpha) * ewma;
  }
  
  return Math.sqrt(ewma * 252 * 24 * 60) * 100; // Annualized vol %
}

/**
 * Detect consecutive trades in same direction
 */
function calculateTradeRunLength(prices: number[]): number {
  if (prices.length < 2) return 0;
  
  let runLength = 1;
  let currentDirection = 0; // 0 = unknown, 1 = up, -1 = down
  
  for (let i = 1; i < prices.length; i++) {
    const direction = prices[i] > prices[i-1] ? 1 : (prices[i] < prices[i-1] ? -1 : 0);
    
    if (direction !== 0) {
      if (currentDirection === direction) {
        runLength++;
      } else {
        currentDirection = direction;
        runLength = 1;
      }
    }
  }
  
  return currentDirection * runLength; // Signed run length
}

/**
 * Calculate depth ratio (bid depth / ask depth)
 */
function calculateDepthRatio(bidDepth: number, askDepth: number): number {
  if (askDepth === 0) return bidDepth > 0 ? 10 : 1;
  if (bidDepth === 0) return 0.1;
  return bidDepth / askDepth;
}

/**
 * Estimate price impact for 1bp of volume
 */
function calculatePriceImpact1bp(depth1bp: number, price: number): number {
  if (depth1bp === 0 || price === 0) return 999;
  const notionalFor1bp = price * 0.0001; // 1bp of price
  return Math.min(999, notionalFor1bp / depth1bp);
}

/**
 * Get microstructure features for a symbol over time window
 */
export async function getMicrostructureFeatures(
  symbol: string,
  startTime: Date,
  endTime: Date
): Promise<MicrostructureFeatures | null> {
  try {
    // Get recent orderbook snapshots
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
      .limit(100);

    if (orderbookData.length === 0) {
      return null;
    }

    // Get recent price bars for trade analysis
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
      .limit(50);

    if (barData.length === 0) {
      return null;
    }

    // Calculate features from most recent data
    const latestOrderbook = orderbookData[0];
    const prices = barData.map(bar => bar.close).reverse(); // Chronological order
    
    // Spread in basis points
    const spread_bps = calculateSpreadBps(latestOrderbook.bidPrice, latestOrderbook.askPrice);
    
    // Order book imbalance
    const imbalance_1 = calculateImbalance(
      latestOrderbook.bidSize || 0,
      latestOrderbook.askSize || 0
    );
    
    // Micro volatility EWMA
    const micro_vol_ewma = calculateMicroVolEWMA(prices);
    
    // Trade run length
    const trade_run_len = calculateTradeRunLength(prices);
    
    // Depth ratio
    const depth_ratio = calculateDepthRatio(
      latestOrderbook.bidDepth || 0,
      latestOrderbook.askDepth || 0
    );
    
    // Price impact
    const price_impact_1bp = calculatePriceImpact1bp(
      latestOrderbook.depth1bp || 0,
      latestOrderbook.bidPrice
    );

    return {
      spread_bps: Math.round(spread_bps * 100) / 100,
      imbalance_1: Math.round(imbalance_1 * 1000) / 1000,
      micro_vol_ewma: Math.round(micro_vol_ewma * 100) / 100,
      trade_run_len,
      depth_ratio: Math.round(depth_ratio * 100) / 100,
      price_impact_1bp: Math.round(price_impact_1bp * 100) / 100
    };

  } catch (error) {
    console.error('Error calculating microstructure features:', error);
    return null;
  }
}

/**
 * Calculate liquidity tier based on market conditions
 */
export function calculateLiquidityTier(features: MicrostructureFeatures): 1 | 2 | 3 {
  const { spread_bps, depth_ratio, price_impact_1bp } = features;
  
  // Tier 1: Highly liquid (tight spreads, deep book)
  if (spread_bps < 5 && depth_ratio > 0.8 && depth_ratio < 1.25 && price_impact_1bp < 0.1) {
    return 1;
  }
  
  // Tier 3: Poor liquidity (wide spreads, thin book)
  if (spread_bps > 20 || price_impact_1bp > 1.0) {
    return 3;
  }
  
  // Tier 2: Moderate liquidity
  return 2;
}