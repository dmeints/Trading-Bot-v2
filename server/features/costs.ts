/**
 * Trading Costs Feature Builder
 * Calculates expected slippage and cost curves for different trade sizes
 */

import { db } from "../db";
import { marketBars } from "@shared/schema";
import { desc, eq, gte, lte, and } from "drizzle-orm";

export interface CostFeatures {
  expected_slippage_bps?: (sizePct: number) => number;
  curve?: { sizePct: number; bps: number }[];
}

export async function calculateCosts(
  symbol: string,
  fromTs: Date,
  toTs: Date
): Promise<CostFeatures | null> {
  try {
    // Get recent market data for cost estimation
    const barData = await db
      .select()
      .from(marketBars)
      .where(
        and(
          eq(marketBars.symbol, symbol),
          gte(marketBars.timestamp, fromTs),
          lte(marketBars.timestamp, toTs)
        )
      )
      .orderBy(desc(marketBars.timestamp))
      .limit(100);

    if (barData.length === 0) {
      return null;
    }

    // Calculate average volume and volatility for cost modeling
    const avgVolume = barData.reduce((sum, bar) => sum + parseFloat(bar.volume || '0'), 0) / barData.length;
    const avgPrice = barData.reduce((sum, bar) => sum + parseFloat(bar.close), 0) / barData.length;

    // Calculate recent volatility
    const returns = [];
    for (let i = 1; i < Math.min(barData.length, 20); i++) {
      returns.push(Math.log(parseFloat(barData[i - 1].close) / parseFloat(barData[i].close)));
    }
    
    const volatility = returns.length > 0 
      ? Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length) * Math.sqrt(288)
      : 0.02; // Default 2% volatility

    // Generate cost curve for different trade sizes
    const sizePcts = [0.1, 0.25, 0.5, 1.0, 2.0, 5.0];
    const curve = sizePcts.map(sizePct => {
      // Market impact model: linear + square root components
      const linearImpact = sizePct * 0.5; // 0.5 bps per 1% of volume
      const sqrtImpact = Math.sqrt(sizePct) * volatility * 200; // Volatility-based impact
      const spreadCost = Math.max(5, 20 / Math.sqrt(avgVolume / 1000000)); // Spread widens with low volume
      
      const totalBps = linearImpact + sqrtImpact + spreadCost;
      
      return {
        sizePct,
        bps: Math.round(totalBps * 100) / 100
      };
    });

    // Create interpolation function for expected slippage
    const expected_slippage_bps = (sizePct: number): number => {
      // Find bracketing points in curve
      let lower = curve[0];
      let upper = curve[curve.length - 1];
      
      for (let i = 0; i < curve.length - 1; i++) {
        if (sizePct >= curve[i].sizePct && sizePct <= curve[i + 1].sizePct) {
          lower = curve[i];
          upper = curve[i + 1];
          break;
        }
      }
      
      // Linear interpolation
      if (lower.sizePct === upper.sizePct) {
        return lower.bps;
      }
      
      const ratio = (sizePct - lower.sizePct) / (upper.sizePct - lower.sizePct);
      return lower.bps + ratio * (upper.bps - lower.bps);
    };

    return {
      expected_slippage_bps,
      curve
    };

  } catch (error) {
    console.error('Cost calculation error:', error);
    return null;
  }
}