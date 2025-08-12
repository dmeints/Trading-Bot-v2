
import { Router } from 'express';
import { StrategyRouter } from '../services/StrategyRouter';
import { logger } from '../utils/logger';

const router = Router();

// Get router snapshot for dashboard
router.get('/snapshot', (req, res) => {
  try {
    const strategyRouter = new StrategyRouter();
    
    // Mock context for snapshot
    const context = {
      regime: 'bull',
      vol: 0.02,
      trend: 0.1,
      funding: 0.0001,
      sentiment: 0.3
    };

    const choice = strategyRouter.choose(context);
    const policies = strategyRouter.getPolicies();
    
    // Get policy details
    const policy = policies.get(choice.policyId);
    
    const snapshot = {
      policyId: choice.policyId,
      score: choice.score,
      explorationBonus: choice.explorationBonus,
      confidence: policy ? 1 / (1 + policy.variance) : 0.5, // Convert variance to confidence
      policies: Array.from(policies.entries()).map(([id, policy]) => ({
        id,
        mean: policy.mean,
        variance: policy.variance,
        updateCount: policy.updateCount
      }))
    };

    res.json(snapshot);
  } catch (error) {
    logger.error('[RouterSnapshot] Error:', error);
    res.status(500).json({ error: 'Failed to get router snapshot' });
  }
});

export default router;
