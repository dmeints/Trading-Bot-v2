import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { marketDataService } from "./marketData";
import { aiOrchestrator } from "./aiAgents";
import { storage } from "../storage";

export interface WebSocketMessage {
  type: string;
  data?: any;
}

export class SkippyWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, { 
    userId?: string; 
    subscriptions: Set<string>;
    lastPing: number;
    connectionHealth: 'healthy' | 'degraded' | 'unhealthy';
  }> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws',
      perMessageDeflate: false,
      maxPayload: 1024 * 1024, // 1MB
      clientTracking: true
    });
    this.setupEventHandlers();
    this.setupHealthCheck();
  }

  private setupEventHandlers() {
    this.wss.on('connection', (ws: WebSocket, request) => {
      console.log(`New WebSocket connection from ${request.socket.remoteAddress}`);
      
      // Initialize client data with connection health
      this.clients.set(ws, { 
        subscriptions: new Set(),
        lastPing: Date.now(),
        connectionHealth: 'healthy'
      });

      // Set up ping/pong for connection health
      ws.on('pong', () => {
        const client = this.clients.get(ws);
        if (client) {
          client.lastPing = Date.now();
          client.connectionHealth = 'healthy';
        }
      });

      ws.on('message', async (message: Buffer) => {
        try {
          const data: WebSocketMessage = JSON.parse(message.toString());
          await this.handleMessage(ws, data);
        } catch (error) {
          console.error('WebSocket message error:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', (code, reason) => {
        console.log(`WebSocket connection closed: ${code} - ${reason}`);
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.handleDisconnect(ws);
      });

      // Send initial data
      this.sendWelcomeMessage(ws);
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket Server error:', error);
    });
  }

  private setupHealthCheck() {
    // Health check every 30 seconds
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        const client = this.clients.get(ws);
        if (client) {
          const timeSinceLastPing = Date.now() - client.lastPing;
          
          if (timeSinceLastPing > 60000) { // 60 seconds
            client.connectionHealth = 'unhealthy';
            ws.terminate();
          } else if (timeSinceLastPing > 30000) { // 30 seconds
            client.connectionHealth = 'degraded';
            ws.ping();
          } else {
            ws.ping();
          }
        }
      });
    }, 30000);
  }

  private async handleMessage(ws: WebSocket, message: WebSocketMessage) {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (message.type) {
      case 'authenticate':
        await this.handleAuthenticate(ws, message.data);
        break;

      case 'subscribe_prices':
        await this.handleSubscribePrices(ws, message.data);
        break;

      case 'unsubscribe_prices':
        await this.handleUnsubscribePrices(ws, message.data);
        break;

      case 'get_agent_status':
        await this.handleGetAgentStatus(ws);
        break;

      case 'get_portfolio':
        await this.handleGetPortfolio(ws);
        break;

      case 'get_recommendations':
        await this.handleGetRecommendations(ws);
        break;

      default:
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }

  private async handleAuthenticate(ws: WebSocket, data: { userId: string }) {
    const client = this.clients.get(ws);
    if (!client) return;

    client.userId = data.userId;
    this.send(ws, {
      type: 'authenticated',
      data: { userId: data.userId },
    });
  }

  private async handleSubscribePrices(ws: WebSocket, data: { symbols: string[] }) {
    const client = this.clients.get(ws);
    if (!client) return;

    data.symbols.forEach(symbol => {
      client.subscriptions.add(symbol);
      marketDataService.subscribe(symbol, ws);
    });

    this.send(ws, {
      type: 'price_subscribed',
      data: { symbols: data.symbols },
    });
  }

  private async handleUnsubscribePrices(ws: WebSocket, data: { symbols: string[] }) {
    const client = this.clients.get(ws);
    if (!client) return;

    data.symbols.forEach(symbol => {
      client.subscriptions.delete(symbol);
      marketDataService.unsubscribe(symbol, ws);
    });

    this.send(ws, {
      type: 'price_unsubscribed',
      data: { symbols: data.symbols },
    });
  }

  private async handleGetAgentStatus(ws: WebSocket) {
    try {
      const agentStatus = aiOrchestrator.getAgentStatus();
      const recentActivities = await storage.getRecentAgentActivities(10);

      this.send(ws, {
        type: 'agent_status',
        data: {
          agents: agentStatus,
          recentActivities,
        },
      });
    } catch (error) {
      console.error('Error getting agent status:', error);
      this.sendError(ws, 'Failed to get agent status');
    }
  }

  private async handleGetPortfolio(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (!client?.userId) {
      this.sendError(ws, 'Not authenticated');
      return;
    }

    try {
      const positions = await storage.getUserPositions(client.userId);
      const recentTrades = await storage.getUserTrades(client.userId, 10);
      const portfolioSnapshot = await storage.getLatestPortfolioSnapshot(client.userId);

      this.send(ws, {
        type: 'portfolio_data',
        data: {
          positions,
          recentTrades,
          snapshot: portfolioSnapshot,
        },
      });
    } catch (error) {
      console.error('Error getting portfolio:', error);
      this.sendError(ws, 'Failed to get portfolio data');
    }
  }

  private async handleGetRecommendations(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (!client?.userId) {
      this.sendError(ws, 'Not authenticated');
      return;
    }

    try {
      const recommendations = await storage.getUserRecommendations(client.userId);

      this.send(ws, {
        type: 'recommendations',
        data: recommendations,
      });
    } catch (error) {
      console.error('Error getting recommendations:', error);
      this.sendError(ws, 'Failed to get recommendations');
    }
  }

  private handleDisconnect(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (!client) return;

    // Unsubscribe from all market data
    client.subscriptions.forEach(symbol => {
      marketDataService.unsubscribe(symbol, ws);
    });

    // Remove client
    this.clients.delete(ws);
  }

  private sendWelcomeMessage(ws: WebSocket) {
    this.send(ws, {
      type: 'welcome',
      data: {
        message: 'Connected to Skippy AI Trading System',
        timestamp: new Date().toISOString(),
      },
    });
  }

  private send(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, error: string) {
    this.send(ws, {
      type: 'error',
      data: { error },
    });
  }

  // Broadcast methods for system-wide updates
  broadcastAgentUpdate(agentType: string, data: any) {
    const message: WebSocketMessage = {
      type: 'agent_update',
      data: { agentType, ...data },
    };

    this.clients.forEach((client, ws) => {
      this.send(ws, message);
    });
  }

  broadcastSystemAlert(alert: { type: string; message: string; severity: 'info' | 'warning' | 'error' }) {
    const message: WebSocketMessage = {
      type: 'system_alert',
      data: alert,
    };

    this.clients.forEach((client, ws) => {
      this.send(ws, message);
    });
  }
}

let webSocketServer: SkippyWebSocketServer | null = null;

export function createWebSocketServer(server: Server): SkippyWebSocketServer {
  webSocketServer = new SkippyWebSocketServer(server);
  return webSocketServer;
}

export function getWebSocketServer(): SkippyWebSocketServer | null {
  return webSocketServer;
}
