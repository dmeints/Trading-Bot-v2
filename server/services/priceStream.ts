
// server/services/priceStream.ts
import WebSocket from 'ws';
import { getWSS } from '../ws';
import { logger } from '../utils/logger';

export class PriceStream {
  private ws?: WebSocket;
  private url: string;
  private symbol: string;
  private connected = false;
  private lastPrice: number = 0;
  private consecutiveFailures = 0;
  private maxFailures = 5;
  private circuitBreakerOpen = false;
  private circuitBreakerTimeout?: NodeJS.Timeout;
  
  constructor(symbol = 'btcusdt') {
    this.symbol = symbol.toLowerCase();
    this.url = `wss://stream.binance.com:9443/ws/${this.symbol}@trade`;
  }
  
  start() {
    if (this.ws || this.circuitBreakerOpen) return;
    
    // Add delay before connecting to reduce connection spam
    const connectDelay = Math.random() * 2000 + 1000; // 1-3 seconds random delay
    setTimeout(() => {
      if (this.circuitBreakerOpen) {
        logger.warn(`[PriceStream] Circuit breaker open, skipping connection attempt`);
        return;
      }
      
      logger.info(`[PriceStream] Connecting to ${this.url}`);
      this.ws = new WebSocket(this.url);
      this.setupWebSocketHandlers();
    }, connectDelay);
  }

  private setupWebSocketHandlers() {
    if (!this.ws) return;
    
    this.ws.on('open', () => { 
      this.connected = true;
      this.consecutiveFailures = 0; // Reset on successful connection
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
        logger.warn('[PriceStream] Failed to parse message:', { error: String(e) });
      }
    });
    
    this.ws.on('close', () => { 
      this.connected = false; 
      this.ws = undefined; 
      // Exponential backoff for reconnections - start with 5s, max 30s
      const reconnectDelay = Math.min(5000 * Math.pow(1.5, Math.random() * 3), 30000);
      logger.info(`[PriceStream] Disconnected ${this.symbol}, reconnecting in ${Math.round(reconnectDelay/1000)}s`);
      setTimeout(() => this.start(), reconnectDelay); 
    });
    
    this.ws.on('error', (error) => { 
      this.consecutiveFailures++;
      logger.error(`[PriceStream] Error ${this.symbol} (${this.consecutiveFailures}/${this.maxFailures}):`, error);
      
      if (this.consecutiveFailures >= this.maxFailures) {
        this.openCircuitBreaker();
      }
    });
  }
  
  private openCircuitBreaker() {
    this.circuitBreakerOpen = true;
    logger.warn(`[PriceStream] Circuit breaker opened for ${this.symbol} - stopping connection attempts for 5 minutes`);
    
    // Reset circuit breaker after 5 minutes
    this.circuitBreakerTimeout = setTimeout(() => {
      this.circuitBreakerOpen = false;
      this.consecutiveFailures = 0;
      logger.info(`[PriceStream] Circuit breaker reset for ${this.symbol}`);
    }, 5 * 60 * 1000);
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
