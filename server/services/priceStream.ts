
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
