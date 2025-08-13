
/**
 * L2 Order Book - In-memory book with sequence tracking
 */

import { logger } from '../../utils/logger.js';

export interface DepthLevel {
  price: number;
  size: number;
}

export interface OrderBookSnapshot {
  venue: string;
  symbol: string;
  bids: DepthLevel[];
  asks: DepthLevel[];
  seq: number;
  timestamp: Date;
}

export interface OrderBookDelta {
  venue: string;
  symbol: string;
  seq: number;
  bids?: Array<{ price: number; size: number; action: 'update' | 'delete' }>;
  asks?: Array<{ price: number; size: number; action: 'update' | 'delete' }>;
  timestamp: Date;
}

class OrderBook {
  private bids = new Map<number, number>(); // price -> size
  private asks = new Map<number, number>(); // price -> size
  private seq = 0;
  private lastUpdate = new Date();
  
  public readonly venue: string;
  public readonly symbol: string;

  constructor(venue: string, symbol: string) {
    this.venue = venue;
    this.symbol = symbol;
  }

  /**
   * Apply full snapshot
   */
  applySnapshot(snapshot: OrderBookSnapshot): void {
    this.bids.clear();
    this.asks.clear();
    
    for (const level of snapshot.bids) {
      if (level.size > 0) {
        this.bids.set(level.price, level.size);
      }
    }
    
    for (const level of snapshot.asks) {
      if (level.size > 0) {
        this.asks.set(level.price, level.size);
      }
    }
    
    this.seq = snapshot.seq;
    this.lastUpdate = snapshot.timestamp;
    
    logger.debug(`[OrderBook] Applied snapshot for ${this.venue}:${this.symbol}, seq=${this.seq}`);
  }

  /**
   * Apply incremental delta
   */
  applyDelta(delta: OrderBookDelta): boolean {
    // Check sequence continuity
    if (delta.seq <= this.seq) {
      logger.warn(`[OrderBook] Ignoring old delta ${this.venue}:${this.symbol}, seq=${delta.seq} <= ${this.seq}`);
      return false;
    }
    
    if (delta.seq > this.seq + 1) {
      logger.warn(`[OrderBook] Sequence gap detected ${this.venue}:${this.symbol}, expected=${this.seq + 1}, got=${delta.seq}`);
      return false; // Signal resync needed
    }

    // Apply bid updates
    if (delta.bids) {
      for (const update of delta.bids) {
        if (update.action === 'delete' || update.size === 0) {
          this.bids.delete(update.price);
        } else {
          this.bids.set(update.price, update.size);
        }
      }
    }

    // Apply ask updates
    if (delta.asks) {
      for (const update of delta.asks) {
        if (update.action === 'delete' || update.size === 0) {
          this.asks.delete(update.price);
        } else {
          this.asks.set(update.price, update.size);
        }
      }
    }

    this.seq = delta.seq;
    this.lastUpdate = delta.timestamp;
    
    return true;
  }

  /**
   * Get best bid price
   */
  getBestBid(): number | null {
    if (this.bids.size === 0) return null;
    return Math.max(...this.bids.keys());
  }

  /**
   * Get best ask price
   */
  getBestAsk(): number | null {
    if (this.asks.size === 0) return null;
    return Math.min(...this.asks.keys());
  }

  /**
   * Get top-k levels for each side
   */
  getTopLevels(k: number = 10): { bids: DepthLevel[], asks: DepthLevel[] } {
    const bidPrices = Array.from(this.bids.keys()).sort((a, b) => b - a).slice(0, k);
    const askPrices = Array.from(this.asks.keys()).sort((a, b) => a - b).slice(0, k);
    
    const bids = bidPrices.map(price => ({ price, size: this.bids.get(price)! }));
    const asks = askPrices.map(price => ({ price, size: this.asks.get(price)! }));
    
    return { bids, asks };
  }

  /**
   * Get current snapshot
   */
  getSnapshot(): OrderBookSnapshot {
    const { bids, asks } = this.getTopLevels(20);
    
    return {
      venue: this.venue,
      symbol: this.symbol,
      bids,
      asks,
      seq: this.seq,
      timestamp: this.lastUpdate
    };
  }

  /**
   * Calculate spread in basis points
   */
  getSpreadBps(): number {
    const bestBid = this.getBestBid();
    const bestAsk = this.getBestAsk();
    
    if (!bestBid || !bestAsk) return 0;
    
    const midPrice = (bestBid + bestAsk) / 2;
    const spread = bestAsk - bestBid;
    
    return (spread / midPrice) * 10000;
  }

  /**
   * Calculate total depth within percentage of mid
   */
  getDepthWithinPercent(percent: number = 0.1): { bidDepth: number, askDepth: number } {
    const bestBid = this.getBestBid();
    const bestAsk = this.getBestAsk();
    
    if (!bestBid || !bestAsk) return { bidDepth: 0, askDepth: 0 };
    
    const midPrice = (bestBid + bestAsk) / 2;
    const bidThreshold = midPrice * (1 - percent);
    const askThreshold = midPrice * (1 + percent);
    
    let bidDepth = 0;
    let askDepth = 0;
    
    for (const [price, size] of this.bids) {
      if (price >= bidThreshold) {
        bidDepth += size * price;
      }
    }
    
    for (const [price, size] of this.asks) {
      if (price <= askThreshold) {
        askDepth += size * price;
      }
    }
    
    return { bidDepth, askDepth };
  }

  /**
   * Check if book needs resync (stale data)
   */
  needsResync(): boolean {
    const staleThresholdMs = 10000; // 10 seconds
    return Date.now() - this.lastUpdate.getTime() > staleThresholdMs;
  }
}

export { OrderBook };
