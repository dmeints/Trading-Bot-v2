
/**
 * Safe Promotion API Routes
 * Endpoints for shadow mode validation and gradual ramp-up
 */

import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { ShadowModeValidator, createShadowModeValidator } from '../services/shadowModeValidator';
import { PromotionGate, createPromotionGate } from '../services/promotionGate';

const router = Router();

// Global instances (in production, these would be properly managed)
let shadowValidator: ShadowModeValidator | null = null;
let promotionGate: PromotionGate | null = null;

// Schemas
const shadowConfigSchema = z.object({
  validationPeriodHours: z.number().min(1).max(168).optional(),
  requiredSamples: z.number().min(10).max(1000).optional(),
  performanceThresholds: z.object({
    minCoverage: z.number().min(0.5).max(1).optional(),
    maxCoverageGap: z.number().min(0).max(0.5).optional(),
    maxIntervalWidth: z.number().min(0).max(1).optional(),
    minSharpeRatio: z.number().min(0).max(10).optional(),
    maxDrawdown: z.number().min(0).max(1).optional()
  }).optional()
});

const promotionConfigSchema = z.object({
  initialNotional: z.number().min(0.001).max(0.1).optional(),
  maxNotional: z.number().min(0.01).max(0.5).optional(),
  rampUpSteps: z.array(z.number()).optional(),
  performanceGates: z.object({
    sharpeThreshold: z.number().optional(),
    winRateThreshold: z.number().min(0).max(1).optional(),
    maxDrawdownThreshold: z.number().min(0).max(1).optional(),
    minTradesPerStep: z.number().min(1).optional()
  }).optional()
});

const shadowTradeSchema = z.object({
  symbol: z.string(),
  features: z.array(z.number()),
  pointPrediction: z.number(),
  marketRegime: z.enum(['bull', 'bear', 'sideways', 'volatile']).optional()
});

const tradeOutcomeSchema = z.object({
  symbol: z.string(),
  timestamp: z.string().transform(str => new Date(str)),
  actualReturn: z.number()
});

const liveTradeSchema = z.object({
  symbol: z.string(),
  side: z.enum(['buy', 'sell']),
  notional: z.number(),
  pnl: z.number()
});

/**
 * POST /api/safe-promotion/shadow/start
 * Start shadow mode validation
 */
router.post('/shadow/start', async (req, res) => {
  try {
    const config = shadowConfigSchema.parse(req.body);
    
    if (shadowValidator?.getValidationStatus().isRunning) {
      return res.status(400).json({
        success: false,
        error: 'Shadow mode validation already running'
      });
    }
    
    shadowValidator = createShadowModeValidator(config);
    await shadowValidator.startValidation();
    
    logger.info('[SafePromotion] Shadow mode validation started');
    
    res.json({
      success: true,
      status: shadowValidator.getValidationStatus()
    });
    
  } catch (error) {
    logger.error('[SafePromotion] Failed to start shadow validation', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to start shadow mode validation'
    });
  }
});

/**
 * POST /api/safe-promotion/shadow/stop
 * Stop shadow mode validation
 */
router.post('/shadow/stop', async (req, res) => {
  try {
    if (!shadowValidator) {
      return res.status(400).json({
        success: false,
        error: 'No shadow mode validation running'
      });
    }
    
    shadowValidator.stopValidation();
    
    res.json({
      success: true,
      message: 'Shadow mode validation stopped'
    });
    
  } catch (error) {
    logger.error('[SafePromotion] Failed to stop shadow validation', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop shadow mode validation'
    });
  }
});

/**
 * POST /api/safe-promotion/shadow/trade
 * Process shadow trade
 */
router.post('/shadow/trade', async (req, res) => {
  try {
    const { symbol, features, pointPrediction, marketRegime } = shadowTradeSchema.parse(req.body);
    
    if (!shadowValidator || !shadowValidator.getValidationStatus().isRunning) {
      return res.status(400).json({
        success: false,
        error: 'Shadow mode validation not running'
      });
    }
    
    await shadowValidator.processShadowTrade(symbol, features, pointPrediction, marketRegime);
    
    res.json({
      success: true,
      status: shadowValidator.getValidationStatus()
    });
    
  } catch (error) {
    logger.error('[SafePromotion] Failed to process shadow trade', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid trade data',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to process shadow trade'
    });
  }
});

/**
 * POST /api/safe-promotion/shadow/outcome
 * Update shadow trade with actual outcome
 */
router.post('/shadow/outcome', async (req, res) => {
  try {
    const { symbol, timestamp, actualReturn } = tradeOutcomeSchema.parse(req.body);
    
    if (!shadowValidator) {
      return res.status(400).json({
        success: false,
        error: 'No shadow mode validator available'
      });
    }
    
    shadowValidator.updateShadowTradeOutcome(symbol, timestamp, actualReturn);
    
    res.json({
      success: true
    });
    
  } catch (error) {
    logger.error('[SafePromotion] Failed to update trade outcome', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid outcome data',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update trade outcome'
    });
  }
});

/**
 * GET /api/safe-promotion/shadow/result
 * Get shadow mode validation result
 */
router.get('/shadow/result', async (req, res) => {
  try {
    if (!shadowValidator) {
      return res.status(400).json({
        success: false,
        error: 'No shadow mode validator available'
      });
    }
    
    const result = await shadowValidator.generateValidationResult();
    
    res.json({
      success: true,
      result,
      status: shadowValidator.getValidationStatus()
    });
    
  } catch (error) {
    logger.error('[SafePromotion] Failed to get validation result', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get validation result'
    });
  }
});

/**
 * POST /api/safe-promotion/promotion/initialize
 * Initialize promotion after successful shadow mode
 */
router.post('/promotion/initialize', async (req, res) => {
  try {
    const config = promotionConfigSchema.parse(req.body);
    
    if (!shadowValidator) {
      return res.status(400).json({
        success: false,
        error: 'Shadow mode validation required before promotion'
      });
    }
    
    const shadowResult = await shadowValidator.generateValidationResult();
    
    promotionGate = createPromotionGate(config);
    const initialized = await promotionGate.initializePromotion(shadowResult);
    
    if (!initialized) {
      return res.status(400).json({
        success: false,
        error: 'Promotion initialization failed',
        shadowResult
      });
    }
    
    res.json({
      success: true,
      promotionStatus: promotionGate.getPromotionStatus(),
      shadowResult
    });
    
  } catch (error) {
    logger.error('[SafePromotion] Failed to initialize promotion', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid promotion configuration',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to initialize promotion'
    });
  }
});

/**
 * POST /api/safe-promotion/promotion/trade
 * Process live trade during promotion
 */
router.post('/promotion/trade', async (req, res) => {
  try {
    const { symbol, side, notional, pnl } = liveTradeSchema.parse(req.body);
    
    if (!promotionGate || !promotionGate.getPromotionStatus().isLive) {
      return res.status(400).json({
        success: false,
        error: 'Promotion not active'
      });
    }
    
    await promotionGate.processLiveTrade(symbol, side, notional, pnl);
    
    res.json({
      success: true,
      promotionStatus: promotionGate.getPromotionStatus()
    });
    
  } catch (error) {
    logger.error('[SafePromotion] Failed to process live trade', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid trade data',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to process live trade'
    });
  }
});

/**
 * GET /api/safe-promotion/promotion/status
 * Get current promotion status
 */
router.get('/promotion/status', async (req, res) => {
  try {
    if (!promotionGate) {
      return res.json({
        success: true,
        promotionStatus: {
          currentStep: 0,
          currentNotional: 0,
          isLive: false,
          canAdvance: false,
          needsRollback: false
        }
      });
    }
    
    const status = promotionGate.getPromotionStatus();
    const history = promotionGate.getPromotionHistory();
    
    res.json({
      success: true,
      promotionStatus: status,
      promotionHistory: history
    });
    
  } catch (error) {
    logger.error('[SafePromotion] Failed to get promotion status', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get promotion status'
    });
  }
});

/**
 * POST /api/safe-promotion/promotion/advance
 * Manually advance promotion step
 */
router.post('/promotion/advance', async (req, res) => {
  try {
    const { adminOverride = false } = req.body;
    
    if (!promotionGate) {
      return res.status(400).json({
        success: false,
        error: 'No promotion gate active'
      });
    }
    
    const advanced = await promotionGate.advanceStep(adminOverride);
    
    res.json({
      success: true,
      advanced,
      promotionStatus: promotionGate.getPromotionStatus()
    });
    
  } catch (error) {
    logger.error('[SafePromotion] Failed to advance promotion step', error);
    res.status(500).json({
      success: false,
      error: 'Failed to advance promotion step'
    });
  }
});

/**
 * POST /api/safe-promotion/promotion/rollback
 * Manually trigger rollback
 */
router.post('/promotion/rollback', async (req, res) => {
  try {
    const { reason = 'Manual rollback' } = req.body;
    
    if (!promotionGate) {
      return res.status(400).json({
        success: false,
        error: 'No promotion gate active'
      });
    }
    
    await promotionGate.triggerRollback(reason);
    
    res.json({
      success: true,
      promotionStatus: promotionGate.getPromotionStatus()
    });
    
  } catch (error) {
    logger.error('[SafePromotion] Failed to trigger rollback', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger rollback'
    });
  }
});

/**
 * POST /api/safe-promotion/promotion/stop
 * Stop live trading and return to shadow mode
 */
router.post('/promotion/stop', async (req, res) => {
  try {
    if (!promotionGate) {
      return res.status(400).json({
        success: false,
        error: 'No promotion gate active'
      });
    }
    
    promotionGate.stopLiveTrading();
    
    res.json({
      success: true,
      message: 'Live trading stopped - returned to shadow mode',
      promotionStatus: promotionGate.getPromotionStatus()
    });
    
  } catch (error) {
    logger.error('[SafePromotion] Failed to stop live trading', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop live trading'
    });
  }
});

/**
 * GET /api/safe-promotion/status
 * Get overall safe promotion system status
 */
router.get('/status', async (req, res) => {
  try {
    const shadowStatus = shadowValidator?.getValidationStatus() || null;
    const promotionStatus = promotionGate?.getPromotionStatus() || null;
    
    res.json({
      success: true,
      system: {
        shadowMode: {
          available: true,
          active: shadowStatus?.isRunning || false,
          status: shadowStatus
        },
        promotion: {
          available: true,
          active: promotionStatus?.isLive || false,
          status: promotionStatus
        }
      }
    });
    
  } catch (error) {
    logger.error('[SafePromotion] Failed to get system status', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system status'
    });
  }
});

export default router;
