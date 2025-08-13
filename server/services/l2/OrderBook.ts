
import { logger } from '../../utils/logger.js';

export interface BookLevel {
  price: number;
  size: number;
}

export interface BookSnapshot {
  bids: BookLevel[];
  asks: BookLevel[];
  seq: number;
  timestamp: number;
}

export interface BookDelta {
  type: 'update' | 'delete';
  side: 'bid' | 'ask';
  price: number;
  size: number;
  seq: number;
}

export class OrderBook {
  private bids: Map<number, number> = new Map(); // price -> size
  private asks: Map<number, number> = new Map(); // price -> size
  private sequence: number = 0;
  private lastUpdate: number = 0;

  constructor(
    private venue: string,
    private symbol: string
  ) {}

  // Apply full snapshot
  applySnapshot(snapshot: BookSnapshot): void {
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
    
    this.sequence = snapshot.seq;
    this.lastUpdate = snapshot.timestamp;
    
    logger.debug(`Applied snapshot for ${this.venue}:${this.symbol}, seq: ${this.sequence}`);
  }

  // Apply incremental delta
  applyDelta(delta: BookDelta): boolean {
    // Check sequence continuity
    if (delta.seq <= this.sequence) {
      logger.warn(`Stale delta for ${this.venue}:${this.symbol}, expected > ${this.sequence}, got ${delta.seq}`);
      return false;
    }

    if (delta.seq > this.sequence + 1) {
      logger.warn(`Sequence gap for ${this.venue}:${this.symbol}, expected ${this.sequence + 1}, got ${delta.seq}`);
      return false; // Trigger resync
    }

    const book = delta.side === 'bid' ? this.bids : this.asks;
    
    if (delta.type === 'delete' || delta.size === 0) {
      book.delete(delta.price);
    } else {
      book.set(delta.price, delta.size);
    }
    
    this.sequence = delta.seq;
    this.lastUpdate = Date.now();
    
    return true;
  }

  // Get best bid/ask
  getBestBid(): BookLevel | null {
    if (this.bids.size === 0) return null;
    const price = Math.max(...this.bids.keys());
    return { price, size: this.bids.get(price)! };
  }

  getBestAsk(): BookLevel | null {
    if (this.asks.size === 0) return null;
    const price = Math.min(...this.asks.keys());
    return { price, size: this.asks.get(price)! };
  }

  // Get top K levels
  getTopLevels(depth: number = 10): BookSnapshot {
    const sortedBids = Array.from(this.bids.entries())
      .sort(([a], [b]) => b - a) // Descending
      .slice(0, depth)
      .map(([price, size]) => ({ price, size }));

    const sortedAsks = Array.from(this.asks.entries())
      .sort(([a], [b]) => a - b) // Ascending
      .slice(0, depth)
      .map(([price, size]) => ({ price, size }));

    return {
      bids: sortedBids,
      asks: sortedAsks,
      seq: this.sequence,
      timestamp: this.lastUpdate
    };
  }

  // Calculate aggregated metrics for microstructure
  getAggregates(): {
    bidVolume: number;
    askVolume: number;
    spread: number;
    midPrice: number;
    weightedMid: number;
  } {
    const bestBid = this.getBestBid();
    const bestAsk = this.getBestAsk();
    
    if (!bestBid || !bestAsk) {
      return {
        bidVolume: 0,
        askVolume: 0,
        spread: 0,
        midPrice: 0,
        weightedMid: 0
      };
    }

    const bidVolume = Array.from(this.bids.values()).reduce((sum, size) => sum + size, 0);
    const askVolume = Array.from(this.asks.values()).reduce((sum, size) => sum + size, 0);
    const spread = bestAsk.price - bestBid.price;
    const midPrice = (bestBid.price + bestAsk.price) / 2;
    
    // Volume-weighted mid
    const totalVolume = bestBid.size + bestAsk.size;
    const weightedMid = totalVolume > 0 
      ? (bestBid.price * bestAsk.size + bestAsk.price * bestBid.size) / totalVolume
      : midPrice;

    return {
      bidVolume,
      askVolume,
      spread,
      midPrice,
      weightedMid
    };
  }

  getSequence(): number {
    return this.sequence;
  }

  getLastUpdate(): number {
    return this.lastUpdate;
  }
}
