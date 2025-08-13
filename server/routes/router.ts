
import { Router } from 'express';
import { strategyRouter } from '../services/StrategyRouter.js';
import { ContextSchema, UpdateRequestSchema } from '../contracts/routerIO.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/router/choose
 * Choose policy using Bayesian Thompson Sampling
 */
router.post('/choose', (req, res) => {
  try {
    const context = ContextSchema.parse(req.body.context || req.body || {});
    
    const choice = strategyRouter.choose(context);
    
    res.json({
      policyId: choice.policyId,
      score: choice.score,
      explorationBonus: choice.explorationBonus,
      confidence: choice.confidence
    });
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
    const { policyId, reward, context } = UpdateRequestSchema.parse(req.body);
    
    const posterior = strategyRouter.update(policyId, reward, context);
    
    res.json({
      success: true,
      policyId,
      posterior: {
        alpha: posterior.alpha,
        beta: posterior.beta,
        count: posterior.count,
        mean: posterior.mean,
        variance: posterior.variance,
        updateCount: posterior.updateCount
      }
    });
  } catch (error) {
    logger.error('[RouterRoutes] Error updating policy:', error);
    res.status(500).json({ error: 'Failed to update policy' });
  }
});

/**
 * GET /api/router/policies
 * Get all policies and their posteriors
 */
router.get('/policies', (req, res) => {
  try {
    const policies = Object.fromEntries(strategyRouter.getPolicies());
    res.json(policies);
  } catch (error) {
    logger.error('[RouterRoutes] Error getting policies:', error);
    res.status(500).json({ error: 'Failed to get policies' });
  }
});

export default router;
