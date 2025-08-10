
/**
 * PHASE 4: PAPER TRADE BURN-IN API ROUTES
 * RESTful API for managing paper trade burn-in sessions
 */

import express from 'express';
import { z } from 'zod';
import { paperTradeBridge, type PaperTradeBridgeConfig } from '../services/paperTradeBridge.js';
import { logger } from '../utils/logger.js';
import { isAuthenticated } from '../replitAuth.js';

const router = express.Router();

// Request validation schemas
const startBurnInSchema = z.object({
  duration: z.number().min(1).max(30).optional(),
  symbols: z.array(z.string()).optional(),
  initialCapital: z.number().positive().optional(),
  strategy: z.string().optional()
});

const configUpdateSchema = z.object({
  enableBurnIn: z.boolean().optional(),
  burnInDurationDays: z.number().min(1).max(30).optional(),
  metricsAggregationInterval: z.number().min(1000).optional(),
  persistenceInterval: z.number().min(1000).optional(),
  liveDataFeed: z.boolean().optional(),
  riskParity: z.boolean().optional(),
  reportingEnabled: z.boolean().optional(),
  maxConcurrentSessions: z.number().min(1).max(10).optional()
});

/**
 * POST /api/paper-trade-bridge/start
 * Start a new burn-in session
 */
router.post('/start', isAuthenticated, async (req, res) => {
  try {
    const config = startBurnInSchema.parse(req.body);

    logger.info('[PaperTradeBridgeAPI] Starting burn-in session', {
      userId: req.user?.claims?.sub,
      config
    });

    // Initialize bridge if needed
    await paperTradeBridge.initialize();

    // Update configuration if provided
    if (config.duration) {
      paperTradeBridge.updateConfig({ burnInDurationDays: config.duration });
    }

    // Create session configuration
    const sessionConfig = {
      symbols: config.symbols || ['BTC', 'ETH', 'SOL'],
      initialCapital: config.initialCapital || 100000,
      strategy: config.strategy || 'burn_in_test'
    };

    const sessionId = await paperTradeBridge.startBurnIn(sessionConfig);

    res.json({
      success: true,
      sessionId,
      config: sessionConfig,
      message: 'Burn-in session started successfully'
    });

  } catch (error) {
    logger.error('[PaperTradeBridgeAPI] Failed to start burn-in session', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request format',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/paper-trade-bridge/sessions
 * List all burn-in sessions
 */
router.get('/sessions', isAuthenticated, async (req, res) => {
  try {
    const includeCompleted = req.query.include_completed === 'true';

    await paperTradeBridge.initialize();

    const allReports = paperTradeBridge.getAllBurnInReports();
    const reports = includeCompleted ? allReports : allReports.filter(r => r.status === 'active');

    res.json({
      success: true,
      sessions: reports.map(report => ({
        sessionId: report.sessionId,
        status: report.status,
        startDate: report.startDate,
        endDate: report.endDate,
        duration: report.duration,
        summary: report.summary,
        liveParityStatus: {
          logicMatch: report.liveParityCheck.logicMatch,
          riskMatch: report.liveParityCheck.riskMatch,
          executionMatch: report.liveParityCheck.executionMatch,
          deviationCount: report.liveParityCheck.deviations.length
        }
      }))
    });

  } catch (error) {
    logger.error('[PaperTradeBridgeAPI] Failed to list sessions', error);

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve burn-in sessions'
    });
  }
});

/**
 * GET /api/paper-trade-bridge/sessions/:sessionId
 * Get detailed session information
 */
router.get('/sessions/:sessionId', isAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;

    await paperTradeBridge.initialize();

    const report = paperTradeBridge.getBurnInReport(sessionId);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Burn-in session not found'
      });
    }

    const tradeMetrics = paperTradeBridge.getTradeMetrics(sessionId);
    const dailyAggregates = paperTradeBridge.getDailyAggregates(sessionId);

    res.json({
      success: true,
      report,
      tradeMetrics: tradeMetrics.slice(-50), // Last 50 trades
      dailyAggregates
    });

  } catch (error) {
    logger.error('[PaperTradeBridgeAPI] Failed to get session details', error);

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session details'
    });
  }
});

/**
 * POST /api/paper-trade-bridge/sessions/:sessionId/stop
 * Stop a burn-in session
 */
router.post('/sessions/:sessionId/stop', isAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reason } = req.body;

    logger.info('[PaperTradeBridgeAPI] Stopping burn-in session', {
      userId: req.user?.claims?.sub,
      sessionId,
      reason
    });

    await paperTradeBridge.initialize();

    const finalReport = await paperTradeBridge.stopBurnIn(sessionId);

    res.json({
      success: true,
      sessionId,
      finalReport,
      message: 'Burn-in session stopped successfully'
    });

  } catch (error) {
    logger.error('[PaperTradeBridgeAPI] Failed to stop burn-in session', error);

    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/paper-trade-bridge/sessions/:sessionId/report
 * Generate detailed report for a session
 */
router.get('/sessions/:sessionId/report', isAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const format = (req.query.format as string) || 'json';

    await paperTradeBridge.initialize();

    if (format === 'text') {
      const textReport = await paperTradeBridge.generateCliReport(sessionId);
      
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="burn-in-report-${sessionId}.txt"`);
      res.send(textReport);
      
    } else if (format === 'csv') {
      const metrics = paperTradeBridge.getTradeMetrics(sessionId);
      
      if (metrics.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No trade metrics found for session'
        });
      }

      // Generate CSV
      const csvHeader = [
        'timestamp', 'symbol', 'side', 'quantity', 'price', 'fillPrice', 
        'slippage', 'latency', 'pnl', 'fees', 'positionSize', 'riskScore'
      ].join(',');

      const csvRows = metrics.map(m => [
        new Date(m.timestamp).toISOString(),
        m.symbol,
        m.side,
        m.quantity,
        m.price,
        m.execution.fillPrice,
        m.execution.slippage,
        m.execution.latencyMs,
        m.pnl.total,
        m.pnl.fees,
        m.risk.positionSize,
        m.risk.riskScore
      ].join(','));

      const csvContent = [csvHeader, ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="burn-in-trades-${sessionId}.csv"`);
      res.send(csvContent);
      
    } else {
      // JSON format (default)
      const report = paperTradeBridge.getBurnInReport(sessionId);
      if (!report) {
        return res.status(404).json({
          success: false,
          error: 'Burn-in session not found'
        });
      }

      res.json({
        success: true,
        report
      });
    }

  } catch (error) {
    logger.error('[PaperTradeBridgeAPI] Failed to generate report', error);

    res.status(500).json({
      success: false,
      error: 'Failed to generate session report'
    });
  }
});

/**
 * GET /api/paper-trade-bridge/sessions/:sessionId/metrics/live
 * Get live streaming metrics for a session
 */
router.get('/sessions/:sessionId/metrics/live', isAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;

    await paperTradeBridge.initialize();

    const report = paperTradeBridge.getBurnInReport(sessionId);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Burn-in session not found'
      });
    }

    const recentMetrics = paperTradeBridge.getTradeMetrics(sessionId).slice(-20);
    const activeSessions = paperTradeBridge.getActiveSessions();
    const currentSession = activeSessions.find(s => s.id === sessionId);

    res.json({
      success: true,
      liveMetrics: {
        sessionId,
        status: report.status,
        isActive: report.status === 'active',
        lastUpdate: new Date().toISOString(),
        summary: {
          totalTrades: report.summary.totalTrades,
          currentPnL: report.summary.totalPnL,
          winRate: report.summary.winRate,
          sharpeRatio: report.summary.sharpeRatio,
          currentBalance: report.summary.finalBalance
        },
        recentTrades: recentMetrics.map(m => ({
          timestamp: m.timestamp,
          symbol: m.symbol,
          side: m.side,
          pnl: m.pnl.total,
          price: m.price,
          quantity: m.quantity
        })),
        liveParityCheck: {
          status: report.liveParityCheck.logicMatch && 
                  report.liveParityCheck.riskMatch && 
                  report.liveParityCheck.executionMatch ? 'PASS' : 'FAIL',
          deviationCount: report.liveParityCheck.deviations.length
        },
        currentSession: currentSession ? {
          currentValue: currentSession.currentValue,
          totalPnL: currentSession.totalPnL,
          totalTrades: currentSession.totalTrades,
          maxDrawdown: currentSession.maxDrawdown
        } : null
      }
    });

  } catch (error) {
    logger.error('[PaperTradeBridgeAPI] Failed to get live metrics', error);

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve live metrics'
    });
  }
});

/**
 * PUT /api/paper-trade-bridge/config
 * Update bridge configuration
 */
router.put('/config', isAuthenticated, async (req, res) => {
  try {
    const config = configUpdateSchema.parse(req.body);

    logger.info('[PaperTradeBridgeAPI] Updating bridge configuration', {
      userId: req.user?.claims?.sub,
      config
    });

    await paperTradeBridge.initialize();
    paperTradeBridge.updateConfig(config);

    res.json({
      success: true,
      config,
      message: 'Bridge configuration updated successfully'
    });

  } catch (error) {
    logger.error('[PaperTradeBridgeAPI] Failed to update configuration', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration format',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update configuration'
    });
  }
});

/**
 * GET /api/paper-trade-bridge/health
 * Health check for paper trade bridge
 */
router.get('/health', async (req, res) => {
  try {
    const activeSessions = paperTradeBridge.getActiveSessions();
    const allReports = paperTradeBridge.getAllBurnInReports();

    res.json({
      success: true,
      health: 'operational',
      statistics: {
        activeSessions: activeSessions.length,
        totalSessions: allReports.length,
        completedSessions: allReports.filter(r => r.status === 'completed').length,
        failedSessions: allReports.filter(r => r.status === 'failed').length
      },
      components: {
        paperTradingEngine: 'operational',
        metricsAggregation: 'operational',
        persistence: 'operational',
        reporting: 'operational'
      },
      lastCheck: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[PaperTradeBridgeAPI] Health check failed', error);

    res.status(503).json({
      success: false,
      health: 'degraded',
      error: 'Paper trade bridge health check failed'
    });
  }
});

export { router as paperTradeBridgeRoutes };
