
/**
 * Order Book - In-memory price→size maps with sequence tracking
 */

export interface DepthLevel {
  price: number;
  size: number;
}

export interface OrderBookSnapshot {
  symbol: string;
  venue: string;
  bids: DepthLevel[];
  asks: DepthLevel[];
  sequence: number;
  timestamp: number;
}

export interface OrderBookDelta {
  symbol: string;
  venue: string;
  sequence: number;
  bids: DepthLevel[];
  asks: DepthLevel[];
  timestamp: number;
}

export class OrderBook {
  private bids = new Map<number, number>(); // price -> size
  private asks = new Map<number, number>(); // price -> size
  private sequence = 0;
  private lastUpdate = 0;

  constructor(
    public readonly symbol: string,
    public readonly venue: string
  ) {}

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
    
    this.sequence = snapshot.sequence;
    this.lastUpdate = snapshot.timestamp;
  }

  applyDelta(delta: OrderBookDelta): boolean {
    // Check sequence continuity
    if (delta.sequence !== this.sequence + 1) {
      return false; // Gap detected, need resync
    }

    // Apply bid updates
    for (const level of delta.bids) {
      if (level.size === 0) {
        this.bids.delete(level.price);
      } else {
        this.bids.set(level.price, level.size);
      }
    }

    // Apply ask updates
    for (const level of delta.asks) {
      if (level.size === 0) {
        this.asks.delete(level.price);
      } else {
        this.asks.set(level.price, level.size);
      }
    }

    this.sequence = delta.sequence;
    this.lastUpdate = delta.timestamp;
    return true;
  }

  getBestBid(): DepthLevel | null {
    if (this.bids.size === 0) return null;
    
    const maxPrice = Math.max(...this.bids.keys());
    return { price: maxPrice, size: this.bids.get(maxPrice)! };
  }

  getBestAsk(): DepthLevel | null {
    if (this.asks.size === 0) return null;
    
    const minPrice = Math.min(...this.asks.keys());
    return { price: minPrice, size: this.asks.get(minPrice)! };
  }

  getTopK(k: number = 10): { bids: DepthLevel[], asks: DepthLevel[] } {
    const sortedBids = Array.from(this.bids.entries())
      .map(([price, size]) => ({ price, size }))
      .sort((a, b) => b.price - a.price)
      .slice(0, k);

    const sortedAsks = Array.from(this.asks.entries())
      .map(([price, size]) => ({ price, size }))
      .sort((a, b) => a.price - b.price)
      .slice(0, k);

    return { bids: sortedBids, asks: sortedAsks };
  }

  getSpread(): number {
    const bestBid = this.getBestBid();
    const bestAsk = this.getBestAsk();
    
    if (!bestBid || !bestAsk) return 0;
    return bestAsk.price - bestBid.price;
  }

  getMidPrice(): number {
    const bestBid = this.getBestBid();
    const bestAsk = this.getBestAsk();
    
    if (!bestBid || !bestAsk) return 0;
    return (bestBid.price + bestAsk.price) / 2;
  }

  getImbalance(levels: number = 5): number {
    const topK = this.getTopK(levels);
    
    const bidVolume = topK.bids.reduce((sum, level) => sum + level.size, 0);
    const askVolume = topK.asks.reduce((sum, level) => sum + level.size, 0);
    
    if (bidVolume + askVolume === 0) return 0;
    return (bidVolume - askVolume) / (bidVolume + askVolume);
  }

  getSnapshot(): OrderBookSnapshot {
    const topK = this.getTopK(20);
    
    return {
      symbol: this.symbol,
      venue: this.venue,
      bids: topK.bids,
      asks: topK.asks,
      sequence: this.sequence,
      timestamp: this.lastUpdate
    };
  }

  getSequence(): number {
    return this.sequence;
  }

  getLastUpdate(): number {
    return this.lastUpdate;
  }
}
