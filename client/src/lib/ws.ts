import { useSystemStore } from "@/state/systemStore";
import { useEffect, useState } from "react";

// Hook for getting real-time quotes
export function useQuotes(symbol: string) {
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    const handleMarketData = (event: any) => {
      const data = event.detail;
      if (data && data[symbol]) {
        setQuote(data[symbol]);
      }
    };

    window.addEventListener('market_data', handleMarketData);
    return () => window.removeEventListener('market_data', handleMarketData);
  }, [symbol]);

  return quote;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect() {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private handleMessage(msg: any) {
    // Handle system breaker messages
    if (msg.type === "breaker") {
      useSystemStore.getState().setBreaker(Boolean(msg.active), msg.reason, msg.details);
    }

    // Handle other message types
    if (msg.type === "market_data") {
      // Dispatch market data updates
      window.dispatchEvent(new CustomEvent('market_data', { detail: msg.data }));
    }

    if (msg.type === "ai_update") {
      // Dispatch AI updates
      window.dispatchEvent(new CustomEvent('ai_update', { detail: msg.data }));
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`WebSocket reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay);

      // Exponential backoff
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    } else {
      console.error('WebSocket max reconnection attempts reached');
      // Set system breaker for connection issues
      useSystemStore.getState().setBreaker(true, "stale_quotes", "WebSocket connection failed");
    }
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not connected, cannot send data');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Global WebSocket instance
export const wsClient = new WebSocketClient();