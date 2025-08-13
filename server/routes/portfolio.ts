
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
