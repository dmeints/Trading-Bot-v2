
/**
 * Book Maintainer - Manages L2 books per venue/symbol
 */

import { OrderBook, type OrderBookSnapshot, type OrderBookDelta } from './OrderBook.js';
import { logger } from '../../utils/logger.js';

interface VenueConfig {
  restEndpoint: string;
  wsEndpoint: string;
  rateLimit: number;
}

class BookMaintainer {
  private books = new Map<string, OrderBook>();
  private resyncTimers = new Map<string, NodeJS.Timeout>();
  private venueConfigs = new Map<string, VenueConfig>();

  constructor() {
    // Initialize venue configurations
    this.venueConfigs.set('binance', {
      restEndpoint: 'https://api.binance.com/api/v3/depth',
      wsEndpoint: 'wss://stream.binance.com:9443/ws',
      rateLimit: 1200 // per minute
    });
    
    this.venueConfigs.set('coinbase', {
      restEndpoint: 'https://api.exchange.coinbase.com/products',
      wsEndpoint: 'wss://ws-feed.exchange.coinbase.com',
      rateLimit: 10 // per second
    });
  }

  /**
   * Initialize book for venue/symbol
   */
  async initializeBook(venue: string, symbol: string): Promise<OrderBook> {
    const key = `${venue}:${symbol}`;
    
    if (this.books.has(key)) {
      return this.books.get(key)!;
    }

    const book = new OrderBook(venue, symbol);
    this.books.set(key, book);

    // Fetch initial snapshot
    try {
      const snapshot = await this.fetchSnapshot(venue, symbol);
      book.applySnapshot(snapshot);
      
      // Schedule periodic resync
      this.scheduleResync(venue, symbol);
      
      logger.info(`[BookMaintainer] Initialized book for ${key}`);
    } catch (error) {
      logger.error(`[BookMaintainer] Failed to initialize book for ${key}:`, error);
    }

    return book;
  }

  /**
   * Apply delta update to book
   */
  applyDelta(venue: string, symbol: string, delta: OrderBookDelta): void {
    const key = `${venue}:${symbol}`;
    const book = this.books.get(key);
    
    if (!book) {
      logger.warn(`[BookMaintainer] No book found for ${key}, ignoring delta`);
      return;
    }

    const success = book.applyDelta(delta);
    
    if (!success) {
      // Sequence gap detected, trigger resync
      logger.warn(`[BookMaintainer] Triggering resync for ${key} due to sequence gap`);
      this.triggerResync(venue, symbol);
    }
  }

  /**
   * Get book for venue/symbol
   */
  getBook(venue: string, symbol: string): OrderBook | null {
    const key = `${venue}:${symbol}`;
    return this.books.get(key) || null;
  }

  /**
   * Get all active books
   */
  getAllBooks(): Map<string, OrderBook> {
    return new Map(this.books);
  }

  /**
   * Fetch snapshot from REST API
   */
  private async fetchSnapshot(venue: string, symbol: string): Promise<OrderBookSnapshot> {
    const config = this.venueConfigs.get(venue);
    
    if (!config) {
      throw new Error(`Unknown venue: ${venue}`);
    }

    // Mock implementation - would connect to real APIs
    const mockSnapshot: OrderBookSnapshot = {
      venue,
      symbol,
      bids: this.generateMockDepth('bid', 10),
      asks: this.generateMockDepth('ask', 10),
      seq: Math.floor(Math.random() * 1000000),
      timestamp: new Date()
    };

    logger.debug(`[BookMaintainer] Fetched snapshot for ${venue}:${symbol}, seq=${mockSnapshot.seq}`);
    
    return mockSnapshot;
  }

  /**
   * Generate mock depth levels
   */
  private generateMockDepth(side: 'bid' | 'ask', count: number): Array<{ price: number; size: number }> {
    const basePrice = 50000; // Mock BTC price
    const levels: Array<{ price: number; size: number }> = [];
    
    for (let i = 0; i < count; i++) {
      const offset = (i + 1) * 10;
      const price = side === 'bid' ? basePrice - offset : basePrice + offset;
      const size = 0.1 + Math.random() * 2;
      
      levels.push({ price, size });
    }
    
    return levels;
  }

  /**
   * Schedule periodic resync
   */
  private scheduleResync(venue: string, symbol: string): void {
    const key = `${venue}:${symbol}`;
    const interval = 30000; // 30 seconds
    
    // Clear existing timer
    const existingTimer = this.resyncTimers.get(key);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    const timer = setInterval(() => {
      const book = this.books.get(key);
      if (book && book.needsResync()) {
        this.triggerResync(venue, symbol);
      }
    }, interval);

    this.resyncTimers.set(key, timer);
  }

  /**
   * Trigger immediate resync
   */
  private async triggerResync(venue: string, symbol: string): Promise<void> {
    try {
      const snapshot = await this.fetchSnapshot(venue, symbol);
      const book = this.books.get(`${venue}:${symbol}`);
      
      if (book) {
        book.applySnapshot(snapshot);
        logger.info(`[BookMaintainer] Resynced ${venue}:${symbol}`);
      }
    } catch (error) {
      logger.error(`[BookMaintainer] Failed to resync ${venue}:${symbol}:`, error);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    for (const timer of this.resyncTimers.values()) {
      clearInterval(timer);
    }
    this.resyncTimers.clear();
    this.books.clear();
  }
}

export const bookMaintainer = new BookMaintainer();
