
// server/services/priceStream.ts
import WebSocket from 'ws';
import { getWSS } from '../ws.js';
import { logger } from '../utils/logger.js';

export class PriceStream {
  private ws?: WebSocket;
  private url: string;
  private symbol: string;
  private connected = false;
  private lastPrice: number = 0;
  
  constructor(symbol = 'btcusdt') {
    this.symbol = symbol.toLowerCase();
    this.url = `wss://stream.binance.com:9443/ws/${this.symbol}@trade`;
  }
  
  start() {
    if (this.ws) return;
    
    logger.info(`[PriceStream] Connecting to ${this.url}`);
    this.ws = new WebSocket(this.url);
    
    this.ws.on('open', () => { 
      this.connected = true; 
      logger.info(`[PriceStream] Connected ${this.symbol}`); 
    });
    
    this.ws.on('message', (buf) => {
      try {
        const msg = JSON.parse(buf.toString());
        const price = parseFloat(msg.p);
        this.lastPrice = price;
        
        const payload = { 
          type: 'tick', 
          symbol: this.symbol.toUpperCase(), 
          price, 
          ts: msg.T 
        };
        
        const wss = getWSS();
        if (wss) {
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              try { 
                client.send(JSON.stringify(payload)); 
              } catch (e) {
                // Ignore send errors for dead connections
              }
            }
          });
        }
      } catch (e) { 
        logger.warn('[PriceStream] Failed to parse message:', e);
      }
    });
    
    this.ws.on('close', () => { 
      this.connected = false; 
      this.ws = undefined; 
      logger.info(`[PriceStream] Disconnected ${this.symbol}, reconnecting in 2s`);
      setTimeout(() => this.start(), 2000); 
    });
    
    this.ws.on('error', (error) => { 
      logger.error(`[PriceStream] Error ${this.symbol}:`, error);
    });
  }
  
  stop() {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
      this.connected = false;
    }
  }
  
  isConnected() { 
    return this.connected; 
  }
  
  getLastPrice() {
    return this.lastPrice;
  }
}

export const priceStream = new PriceStream('btcusdt');
import WebSocket from 'ws';
import { getWSS } from '../ws';
import { logger } from '../utils/logger';

export class PriceStream {
  private ws?: WebSocket;
  private url: string;
  private symbol: string;
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(symbol = 'btcusdt') {
    this.symbol = symbol.toLowerCase();
    this.url = `wss://stream.binance.com:9443/ws/${this.symbol}@trade`;
  }

  start() {
    logger.info(`Starting price stream for ${this.symbol}`);
    this.connect();
  }

  stop() {
    logger.info(`Stopping price stream for ${this.symbol}`);
    this.connected = false;
    if (this.ws) {
      this.ws.close();
    }
  }

  private connect() {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        logger.info(`Connected to Binance WebSocket for ${this.symbol}`);
        this.connected = true;
        this.reconnectAttempts = 0;
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const trade = JSON.parse(data.toString());
          
          // Transform Binance trade data to our format
          const priceUpdate = {
            symbol: trade.s || this.symbol.toUpperCase(),
            price: parseFloat(trade.p),
            quantity: parseFloat(trade.q),
            timestamp: trade.T || Date.now(),
            isBuyerMaker: trade.m || false,
            tradeId: trade.t,
            source: 'binance_ws'
          };

          // Broadcast to all connected clients via our WebSocket server
          this.broadcastPriceUpdate(priceUpdate);

        } catch (error) {
          logger.error('Error parsing Binance trade data:', error);
        }
      });

      this.ws.on('close', () => {
        logger.warn(`Binance WebSocket closed for ${this.symbol}`);
        this.connected = false;
        this.handleReconnect();
      });

      this.ws.on('error', (error) => {
        logger.error(`Binance WebSocket error for ${this.symbol}:`, error);
        this.connected = false;
        this.handleReconnect();
      });

    } catch (error) {
      logger.error(`Failed to create WebSocket connection for ${this.symbol}:`, error);
      this.handleReconnect();
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`Max reconnect attempts reached for ${this.symbol}`);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    logger.info(`Attempting to reconnect to ${this.symbol} in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (!this.connected) {
        this.connect();
      }
    }, delay);
  }

  private broadcastPriceUpdate(priceUpdate: any) {
    try {
      const wss = getWSS();
      if (!wss) {
        logger.warn('WebSocket server not available for broadcasting');
        return;
      }

      const message = JSON.stringify({
        type: 'price_update',
        data: priceUpdate
      });

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });

    } catch (error) {
      logger.error('Error broadcasting price update:', error);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getSymbol(): string {
    return this.symbol;
  }
}

// Singleton instance for managing multiple price streams
class PriceStreamManager {
  private streams: Map<string, PriceStream> = new Map();

  startStream(symbol: string): PriceStream {
    const key = symbol.toLowerCase();
    
    if (this.streams.has(key)) {
      return this.streams.get(key)!;
    }

    const stream = new PriceStream(key);
    this.streams.set(key, stream);
    stream.start();
    
    logger.info(`Started price stream for ${symbol}`);
    return stream;
  }

  stopStream(symbol: string): boolean {
    const key = symbol.toLowerCase();
    const stream = this.streams.get(key);
    
    if (stream) {
      stream.stop();
      this.streams.delete(key);
      logger.info(`Stopped price stream for ${symbol}`);
      return true;
    }
    
    return false;
  }

  stopAllStreams() {
    logger.info('Stopping all price streams');
    this.streams.forEach((stream, symbol) => {
      stream.stop();
    });
    this.streams.clear();
  }

  getActiveStreams(): string[] {
    return Array.from(this.streams.keys());
  }
}

export const priceStreamManager = new PriceStreamManager();
