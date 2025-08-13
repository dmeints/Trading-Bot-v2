
/**
 * Microstructure Features Service
 * Computes real-time order book and trade imbalance signals
 */

import { logger } from '../../utils/logger.js';
import { fastPath } from './FastPath.js';

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
// Microstructure Features: OBI, Trade Imbalance, Spread, Micro-Vol, Cancel Rate
import { EventEmitter } from 'events';

interface TradeData {
  price: number;
  size: number;
  side: 'buy' | 'sell';
  timestamp: number;
}

interface DepthLevel {
  price: number;
  size: number;
}

interface OrderBookSnapshot {
  bids: DepthLevel[];
  asks: DepthLevel[];
  timestamp: number;
}

interface MicrostructureSnapshot {
  symbol: string;
  obi: number; // Order Book Imbalance
  ti: number; // Trade Imbalance
  spread_bps: number; // Spread in basis points
  micro_vol: number; // Micro volatility (1-5s)
  cancel_rate: number; // Cancel rate approximation
  timestamp: number;
}

class MicrostructureFeatures extends EventEmitter {
  private symbols = new Map<string, {
    trades: TradeData[];
    books: OrderBookSnapshot[];
    returns: number[];
    lastPrice: number;
    lastSnapshot: MicrostructureSnapshot | null;
  }>();

  private readonly WINDOW_SIZE = 300; // 5 minutes of seconds
  private readonly TRADE_WINDOW = 100; // Recent trades for TI

  constructor() {
    super();
    // Clean old data every minute
    setInterval(() => this.cleanup(), 60000);
  }

  addTrade(symbol: string, trade: TradeData): void {
    const data = this.getSymbolData(symbol);
    data.trades.push(trade);
    
    // Calculate return for micro-vol
    if (data.lastPrice > 0) {
      const ret = Math.log(trade.price / data.lastPrice);
      data.returns.push(ret);
      if (data.returns.length > this.WINDOW_SIZE) {
        data.returns.shift();
      }
    }
    data.lastPrice = trade.price;

    // Keep recent trades
    if (data.trades.length > this.TRADE_WINDOW) {
      data.trades.shift();
    }
  }

  addOrderBook(symbol: string, book: OrderBookSnapshot): void {
    const data = this.getSymbolData(symbol);
    data.books.push(book);
    
    // Keep recent books
    if (data.books.length > 20) {
      data.books.shift();
    }
  }

  getSnapshot(symbol: string): MicrostructureSnapshot | null {
    const data = this.symbols.get(symbol);
    if (!data || data.books.length === 0) return null;

    const latestBook = data.books[data.books.length - 1];
    const obi = this.calculateOBI(latestBook);
    const ti = this.calculateTI(data.trades);
    const spread_bps = this.calculateSpread(latestBook);
    const micro_vol = this.calculateMicroVol(data.returns);
    const cancel_rate = this.calculateCancelRate(data.books);

    const snapshot: MicrostructureSnapshot = {
      symbol,
      obi,
      ti,
      spread_bps,
      micro_vol,
      cancel_rate,
      timestamp: Date.now()
    };

    data.lastSnapshot = snapshot;
    return snapshot;
  }

  private getSymbolData(symbol: string) {
    if (!this.symbols.has(symbol)) {
      this.symbols.set(symbol, {
        trades: [],
        books: [],
        returns: [],
        lastPrice: 0,
        lastSnapshot: null
      });
    }
    return this.symbols.get(symbol)!;
  }

  private calculateOBI(book: OrderBookSnapshot): number {
    if (book.bids.length === 0 || book.asks.length === 0) return 0;
    
    const bidVolume = book.bids.slice(0, 5).reduce((sum, level) => sum + level.size, 0);
    const askVolume = book.asks.slice(0, 5).reduce((sum, level) => sum + level.size, 0);
    
    if (bidVolume + askVolume === 0) return 0;
    return (bidVolume - askVolume) / (bidVolume + askVolume);
  }

  private calculateTI(trades: TradeData[]): number {
    if (trades.length === 0) return 0;
    
    const recentTrades = trades.slice(-20); // Last 20 trades
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

  private calculateSpread(book: OrderBookSnapshot): number {
    if (book.bids.length === 0 || book.asks.length === 0) return 0;
    
    const bestBid = book.bids[0].price;
    const bestAsk = book.asks[0].price;
    const midPrice = (bestBid + bestAsk) / 2;
    
    if (midPrice === 0) return 0;
    return ((bestAsk - bestBid) / midPrice) * 10000; // bps
  }

  private calculateMicroVol(returns: number[]): number {
    if (returns.length < 2) return 0;
    
    // Use last 60 seconds of returns for micro-vol
    const recentReturns = returns.slice(-60);
    if (recentReturns.length < 2) return 0;
    
    const mean = recentReturns.reduce((sum, r) => sum + r, 0) / recentReturns.length;
    const variance = recentReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (recentReturns.length - 1);
    
    return Math.sqrt(variance * 252 * 24 * 60 * 60); // Annualized
  }

  private calculateCancelRate(books: OrderBookSnapshot[]): number {
    if (books.length < 2) return 0;
    
    // Approximate cancel rate by order book changes
    // This is a simplified approximation
    const recent = books.slice(-10);
    let changes = 0;
    
    for (let i = 1; i < recent.length; i++) {
      const prev = recent[i - 1];
      const curr = recent[i];
      
      // Count level changes as proxy for cancellations
      if (prev.bids.length !== curr.bids.length || prev.asks.length !== curr.asks.length) {
        changes++;
      }
    }
    
    return recent.length > 1 ? changes / (recent.length - 1) : 0;
  }

  private cleanup(): void {
    const cutoff = Date.now() - 5 * 60 * 1000; // 5 minutes ago
    
    for (const [symbol, data] of this.symbols.entries()) {
      data.trades = data.trades.filter(t => t.timestamp > cutoff);
      data.books = data.books.filter(b => b.timestamp > cutoff);
      
      if (data.trades.length === 0 && data.books.length === 0) {
        this.symbols.delete(symbol);
      }
    }
  }
}

export const microstructureFeatures = new MicrostructureFeatures();
export type { MicrostructureSnapshot, TradeData, OrderBookSnapshot };
