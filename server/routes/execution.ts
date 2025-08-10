/**
 * Phase J - Real-Time Execution Integration API Routes
 */

import express from 'express';
import { z } from "zod";
import { executionRouter, type OrderRequest } from "../services/ExecutionRouter";
import { logger } from "../utils/logger";
import { isAuthenticated } from "../replitAuth";

const router = express.Router();

// Request validation schemas
const orderRequestSchema = z.object({
  symbol: z.string().min(1),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.number().positive(),
  targetPrice: z.number().positive().optional(),
  maxSlippage: z.number().min(0).max(1), // 0-100%
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH'])
});

const executionStatusSchema = z.object({
  symbol: z.string().min(1)
});

/**
 * POST /api/execution/route
 * Route order execution based on market conditions
 */
router.post('/route', isAuthenticated, async (req, res) => {
  try {
    const request = orderRequestSchema.parse(req.body);

    logger.info('[ExecutionAPI] Processing execution routing request', {
      userId: req.user?.claims?.sub,
      symbol: request.symbol,
      side: request.side,
      quantity: request.quantity
    });

    const decision = await executionRouter.routeExecution(request);

    res.json({
      success: true,
      decision,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[ExecutionAPI] Execution routing failed', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request format',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to route execution'
    });
  }
});

/**
 * GET /api/execution/status/:symbol
 * Get current execution status for a symbol
 */
router.get('/status/:symbol', isAuthenticated, async (req, res) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Symbol parameter required'
      });
    }

    const status = await executionRouter.getExecutionStatus(symbol);

    res.json({
      success: true,
      status,
      symbol: symbol.toUpperCase()
    });

  } catch (error) {
    logger.error('[ExecutionAPI] Status check failed', error);

    res.status(500).json({
      success: false,
      error: 'Failed to get execution status'
    });
  }
});

/**
 * POST /api/execution/analyze
 * Analyze execution options for multiple scenarios
 */
router.post('/analyze', isAuthenticated, async (req, res) => {
  try {
    const baseRequest = orderRequestSchema.parse(req.body);

    // Analyze all three urgency levels
    const scenarios = await Promise.all([
      executionRouter.routeExecution({ ...baseRequest, urgency: 'LOW' }),
      executionRouter.routeExecution({ ...baseRequest, urgency: 'MEDIUM' }),
      executionRouter.routeExecution({ ...baseRequest, urgency: 'HIGH' })
    ]);

    const analysis = {
      low_urgency: scenarios[0],
      medium_urgency: scenarios[1],
      high_urgency: scenarios[2],
      recommendation: scenarios.reduce((best, current) => 
        current.expectedFillProbability > best.expectedFillProbability ? current : best
      )
    };

    res.json({
      success: true,
      analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[ExecutionAPI] Analysis failed', error);

    res.status(500).json({
      success: false,
      error: 'Failed to analyze execution scenarios'
    });
  }
});

/**
 * GET /api/execution/health
 * Health check for execution router
 */
router.get('/health', async (req, res) => {
  try {
    // Test with a common symbol
    const testStatus = await executionRouter.getExecutionStatus('BTCUSDT');

    res.json({
      success: true,
      health: 'operational',
      last_check: testStatus.lastUpdate,
      components: {
        router: 'operational',
        market_analysis: 'operational',
        risk_assessment: 'operational'
      }
    });

  } catch (error) {
    logger.error('[ExecutionAPI] Health check failed', error);

    res.status(503).json({
      success: false,
      health: 'degraded',
      error: 'Execution router health check failed'
    });
  }
});

// POST /api/execution/decide - Get execution recommendation
router.post('/decide', async (req, res) => {
  try {
    const { symbol, orderSize, side, urgency = 'medium' } = req.body;

    // Mock market data for now - in production, fetch from live feed
    const marketData = {
      bid: 50000,
      ask: 50010,
      bidSize: 1.5,
      askSize: 2.0,
      lastPrice: 50005,
      volume24h: 15000
    };

    const context = {
      symbol,
      orderSize,
      side,
      urgency,
      marketData
    };

    const decision = executionRouter.decideExecution(context);

    res.json(decision);
  } catch (error) {
    console.error('Execution decision error:', error);
    res.status(500).json({ error: 'Failed to generate execution decision' });
  }
});

export { router as executionRoutes };