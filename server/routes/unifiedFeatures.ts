/**
 * Unified Features API Routes
 * Consolidated endpoint for all advanced feature calculations
 */

import { Router } from 'express';
import { calculateUnifiedFeatures } from '../features';
import { addProvenance } from '../middleware/provenanceGuard';
import { rateLimiters } from '../middleware/rateLimiter';
import { z } from 'zod';

const router = Router();

const featureRequestSchema = z.object({
  symbol: z.string().min(1),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  timeframe: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).default('5m')
});

/**
 * GET /api/features/unified - Get all unified features for a symbol
 */
router.get('/unified', rateLimiters.features, async (req, res) => {
  try {
    const params = featureRequestSchema.parse({
      symbol: req.query.symbol,
      startTime: req.query.startTime,
      endTime: req.query.endTime,
      timeframe: req.query.timeframe
    });
    
    const endTime = params.endTime ? new Date(params.endTime) : new Date();
    const startTime = params.startTime ? new Date(params.startTime) : new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
    
    console.log(`[Features] Calculating unified features for ${params.symbol} from ${startTime.toISOString()} to ${endTime.toISOString()}`);
    
    const features = await calculateUnifiedFeatures(params.symbol, startTime, endTime, params.timeframe);
    
    res.json(addProvenance(features, 'computation', `unified_features_${params.symbol}`));
    
  } catch (error: any) {
    console.error('[Features] Unified calculation error:', error);
    res.status(500).json(addProvenance({
      error: 'Feature calculation failed',
      message: error.message
    }, 'computation'));
  }
});

/**
 * GET /api/features/microstructure - Get microstructure features
 */
router.get('/microstructure', rateLimiters.features, async (req, res) => {
  try {
    const params = featureRequestSchema.parse(req.query);
    const endTime = params.endTime ? new Date(params.endTime) : new Date();
    const startTime = params.startTime ? new Date(params.startTime) : new Date(endTime.getTime() - 60 * 60 * 1000);
    
    const features = await calculateUnifiedFeatures(params.symbol, startTime, endTime);
    
    res.json(addProvenance({
      symbol: params.symbol,
      timeframe: params.timeframe,
      microstructure: features.micro,
      timestamp: endTime.toISOString()
    }, 'computation', `microstructure_${params.symbol}`));
    
  } catch (error: any) {
    console.error('[Features] Microstructure error:', error);
    res.status(500).json(addProvenance({
      error: 'Microstructure calculation failed',
      message: error.message
    }, 'computation'));
  }
});

/**
 * GET /api/features/regime - Get regime detection features
 */
router.get('/regime', rateLimiters.features, async (req, res) => {
  try {
    const params = featureRequestSchema.parse(req.query);
    const endTime = params.endTime ? new Date(params.endTime) : new Date();
    const startTime = params.startTime ? new Date(params.startTime) : new Date(endTime.getTime() - 4 * 60 * 60 * 1000);
    
    const features = await calculateUnifiedFeatures(params.symbol, startTime, endTime);
    
    res.json(addProvenance({
      symbol: params.symbol,
      timeframe: params.timeframe,
      regime: features.regime,
      timestamp: endTime.toISOString()
    }, 'computation', `regime_${params.symbol}`));
    
  } catch (error: any) {
    console.error('[Features] Regime error:', error);
    res.status(500).json(addProvenance({
      error: 'Regime calculation failed',
      message: error.message
    }, 'computation'));
  }
});

/**
 * GET /api/features/social - Get social sentiment features
 */
router.get('/social', rateLimiters.features, async (req, res) => {
  try {
    const params = featureRequestSchema.parse(req.query);
    const endTime = params.endTime ? new Date(params.endTime) : new Date();
    const startTime = params.startTime ? new Date(params.startTime) : new Date(endTime.getTime() - 2 * 60 * 60 * 1000);
    
    const features = await calculateUnifiedFeatures(params.symbol, startTime, endTime);
    
    res.json(addProvenance({
      symbol: params.symbol,
      social: features.social,
      timestamp: endTime.toISOString()
    }, 'computation', `social_${params.symbol}`));
    
  } catch (error: any) {
    console.error('[Features] Social error:', error);
    res.status(500).json(addProvenance({
      error: 'Social sentiment calculation failed',
      message: error.message
    }, 'computation'));
  }
});

/**
 * GET /api/features/onchain - Get on-chain features
 */
router.get('/onchain', rateLimiters.features, async (req, res) => {
  try {
    const params = featureRequestSchema.parse(req.query);
    const endTime = params.endTime ? new Date(params.endTime) : new Date();
    const startTime = params.startTime ? new Date(params.startTime) : new Date(endTime.getTime() - 2 * 60 * 60 * 1000);
    
    const features = await calculateUnifiedFeatures(params.symbol, startTime, endTime);
    
    res.json(addProvenance({
      symbol: params.symbol,
      onchain: features.onchain,
      timestamp: endTime.toISOString()
    }, 'computation', `onchain_${params.symbol}`));
    
  } catch (error: any) {
    console.error('[Features] On-chain error:', error);
    res.status(500).json(addProvenance({
      error: 'On-chain calculation failed',
      message: error.message
    }, 'computation'));
  }
});

/**
 * GET /api/features/macro - Get macro economic features
 */
router.get('/macro', rateLimiters.features, async (req, res) => {
  try {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
    
    const features = await calculateUnifiedFeatures('BTC/USD', startTime, endTime);
    
    res.json(addProvenance({
      macro: features.macro,
      timestamp: endTime.toISOString()
    }, 'computation', 'macro_features'));
    
  } catch (error: any) {
    console.error('[Features] Macro error:', error);
    res.status(500).json(addProvenance({
      error: 'Macro calculation failed',
      message: error.message
    }, 'computation'));
  }
});

/**
 * POST /api/features/batch - Calculate features for multiple symbols
 */
router.post('/batch', rateLimiters.features, async (req, res) => {
  try {
    const { symbols, timeframe = '5m' } = req.body;
    
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json(addProvenance({
        error: 'Invalid request',
        message: 'symbols must be a non-empty array'
      }, 'computation'));
    }
    
    if (symbols.length > 10) {
      return res.status(400).json(addProvenance({
        error: 'Too many symbols',
        message: 'Maximum 10 symbols per batch request'
      }, 'computation'));
    }
    
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 2 * 60 * 60 * 1000);
    
    console.log(`[Features] Batch calculation for ${symbols.length} symbols`);
    
    const results = await Promise.allSettled(
      symbols.map(symbol => calculateUnifiedFeatures(symbol, startTime, endTime, timeframe))
    );
    
    const batchResults = symbols.map((symbol, index) => {
      const result = results[index];
      if (result.status === 'fulfilled') {
        return {
          symbol,
          success: true,
          features: result.value
        };
      } else {
        return {
          symbol,
          success: false,
          error: result.reason.message || 'Unknown error'
        };
      }
    });
    
    const successCount = batchResults.filter(r => r.success).length;
    console.log(`[Features] Batch completed: ${successCount}/${symbols.length} successful`);
    
    res.json(addProvenance({
      results: batchResults,
      summary: {
        total: symbols.length,
        successful: successCount,
        failed: symbols.length - successCount
      },
      timestamp: endTime.toISOString()
    }, 'computation', `batch_features_${symbols.join('_')}`));
    
  } catch (error: any) {
    console.error('[Features] Batch error:', error);
    res.status(500).json(addProvenance({
      error: 'Batch calculation failed',
      message: error.message
    }, 'computation'));
  }
});

export default router;