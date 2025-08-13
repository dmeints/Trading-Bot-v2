
/**
 * Microstructure Features Service
 * Computes real-time order book and trade imbalance signals
 */

import { logger } from '../../utils/logger';
import { fastPath } from './FastPath';

export interface MicrostructureSnapshot {
  symbol: string;
  timestamp: Date;
  obi: number;          // Order Book Imbalance: (B-A)/(B+A)
  ti: number;           // Trade Imbalance: (buyVol-sellVol)/(buyVol+sellVol)
  spread_bps: number;   // Bid-ask spread in basis points
  micro_vol: number;    // Realized micro volatility (1-5s)
  cancel_rate: number;  // Queue/cancel rate approximation
}

export interface DepthLevel {
  price: number;
  size: number;
}

export interface OrderBookSnapshot {
  symbol: string;
  timestamp: Date;
  bids: DepthLevel[];
  asks: DepthLevel[];
}

export interface TradeEvent {
  symbol: string;
  timestamp: Date;
  price: number;
  size: number;
  side: 'buy' | 'sell';
}

class MicrostructureFeatures {
  private snapshots = new Map<string, MicrostructureSnapshot>();
  private priceHistory = new Map<string, Array<{ price: number; timestamp: Date }>>();
  private tradeHistory = new Map<string, TradeEvent[]>();
  private messageCount = new Map<string, number>();

  /**
   * Update order book snapshot and compute features
   */
  updateOrderBook(orderBook: OrderBookSnapshot): MicrostructureSnapshot {
    const { symbol, bids, asks, timestamp } = orderBook;

    // Try fast path first, fallback to TypeScript
    if (fastPath.isWasmAvailable()) {
      try {
        const trades = this.tradeHistory.get(symbol) || [];
        const metrics = fastPath.calculateMetrics(bids, asks, trades);
        
        const snapshot: MicrostructureSnapshot = {
          symbol,
          timestamp,
          obi: metrics.obi,
          ti: metrics.ti,
          spread_bps: metrics.spread_bps,
          micro_vol: metrics.micro_vol,
          cancel_rate: this.estimateCancelRate(symbol)
        };

        this.snapshots.set(symbol, snapshot);
        this.updatePriceHistory(symbol, bids, asks, timestamp);
        
        // Update fast path with new data
        const midPrice = (bids[0]?.price + asks[0]?.price) / 2;
        fastPath.rollUpdate(midPrice);

        logger.debug(`[MicrostructureFeatures] Updated ${symbol} (WASM): OBI=${snapshot.obi.toFixed(3)}, TI=${snapshot.ti.toFixed(3)}, Spread=${snapshot.spread_bps.toFixed(1)}bps`);
        return snapshot;
      } catch (error) {
        logger.warn('[MicrostructureFeatures] Fast path failed, using TypeScript fallback:', error);
      }
    }

    // TypeScript fallback
    const obi = this.calculateOBI(bids, asks, 5);
    const ti = this.getTradeImbalance(symbol);
    const spread_bps = this.calculateSpreadBPS(bids, asks);
    const micro_vol = this.calculateMicroVolatility(symbol, timestamp);
    const cancel_rate = this.estimateCancelRate(symbol);

    const snapshot: MicrostructureSnapshot = {
      symbol,
      timestamp,
      obi,
      ti,
      spread_bps,
      micro_vol,
      cancel_rate
    };

    this.snapshots.set(symbol, snapshot);
    this.updatePriceHistory(symbol, bids, asks, timestamp);

    logger.debug(`[MicrostructureFeatures] Updated ${symbol}: OBI=${obi.toFixed(3)}, TI=${ti.toFixed(3)}, Spread=${spread_bps.toFixed(1)}bps`);

    return snapshot;
  }

  /**
   * Update with trade event
   */
  updateTrade(trade: TradeEvent): void {
    const { symbol } = trade;
    
    if (!this.tradeHistory.has(symbol)) {
      this.tradeHistory.set(symbol, []);
    }

    const trades = this.tradeHistory.get(symbol)!;
    trades.push(trade);

    // Keep only last 100 trades for performance
    if (trades.length > 100) {
      trades.shift();
    }

    // Update message count for cancel rate estimation
    this.incrementMessageCount(symbol);
  }

  /**
   * Get latest snapshot for symbol
   */
  getSnapshot(symbol: string): MicrostructureSnapshot | null {
    return this.snapshots.get(symbol) || null;
  }

  /**
   * Calculate Order Book Imbalance using top-k levels
   */
  private calculateOBI(bids: DepthLevel[], asks: DepthLevel[], k: number = 5): number {
    if (bids.length === 0 || asks.length === 0) return 0;

    const topBids = bids.slice(0, k);
    const topAsks = asks.slice(0, k);

    const bidVolume = topBids.reduce((sum, level) => sum + level.size, 0);
    const askVolume = topAsks.reduce((sum, level) => sum + level.size, 0);

    if (bidVolume + askVolume === 0) return 0;

    return (bidVolume - askVolume) / (bidVolume + askVolume);
  }

  /**
   * Calculate Trade Imbalance from recent trades
   */
  private getTradeImbalance(symbol: string): number {
    const trades = this.tradeHistory.get(symbol) || [];
    
    if (trades.length === 0) return 0;

    // Look at trades from last 60 seconds
    const cutoff = new Date(Date.now() - 60000);
    const recentTrades = trades.filter(t => t.timestamp >= cutoff);

    if (recentTrades.length === 0) return 0;

    let buyVolume = 0;
    let sellVolume = 0;

    for (const trade of recentTrades) {
      if (trade.side === 'buy') {
        buyVolume += trade.size;
      } else {
        sellVolume += trade.size;
      }
    }

    if (buyVolume + sellVolume === 0) return 0;

    return (buyVolume - sellVolume) / (buyVolume + sellVolume);
  }

  /**
   * Calculate bid-ask spread in basis points
   */
  private calculateSpreadBPS(bids: DepthLevel[], asks: DepthLevel[]): number {
    if (bids.length === 0 || asks.length === 0) return 0;

    const bestBid = bids[0].price;
    const bestAsk = asks[0].price;
    const midPrice = (bestBid + bestAsk) / 2;

    if (midPrice === 0) return 0;

    const spread = bestAsk - bestBid;
    return (spread / midPrice) * 10000; // Convert to basis points
  }

  /**
   * Calculate micro volatility from recent price movements
   */
  private calculateMicroVolatility(symbol: string, timestamp: Date): number {
    const history = this.priceHistory.get(symbol) || [];
    
    if (history.length < 2) return 0;

    // Look at price changes in last 5 minutes
    const cutoff = new Date(timestamp.getTime() - 300000);
    const recentPrices = history.filter(p => p.timestamp >= cutoff);

    if (recentPrices.length < 2) return 0;

    // Calculate log returns
    const returns: number[] = [];
    for (let i = 1; i < recentPrices.length; i++) {
      const logReturn = Math.log(recentPrices[i].price / recentPrices[i-1].price);
      returns.push(logReturn);
    }

    if (returns.length === 0) return 0;

    // Calculate variance of returns
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    
    // Annualize to get volatility (assume 1-second intervals)
    return Math.sqrt(variance * 86400 * 365); // seconds per year
  }

  /**
   * Estimate cancel rate from message frequency
   */
  private estimateCancelRate(symbol: string): number {
    const count = this.messageCount.get(symbol) || 0;
    // Simple proxy: higher message rate suggests more cancellations
    // In practice would need actual order book delta analysis
    return Math.min(count / 1000, 1); // Normalize to 0-1 range
  }

  /**
   * Update price history for volatility calculation
   */
  private updatePriceHistory(symbol: string, bids: DepthLevel[], asks: DepthLevel[], timestamp: Date): void {
    if (bids.length === 0 || asks.length === 0) return;

    const midPrice = (bids[0].price + asks[0].price) / 2;
    
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }

    const history = this.priceHistory.get(symbol)!;
    history.push({ price: midPrice, timestamp });

    // Keep only last 1000 price points for performance
    if (history.length > 1000) {
      history.shift();
    }
  }

  /**
   * Increment message count for cancel rate estimation
   */
  private incrementMessageCount(symbol: string): void {
    const current = this.messageCount.get(symbol) || 0;
    this.messageCount.set(symbol, current + 1);
  }

  /**
   * Generate mock data for testing
   */
  generateMockSnapshot(symbol: string): MicrostructureSnapshot {
    const timestamp = new Date();
    
    // Generate realistic mock data
    const obi = (Math.random() - 0.5) * 0.4; // -0.2 to 0.2
    const ti = (Math.random() - 0.5) * 0.6;  // -0.3 to 0.3
    const spread_bps = 1 + Math.random() * 10; // 1-11 bps
    const micro_vol = 0.01 + Math.random() * 0.05; // 1-6% annualized
    const cancel_rate = Math.random() * 0.3; // 0-30%

    const snapshot: MicrostructureSnapshot = {
      symbol,
      timestamp,
      obi,
      ti,
      spread_bps,
      micro_vol,
      cancel_rate
    };

    this.snapshots.set(symbol, snapshot);
    return snapshot;
  }
}

export const microstructureFeatures = new MicrostructureFeatures();
