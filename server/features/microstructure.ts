/**
 * Microstructure Features
 * Spread, imbalance, volatility calculations from orderbook data
 */

import { stevieOrderbookSnaps } from '../../shared/schema';
import { Storage } from '../storage';
import { eq, and, gte, lte } from 'drizzle-orm';

export interface MicrostructureFeatures {
  spread_bps: number;
  imbalance_1: number;
  micro_vol_ewma: number;
  trade_run_len: number;
}

export async function calculateMicrostructure(
  symbol: string,
  fromTime: Date,
  toTime: Date
): Promise<MicrostructureFeatures | null> {
  try {
    console.log(`[Microstructure] Calculating for ${symbol} from ${fromTime.toISOString()} to ${toTime.toISOString()}`);
    
    // For MVP, return null since database tables not populated yet
    const snapshots: any[] = [];

    if (snapshots.length === 0) {
      console.log(`[Microstructure] No orderbook data available for ${symbol}`);
      return null;
    }

    // Calculate average spread in basis points
    const spreads = snapshots.map(s => Number(s.spreadBps));
    const spread_bps = spreads.reduce((a, b) => a + b, 0) / spreads.length;

    // Calculate level 1 imbalance (bid vs ask volume)
    const imbalances = snapshots.map(s => {
      const bidSize = Number(s.depth1bp) || 0;
      const askSize = Number(s.depth5bp) || 0;
      return (bidSize - askSize) / (bidSize + askSize + 0.001);
    });
    const imbalance_1 = imbalances.reduce((a, b) => a + b, 0) / imbalances.length;

    // Calculate EWMA of micro volatility
    const prices = snapshots.map(s => (Number(s.bid) + Number(s.ask)) / 2);
    let ewma = 0;
    const alpha = 0.1;
    for (let i = 1; i < prices.length; i++) {
      const return_pct = (prices[i] - prices[i-1]) / prices[i-1];
      ewma = alpha * return_pct * return_pct + (1 - alpha) * ewma;
    }
    const micro_vol_ewma = Math.sqrt(ewma);

    // Estimate trade run length (simplified)
    const trade_run_len = Math.max(1, Math.min(10, snapshots.length / 100));

    console.log(`[Microstructure] Calculated for ${symbol}: spread=${spread_bps.toFixed(2)}bps, imbalance=${imbalance_1.toFixed(3)}`);

    return {
      spread_bps,
      imbalance_1,
      micro_vol_ewma,
      trade_run_len
    };
    
  } catch (error) {
    console.error(`[Microstructure] Error calculating for ${symbol}:`, error);
    return null;
  }
}