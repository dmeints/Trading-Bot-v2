
/**
 * Strategy Router API Routes
 */

import { Router } from 'express';
import { strategyRouter, type RouterContext, type PolicyUpdate } from '../services/StrategyRouter.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/router/choose
 * Choose policy using Bayesian Thompson Sampling
 */
router.post('/choose', (req, res) => {
  try {
    const context: RouterContext = req.body.context || {};
    
    const choice = strategyRouter.choosePolicy(context);
    
    res.json(choice);
  } catch (error) {
    logger.error('[RouterRoutes] Error choosing policy:', error);
    res.status(500).json({ error: 'Failed to choose policy' });
  }
});

/**
 * POST /api/router/update
 * Update policy performance with reward
 */
router.post('/update', (req, res) => {
  try {
    const update: PolicyUpdate = req.body;
    
    if (!update.policyId || typeof update.reward !== 'number') {
      return res.status(400).json({ error: 'Missing policyId or reward' });
    }
    
    strategyRouter.updatePolicy(update);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('[RouterRoutes] Error updating policy:', error);
    res.status(500).json({ error: 'Failed to update policy' });
  }
});

/**
 * GET /api/router/snapshot
 * Get current router state
 */
router.get('/snapshot', (req, res) => {
  try {
    const snapshot = strategyRouter.getSnapshot();
    res.json(snapshot);
  } catch (error) {
    logger.error('[RouterRoutes] Error getting snapshot:', error);
    res.status(500).json({ error: 'Failed to get router snapshot' });
  }
});

export default router;
