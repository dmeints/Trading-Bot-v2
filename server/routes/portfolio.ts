
import { Router } from 'express';
import { portfolioOptimizer } from '../services/portfolio.js';
import { OptimizationRequestSchema } from '../contracts/portfolio.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.post('/optimize', (req, res) => {
  try {
    const request = OptimizationRequestSchema.parse(req.body);
    const result = portfolioOptimizer.optimize(request);
    res.json(result);
  } catch (error) {
    logger.error('[Portfolio] Optimize error:', error);
    res.status(400).json({ error: 'Invalid optimization request' });
  }
});

export default router;
