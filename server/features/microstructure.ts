/**
 * Microstructure Feature Builder
 * Calculates spread, imbalance, volatility and trade run metrics
 */

import { db } from "../db";
import { marketBars, orderbookSnapsExtended } from "@shared/schema";
import { desc, eq, gte, lte, and } from "drizzle-orm";

export interface MicrostructureFeatures {
  spread_bps: number;
  imbalance_1: number;
  micro_vol_ewma: number;
  trade_run_len: number;
}

export async function calculateMicrostructure(
  symbol: string,
  fromTs: Date,
  toTs: Date
): Promise<MicrostructureFeatures | null> {
  try {
    // Get recent orderbook snapshots for spread calculation
    const orderbookData = await db
      .select()
      .from(orderbookSnapsExtended)
      .where(
        and(
          eq(orderbookSnapsExtended.symbol, symbol),
          gte(orderbookSnapsExtended.timestamp, fromTs),
          lte(orderbookSnapsExtended.timestamp, toTs)
        )
      )
      .orderBy(desc(orderbookSnapsExtended.timestamp))
      .limit(100);

    // Get market bars for volatility calculation
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
      .limit(50);

    if (orderbookData.length === 0 || barData.length === 0) {
      return null;
    }

    // Calculate spread in basis points
    const latestOrderbook = orderbookData[0];
    const bidPrice = parseFloat(latestOrderbook.bid);
    const askPrice = parseFloat(latestOrderbook.ask);
    const midPrice = (bidPrice + askPrice) / 2;
    const spread_bps = ((askPrice - bidPrice) / midPrice) * 10000;

    // Calculate order book imbalance
    const bidSize = parseFloat(latestOrderbook.depth1bp || '1000'); // Default if missing
    const askSize = parseFloat(latestOrderbook.depth5bp || '1000');
    const imbalance_1 = (bidSize - askSize) / (bidSize + askSize);

    // Calculate EWMA volatility from recent bars
    const returns = [];
    for (let i = 1; i < Math.min(barData.length, 20); i++) {
      const currentClose = parseFloat(barData[i - 1].close);
      const prevClose = parseFloat(barData[i].close);
      returns.push(Math.log(currentClose / prevClose));
    }

    let micro_vol_ewma = 0;
    if (returns.length > 0) {
      const alpha = 0.1; // EWMA decay factor
      let ewmaVar = returns[0] * returns[0];
      
      for (let i = 1; i < returns.length; i++) {
        ewmaVar = alpha * (returns[i] * returns[i]) + (1 - alpha) * ewmaVar;
      }
      
      micro_vol_ewma = Math.sqrt(ewmaVar) * Math.sqrt(288) * 100; // Annualized % volatility
    }

    // Calculate trade run length (simplified heuristic)
    // Positive run = consecutive upticks, negative = downticks
    let trade_run_len = 0;
    let currentDirection = 0;
    
    for (let i = 1; i < Math.min(barData.length, 10); i++) {
      const direction = parseFloat(barData[i - 1].close) > parseFloat(barData[i].close) ? 1 : -1;
      
      if (currentDirection === 0) {
        currentDirection = direction;
        trade_run_len = 1;
      } else if (currentDirection === direction) {
        trade_run_len += direction; // Accumulate run length with direction
      } else {
        break; // Run ended
      }
    }

    return {
      spread_bps: Math.round(spread_bps * 100) / 100,
      imbalance_1: Math.round(imbalance_1 * 1000) / 1000,
      micro_vol_ewma: Math.round(micro_vol_ewma * 100) / 100,
      trade_run_len
    };

  } catch (error) {
    console.error('Microstructure calculation error:', error);
    return null;
  }
}