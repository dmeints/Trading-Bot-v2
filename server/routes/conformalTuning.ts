
/**
 * Conformal Prediction Tuning API Routes
 * Endpoints for hyperparameter optimization and validation
 */

import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { CoarseGridSearch } from '../tuning/coarse_grid_search';
import { OptunaOptimizer } from '../tuning/optuna_optimizer';
import { WalkForwardValidator } from '../tuning/walkforward_validator';

const router = Router();

// Schemas
const gridSearchSchema = z.object({
  trainingData: z.array(z.object({
    features: z.array(z.number()),
    actualReturn: z.number(),
    timestamp: z.string().transform(str => new Date(str))
  })),
  validationData: z.array(z.object({
    features: z.array(z.number()),
    actualReturn: z.number(),
    timestamp: z.string().transform(str => new Date(str))
  })),
  config: z.object({
    alphaRange: z.array(z.number()).optional(),
    windowSizeRange: z.array(z.number()).optional(),
    kernelBandwidthRange: z.array(z.number()).optional(),
    minSamplesRange: z.array(z.number()).optional(),
    maxIterations: z.number().optional(),
    convergenceThreshold: z.number().optional()
  }).optional()
});

const optunaSchema = z.object({
  trainingData: z.array(z.object({
    features: z.array(z.number()),
    actualReturn: z.number(),
    timestamp: z.string().transform(str => new Date(str))
  })),
  validationData: z.array(z.object({
    features: z.array(z.number()),
    actualReturn: z.number(),
    timestamp: z.string().transform(str => new Date(str))
  })),
  config: z.object({
    nTrials: z.number().optional(),
    timeout: z.number().optional(),
    sampler: z.enum(['TPESampler', 'RandomSampler', 'CmaEsSampler']).optional(),
    pruner: z.enum(['MedianPruner', 'PatientPruner', 'NopPruner']).optional()
  }).optional()
});

const walkForwardSchema = z.object({
  conformalParams: z.object({
    alpha: z.number(),
    windowSize: z.number(),
    kernelBandwidth: z.number(),
    minSamples: z.number()
  }),
  historicalData: z.array(z.object({
    features: z.array(z.number()),
    actualReturn: z.number(),
    timestamp: z.string().transform(str => new Date(str))
  })),
  config: z.object({
    windowSize: z.number().optional(),
    stepSize: z.number().optional(),
    minTrainingPeriods: z.number().optional(),
    maxValidationPeriods: z.number().optional()
  }).optional()
});

/**
 * POST /api/conformal-tuning/grid-search
 * Run coarse grid search optimization
 */
router.post('/grid-search', async (req, res) => {
  try {
    const { trainingData, validationData, config } = gridSearchSchema.parse(req.body);
    
    logger.info('[ConformalTuning] Starting grid search', {
      trainingSize: trainingData.length,
      validationSize: validationData.length
    });
    
    const gridSearch = new CoarseGridSearch(config);
    const result = await gridSearch.runSearch(trainingData, validationData);
    
    res.json({
      success: true,
      result,
      statistics: gridSearch.getSearchStatistics()
    });
    
  } catch (error) {
    logger.error('[ConformalTuning] Grid search failed', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Grid search optimization failed'
    });
  }
});

/**
 * POST /api/conformal-tuning/optuna
 * Run Optuna Bayesian optimization
 */
router.post('/optuna', async (req, res) => {
  try {
    const { trainingData, validationData, config } = optunaSchema.parse(req.body);
    
    logger.info('[ConformalTuning] Starting Optuna optimization', {
      trainingSize: trainingData.length,
      validationSize: validationData.length,
      nTrials: config?.nTrials || 100
    });
    
    const optimizer = new OptunaOptimizer(config);
    const result = await optimizer.optimize(trainingData, validationData);
    
    res.json({
      success: true,
      result
    });
    
  } catch (error) {
    logger.error('[ConformalTuning] Optuna optimization failed', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Optuna optimization failed'
    });
  }
});

/**
 * POST /api/conformal-tuning/walk-forward
 * Run walk-forward validation with stress testing
 */
router.post('/walk-forward', async (req, res) => {
  try {
    const { conformalParams, historicalData, config } = walkForwardSchema.parse(req.body);
    
    logger.info('[ConformalTuning] Starting walk-forward validation', {
      dataSize: historicalData.length,
      conformalParams
    });
    
    const validator = new WalkForwardValidator(config);
    const result = await validator.validate(conformalParams, historicalData);
    
    res.json({
      success: true,
      result
    });
    
  } catch (error) {
    logger.error('[ConformalTuning] Walk-forward validation failed', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Walk-forward validation failed'
    });
  }
});

/**
 * GET /api/conformal-tuning/recommendations
 * Get optimization recommendations based on historical results
 */
router.get('/recommendations', async (req, res) => {
  try {
    // This would typically load from database
    const historicalResults = []; // Placeholder
    
    const optimizer = new OptunaOptimizer();
    const recommendations = await optimizer.getOptimizationRecommendations(historicalResults);
    
    res.json({
      success: true,
      recommendations
    });
    
  } catch (error) {
    logger.error('[ConformalTuning] Failed to get recommendations', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get recommendations'
    });
  }
});

/**
 * GET /api/conformal-tuning/status
 * Get current tuning pipeline status
 */
router.get('/status', async (req, res) => {
  try {
    // Check if optimization tools are available
    const status = {
      gridSearchAvailable: true,
      optunaAvailable: process.platform !== 'win32', // Python dependency
      walkForwardAvailable: true,
      lastOptimization: null, // Would load from database
      currentlyRunning: false,
      queuedJobs: 0
    };
    
    res.json({
      success: true,
      status
    });
    
  } catch (error) {
    logger.error('[ConformalTuning] Failed to get status', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get tuning status'
    });
  }
});

/**
 * POST /api/conformal-tuning/validate-config
 * Validate conformal prediction configuration
 */
router.post('/validate-config', async (req, res) => {
  try {
    const config = req.body;
    
    const validation = {
      valid: true,
      warnings: [],
      errors: [],
      suggestions: []
    };
    
    // Validate alpha
    if (config.alpha < 0.01 || config.alpha > 0.5) {
      validation.errors.push('Alpha should be between 0.01 and 0.5');
      validation.valid = false;
    }
    
    // Validate window size
    if (config.windowSize < 50) {
      validation.warnings.push('Window size below 50 may lead to unstable calibration');
    }
    
    if (config.windowSize > 2000) {
      validation.warnings.push('Large window size may slow down updates');
    }
    
    // Validate kernel bandwidth
    if (config.kernelBandwidth < 0.001 || config.kernelBandwidth > 1.0) {
      validation.warnings.push('Kernel bandwidth outside typical range [0.001, 1.0]');
    }
    
    // Add suggestions
    if (config.alpha > 0.2) {
      validation.suggestions.push('Consider lower alpha for tighter intervals');
    }
    
    if (!config.adaptiveAlpha) {
      validation.suggestions.push('Enable adaptive alpha for better market regime handling');
    }
    
    res.json({
      success: true,
      validation
    });
    
  } catch (error) {
    logger.error('[ConformalTuning] Config validation failed', error);
    
    res.status(500).json({
      success: false,
      error: 'Configuration validation failed'
    });
  }
});

export default router;
