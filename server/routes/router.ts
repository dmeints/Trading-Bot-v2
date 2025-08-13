import express from 'express';
import { StrategyRouter } from '../services/StrategyRouter.js';

const router = express.Router();
const strategyRouter = new StrategyRouter();

// POST /api/router/choose - Choose strategy based on context
router.post('/choose', async (req, res) => {
  try {
    const { context } = req.body;
    const choice = await strategyRouter.choose(context);
    res.json(choice);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// POST /api/router/update - Update strategy with reward
router.post('/update', async (req, res) => {
  try {
    const { policyId, reward, context } = req.body;
    await strategyRouter.update(policyId, reward, context);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// GET /api/router/snapshot - Get current router state
router.get('/snapshot', async (req, res) => {
  try {
    const snapshot = await strategyRouter.snapshot();
    res.json(snapshot);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;