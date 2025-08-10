/**
 * Market Regime Feature Builder
 * Identifies current market volatility, trend strength, and liquidity conditions
 */

import { db } from "../db";
import { marketBars } from "@shared/schema";
import { desc, eq, gte, lte, and } from "drizzle-orm";

export interface RegimeFeatures {
  vol_pct: number;           // Current volatility percentile (0-100)
  trend_strength: number;    // Trend strength indicator (-1 to 1)
  liquidity_tier: 1 | 2 | 3; // Liquidity classification (1=high, 3=low)
}

export async function calculateRegime(
  symbol: string,
  fromTs: Date,
  toTs: Date
): Promise<RegimeFeatures | null> {
  try {
    // Get extended historical data for regime analysis
    const extendedFromTs = new Date(fromTs.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days back
    
    const barData = await db
      .select()
      .from(marketBars)
      .where(
        and(
          eq(marketBars.symbol, symbol),
          gte(marketBars.timestamp, extendedFromTs),
          lte(marketBars.timestamp, toTs)
        )
      )
      .orderBy(desc(marketBars.timestamp))
      .limit(1000);

    if (barData.length < 20) {
      return null;
    }

    // Calculate returns for volatility analysis
    const returns = [];
    const closes = barData.map(bar => parseFloat(bar.close)).reverse(); // Chronological order
    
    for (let i = 1; i < closes.length; i++) {
      returns.push(Math.log(closes[i] / closes[i - 1]));
    }

    // Calculate rolling volatilities (using different windows)
    const volatilities = [];
    const window = 20; // 20-period rolling window
    
    for (let i = window; i < returns.length; i++) {
      const windowReturns = returns.slice(i - window, i);
      const mean = windowReturns.reduce((sum, r) => sum + r, 0) / window;
      const variance = windowReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (window - 1);
      const vol = Math.sqrt(variance) * Math.sqrt(288) * 100; // Annualized % volatility
      volatilities.push(vol);
    }

    // Current volatility percentile
    const currentVol = volatilities[volatilities.length - 1] || 0;
    const sortedVols = [...volatilities].sort((a, b) => a - b);
    let vol_pct = 50; // Default to median
    
    if (sortedVols.length > 0) {
      const rank = sortedVols.findIndex(vol => vol >= currentVol);
      vol_pct = rank >= 0 ? (rank / sortedVols.length) * 100 : 100;
    }

    // Calculate trend strength using multiple timeframes
    let trend_strength = 0;
    
    // Short-term trend (5-period moving average slope)
    if (closes.length >= 10) {
      const shortMa = closes.slice(-10, -5).reduce((sum, price) => sum + price, 0) / 5;
      const recentMa = closes.slice(-5).reduce((sum, price) => sum + price, 0) / 5;
      const shortTrend = (recentMa - shortMa) / shortMa;
      
      // Medium-term trend (20-period moving average slope)
      const mediumMa = closes.slice(-25, -5).reduce((sum, price) => sum + price, 0) / 20;
      const mediumTrend = (recentMa - mediumMa) / mediumMa;
      
      // Combine trends with weights
      trend_strength = 0.6 * Math.tanh(shortTrend * 100) + 0.4 * Math.tanh(mediumTrend * 50);
    }

    // Determine liquidity tier based on volume and volatility
    const recentVolumes = barData.slice(0, 20).map(bar => parseFloat(bar.volume || '0'));
    const avgVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
    const avgPrice = closes.slice(-20).reduce((sum, price) => sum + price, 0) / 20;
    const dollarVolume = avgVolume * avgPrice;

    let liquidity_tier: 1 | 2 | 3 = 3; // Default to low liquidity

    // Tier classification based on dollar volume and volatility
    if (dollarVolume > 10000000 && currentVol < 50) { // $10M+ volume, low vol
      liquidity_tier = 1; // High liquidity
    } else if (dollarVolume > 1000000 && currentVol < 80) { // $1M+ volume, moderate vol
      liquidity_tier = 2; // Medium liquidity
    }
    // Else remains tier 3 (low liquidity)

    return {
      vol_pct: Math.round(vol_pct * 10) / 10,
      trend_strength: Math.round(trend_strength * 1000) / 1000,
      liquidity_tier
    };

  } catch (error) {
    console.error('Regime calculation error:', error);
    return null;
  }
}