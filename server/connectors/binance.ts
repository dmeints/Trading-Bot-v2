/**
 * Binance API Connector - Phase A Implementation  
 * Fetches klines + bookTicker WebSocket (L1/L2) with rate limiting and provenance tracking
 */

import axios, { AxiosResponse } from 'axios';
import WebSocket from 'ws';
import { db } from '../db';
import { marketBars, orderbookSnaps, connectorHealth, type InsertMarketBar, type InsertOrderbookSnap, type InsertConnectorHealth } from '@shared/schema';
import { logger } from '../utils/logger';
import { RateLimiter } from 'limiter';

export interface BinanceKlineData {
  0: number; // Open time
  1: string; // Open price
  2: string; // High price  
  3: string; // Low price
  4: string; // Close price
  5: string; // Volume
  6: number; // Close time
  7: string; // Quote asset volume
  8: number; // Number of trades
  9: string; // Taker buy base asset volume
  10: string; // Taker buy quote asset volume
  11: string; // Ignore
}

export interface BinanceBookTickerData {
  symbol: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
}

export interface BinanceDepthData {
  symbol: string;
  bids: [string, string][]; // [price, quantity]
  asks: [string, string][]; // [price, quantity]
  lastUpdateId: number;
}

export class BinanceConnector {
  private baseUrl = 'https://api.binance.com/api/v3';
  private wsBaseUrl = 'wss://stream.binance.com:9443/ws';
  private limiter: RateLimiter;
  private requestCount = 0;
  private errorCount = 0;
  private wsConnections: Map<string, WebSocket> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    // Rate limit: 1200 requests per minute
    this.limiter = new RateLimiter({ tokensPerInterval: 1200, interval: 60000 });
  }

  private async makeRequest<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    await this.limiter.removeTokens(1);
    this.requestCount++;

    const config = {
      baseURL: this.baseUrl,
      params,
      timeout: 10000,
    };

    try {
      const response: AxiosResponse<T> = await axios.get(endpoint, config);
      await this.updateHealthStatus('healthy', null);
      return response.data;
    } catch (error: any) {
      this.errorCount++;
      const errorMessage = error.response?.data?.msg || error.message || 'Unknown error';
      await this.updateHealthStatus('degraded', errorMessage);
      
      logger.error('Binance API error', {
        endpoint,
        error: errorMessage,
        status: error.response?.status,
      });

      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded');
      }
      
      throw error;
    }
  }

  async fetchKlines(symbol: string, interval: '1m' | '5m' | '1h' | '1d', limit: number = 500): Promise<InsertMarketBar[]> {
    const endpoint = '/klines';
    const params = {
      symbol: symbol.replace('/', ''), // Remove slash for Binance format
      interval,
      limit,
    };

    try {
      const data = await this.makeRequest<BinanceKlineData[]>(endpoint, params);
      
      if (!data?.length) {
        logger.warn(`No kline data returned for ${symbol}`);
        return [];
      }

      // Convert to market bars format
      const bars: InsertMarketBar[] = [];
      const datasetId = `binance_${symbol}_${interval}_${Date.now()}`;
      
      data.forEach(kline => {
        bars.push({
          symbol,
          timeframe: interval,
          timestamp: new Date(kline[0]),
          open: kline[1],
          high: kline[2],
          low: kline[3],
          close: kline[4],
          volume: kline[5],
          provider: 'binance',
          datasetId,
          provenance: {
            provider: 'binance',
            endpoint,
            fetchedAt: new Date().toISOString(),
            quotaCost: 1,
            interval,
            limit,
          },
        });
      });

      logger.info(`Fetched ${bars.length} klines for ${symbol} from Binance`);
      return bars;
      
    } catch (error) {
      logger.error(`Failed to fetch klines for ${symbol}`, error);
      throw error;
    }
  }

  async fetchOrderBookSnapshot(symbol: string): Promise<InsertOrderbookSnap | null> {
    const endpoint = '/depth';
    const params = {
      symbol: symbol.replace('/', ''), // Remove slash for Binance format
      limit: 100,
    };

    try {
      const data = await this.makeRequest<BinanceDepthData>(endpoint, params);
      
      if (!data?.bids?.length || !data?.asks?.length) {
        logger.warn(`No order book data returned for ${symbol}`);
        return null;
      }

      const bestBid = parseFloat(data.bids[0][0]);
      const bestAsk = parseFloat(data.asks[0][0]);
      const spread = bestAsk - bestBid;
      const spreadBps = (spread / bestBid) * 10000;

      // Calculate depth at 1bp and 5bp
      const depth1bp = this.calculateDepth(data.bids, data.asks, bestBid, bestAsk, 0.0001);
      const depth5bp = this.calculateDepth(data.bids, data.asks, bestBid, bestAsk, 0.0005);

      const orderBookSnap: InsertOrderbookSnap = {
        symbol,
        timestamp: new Date(),
        bid: bestBid.toString(),
        ask: bestAsk.toString(),
        spreadBps,
        depth1bp: depth1bp.toString(),
        depth5bp: depth5bp.toString(),
        provider: 'binance',
        provenance: {
          provider: 'binance',
          endpoint,
          fetchedAt: new Date().toISOString(),
          quotaCost: 1,
          lastUpdateId: data.lastUpdateId,
        },
      };

      logger.info(`Fetched order book snapshot for ${symbol} from Binance`);
      return orderBookSnap;
      
    } catch (error) {
      logger.error(`Failed to fetch order book for ${symbol}`, error);
      throw error;
    }
  }

  private calculateDepth(bids: [string, string][], asks: [string, string][], bestBid: number, bestAsk: number, bpThreshold: number): number {
    let bidDepth = 0;
    let askDepth = 0;
    
    // Calculate bid depth within threshold
    for (const [priceStr, qtyStr] of bids) {
      const price = parseFloat(priceStr);
      const qty = parseFloat(qtyStr);
      if (price >= bestBid * (1 - bpThreshold)) {
        bidDepth += qty;
      } else {
        break;
      }
    }
    
    // Calculate ask depth within threshold  
    for (const [priceStr, qtyStr] of asks) {
      const price = parseFloat(priceStr);
      const qty = parseFloat(qtyStr);
      if (price <= bestAsk * (1 + bpThreshold)) {
        askDepth += qty;
      } else {
        break;
      }
    }
    
    return bidDepth + askDepth;
  }

  startBookTickerStream(symbols: string[], onUpdate: (data: InsertOrderbookSnap) => void): void {
    const streams = symbols.map(s => `${s.toLowerCase().replace('/', '')}@bookTicker`).join('/');
    const wsUrl = `${this.wsBaseUrl}/${streams}`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
      logger.info(`Connected to Binance WebSocket for symbols: ${symbols.join(', ')}`);
      this.reconnectAttempts = 0;
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.stream && message.data) {
          const tickerData = message.data as BinanceBookTickerData;
          const symbol = tickerData.symbol;
          
          const bid = parseFloat(tickerData.bidPrice);
          const ask = parseFloat(tickerData.askPrice);
          const spread = ask - bid;
          const spreadBps = (spread / bid) * 10000;
          
          const orderBookSnap: InsertOrderbookSnap = {
            symbol,
            timestamp: new Date(),
            bid: tickerData.bidPrice,
            ask: tickerData.askPrice,
            spreadBps,
            depth1bp: (parseFloat(tickerData.bidQty) + parseFloat(tickerData.askQty)).toString(),
            depth5bp: (parseFloat(tickerData.bidQty) + parseFloat(tickerData.askQty)).toString(),
            provider: 'binance',
            provenance: {
              provider: 'binance',
              endpoint: 'bookTicker_stream',
              fetchedAt: new Date().toISOString(),
              quotaCost: 0, // WebSocket has no quota cost
              stream: message.stream,
            },
          };
          
          onUpdate(orderBookSnap);
        }
      } catch (error) {
        logger.error('Error parsing Binance WebSocket message', error);
      }
    });

    ws.on('error', (error) => {
      logger.error('Binance WebSocket error', error);
      this.handleWebSocketReconnect(ws, symbols, onUpdate);
    });

    ws.on('close', (code, reason) => {
      logger.warn(`Binance WebSocket closed: ${code} - ${reason}`);
      this.handleWebSocketReconnect(ws, symbols, onUpdate);
    });

    this.wsConnections.set(symbols.join(','), ws);
  }

  private handleWebSocketReconnect(ws: WebSocket, symbols: string[], onUpdate: (data: InsertOrderbookSnap) => void): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      logger.info(`Attempting to reconnect Binance WebSocket in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        this.startBookTickerStream(symbols, onUpdate);
      }, delay);
    } else {
      logger.error('Max reconnection attempts reached for Binance WebSocket');
      this.updateHealthStatus('down', 'WebSocket connection failed after max reconnection attempts');
    }
  }

  async storeMarketBars(bars: InsertMarketBar[]): Promise<void> {
    if (bars.length === 0) return;

    try {
      await db.insert(marketBars)
        .values(bars)
        .onConflictDoUpdate({
          target: [marketBars.symbol, marketBars.timestamp, marketBars.provider],
          set: {
            open: marketBars.open,
            high: marketBars.high,
            low: marketBars.low,
            close: marketBars.close,
            volume: marketBars.volume,
            datasetId: marketBars.datasetId,
            fetchedAt: new Date(),
            provenance: marketBars.provenance,
          },
        });

      logger.info(`Stored ${bars.length} Binance market bars to database`);
    } catch (error) {
      logger.error('Failed to store Binance market bars', error);
      throw error;
    }
  }

  async storeOrderBookSnap(snap: InsertOrderbookSnap): Promise<void> {
    try {
      await db.insert(orderbookSnaps).values([snap]);
      logger.debug(`Stored order book snapshot for ${snap.symbol}`);
    } catch (error) {
      logger.error('Failed to store order book snapshot', error);
      throw error;
    }
  }

  private async updateHealthStatus(status: 'healthy' | 'degraded' | 'down', error: string | null): Promise<void> {
    const healthData: InsertConnectorHealth = {
      provider: 'binance',
      status,
      lastSuccessfulFetch: status === 'healthy' ? new Date() : undefined,
      lastError: error,
      requestCount24h: this.requestCount,
      errorCount24h: this.errorCount,
      quotaUsed: this.requestCount,
      quotaLimit: 1200,
    };

    try {
      await db.insert(connectorHealth)
        .values(healthData)
        .onConflictDoUpdate({
          target: connectorHealth.provider,
          set: healthData,
        });
    } catch (error) {
      logger.error('Failed to update Binance connector health', error);
    }
  }

  async getHealthStatus(): Promise<{ status: string; requestCount: number; errorCount: number }> {
    return {
      status: this.errorCount / Math.max(this.requestCount, 1) > 0.1 ? 'degraded' : 'healthy',
      requestCount: this.requestCount,
      errorCount: this.errorCount,
    };
  }

  closeWebSocketConnections(): void {
    this.wsConnections.forEach((ws, symbols) => {
      logger.info(`Closing WebSocket connection for ${symbols}`);
      ws.close();
    });
    this.wsConnections.clear();
  }

  resetDailyCounters(): void {
    this.requestCount = 0;
    this.errorCount = 0;
  }
}

// Export singleton instance
export const binanceConnector = new BinanceConnector();