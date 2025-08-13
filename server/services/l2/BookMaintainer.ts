
/**
 * Book Maintainer - Manage snapshot + delta streams per venue
 */

import WebSocket from 'ws';
import axios from 'axios';
import { EventEmitter } from 'events';
import { OrderBook, type OrderBookSnapshot, type OrderBookDelta } from './OrderBook';
import { logger } from '../../utils/logger';

export interface L2Config {
  venue: string;
  symbols: string[];
  snapshotUrl: string;
  wsUrl: string;
  resyncThreshold: number;
}

export class BookMaintainer extends EventEmitter {
  private books = new Map<string, OrderBook>();
  private ws?: WebSocket;
  private resyncTimeouts = new Map<string, NodeJS.Timeout>();
  private isConnected = false;

  constructor(private config: L2Config) {
    super();
  }

  async initialize(): Promise<void> {
    try {
      // Initialize order books
      for (const symbol of this.config.symbols) {
        const key = `${this.config.venue}:${symbol}`;
        this.books.set(key, new OrderBook(symbol, this.config.venue));
        
        // Get initial snapshot
        await this.fetchSnapshot(symbol);
      }

      // Start WebSocket for deltas
      await this.connectWebSocket();
      
      logger.info(`[BookMaintainer] Initialized ${this.config.venue} with ${this.config.symbols.length} symbols`);
    } catch (error) {
      logger.error(`[BookMaintainer] Initialization failed for ${this.config.venue}:`, error);
      throw error;
    }
  }

  private async fetchSnapshot(symbol: string): Promise<void> {
    try {
      const url = this.config.snapshotUrl.replace('{symbol}', symbol);
      const response = await axios.get(url, { timeout: 5000 });
      
      const snapshot = this.parseSnapshot(symbol, response.data);
      const key = `${this.config.venue}:${symbol}`;
      const book = this.books.get(key);
      
      if (book && snapshot) {
        book.applySnapshot(snapshot);
        this.emit('snapshot', snapshot);
        
        logger.debug(`[BookMaintainer] Snapshot applied for ${this.config.venue}:${symbol} seq=${snapshot.sequence}`);
      }
    } catch (error) {
      logger.error(`[BookMaintainer] Snapshot fetch failed for ${symbol}:`, error);
    }
  }

  private async connectWebSocket(): Promise<void> {
    if (this.ws) {
      this.ws.close();
    }

    this.ws = new WebSocket(this.config.wsUrl);

    this.ws.on('open', () => {
      this.isConnected = true;
      logger.info(`[BookMaintainer] WebSocket connected for ${this.config.venue}`);
      
      // Subscribe to symbols
      for (const symbol of this.config.symbols) {
        this.subscribeToSymbol(symbol);
      }
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleDelta(message);
      } catch (error) {
        logger.error('[BookMaintainer] Failed to parse WebSocket message:', error);
      }
    });

    this.ws.on('close', () => {
      this.isConnected = false;
      logger.warn(`[BookMaintainer] WebSocket closed for ${this.config.venue}, reconnecting...`);
      setTimeout(() => this.connectWebSocket(), 5000);
    });

    this.ws.on('error', (error) => {
      logger.error(`[BookMaintainer] WebSocket error for ${this.config.venue}:`, error);
    });
  }

  private subscribeToSymbol(symbol: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Binance-style subscription (mock)
    const subscription = {
      method: 'SUBSCRIBE',
      params: [`${symbol.toLowerCase()}@depth`],
      id: Date.now()
    };

    this.ws.send(JSON.stringify(subscription));
  }

  private handleDelta(message: any): void {
    const delta = this.parseDelta(message);
    if (!delta) return;

    const key = `${this.config.venue}:${delta.symbol}`;
    const book = this.books.get(key);
    
    if (!book) return;

    const applied = book.applyDelta(delta);
    
    if (!applied) {
      // Sequence gap detected, trigger resync
      logger.warn(`[BookMaintainer] Sequence gap detected for ${key}, resyncing...`);
      this.scheduleResync(delta.symbol);
      return;
    }

    this.emit('delta', delta);
    this.emit('update', book.getSnapshot());
  }

  private scheduleResync(symbol: string): void {
    const existing = this.resyncTimeouts.get(symbol);
    if (existing) {
      clearTimeout(existing);
    }

    const timeout = setTimeout(() => {
      this.fetchSnapshot(symbol);
      this.resyncTimeouts.delete(symbol);
    }, 1000);

    this.resyncTimeouts.set(symbol, timeout);
  }

  private parseSnapshot(symbol: string, data: any): OrderBookSnapshot | null {
    try {
      // Mock Binance format
      return {
        symbol,
        venue: this.config.venue,
        bids: (data.bids || []).map((b: any) => ({ price: parseFloat(b[0]), size: parseFloat(b[1]) })),
        asks: (data.asks || []).map((a: any) => ({ price: parseFloat(a[0]), size: parseFloat(a[1]) })),
        sequence: data.lastUpdateId || Date.now(),
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('[BookMaintainer] Failed to parse snapshot:', error);
      return null;
    }
  }

  private parseDelta(message: any): OrderBookDelta | null {
    try {
      // Mock Binance delta format
      if (!message.data || !message.stream) return null;

      const symbol = message.stream.split('@')[0].toUpperCase();
      const data = message.data;

      return {
        symbol,
        venue: this.config.venue,
        sequence: data.u || Date.now(),
        bids: (data.b || []).map((b: any) => ({ price: parseFloat(b[0]), size: parseFloat(b[1]) })),
        asks: (data.a || []).map((a: any) => ({ price: parseFloat(a[0]), size: parseFloat(a[1]) })),
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('[BookMaintainer] Failed to parse delta:', error);
      return null;
    }
  }

  getBook(symbol: string): OrderBook | undefined {
    const key = `${this.config.venue}:${symbol}`;
    return this.books.get(key);
  }

  getAllBooks(): OrderBook[] {
    return Array.from(this.books.values());
  }

  isHealthy(): boolean {
    return this.isConnected && this.books.size > 0;
  }

  cleanup(): void {
    if (this.ws) {
      this.ws.close();
    }
    
    for (const timeout of this.resyncTimeouts.values()) {
      clearTimeout(timeout);
    }
    
    this.removeAllListeners();
  }
}

// Global maintainers
export const binanceMaintainer = new BookMaintainer({
  venue: 'binance',
  symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
  snapshotUrl: 'https://api.binance.com/api/v3/depth?symbol={symbol}&limit=20',
  wsUrl: 'wss://stream.binance.com:9443/ws',
  resyncThreshold: 100
});
