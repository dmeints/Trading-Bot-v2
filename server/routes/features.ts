/**
 * Features API Route
 * Unified endpoint for all feature calculations
 */

import { Router } from "express";
import { z } from "zod";
import { calculateUnifiedFeatures } from "../features";
import { logger } from "../utils/logger";

const router = Router();

// Request validation schema
const featuresQuerySchema = z.object({
  symbol: z.string().min(1).max(20),
  from: z.string().datetime(),
  to: z.string().datetime(),
  tf: z.string().optional().default('5m')
});

/**
 * GET /api/features
 * Calculate unified features for a symbol and time range
 */
router.get('/', async (req, res) => {
  try {
    const { symbol, from, to, tf } = featuresQuerySchema.parse(req.query);
    
    const fromTs = new Date(from);
    const toTs = new Date(to);
    
    logger.info('[FeaturesAPI] Calculating unified features', {
      symbol,
      from: fromTs.toISOString(),
      to: toTs.toISOString(),
      timeframe: tf
    });

    const features = await calculateUnifiedFeatures(symbol, fromTs, toTs, tf);
    
    res.json({
      success: true,
      ...features
    });

  } catch (error) {
    logger.error('[FeaturesAPI] Feature calculation failed', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to calculate features'
    });
  }
});

export default router;