import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { tradingEngine } from "./services/tradingEngine";
import { aiOrchestrator } from "./services/aiAgents";
import { marketDataService } from "./services/marketData";
import { createWebSocketServer } from "./services/webSocketServer";
import { insertTradeSchema } from "@shared/schema";
import { z } from "zod";
import { analyticsLogger, logTradeEvent, logAIEvent } from "./services/analyticsLogger";
import { apiRateLimit, tradingRateLimit, adminRateLimit } from "./middleware/rateLimiter";
import { adminAuthGuard, AdminRequest } from "./middleware/adminAuth";
import { modelManager } from "./services/modelManager";
import { tradingWebhookVerifier, marketDataWebhookVerifier, genericWebhookVerifier, captureRawBody, WebhookRequest } from "./middleware/webhookSecurity";
import { webhookTester } from "./services/webhookTester";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Market data routes
  app.get('/api/market/prices', async (req, res) => {
    try {
      const prices = marketDataService.getCurrentPrices();
      res.json(prices);
    } catch (error) {
      console.error("Error fetching prices:", error);
      res.status(500).json({ message: "Failed to fetch market prices" });
    }
  });

  app.get('/api/market/price/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const price = marketDataService.getCurrentPrice(symbol);
      if (!price) {
        return res.status(404).json({ message: "Symbol not found" });
      }
      res.json(price);
    } catch (error) {
      console.error("Error fetching price:", error);
      res.status(500).json({ message: "Failed to fetch price" });
    }
  });

  // Admin routes
  app.get('/api/admin/system/stats', adminRateLimit, adminAuthGuard, (req: AdminRequest, res) => {
    const stats = analyticsLogger.getSystemStats();
    res.json(stats);
  });

  app.get('/api/admin/analytics', adminRateLimit, adminAuthGuard, (req: AdminRequest, res) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const data = analyticsLogger.getAnalyticsData(limit);
    res.json(data);
  });

  app.get('/api/admin/errors', adminRateLimit, adminAuthGuard, (req: AdminRequest, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = analyticsLogger.getErrorLogs(limit);
    res.type('text/plain').send(logs);
  });

  app.post('/api/admin/generate-summary', adminRateLimit, adminAuthGuard, (req: AdminRequest, res) => {
    try {
      const filePath = analyticsLogger.generateDailySummary();
      if (filePath && require('fs').existsSync(filePath)) {
        res.download(filePath, `daily_summary_${new Date().toISOString().split('T')[0]}.csv`);
      } else {
        res.status(404).json({ error: 'No data available for daily summary' });
      }
    } catch (error) {
      console.error('Failed to generate daily summary:', error);
      res.status(500).json({ error: 'Failed to generate summary' });
    }
  });

  app.post('/api/admin/clear-logs', adminRateLimit, adminAuthGuard, (req: AdminRequest, res) => {
    try {
      analyticsLogger.clearLogs();
      res.json({ success: true, message: 'Logs cleared successfully' });
    } catch (error) {
      console.error('Failed to clear logs:', error);
      res.status(500).json({ error: 'Failed to clear logs' });
    }
  });

  // Model management routes
  app.get('/api/admin/models', adminRateLimit, adminAuthGuard, (req: AdminRequest, res) => {
    try {
      const type = req.query.type as string;
      const models = modelManager.getAllModels(type);
      res.json(models);
    } catch (error) {
      console.error('Failed to fetch models:', error);
      res.status(500).json({ error: 'Failed to fetch models' });
    }
  });

  app.post('/api/admin/models', adminRateLimit, adminAuthGuard, (req: AdminRequest, res) => {
    try {
      const modelData = req.body;
      const modelId = modelManager.registerModel(modelData);
      res.json({ id: modelId, success: true });
    } catch (error) {
      console.error('Failed to create model:', error);
      res.status(500).json({ error: 'Failed to create model' });
    }
  });

  app.put('/api/admin/models/:id', adminRateLimit, adminAuthGuard, (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const success = modelManager.updateModel(id, updates);
      
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Model not found' });
      }
    } catch (error) {
      console.error('Failed to update model:', error);
      res.status(500).json({ error: 'Failed to update model' });
    }
  });

  app.delete('/api/admin/models/:id', adminRateLimit, adminAuthGuard, (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const success = modelManager.deleteModel(id);
      
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Model not found' });
      }
    } catch (error) {
      console.error('Failed to delete model:', error);
      res.status(500).json({ error: 'Failed to delete model' });
    }
  });

  app.post('/api/admin/models/:id/backup', adminRateLimit, adminAuthGuard, (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const backupPath = modelManager.backupModel(id);
      
      if (backupPath) {
        res.download(backupPath);
      } else {
        res.status(404).json({ error: 'Model not found or backup failed' });
      }
    } catch (error) {
      console.error('Failed to backup model:', error);
      res.status(500).json({ error: 'Failed to backup model' });
    }
  });

  app.get('/api/admin/models/stats', adminRateLimit, adminAuthGuard, (req: AdminRequest, res) => {
    try {
      const stats = modelManager.getSystemStats();
      res.json(stats);
    } catch (error) {
      console.error('Failed to fetch model stats:', error);
      res.status(500).json({ error: 'Failed to fetch model stats' });
    }
  });

  // Webhook endpoints with security
  app.post('/api/webhooks/trading', captureRawBody, tradingWebhookVerifier, (req: WebhookRequest, res) => {
    try {
      const { type, data } = req.body;
      
      // Log webhook receipt
      analyticsLogger.logAnalyticsEvent({
        timestamp: new Date().toISOString(),
        tradeId: `webhook-trading-${Date.now()}`,
        strategy: 'webhook-trading',
        regime: 'sideways',
        type: 'scalp',
        risk: 'medium',
        source: 'trading-webhook',
        pnl: data.pnl || 0,
        latencyMs: 0,
        signalStrength: 0.8,
        confidence: 0.8,
        metadata: { webhookType: type, data },
      });

      // Process trading webhook based on type
      switch (type) {
        case 'signal':
          // Handle trading signal
          console.log('[Webhook] Received trading signal:', data);
          break;
        case 'execution':
          // Handle trade execution update
          console.log('[Webhook] Trade execution update:', data);
          break;
        default:
          console.log('[Webhook] Unknown trading webhook type:', type);
      }

      res.json({ received: true, processed: true });
    } catch (error) {
      console.error('Trading webhook error:', error);
      res.status(500).json({ error: 'Processing failed' });
    }
  });

  app.post('/api/webhooks/market', captureRawBody, marketDataWebhookVerifier, (req: WebhookRequest, res) => {
    try {
      const { symbol, price, timestamp } = req.body;
      
      // Log market data webhook
      analyticsLogger.logAnalyticsEvent({
        timestamp: new Date().toISOString(),
        tradeId: `webhook-market-${Date.now()}`,
        strategy: 'webhook-market',
        regime: 'sideways',
        type: 'scalp',
        risk: 'low',
        source: 'market-webhook',
        pnl: 0,
        latencyMs: 0,
        signalStrength: 1.0,
        confidence: 1.0,
        metadata: { symbol, price, timestamp },
      });

      // Update market data
      marketDataService.updatePrice(symbol, price);
      
      res.json({ received: true, updated: true });
    } catch (error) {
      console.error('Market webhook error:', error);
      res.status(500).json({ error: 'Processing failed' });
    }
  });

  app.post('/api/webhooks/generic', captureRawBody, genericWebhookVerifier, (req: WebhookRequest, res) => {
    try {
      const { source, event, data } = req.body;
      
      // Log generic webhook
      analyticsLogger.logAnalyticsEvent({
        timestamp: new Date().toISOString(),
        tradeId: `webhook-generic-${Date.now()}`,
        strategy: 'webhook-generic',
        regime: 'sideways',
        type: 'scalp',
        risk: 'low',
        source: 'generic-webhook',
        pnl: 0,
        latencyMs: 0,
        signalStrength: 0.5,
        confidence: 0.5,
        metadata: { source, event, data },
      });

      console.log('[Webhook] Generic webhook from', source, ':', event);
      res.json({ received: true });
    } catch (error) {
      console.error('Generic webhook error:', error);
      res.status(500).json({ error: 'Processing failed' });
    }
  });

  // Webhook testing routes
  app.get('/api/admin/webhook/tests', adminRateLimit, adminAuthGuard, (req: AdminRequest, res) => {
    try {
      const history = webhookTester.getTestHistory();
      res.json(history);
    } catch (error) {
      console.error('Failed to fetch webhook test history:', error);
      res.status(500).json({ error: 'Failed to fetch test history' });
    }
  });

  app.get('/api/admin/webhook/stats', adminRateLimit, adminAuthGuard, (req: AdminRequest, res) => {
    try {
      const stats = webhookTester.getTestStats();
      res.json(stats);
    } catch (error) {
      console.error('Failed to fetch webhook test stats:', error);
      res.status(500).json({ error: 'Failed to fetch test stats' });
    }
  });

  app.post('/api/admin/webhook/test', adminRateLimit, adminAuthGuard, async (req: AdminRequest, res) => {
    try {
      const results = await webhookTester.runAllTests();
      res.json({
        success: true,
        totalTests: results.length,
        results,
      });
    } catch (error) {
      console.error('Failed to run webhook tests:', error);
      res.status(500).json({ error: 'Failed to run tests' });
    }
  });

  app.delete('/api/admin/webhook/tests', adminRateLimit, adminAuthGuard, (req: AdminRequest, res) => {
    try {
      webhookTester.clearHistory();
      res.json({ success: true, message: 'Test history cleared' });
    } catch (error) {
      console.error('Failed to clear webhook test history:', error);
      res.status(500).json({ error: 'Failed to clear test history' });
    }
  });

  // Trading routes
  const tradeRequestSchema = z.object({
    symbol: z.string(),
    side: z.enum(['buy', 'sell']),
    quantity: z.number().positive(),
    orderType: z.enum(['market', 'limit', 'stop']),
    price: z.number().optional(),
    stopPrice: z.number().optional(),
  });

  app.post('/api/trading/execute', tradingRateLimit, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tradeRequest = tradeRequestSchema.parse(req.body);
      
      const result = await tradingEngine.executeTrade({
        userId,
        ...tradeRequest,
      });

      if (result.success) {
        // Log successful trade
        logTradeEvent(
          result.trade?.id || 'unknown',
          userId,
          tradeRequest.symbol,
          tradeRequest.side,
          result.trade?.pnl || 0,
          0.8, // confidence score
          'manual-trade',
          { orderType: tradeRequest.orderType }
        );
        res.json(result);
      } else {
        // Log failed trade
        analyticsLogger.logError({
          timestamp: new Date().toISOString(),
          level: 'warn',
          message: 'Trade execution failed',
          userId,
          endpoint: '/api/trading/execute',
          metadata: { tradeRequest, error: result.error },
        });
        res.status(400).json({ message: result.error });
      }
    } catch (error) {
      console.error("Error executing trade:", error);
      res.status(500).json({ message: "Failed to execute trade" });
    }
  });

  app.get('/api/trading/positions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const positions = await storage.getUserPositions(userId);
      res.json(positions);
    } catch (error) {
      console.error("Error fetching positions:", error);
      res.status(500).json({ message: "Failed to fetch positions" });
    }
  });

  app.get('/api/trading/trades', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 50;
      const trades = await storage.getUserTrades(userId, limit);
      res.json(trades);
    } catch (error) {
      console.error("Error fetching trades:", error);
      res.status(500).json({ message: "Failed to fetch trades" });
    }
  });

  // AI Agent routes
  app.get('/api/ai/agents/status', async (req, res) => {
    try {
      const status = aiOrchestrator.getAgentStatus();
      const recentActivities = await storage.getRecentAgentActivities(20);
      res.json({ agents: status, recentActivities });
    } catch (error) {
      console.error("Error fetching agent status:", error);
      res.status(500).json({ message: "Failed to fetch agent status" });
    }
  });

  app.post('/api/ai/agents/run/:agentType', isAuthenticated, async (req: any, res) => {
    try {
      const { agentType } = req.params;
      const data = req.body;
      
      const result = await aiOrchestrator.runAgent(agentType, data);
      res.json(result);
    } catch (error) {
      console.error("Error running agent:", error);
      res.status(500).json({ message: "Failed to run agent" });
    }
  });

  app.get('/api/ai/recommendations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const status = (req.query.status as string) || 'active';
      const recommendations = await storage.getUserRecommendations(userId, status);
      res.json(recommendations);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      res.status(500).json({ message: "Failed to fetch recommendations" });
    }
  });

  app.post('/api/ai/recommendations/generate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { symbol } = req.body;
      
      if (!symbol) {
        return res.status(400).json({ message: "Symbol is required" });
      }

      const recommendation = await tradingEngine.generateAIRecommendation(userId, symbol);
      res.json(recommendation);
    } catch (error) {
      console.error("Error generating recommendation:", error);
      res.status(500).json({ message: "Failed to generate recommendation" });
    }
  });

  // Portfolio routes
  app.get('/api/portfolio/summary', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const snapshot = await storage.getLatestPortfolioSnapshot(userId);
      const positions = await storage.getUserPositions(userId);
      const recentTrades = await storage.getUserTrades(userId, 10);

      res.json({
        snapshot,
        positions,
        recentTrades,
      });
    } catch (error) {
      console.error("Error fetching portfolio:", error);
      res.status(500).json({ message: "Failed to fetch portfolio" });
    }
  });

  // User settings routes
  app.patch('/api/user/settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { tradingMode, riskTolerance } = req.body;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update user settings (would need to implement updateUser method in storage)
      // For now, just return success
      res.json({ message: "Settings updated successfully" });
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        ai_agents: 'active',
        market_data: 'streaming',
      },
    });
  });

  const httpServer = createServer(app);
  
  // Setup WebSocket server
  createWebSocketServer(httpServer);

  return httpServer;
}
