import { WebSocket } from "ws";
import { storage } from "../storage";
import type { InsertMarketData } from "@shared/schema";

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

  constructor() {
    this.startPriceSimulation();
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

  private startPriceSimulation() {
    // Initialize with some crypto symbols and realistic prices
    const symbols = [
      { symbol: 'BTC/USD', basePrice: 42000 },
      { symbol: 'ETH/USD', basePrice: 2800 },
      { symbol: 'SOL/USD', basePrice: 98 },
      { symbol: 'ADA/USD', basePrice: 0.5 },
      { symbol: 'DOT/USD', basePrice: 7.5 },
    ];

    // Initialize prices
    symbols.forEach(({ symbol, basePrice }) => {
      this.priceCache.set(symbol, {
        symbol,
        price: basePrice,
        change24h: (Math.random() - 0.5) * 10, // ±5%
        volume24h: Math.random() * 1000000000, // Random volume
        timestamp: new Date(),
      });
    });

    // Update prices every 3 seconds
    this.updateInterval = setInterval(() => {
      this.updatePrices();
    }, 3000);
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

      // Store in database
      try {
        await storage.updateMarketData({
          symbol,
          price: newPrice.toString(),
          change24h: newChange24h,
          volume24h: updatedPrice.volume24h.toString(),
        });
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

  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

export const marketDataService = new MarketDataService();
