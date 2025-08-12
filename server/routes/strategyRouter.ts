
import { Router, Request, Response } from 'express';
import { strategyRouter, Context } from '../services/StrategyRouter.js';
import { logger } from '../utils/logger.js';

const router = Router();

// POST /api/router/choose
router.post('/choose', async (req: Request, res: Response) => {
  try {
    const context: Context = req.body.context || {};
    const result = strategyRouter.choose(context);
    
    res.json(result);
  } catch (error) {
    logger.error('[StrategyRouter] Choose error:', { error: String(error) });
    res.status(500).json({ error: 'Failed to choose strategy' });
  }
});

// POST /api/router/update
router.post('/update', async (req: Request, res: Response) => {
  try {
    const { policyId, reward, context } = req.body;
    
    if (!policyId || typeof reward !== 'number') {
      return res.status(400).json({ error: 'policyId and reward are required' });
    }
    
    const posterior = strategyRouter.update(policyId, reward, context || {});
    
    res.json({
      policyId,
      posterior: {
        mean: posterior.mean,
        variance: posterior.variance,
        alpha: posterior.alpha,
        beta: posterior.beta,
        updateCount: posterior.updateCount
      }
    });
  } catch (error) {
    logger.error('[StrategyRouter] Update error:', { error: String(error) });
    res.status(500).json({ error: 'Failed to update strategy' });
  }
});

export default router;
