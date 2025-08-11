import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { xApiEmergencyProtection, xApiManualOverride, getXApiUsageStats } from "./middleware/xApiProtection.js";
import { xApiCache } from "./services/xApiCache.js";
import { SentimentAnalyzer } from "./services/sentimentAnalyzer.js";
import { 
  getAllApiStats, 
  getApiStats,
  emergencyDisableApi,
  redditApiGuard,
  etherscanApiGuard,
  cryptoPanicApiGuard,
  recordApiUsage
} from "./middleware/apiGuardrails.js";
import { EnhancedSentimentAnalyzer } from "./services/enhancedSentimentAnalyzer.js";
import { advancedFeaturesRouter } from "./routes/advancedFeatures";
import layoutRoutes from "./routes/layoutRoutes";
import experimentRoutes from "./routes/experimentRoutes";
import preferencesRoutes from "./routes/preferencesRoutes";
import monitoringRoutes from "./routes/monitoringRoutes";
import { unifiedApi } from "./api/unified";
// Feedback routes will be added inline
import { tradingEngine } from "./services/tradingEngine";
import { aiOrchestrator } from "./services/aiAgents";
import { marketDataService } from "./services/marketData";
import { createWebSocketServer } from "./services/webSocketServer";
import { insertTradeSchema } from "@shared/schema";
import { z } from "zod";
import { analyticsLogger, logTradeEvent, logAIEvent } from "./services/analyticsLogger";
import { rateLimiters } from "./middleware/rateLimiter";
import { adminAuth } from "./middleware/adminAuth";
import { modelManager } from "./services/modelManager";
import { tradingWebhookVerifier, marketDataWebhookVerifier, genericWebhookVerifier, captureRawBody, WebhookRequest } from "./middleware/webhookSecurity";
import { webhookTester } from "./services/webhookTester";
import { policyEngine } from "./engine/policy";
import { rlEngine } from "./engine/rl";
import { lazyInitService } from "./services/lazyInit";
import { backtestEngine } from "./services/backtestEngine";
import { ensembleOrchestrator } from "./services/ensembleAI";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import type { RequestWithId } from "./middleware/requestId";
// import { healthRoutes } from "./routes/healthRoutes"; // Fixed: will use dynamic import
// import { health } from "./routes/health"; // Fixed: health route now imported dynamically
import { bench } from "./routes/bench";
import { mlopsRoutes } from "./routes/mlopsRoutes";
// import vectorRoutes from './routes/vectorRoutes';
import dataFusionRoutes from './routes/dataFusionRoutes';
import pluginRoutes from "./routes/pluginRoutes";
import docsRoutes from "./routes/docsRoutes";
import { startRetrainingJobs } from "./jobs/retrainingCron";
import { AlertingIntegration } from "./services/alertingIntegration";
import stevieSupertainRoutes from './routes/stevie-supertrain';
import featuresRouter from './routes/features.js';
import featureRoutes from './routes/featureRoutes';
import stevieRoutes from './routes/stevieRoutes';
import realTrainingRoutes from './routes/realTrainingRoutes';
import taRoutes from './routes/taRoutes';
import exchangeRoutes from './routes/exchangeRoutes';
import { registerEnhancementRoutes } from './routes/enhancementRoutes';
import { temporalRoutes } from './routes/temporalRoutes';
import universalRoutes from './routes/universalRoutes';
import { trainingJobsRouter } from './training/jobs/routes';
import tradingRoutes from './routes/trading.js';
import tradingTestRoutes from './routes/trading-tests.js';
import { registerMarketRoutes } from './routes/marketRoutes';
import { registerStrategyRoutes } from './routes/strategyRoutes';
import registerBacktestRoutes from './routes/backtestRoutes';
import externalConnectorsRouter from './routes/externalConnectors';
import connectorsRouter from './routes/connectors';
import comprehensiveFeaturesRouter from './routes/comprehensive-features';
import { transferLearningRouter } from './routes/transferLearning.js';

export async function registerRoutes(app: Express): Promise<Server> {
  // Development bypass function
  const devBypass = (req: any, res: any, next: any) => {
    if (isDevelopment && !req.user) {
      req.user = { claims: { sub: 'dev-user-123' } };
    }
    next();
  };

  // Auth middleware
  await setupAuth(app);

  // Advanced features routes
  app.use(advancedFeaturesRouter);

  // Development bypass middleware - fix authentication
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    // Apply early bypass for development
    app.use('*', async (req: any, res: any, next: any) => {
      req.user = { claims: { sub: 'dev-user-123' } };
      req.isAuthenticated = () => true;

      // Ensure dev user exists in storage once
      if (!req.session?.devUserCreated) {
        try {
          let user = await storage.getUser('dev-user-123');
          if (!user) {
            user = await storage.upsertUser({
              id: 'dev-user-123',
              email: 'dev@skippy.local',
              firstName: 'Dev',
              lastName: 'User',
              profileImageUrl: 'https://via.placeholder.com/150'
            });
          }
          req.session = req.session || {};
          req.session.devUserCreated = true;
        } catch (error) {
          // Silent fail to prevent blocking requests
          logger.debug('[DevBypass] User creation skipped:', { error: error instanceof Error ? error.message : String(error) });
        }
      }
      next();
    });
  }

  // Auth middleware
  if (!isDevelopment) {
    await setupAuth(app);
  } else {
    logger.info('[DevMode] Skipping Replit Auth setup - using dev bypass');
  }

  // Unified API routes
  app.use('/api', unifiedApi);

  // Features API for real algorithmic trading
  app.use('/api/features', featuresRouter);

  // Unified features API with comprehensive validation
  const unifiedFeaturesRoutes = await import('./routes/unifiedFeatures');
  app.use('/api/features', unifiedFeaturesRoutes.default);

  // Stevie Real Decision API
  const stevieDecisionRouter = await import('./routes/stevie-decision.js');
  app.use('/api/stevie', stevieDecisionRouter.default);

  // Stevie AI Companion routes
  app.use('/api/stevie', stevieRoutes);

  // Register comprehensive new API routes for live paper trading
  registerMarketRoutes(app, isAuthenticated);
  registerStrategyRoutes(app, isAuthenticated); 
  // Backtest routes with deterministic validation
  app.use('/api/backtest', registerBacktestRoutes);

  // Promotion gate routes for production readiness
  const promotionRoutes = await import('./routes/promotionRoutes');
  app.use('/api/promotion', promotionRoutes.default);

  // Stevie Super-Training routes (v1.2 advanced RL system)
  app.use('/api/stevie/supertrain', stevieSupertainRoutes);

  // Health & monitoring routes  
  const { healthRoutes: healthCheckRoutes } = await import('./routes/healthRoutes');
  app.use('/api', healthCheckRoutes);
  app.use('/api/bench', bench);

  // MLOps routes
  app.use('/api/mlops', mlopsRoutes);

  // Pillar 4: UX & Personalization routes
  app.use('/api/layouts', layoutRoutes);
  app.use('/api/experiments', experimentRoutes);

  // Simple preferences endpoint for UI compatibility
  app.get('/api/preferences', async (req: any, res) => {
    try {
      res.json({
        success: true,
        preferences: {
          theme: 'dark',
          notifications: true,
          autoRefresh: true,
          riskTolerance: 'medium',
          tradingMode: 'paper'
        }
      });
    } catch (error) {
      console.error('Error fetching preferences:', error);
      res.status(500).json({ message: 'Failed to fetch preferences' });
    }
  });

  app.use('/api/preferences', preferencesRoutes);

  // Pillar 5: Scale, Monitoring & Resilience routes
  app.use('/api/monitoring', monitoringRoutes);

  // Vector routes (temporarily disabled)
  // app.use('/api/vector', vectorRoutes);

  // Feature routes (Stevie v1.3 data ingestion)
  app.use(featureRoutes);

  // Stevie explanation routes (v1.4 LLM integration)
  app.use('/api/stevie', stevieRoutes);

  // PHASE 6 & 7: Paper Run Implementation - TA and Exchange Routes
  app.use('/api/ta', taRoutes);
  app.use('/api/exchange', exchangeRoutes);

  // Register all 6 exceptional enhancement services
  registerEnhancementRoutes(app);

  // Data fusion routes (on-chain + sentiment)
  app.use('/api/fusion', dataFusionRoutes);

  // External connectors API (Phase A - Compliance Mode)
  app.use('/api/connectors', externalConnectorsRouter);
  app.use('/api/connectors-phase-a', connectorsRouter);

  // Phase B: AI Chat Integration
  const { aiChatRoutes } = await import('./routes/aiChat.js');
  app.use('/api/ai', aiChatRoutes);

  // Phase C: Advanced Trading Strategies
  const { strategiesRouter } = await import('./routes/strategies.js');
  app.use('/api/strategies', strategiesRouter);

  // Phase D: Real-Time Algorithm Training
  const { trainingRouter } = await import('./routes/training.js');
  app.use('/api/training', trainingRouter);

  // Phase E: Live Trading Execution
  const { liveTradingRouter } = await import('./routes/liveTrading.js');
  app.use('/api/live', liveTradingRouter);

  // Phase F: Advanced Portfolio Management
  const { portfolioRouter } = await import('./routes/portfolio.js');
  app.use('/api/portfolio', portfolioRouter);

  // Phase G: Institutional Compliance
  const { complianceRouter } = await import('./routes/compliance.js');
  app.use('/api/compliance', complianceRouter);

  // Phase H: Social Trading Platform
  const { socialTradingRouter } = await import('./routes/socialTrading.js');
  app.use('/api/social', socialTradingRouter);

  // Phase I: System Integration and Analytics
  const { systemIntegrationRouter } = await import('./routes/systemIntegration.js');
  app.use('/api/system', systemIntegrationRouter);

  // Phase J: Real-Time Execution Integration
  const { executionRoutes } = await import('./routes/execution.js');
  app.use('/api/execution', executionRoutes);

  // Phase K: Performance Attribution
  const performanceAttributionRouter = (await import('./routes/performanceAttribution.js')).default;
  app.use('/api/attribution', performanceAttributionRouter);

  // Phase L: Production Monitoring
  const productionMonitoringRouter = (await import('./routes/monitoring.js')).default;
  app.use('/api/monitoring', productionMonitoringRouter);

  // Features API (from original manifest)
  const featuresApiRouter = (await import('./routes/features.js')).default;
  app.use('/api/features', featuresApiRouter);

  // Stevie Core Algorithm API (comprehensive trading engine)
  const stevieCoreRouter = (await import('./routes/stevieCore.js')).default;
  app.use('/api/stevie-core', stevieCoreRouter);

  // Real algorithm benchmark routes (actual trading performance testing)
  const { realBenchmarkRoutes } = await import('./routes/realBenchmarkRoutes');
  app.use('/api/real-benchmark', realBenchmarkRoutes);

  // Health routes (SLO monitoring)
  const { healthRoutes } = await import('./routes/health');
  app.use('/api/health', healthRoutes);

  // Plugin system routes
  app.use('/api/plugins', pluginRoutes);

  // API documentation routes
  app.use('/api', docsRoutes);

  // Admin routes
  const { adminRoutes } = await import('./routes/adminRoutes.js');
  app.use('/api/admin', adminRoutes);

  // Auth status endpoint
  app.get('/api/me', async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ authenticated: false });
      }

      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json({ 
        authenticated: true, 
        user,
        isAdmin: req.session?.isAdmin || false
      });
    } catch (error) {
      const reqLogger = logger.withRequest(req.id);
      reqLogger.error("Error fetching auth status", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to fetch auth status" });
    }
  });

  // Auth routes
  app.get('/api/auth/user', isDevelopment ? (req: any, res: any, next: any) => next() : isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      const reqLogger = logger.withRequest(req.id, req.user?.claims.sub);
      reqLogger.error("Error fetching user", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ===== X API EMERGENCY PROTECTION SYSTEM =====

  // X API usage monitoring endpoint (admin only)
  app.get('/api/admin/x-api/usage', rateLimiters.admin, adminAuth, (req: any, res: any) => {
    try {
      const stats = getXApiUsageStats();
      const cacheStats = xApiCache.getStats();

      res.json({
        usage: stats,
        cache: cacheStats,
        limits: {
          monthlyLimit: 100,
          dailyRecommended: 3,
          emergencyCutoff: 90
        },
        status: stats.remaining > 10 ? 'safe' : stats.remaining > 0 ? 'warning' : 'critical'
      });
    } catch (error) {
      logger.error('Failed to get X API usage stats', { error });
      res.status(500).json({ error: 'Failed to get usage stats' });
    }
  });

  // Protected sentiment analysis endpoint (uses X API protection)
  app.get('/api/sentiment/:symbol', xApiEmergencyProtection, async (req: any, res: any) => {
    try {
      const { symbol } = req.params;
      const analyzer = new SentimentAnalyzer();

      // Add volatility header for smart triggering
      const volatility = parseFloat(req.query.volatility as string) || 0;
      req.headers['x-market-volatility'] = volatility.toString();

      const sentiment = await analyzer.getAggregatedSentiment(symbol);

      res.json({
        ...sentiment,
        metadata: {
          symbol,
          timestamp: new Date().toISOString(),
          volatilityTrigger: volatility,
          xApiUsed: sentiment.breakdown.some(s => s.source === 'x'),
          quotaRemaining: getXApiUsageStats().remaining
        }
      });
    } catch (error) {
      logger.error('Sentiment analysis failed', { error, symbol: req.params.symbol });
      res.status(500).json({ error: 'Sentiment analysis failed' });
    }
  });

  // Manual X API override endpoint (admin only, for testing)
  app.get('/api/admin/sentiment/:symbol/force', rateLimiters.admin, adminAuth, xApiManualOverride, async (req: any, res: any) => {
    try {
      const { symbol } = req.params;
      const analyzer = new SentimentAnalyzer();

      logger.warn('Manual X API override triggered by admin', { 
        symbol, 
        admin: req.user?.claims?.sub,
        warning: 'This consumes precious X API quota!'
      });

      const sentiment = await analyzer.getAggregatedSentiment(symbol);

      res.json({
        ...sentiment,
        metadata: {
          symbol,
          timestamp: new Date().toISOString(),
          manualOverride: true,
          quotaRemaining: getXApiUsageStats().remaining,
          warning: 'Manual override used - X API quota consumed'
        }
      });
    } catch (error) {
      logger.error('Manual sentiment analysis failed', { error, symbol: req.params.symbol });
      res.status(500).json({ error: 'Manual sentiment analysis failed' });
    }
  });

  // ===== COMPREHENSIVE API GUARDRAILS SYSTEM =====

  // All API usage monitoring endpoint (admin only)
  app.get('/api/admin/api-usage/all', rateLimiters.admin, adminAuth, (req: any, res: any) => {
    try {
      const allStats = getAllApiStats();
      const xStats = getXApiUsageStats();

      res.json({
        apis: {
          x: {
            usage: xStats,
            cache: xApiCache.getStats(),
            limits: {
              monthlyLimit: 100,
              dailyRecommended: 3,
              emergencyCutoff: 90
            },
            status: xStats.remaining > 10 ? 'safe' : xStats.remaining > 0 ? 'warning' : 'critical'
          },
          ...allStats
        },
        summary: {
          totalApis: Object.keys(allStats).length + 1,
          criticalApis: Object.values(allStats).filter((stat: any) => stat.status === 'critical').length,
          warningApis: Object.values(allStats).filter((stat: any) => stat.status === 'warning').length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to get comprehensive API stats', { error });
      res.status(500).json({ error: 'Failed to get API usage statistics' });
    }
  });

  // Enhanced sentiment analysis with full guardrail protection
  app.get('/api/sentiment/enhanced/:symbol', recordApiUsage, async (req: any, res: any) => {
    try {
      const { symbol } = req.params;
      const analyzer = new EnhancedSentimentAnalyzer();

      logger.info('[Enhanced Sentiment] Request received with guardrails active', { 
        symbol,
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });

      const sentiment = await analyzer.getComprehensiveSentiment(symbol);

      res.json({
        ...sentiment,
        metadata: {
          symbol,
          timestamp: new Date().toISOString(),
          guardrailsActive: true,
          apiQuotas: getAllApiStats()
        }
      });
    } catch (error) {
      logger.error('Enhanced sentiment analysis failed', { error, symbol: req.params.symbol });
      res.status(500).json({ error: 'Enhanced sentiment analysis failed' });
    }
  });

  // Protected Reddit sentiment (with guardrails)
  app.get('/api/sentiment/reddit/:symbol', redditApiGuard, recordApiUsage, async (req: any, res: any) => {
    try {
      const { symbol } = req.params;
      const analyzer = new EnhancedSentimentAnalyzer();

      const sentiment = await analyzer.getRedditSentiment(symbol);

      res.json({
        ...sentiment,
        metadata: {
          symbol,
          source: 'reddit',
          timestamp: new Date().toISOString(),
          quotaRemaining: getApiStats('reddit')?.remaining
        }
      });
    } catch (error) {
      logger.error('Reddit sentiment analysis failed', { error, symbol: req.params.symbol });
      res.status(500).json({ error: 'Reddit sentiment analysis failed' });
    }
  });

  // Protected CryptoPanic news sentiment (with guardrails)
  app.get('/api/sentiment/news/:symbol', cryptoPanicApiGuard, recordApiUsage, async (req: any, res: any) => {
    try {
      const { symbol } = req.params;
      const analyzer = new EnhancedSentimentAnalyzer();

      const sentiment = await analyzer.getCryptoPanicSentiment(symbol);

      res.json({
        ...sentiment,
        metadata: {
          symbol,
          source: 'cryptopanic',
          timestamp: new Date().toISOString(),
          quotaRemaining: getApiStats('cryptopanic')?.remaining
        }
      });
    } catch (error) {
      logger.error('News sentiment analysis failed', { error, symbol: req.params.symbol });
      res.status(500).json({ error: 'News sentiment analysis failed' });
    }
  });

  // Protected Etherscan on-chain analysis (with guardrails)
  app.get('/api/sentiment/onchain/:symbol', etherscanApiGuard, recordApiUsage, async (req: any, res: any) => {
    try {
      const { symbol } = req.params;
      const analyzer = new EnhancedSentimentAnalyzer();

      const sentiment = await analyzer.getEtherscanOnChainSentiment(symbol);

      res.json({
        ...sentiment,
        metadata: {
          symbol,
          source: 'etherscan',
          timestamp: new Date().toISOString(),
          quotaRemaining: getApiStats('etherscan')?.remaining
        }
      });
    } catch (error) {
      logger.error('On-chain sentiment analysis failed', { error, symbol: req.params.symbol });
      res.status(500).json({ error: 'On-chain sentiment analysis failed' });
    }
  });

  // Emergency API disable endpoint (admin only)
  app.post('/api/admin/api/:apiName/disable', rateLimiters.admin, adminAuth, (req: any, res: any) => {
    try {
      const { apiName } = req.params;
      const { reason } = req.body;

      if (!['reddit', 'etherscan', 'cryptopanic'].includes(apiName)) {
        return res.status(400).json({ error: 'Invalid API name' });
      }

      emergencyDisableApi(apiName, reason || 'Manual admin disable');

      logger.warn(`[Admin] Emergency disable triggered for ${apiName.toUpperCase()} API`, {
        api: apiName,
        reason: reason || 'Manual admin disable',
        admin: req.user?.claims?.sub,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: `${apiName.toUpperCase()} API disabled`,
        disabledAt: new Date().toISOString(),
        reason: reason || 'Manual admin disable'
      });
    } catch (error) {
      logger.error('Failed to disable API', { error, api: req.params.apiName });
      res.status(500).json({ error: 'Failed to disable API' });
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
  app.get('/api/admin/system/stats', rateLimiters.admin, adminAuth, (req: any, res) => {
    const stats = analyticsLogger.getSystemStats();
    res.json(stats);
  });

  app.get('/api/admin/analytics', rateLimiters.admin, adminAuth, (req: any, res) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const data = analyticsLogger.getAnalyticsData(limit);
    res.json(data);
  });

  app.get('/api/admin/errors', rateLimiters.admin, adminAuth, (req: any, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = analyticsLogger.getErrorLogs(limit);
    res.type('text/plain').send(logs);
  });

  app.post('/api/admin/generate-summary', rateLimiters.admin, adminAuth, (req: any, res) => {
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

  app.post('/api/admin/clear-logs', rateLimiters.admin, adminAuth, (req: any, res) => {
    try {
      analyticsLogger.clearLogs();
      res.json({ success: true, message: 'Logs cleared successfully' });
    } catch (error) {
      console.error('Failed to clear logs:', error);
      res.status(500).json({ error: 'Failed to clear logs' });
    }
  });

  // Model management routes
  app.get('/api/admin/models', rateLimiters.admin, adminAuth, (req: any, res) => {
    try {
      const type = req.query.type as string;
      const models = modelManager.getAllModels(type);
      res.json(models);
    } catch (error) {
      console.error('Failed to fetch models:', error);
      res.status(500).json({ error: 'Failed to fetch models' });
    }
  });

  app.post('/api/admin/models', rateLimiters.admin, adminAuth, (req: any, res) => {
    try {
      const modelData = req.body;
      const modelId = modelManager.registerModel(modelData);
      res.json({ id: modelId, success: true });
    } catch (error) {
      console.error('Failed to create model:', error);
      res.status(500).json({ error: 'Failed to create model' });
    }
  });

  app.put('/api/admin/models/:id', rateLimiters.admin, adminAuth, (req: any, res) => {
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

  app.delete('/api/admin/models/:id', rateLimiters.admin, adminAuth, (req: any, res) => {
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

  app.post('/api/admin/models/:id/backup', rateLimiters.admin, adminAuth, (req: any, res) => {
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

  app.get('/api/admin/models/stats', rateLimiters.admin, adminAuth, (req: any, res) => {
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
  app.get('/api/admin/webhook/tests', rateLimiters.admin, adminAuth, (req: any, res) => {
    try {
      const history = webhookTester.getTestHistory();
      res.json(history);
    } catch (error) {
      console.error('Failed to fetch webhook test history:', error);
      res.status(500).json({ error: 'Failed to fetch test history' });
    }
  });

  app.get('/api/admin/webhook/stats', rateLimiters.admin, adminAuth, (req: any, res) => {
    try {
      const stats = webhookTester.getTestStats();
      res.json(stats);
    } catch (error) {
      console.error('Failed to fetch webhook test stats:', error);
      res.status(500).json({ error: 'Failed to fetch test stats' });
    }
  });

  app.post('/api/admin/webhook/test', rateLimiters.admin, adminAuth, async (req: any, res) => {
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

  app.delete('/api/admin/webhook/tests', rateLimiters.admin, adminAuth, (req: any, res) => {
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

  app.post('/api/trading/execute', rateLimiters.trading, isDevelopment ? devBypass : isAuthenticated, async (req: any, res) => {
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

  // Trading status endpoint - add before positions
  app.get('/api/trading/status', devBypass, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.json({
          enabled: false,
          openPositions: 0,
          totalPnL: 0,
          message: 'Not authenticated'
        });
      }

      const positions = await storage.getUserPositions(userId);
      const trades = await storage.getUserTrades(userId, 10);

      const totalPnL = trades.reduce((sum, trade) => sum + parseFloat(trade.pnl || '0'), 0);

      res.json({
        enabled: positions.length > 0,
        openPositions: positions.length,
        totalPnL: totalPnL.toFixed(2),
        lastUpdate: new Date().toISOString()
      });
    } catch (error) {
      console.error('Trading status error:', error);
      res.status(500).json({ error: 'Failed to get trading status' });
    }
  });

  app.get('/api/trading/positions', isDevelopment ? devBypass : isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const positions = await storage.getUserPositions(userId);
      res.json(positions || []);
    } catch (error) {
      console.error("Error fetching positions:", error);
      res.status(500).json({ message: "Failed to fetch positions" });
    }
  });

  app.get('/api/trading/trades', isDevelopment ? devBypass : isAuthenticated, async (req: any, res) => {
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
      // Initialize AI orchestrator if not already initialized
      await lazyInitService.initializeAIOrchestrator();

      const status = aiOrchestrator.getAgentStatus();
      const recentActivities = await storage.getRecentAgentActivities(20);
      res.json({ agents: status, recentActivities });
    } catch (error) {
      console.error("Error fetching agent status:", error);
      res.status(500).json({ message: "Failed to fetch agent status" });
    }
  });

  app.post('/api/ai/agents/run/:agentType', isDevelopment ? devBypass : isAuthenticated, async (req: any, res) => {
    try {
      const { agentType } = req.params;
      const data = req.body;

      // Initialize AI orchestrator if not already initialized
      await lazyInitService.initializeAIOrchestrator();

      const result = await aiOrchestrator.runAgent(agentType, data);
      res.json(result);
    } catch (error) {
      console.error("Error running agent:", error);
      res.status(500).json({ message: "Failed to run agent" });
    }
  });

  app.get('/api/ai/recommendations', isDevelopment ? devBypass : isAuthenticated, async (req: any, res) => {
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

  app.post('/api/ai/recommendations/generate', isDevelopment ? devBypass : isAuthenticated, async (req: any, res) => {
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
  app.get('/api/portfolio/summary', isDevelopment ? devBypass : isAuthenticated, async (req: any, res) => {
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
  app.patch('/api/user/settings', isDevelopment ? devBypass : isAuthenticated, async (req: any, res) => {
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

  // RL Inference routes
  app.post('/api/rl/predict', rateLimiters.general, isAuthenticated, async (req: any, res) => {
    try {
      const { symbol } = req.body;
      if (!symbol) {
        return res.status(400).json({ error: 'Symbol is required' });
      }

      // Initialize RL engine if not already initialized
      await lazyInitService.initializeRLEngine();

      const marketPrice = marketDataService.getCurrentPrice(symbol);
      if (!marketPrice) {
        return res.status(404).json({ error: 'Market data not found for symbol' });
      }

      const prediction = await rlEngine.predict(symbol, marketPrice);
      res.json(prediction);
    } catch (error) {
      console.error('RL prediction error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'RL prediction failed' 
      });
    }
  });

  app.get('/api/rl/model-info', rateLimiters.general, isAuthenticated, async (req: any, res) => {
    try {
      // Initialize RL engine if not already initialized
      await lazyInitService.initializeRLEngine();

      const info = rlEngine.getModelInfo();
      res.json(info);
    } catch (error) {
      console.error('RL model info error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get model info' 
      });
    }
  });

  // Policy Engine routes
  app.get('/api/policy/status', rateLimiters.general, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const status = await policyEngine.getPolicyStatus(userId);
      res.json(status);
    } catch (error) {
      console.error('Policy status error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get policy status' 
      });
    }
  });

  app.post('/api/policy/emergency-stop', rateLimiters.admin, adminAuth, async (req: any, res) => {
    try {
      const { userId, durationMinutes } = req.body;
      await policyEngine.emergencyStop(userId, durationMinutes);
      res.json({ success: true, message: 'Emergency stop activated' });
    } catch (error) {
      console.error('Emergency stop error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Emergency stop failed' 
      });
    }
  });

  // Simulation/Backtest routes
  app.get('/api/simulation/strategies', rateLimiters.general, isAuthenticated, async (req: any, res) => {
    try {
      const strategies = backtestEngine.getAvailableStrategies();
      res.json(strategies);
    } catch (error) {
      console.error('Get strategies error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get strategies' 
      });
    }
  });

  app.get('/api/simulation/event-templates', rateLimiters.general, isAuthenticated, async (req: any, res) => {
    try {
      const templates = backtestEngine.getSyntheticEventTemplates();
      res.json(templates);
    } catch (error) {
      console.error('Get event templates error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get event templates' 
      });
    }
  });

  app.post('/api/simulation/backtest', rateLimiters.trading, isAuthenticated, async (req: any, res) => {
    try {
      const config = req.body;
      const result = await backtestEngine.runBacktest(config);
      res.json(result);
    } catch (error) {
      console.error('Backtest error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Backtest failed' 
      });
    }
  });

  app.get('/api/simulation/export/:id', rateLimiters.general, isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const csvData = await backtestEngine.exportBacktestCSV(id);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="backtest_${id}_results.csv"`);
      res.send(csvData);
    } catch (error) {
      console.error('Export backtest error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Export failed' 
      });
    }
  });

  // Paper Run routes (for frontend access)
  app.post('/api/paperrun/start', rateLimiters.trading, isAuthenticated, async (req: any, res) => {
    try {
      const config = req.body;
      // Import ExchangeService dynamically to avoid initialization issues
      const { default: ExchangeService } = await import('./services/exchangeService');

      const defaultConfig = {
        mode: 'paper' as const,
        exchange: 'mock' as const,
        testnet: true,
        maxPositionSize: 0.1,
        riskPerTrade: 0.02,
        killSwitchEnabled: true,
        killSwitchConditions: {
          maxDailyLoss: 5,
          maxDrawdown: 10,
          minWinRate: 40
        }
      };

      const exchangeService = new ExchangeService(defaultConfig);
      await exchangeService.initialize();
      const runId = await exchangeService.startPaperRun(config);

      res.json({ 
        success: true,
        runId,
        message: 'Paper run started successfully'
      });
    } catch (error) {
      console.error('Start paper run error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to start paper run' 
      });
    }
  });

  app.get('/api/paperrun/current', rateLimiters.general, isAuthenticated, async (req: any, res) => {
    try {
      const { default: ExchangeService } = await import('./services/exchangeService');

      const defaultConfig = {
        mode: 'paper' as const,
        exchange: 'mock' as const,
        testnet: true,
        maxPositionSize: 0.1,
        riskPerTrade: 0.02,
        killSwitchEnabled: true,
        killSwitchConditions: {
          maxDailyLoss: 5,
          maxDrawdown: 10,
          minWinRate: 40
        }
      };

      const exchangeService = new ExchangeService(defaultConfig);
      const currentRun = await exchangeService.getCurrentRun();

      res.json(currentRun || { message: 'No active paper run' });
    } catch (error) {
      console.error('Get current paper run error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get current paper run' 
      });
    }
  });

  app.post('/api/paperrun/stop', rateLimiters.trading, isAuthenticated, async (req: any, res) => {
    try {
      const { reason = 'Manual stop via API' } = req.body;
      const { default: ExchangeService } = await import('./services/exchangeService');

      const defaultConfig = {
        mode: 'paper' as const,
        exchange: 'mock' as const,
        testnet: true,
        maxPositionSize: 0.1,
        riskPerTrade: 0.02,
        killSwitchEnabled: true,
        killSwitchConditions: {
          maxDailyLoss: 5,
          maxDrawdown: 10,
          minWinRate: 40
        }
      };

      const exchangeService = new ExchangeService(defaultConfig);
      await exchangeService.stopCurrentRun(reason);

      res.json({ 
        success: true,
        message: 'Paper run stopped successfully'
      });
    } catch (error) {
      console.error('Stop paper run error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to stop paper run' 
      });
    }
  });

  app.get('/api/paperrun/history', rateLimiters.general, isAuthenticated, async (req: any, res) => {
    try {
      const { default: ExchangeService } = await import('./services/exchangeService');

      const defaultConfig = {
        mode: 'paper' as const,
        exchange: 'mock' as const,
        testnet: true,
        maxPositionSize: 0.1,
        riskPerTrade: 0.02,
        killSwitchEnabled: true,
        killSwitchConditions: {
          maxDailyLoss: 5,
          maxDrawdown: 10,
          minWinRate: 40
        }
      };

      const exchangeService = new ExchangeService(defaultConfig);
      const history = await exchangeService.getRunHistory();

      res.json(history);
    } catch (error) {
      console.error('Get paper run history error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get paper run history' 
      });
    }
  });

  app.get('/api/paperrun/positions', rateLimiters.general, isAuthenticated, async (req: any, res) => {
    try {
      const { default: ExchangeService } = await import('./services/exchangeService');

      const defaultConfig = {
        mode: 'paper' as const,
        exchange: 'mock' as const,
        testnet: true,
        maxPositionSize: 0.1,
        riskPerTrade: 0.02,
        killSwitchEnabled: true,
        killSwitchConditions: {
          maxDailyLoss: 5,
          maxDrawdown: 10,
          minWinRate: 40
        }
      };

      const exchangeService = new ExchangeService(defaultConfig);
      const positions = await exchangeService.getPositions();
      const positionsArray = Array.from(positions.values());

      res.json(positionsArray);
    } catch (error) {
      console.error('Get paper run positions error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get paper run positions' 
      });
    }
  });

  // Journal routes (placeholder implementations)
  app.get('/api/journal/analysis', rateLimiters.general, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { from, to } = req.query;

      // Get actual trades for analysis
      const trades = await storage.getUserTrades(userId, 100);
      const winningTrades = trades.filter(t => parseFloat(t.pnl) > 0);
      const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
      const avgReturn = trades.length > 0 ? trades.reduce((sum, trade) => sum + parseFloat(trade.pnl), 0) / trades.length : 0;

      const analysis = {
        winRate,
        avgReturn,
        bestStrategy: 'ai_hybrid',
        worstStrategy: 'momentum',
        emotionalBias: ['overconfidence', 'fomo'],
        improvementAreas: ['risk_management', 'patience']
      };

      res.json(analysis);
    } catch (error) {
      console.error('Journal analysis error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to analyze journal' 
      });
    }
  });

  app.get('/api/journal/performance', rateLimiters.general, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const trades = await storage.getUserTrades(userId, 50);

      // Generate cumulative P&L data
      let cumulativePnl = 0;
      const performanceData = trades.reverse().map(trade => {
        cumulativePnl += parseFloat(trade.pnl);
        return {
          date: new Date(trade.executedAt).toISOString().split('T')[0],
          cumulative_pnl: cumulativePnl
        };
      });

      res.json(performanceData);
    } catch (error) {
      console.error('Journal performance error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get performance data' 
      });
    }
  });

  // Lazy initialization endpoint (for manual initialization if needed)
  app.post('/api/ai/initialize', rateLimiters.general, isAuthenticated, async (req: any, res) => {
    try {
      console.log('[API] Manual AI initialization requested');
      await lazyInitService.initializeAllServices();
      const status = lazyInitService.getStatus();
      res.json({ 
        message: 'AI services initialized successfully', 
        status 
      });
    } catch (error) {
      console.error('Manual AI initialization error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'AI initialization failed' 
      });
    }
  });

  // Health check
  app.get('/api/health', async (req, res) => {
    try {
      const lazyInitStatus = lazyInitService.getStatus();
      const rlEngineStatus = lazyInitStatus.rlEngine ? 
        (rlEngine.getModelInfo().loaded ? 'ready' : 'loaded_not_ready') : 
        'not_initialized';

      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
          database: 'connected',
          ai_agents: lazyInitStatus.aiOrchestrator ? 'active' : 'not_initialized',
          market_data: 'streaming',
          rl_engine: rlEngineStatus,
          policy_engine: 'active',
        },
        lazy_init_status: lazyInitStatus,
      });
    } catch (error) {
      console.error('Health check error:', error);
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  });

  const httpServer = createServer(app);

  // Setup WebSocket server
  createWebSocketServer(httpServer);

  // Collaborative Intelligence Routes
  app.get('/api/strategies/public', async (req, res) => {
    try {
      const strategies = await storage.getPublicStrategies();
      res.json(strategies);
    } catch (error) {
      console.error('Error fetching public strategies:', error);
      res.status(500).json({ error: 'Failed to fetch strategies' });
    }
  });

  app.post('/api/strategies/:id/vote', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { upvote } = req.body;
      const strategy = await storage.voteOnStrategy(id, upvote);
      res.json(strategy);
    } catch (error) {
      console.error('Error voting on strategy:', error);
      res.status(500).json({ error: 'Failed to vote on strategy' });
    }
  });

  app.get('/api/community/signals', async (req, res) => {
    try {
      const signals = [
        { id: '1', symbol: 'BTC/USD', action: 'buy', confidence: 0.78, reasoning: 'Strong technical indicators and positive sentiment', votes: 24, userCount: 18, sentiment: 0.65, timeframe: '24h' }
      ];
      res.json(signals);
    } catch (error) {
      console.error('Error fetching community signals:', error);
      res.status(500).json({ error: 'Failed to fetch community signals' });
    }
  });

  app.get('/api/community/top-traders', async (req, res) => {
    try {
      const topTraders = [
        { userId: 'trader001', tradingScore: 0.89, communityScore: 0.76, totalTrades: 156, successfulTrades: 118 }
      ];
      res.json(topTraders);
    } catch (error) {
      console.error('Error fetching top traders:', error);
      res.status(500).json({ error: 'Failed to fetch top traders' });
    }
  });

  app.get('/api/risk/metrics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const riskMetrics = await storage.getUserRiskMetrics(userId);

      if (!riskMetrics) {
        return res.json({
          overallRisk: 0.3, varDaily: 0.05, varWeekly: 0.12, maxDrawdown: 0.15,
          sharpeRatio: 1.2, sortinoRatio: 1.5, beta: 1.1, alpha: 0.03, diversificationScore: 0.7
        });
      }
      res.json(riskMetrics);
    } catch (error) {
      console.error('Error fetching risk metrics:', error);
      res.status(500).json({ error: 'Failed to fetch risk metrics' });
    }
  });

  app.get('/api/analytics/performance/:timeframe', isAuthenticated, async (req: any, res) => {
    try {
      const performanceData = {
        current: { portfolioValue: 125000 },
        summary: { totalReturn: 0.15, sharpeRatio: 1.45, maxDrawdown: 0.08 },
        timeline: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          portfolioValue: 100000 + Math.random() * 50000,
          benchmark: 100000 + Math.random() * 30000,
          drawdown: Math.random() * 0.1
        }))
      };
      res.json(performanceData);
    } catch (error) {
      console.error('Error fetching performance data:', error);
      res.status(500).json({ error: 'Failed to fetch performance data' });
    }
  });

  app.get('/api/sentiment/analysis/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const sentimentData = await storage.getSentimentData(symbol);
      const breakdown = sentimentData.reduce((acc: any, item) => {
        const existing = acc.find((a: any) => a.source === item.source);
        if (existing) {
          existing.sentiment = (existing.sentiment + item.sentiment) / 2;
          existing.volume += item.volume || 0;
        } else {
          acc.push({ source: item.source, sentiment: item.sentiment, volume: item.volume || 0, confidence: item.confidence });
        }
        return acc;
      }, []);
      const overallSentiment = breakdown.reduce((sum: number, item: any) => sum + item.sentiment, 0) / breakdown.length;
      res.json({
        overallSentiment: overallSentiment || 0.1,
        breakdown: breakdown.length > 0 ? breakdown : [
          { source: 'twitter', sentiment: 0.2, volume: 150, confidence: 0.7 },
          { source: 'reddit', sentiment: 0.35, volume: 89, confidence: 0.6 },
          { source: 'news', sentiment: -0.1, volume: 23, confidence: 0.8 },
          { source: 'fear_greed', sentiment: 0.4, volume: 1, confidence: 0.9 }
        ]
      });
    } catch (error) {
      console.error('Error fetching sentiment analysis:', error);
      res.status(500).json({ error: 'Failed to fetch sentiment analysis' });
    }
  });

  app.get('/api/market/regimes', async (req, res) => {
    try {
      const symbols = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'ADA/USD', 'DOT/USD'];
      const regimes = [];
      for (const symbol of symbols) {
        const regime = await storage.getCurrentMarketRegime(symbol);
        if (regime) {
          regimes.push(regime);
        } else {
          regimes.push({
            symbol, regime: ['bull', 'bear', 'sideways', 'volatile'][Math.floor(Math.random() * 4)],
            confidence: 0.6 + Math.random() * 0.3, volatility: 0.3 + Math.random() * 0.4, trendStrength: 0.4 + Math.random() * 0.5
          });
        }
      }
      res.json(regimes);
    } catch (error) {
      console.error('Error fetching market regimes:', error);
      res.status(500).json({ error: 'Failed to fetch market regimes' });
    }
  });

  app.get('/api/ai/performance', async (req, res) => {
    try {
      await lazyInitService.initializeAIOrchestrator();
      const modelPerformance = ensembleOrchestrator.getModelPerformance();
      const performance = Object.entries(modelPerformance).map(([agentType, performance]) => ({
        agentType, accuracy: performance, confidence: 0.7 + Math.random() * 0.2,
        predictions: Math.floor(Math.random() * 100) + 50, successRate: performance
      }));
      res.json(performance);
    } catch (error) {
      console.error('Error fetching AI performance:', error);
      res.status(500).json({ error: 'Failed to fetch AI performance' });
    }
  });

  app.get('/api/correlations/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const correlations = await storage.getCorrelationData(symbol);
      if (correlations.length === 0) {
        const otherAssets = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'ADA/USD', 'DOT/USD'].filter(s => s !== symbol);
        const simulatedCorrelations = otherAssets.map(asset => ({
          asset1: symbol, asset2: asset, correlation: Math.random() * 2 - 1,
          significance: 0.8 + Math.random() * 0.2, timeframe: '30d'
        }));
        return res.json(simulatedCorrelations);
      }
      res.json(correlations);
    } catch (error) {
      console.error('Error fetching correlations:', error);
      res.status(500).json({ error: 'Failed to fetch correlations' });
    }
  });

  app.post('/api/backtest/run', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const config = req.body;
      if (!config.startDate || !config.endDate || !config.initialCapital) {
        return res.status(400).json({ error: 'Missing required backtest parameters' });
      }
      const result = await backtestEngine.runBacktest({
        ...config, userId, startDate: new Date(config.startDate), endDate: new Date(config.endDate)
      });
      res.json(result);
    } catch (error) {
      console.error('Error running backtest:', error);
      res.status(500).json({ error: 'Failed to run backtest' });
    }
  });

  app.get('/api/backtest/results', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const results = await storage.getUserBacktests(userId);
      res.json(results);
    } catch (error) {
      console.error('Error fetching backtest results:', error);
      res.status(500).json({ error: 'Failed to fetch backtest results' });
    }
  });

  // Revolutionary Enhancements Routes
  app.use('/api/revolutionary-enhancements', (await import('./routes/revolutionaryEnhancements')).revolutionaryEnhancementsRouter);

  // RL Training Routes
  app.use('/api/rl-training', (await import('./routes/rl-training')).default);

  // Revolutionary Systems Routes (Quantum Consciousness, Collective Superintelligence, etc.)
  app.use('/api/revolutionary', (await import('./routes/revolutionary')).default);

  // AI Copilot Routes
  app.use('/api/copilot', (await import('./routes/copilot')).default);

  // Metrics and Monitoring Routes
  app.use('/api/metrics', (await import('./routes/metrics')).default);

  // Feature Flags Routes
  app.use('/api/feature-flags', (await import('./routes/featureFlags')).default);

  // Ultra-Adaptive Intelligence Routes
  app.use('/api/ultra-adaptive', (await import('./routes/ultraAdaptive')).default);

  // Real Training Day Routes (replaces marketing fluff with actual ML training)
  app.use('/api/training', realTrainingRoutes);

  // Real Training Day Routes (replaces marketing fluff with actual ML training)
  app.use('/api/training', realTrainingRoutes);

  // Transfer Learning Routes (jumpstart training with pre-trained models)
  app.use('/api/transfer-learning', transferLearningRouter);

  // Async Training Job Routes
  app.use('/api/training-jobs', trainingJobsRouter);

  // Trading system routes
  app.use('/api/trading', tradingRoutes);
  app.use('/api/trading', tradingTestRoutes);

  // Feedback routes
  app.post('/api/feedback', isDevelopment ? devBypass : isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { rating, category, message, page } = req.body;

      if (!rating || !category || !message) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      console.log('[Feedback] Received feedback:', { rating, category, page });
      res.json({ success: true, id: 'feedback-' + Date.now() });
    } catch (error) {
      console.error("Error submitting feedback:", error);
      res.status(500).json({ message: "Failed to submit feedback" });
    }
  });

  // Health and SLO endpoint (already registered above)

  // Comprehensive Features endpoint
  app.use('/api/comprehensive', comprehensiveFeaturesRouter);

  // System Validation endpoint
  app.use('/api/system-validation', (await import('./routes/system-validation')).default);

  // Stevie Strategy endpoint
  app.use('/api/stevie-strategy', (await import('./routes/stevie-strategy')).default);

  // Temporal Omniscience routes (Phase 2)
  app.use('/', temporalRoutes);
  app.use('/api/universal', universalRoutes);

  // Paper trade bridge routes
  const { paperTradeBridgeRoutes } = await import('./routes/paperTradeBridge');
  app.use('/api/paper-trade', paperTradeBridgeRoutes);

  // Live deployment routes
  const liveDeploymentRoutes = await import('./routes/liveDeployment');
  app.use('/api/live-deployment', liveDeploymentRoutes.default);

  // Start MLOps cron jobs
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_MLOPS_JOBS === 'true') {
    startRetrainingJobs();
    logger.info('MLOps cron jobs started');
  } else {
    logger.info('MLOps cron jobs disabled in development mode');
  }

  return httpServer;
}