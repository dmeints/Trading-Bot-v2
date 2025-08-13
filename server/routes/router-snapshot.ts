
/**
 * Router Snapshot API Routes
 */

import { Router } from 'express';
import { strategyRouter } from '../services/StrategyRouter';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/router/snapshot
 * Get last router decision and feature vector
 */
router.get('/snapshot', (req, res) => {
  try {
    const snapshot = strategyRouter.getSnapshot();
    
    if (!snapshot) {
      return res.status(404).json({ error: 'No router decisions found' });
    }
    
    res.json({
      decision: snapshot,
      sampledScores: {
        chosen: snapshot.strategy,
        expectedReturn: snapshot.expectedReturn,
        confidence: snapshot.confidence
      },
      featureVector: snapshot.featureVector,
      alphaSignal: snapshot.alphaSignal,
      timestamp: snapshot.timestamp
    });

  } catch (error) {
    logger.error('[Router] Error getting snapshot:', error);
    res.status(500).json({ error: 'Failed to get router snapshot' });
  }
});

/**
 * POST /api/router/choose
 * Make a routing decision (for testing)
 */
router.post('/choose', async (req, res) => {
  try {
    const { context } = req.body;
    
    if (!context || !context.symbol) {
      return res.status(400).json({ error: 'Missing context or symbol' });
    }

    // Enrich context with default values if missing
    const fullContext = {
      symbol: context.symbol,
      price: context.price || 50000,
      volume: context.volume || 100,
      timestamp: new Date(),
      ...context // Override with provided values
    };

    const choice = await strategyRouter.choose(fullContext);
    res.json(choice);

  } catch (error) {
    logger.error('[Router] Error making choice:', error);
    res.status(500).json({ error: 'Failed to make routing choice' });
  }
});

export default router;
