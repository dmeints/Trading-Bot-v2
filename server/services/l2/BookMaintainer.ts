
import { OrderBook, BookSnapshot, BookDelta } from './OrderBook.js';
import { logger } from '../../utils/logger.js';

interface VenueConfig {
  restUrl: string;
  wsUrl: string;
  auth?: {
    apiKey: string;
    secret: string;
  };
}

export class BookMaintainer {
  private books: Map<string, OrderBook> = new Map();
  private wsConnections: Map<string, WebSocket> = new Map();
  private resyncTimers: Map<string, NodeJS.Timeout> = new Map();
  
  private venues: Map<string, VenueConfig> = new Map([
    ['binance', {
      restUrl: 'https://api.binance.com/api/v3',
      wsUrl: 'wss://stream.binance.com:9443/ws'
    }],
    ['coinbase', {
      restUrl: 'https://api.exchange.coinbase.com',
      wsUrl: 'wss://ws-feed.exchange.coinbase.com'
    }]
  ]);

  constructor() {
    this.initializeBooks();
  }

  private initializeBooks(): void {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'DOTUSDT'];
    
    for (const venue of this.venues.keys()) {
      for (const symbol of symbols) {
        const key = `${venue}:${symbol}`;
        this.books.set(key, new OrderBook(venue, symbol));
      }
    }
  }

  // Fetch snapshot via REST
  private async fetchSnapshot(venue: string, symbol: string): Promise<BookSnapshot | null> {
    try {
      const config = this.venues.get(venue);
      if (!config) {
        logger.error(`Unknown venue: ${venue}`);
        return null;
      }

      let url: string;
      if (venue === 'binance') {
        url = `${config.restUrl}/depth?symbol=${symbol}&limit=100`;
      } else if (venue === 'coinbase') {
        // Convert BTCUSDT -> BTC-USD format
        const cbSymbol = symbol.replace('USDT', '-USD').replace('USDC', '-USD');
        url = `${config.restUrl}/products/${cbSymbol}/book?level=2`;
      } else {
        logger.warn(`Snapshot not implemented for venue: ${venue}`);
        return this.generateMockSnapshot(symbol);
      }

      const response = await fetch(url);
      if (!response.ok) {
        logger.error(`Failed to fetch snapshot: ${response.status}`);
        return this.generateMockSnapshot(symbol);
      }

      const data = await response.json();
      return this.parseSnapshot(venue, data);
      
    } catch (error) {
      logger.error(`Error fetching snapshot for ${venue}:${symbol}:`, error);
      return this.generateMockSnapshot(symbol);
    }
  }

  private parseSnapshot(venue: string, data: any): BookSnapshot {
    let bids: Array<{price: number, size: number}> = [];
    let asks: Array<{price: number, size: number}> = [];
    
    if (venue === 'binance') {
      bids = data.bids?.map(([price, qty]: [string, string]) => ({
        price: parseFloat(price),
        size: parseFloat(qty)
      })) || [];
      asks = data.asks?.map(([price, qty]: [string, string]) => ({
        price: parseFloat(price),
        size: parseFloat(qty)
      })) || [];
    } else if (venue === 'coinbase') {
      bids = data.bids?.map(([price, size]: [string, string]) => ({
        price: parseFloat(price),
        size: parseFloat(size)
      })) || [];
      asks = data.asks?.map(([price, size]: [string, string]) => ({
        price: parseFloat(price),
        size: parseFloat(size)
      })) || [];
    }

    return {
      bids,
      asks,
      seq: data.lastUpdateId || Date.now(),
      timestamp: Date.now()
    };
  }

  private generateMockSnapshot(symbol: string): BookSnapshot {
    // Generate realistic mock data for demo
    const basePrice = symbol.includes('BTC') ? 45000 : 
                     symbol.includes('ETH') ? 3000 :
                     symbol.includes('SOL') ? 100 :
                     symbol.includes('ADA') ? 0.5 : 1000;
    
    const spread = basePrice * 0.0001; // 1 bps spread
    
    const bids = [];
    const asks = [];
    
    for (let i = 0; i < 10; i++) {
      bids.push({
        price: basePrice - spread/2 - i * spread/10,
        size: Math.random() * 10 + 0.1
      });
      asks.push({
        price: basePrice + spread/2 + i * spread/10,
        size: Math.random() * 10 + 0.1
      });
    }

    return {
      bids,
      asks,
      seq: Date.now(),
      timestamp: Date.now()
    };
  }

  // Start maintaining book for venue:symbol
  async startMaintaining(venue: string, symbol: string): Promise<void> {
    const key = `${venue}:${symbol}`;
    const book = this.books.get(key);
    
    if (!book) {
      logger.error(`No book found for ${key}`);
      return;
    }

    // Fetch initial snapshot
    const snapshot = await this.fetchSnapshot(venue, symbol);
    if (snapshot) {
      book.applySnapshot(snapshot);
      logger.info(`Initialized book for ${key}`);
    }

    // Start WebSocket for deltas (mock for now)
    this.startWebSocketMock(venue, symbol);
  }

  private startWebSocketMock(venue: string, symbol: string): void {
    const key = `${venue}:${symbol}`;
    const book = this.books.get(key);
    
    if (!book) return;

    // Mock WebSocket updates
    const interval = setInterval(() => {
      const delta: BookDelta = {
        type: Math.random() > 0.9 ? 'delete' : 'update',
        side: Math.random() > 0.5 ? 'bid' : 'ask',
        price: 45000 + (Math.random() - 0.5) * 100,
        size: Math.random() * 5,
        seq: book.getSequence() + 1
      };

      const success = book.applyDelta(delta);
      if (!success) {
        logger.warn(`Delta failed for ${key}, triggering resync`);
        this.scheduleResync(venue, symbol);
      }
    }, 1000 + Math.random() * 2000); // Random interval 1-3s

    // Store interval for cleanup
    const existingTimer = this.resyncTimers.get(key);
    if (existingTimer) {
      clearInterval(existingTimer);
    }
    this.resyncTimers.set(key, interval);
  }

  private scheduleResync(venue: string, symbol: string): void {
    const key = `${venue}:${symbol}`;
    
    // Debounce resyncs
    const existingTimer = this.resyncTimers.get(`${key}:resync`);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      logger.info(`Resyncing book for ${key}`);
      await this.startMaintaining(venue, symbol);
    }, 5000);

    this.resyncTimers.set(`${key}:resync`, timer);
  }

  // Get book snapshot
  getBook(venue: string, symbol: string): BookSnapshot | null {
    const key = `${venue}:${symbol}`;
    const book = this.books.get(key);
    
    if (!book) {
      logger.error(`No book found for ${key}`);
      return null;
    }

    return book.getTopLevels(20);
  }

  // Get aggregates for microstructure features
  getAggregates(venue: string, symbol: string) {
    const key = `${venue}:${symbol}`;
    const book = this.books.get(key);
    
    if (!book) return null;
    
    return book.getAggregates();
  }

  // Initialize all books
  async initializeAll(): Promise<void> {
    const symbols = ['BTCUSDT', 'ETHUSDT'];
    
    for (const venue of this.venues.keys()) {
      for (const symbol of symbols) {
        await this.startMaintaining(venue, symbol);
      }
    }
  }

  // Cleanup
  destroy(): void {
    for (const timer of this.resyncTimers.values()) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.resyncTimers.clear();
    
    for (const ws of this.wsConnections.values()) {
      ws.close();
    }
    this.wsConnections.clear();
  }
}

export const bookMaintainer = new BookMaintainer();
