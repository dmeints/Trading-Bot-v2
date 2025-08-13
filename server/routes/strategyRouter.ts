
import { Router } from 'express';
import { strategyRouter } from '../services/StrategyRouter.js';
import { ContextSchema, UpdateRequestSchema } from '../contracts/routerIO.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.post('/choose', (req, res) => {
  try {
    const context = ContextSchema.parse(req.body.context || req.body);
    const result = strategyRouter.choose(context);
    res.json(result);
  } catch (error) {
    logger.error('[StrategyRouter] Choose error:', error);
    res.status(400).json({ error: 'Invalid context' });
  }
});

router.post('/update', (req, res) => {
  try {
    const updateRequest = UpdateRequestSchema.parse(req.body);
    const result = strategyRouter.update(
      updateRequest.policyId,
      updateRequest.reward,
      updateRequest.context
    );
    res.json(result);
  } catch (error) {
    logger.error('[StrategyRouter] Update error:', error);
    res.status(400).json({ error: 'Invalid update request' });
  }
});

router.get('/policies', (req, res) => {
  const policies = Object.fromEntries(strategyRouter.getPolicies());
  res.json(policies);
});

export default router;
