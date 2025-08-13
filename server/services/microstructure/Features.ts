
import { logger } from '../../utils/logger.js';

interface DepthLevel {
  price: number;
  size: number;
}

interface TradeData {
  price: number;
  size: number;
  side: 'buy' | 'sell';
  timestamp: number;
}

interface MicrostructureSnapshot {
  symbol: string;
  timestamp: number;
  obi: number;        // Order Book Imbalance
  ti: number;         // Trade Imbalance  
  spread_bps: number; // Spread in basis points
  micro_vol: number;  // Micro volatility (1-5s)
  cancel_rate: number; // Cancel rate approximation
  best_bid: number;
  best_ask: number;
}

class MicrostructureFeatures {
  private snapshots: Map<string, MicrostructureSnapshot> = new Map();
  private trades: Map<string, TradeData[]> = new Map();
  private returns: Map<string, number[]> = new Map();
  
  private readonly TRADE_WINDOW_MS = 5000; // 5 seconds
  private readonly RETURN_WINDOW_MS = 5000; // 5 seconds for micro-vol
  
  updateDepth(symbol: string, bids: DepthLevel[], asks: DepthLevel[]): void {
    try {
      if (bids.length === 0 || asks.length === 0) {
        logger.warn(`Empty depth for ${symbol}`);
        return;
      }
      
      const bestBid = bids[0].price;
      const bestAsk = asks[0].price;
      const midPrice = (bestBid + bestAsk) / 2;
      
      // Calculate OBI (Order Book Imbalance)
      const bidVolume = bids.slice(0, 10).reduce((sum, level) => sum + level.size, 0);
      const askVolume = asks.slice(0, 10).reduce((sum, level) => sum + level.size, 0);
      const obi = (bidVolume - askVolume) / (bidVolume + askVolume);
      
      // Calculate spread in basis points
      const spread_bps = ((bestAsk - bestBid) / midPrice) * 10000;
      
      // Get existing snapshot or create new one
      const existing = this.snapshots.get(symbol) || {
        symbol,
        timestamp: Date.now(),
        obi: 0,
        ti: 0,
        spread_bps: 0,
        micro_vol: 0,
        cancel_rate: 0.05, // Default approximation
        best_bid: bestBid,
        best_ask: bestAsk
      };
      
      // Update with new values
      const updated: MicrostructureSnapshot = {
        ...existing,
        timestamp: Date.now(),
        obi: isNaN(obi) ? 0 : obi,
        spread_bps: isNaN(spread_bps) ? 10 : Math.max(0.1, spread_bps),
        best_bid: bestBid,
        best_ask: bestAsk
      };
      
      this.snapshots.set(symbol, updated);
      
      // Update returns for micro-vol calculation
      this.updateReturns(symbol, midPrice);
      
    } catch (error) {
      logger.error(`Error updating depth for ${symbol}:`, { error: String(error) });
    }
  }
  
  updateTrade(symbol: string, trade: TradeData): void {
    try {
      const trades = this.trades.get(symbol) || [];
      trades.push(trade);
      
      // Keep only recent trades
      const cutoff = Date.now() - this.TRADE_WINDOW_MS;
      const recentTrades = trades.filter(t => t.timestamp > cutoff);
      this.trades.set(symbol, recentTrades);
      
      // Calculate Trade Imbalance
      const buyVolume = recentTrades.filter(t => t.side === 'buy').reduce((sum, t) => sum + t.size, 0);
      const sellVolume = recentTrades.filter(t => t.side === 'sell').reduce((sum, t) => sum + t.size, 0);
      const totalVolume = buyVolume + sellVolume;
      const ti = totalVolume > 0 ? (buyVolume - sellVolume) / totalVolume : 0;
      
      // Update snapshot with TI
      const existing = this.snapshots.get(symbol);
      if (existing) {
        existing.ti = isNaN(ti) ? 0 : ti;
        existing.timestamp = Date.now();
        this.snapshots.set(symbol, existing);
      }
      
    } catch (error) {
      logger.error(`Error updating trade for ${symbol}:`, { error: String(error) });
    }
  }
  
  private updateReturns(symbol: string, price: number): void {
    const returns = this.returns.get(symbol) || [];
    
    if (returns.length > 0) {
      const lastPrice = returns[returns.length - 1];
      if (lastPrice > 0) {
        const logReturn = Math.log(price / lastPrice);
        returns.push(logReturn);
      }
    } else {
      returns.push(price); // Store first price
    }
    
    // Keep only recent returns (for micro-vol calculation)
    if (returns.length > 100) { // Keep ~100 observations
      returns.shift();
    }
    
    this.returns.set(symbol, returns);
    
    // Update micro volatility
    const existing = this.snapshots.get(symbol);
    if (existing && returns.length > 5) {
      const logReturns = returns.slice(1); // Skip first price
      const mean = logReturns.reduce((sum, r) => sum + r, 0) / logReturns.length;
      const variance = logReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / logReturns.length;
      const microVol = Math.sqrt(variance * 252 * 24 * 60 * 12); // Annualized from 5s returns
      
      existing.micro_vol = isNaN(microVol) ? 0.001 : Math.max(0.0001, microVol);
      existing.timestamp = Date.now();
      this.snapshots.set(symbol, existing);
    }
  }
  
  getSnapshot(symbol: string): MicrostructureSnapshot | null {
    const snapshot = this.snapshots.get(symbol);
    if (!snapshot) {
      return null;
    }
    
    // Return copy to prevent mutation
    return { ...snapshot };
  }
  
  getAllSnapshots(): MicrostructureSnapshot[] {
    return Array.from(this.snapshots.values()).map(s => ({ ...s }));
  }
  
  // Generate synthetic data for testing
  generateSyntheticSnapshot(symbol: string): MicrostructureSnapshot {
    const basePrice = symbol === 'BTCUSDT' ? 45000 : 3000;
    const spread = basePrice * 0.0001; // 1 bps
    
    const snapshot: MicrostructureSnapshot = {
      symbol,
      timestamp: Date.now(),
      obi: (Math.random() - 0.5) * 0.4, // -0.2 to +0.2
      ti: (Math.random() - 0.5) * 0.3,  // -0.15 to +0.15
      spread_bps: 1 + Math.random() * 5, // 1-6 bps
      micro_vol: 0.001 + Math.random() * 0.01, // 0.1%-1.1%
      cancel_rate: 0.03 + Math.random() * 0.07, // 3%-10%
      best_bid: basePrice - spread/2,
      best_ask: basePrice + spread/2
    };
    
    this.snapshots.set(symbol, snapshot);
    return { ...snapshot };
  }
}

export const microstructureFeatures = new MicrostructureFeatures();
export type { MicrostructureSnapshot, DepthLevel, TradeData };
