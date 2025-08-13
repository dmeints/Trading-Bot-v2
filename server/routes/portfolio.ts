
import express from 'express';
import { PortfolioOptimizer } from '../services/PortfolioOptimizer.js';

const router = express.Router();
const optimizer = new PortfolioOptimizer();

// POST /api/portfolio/optimize
router.post('/optimize', async (req, res) => {
  try {
    const { symbols, cvarBudget, volTarget } = req.body;
    const allocation = await optimizer.optimize(symbols, cvarBudget, volTarget);
    res.json(allocation);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export { router as portfolioRouter };
export default router;
import express from 'express';
import { portfolioOptimizer } from '../services/PortfolioOptimizer.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.post('/optimize', async (req, res) => {
  try {
    const { symbols, cvarBudget, volTarget } = req.body;
    
    if (!symbols || !Array.isArray(symbols) || !cvarBudget || !volTarget) {
      return res.status(400).json({
        error: 'Missing required fields: symbols, cvarBudget, volTarget'
      });
    }
    
    const constraints = {
      symbols,
      cvarBudget,
      volTarget,
      maxWeight: req.body.maxWeight,
      minWeight: req.body.minWeight
    };
    
    const result = await portfolioOptimizer.optimize(constraints);
    
    res.json({
      success: true,
      optimization: result,
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('Portfolio optimization error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: String(error)
    });
  }
});

export default router;
