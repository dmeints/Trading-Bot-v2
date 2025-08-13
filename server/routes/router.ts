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
import { Router } from 'express';
import { strategyRouter } from '../services/StrategyRouter.js';

const router = Router();

// Choose policy based on context
router.post('/choose', (req, res) => {
  try {
    const { context } = req.body;
    
    if (!context || typeof context !== 'object') {
      return res.status(400).json({ error: 'Context object required' });
    }
    
    const choice = strategyRouter.choose(context);
    res.json(choice);
  } catch (error) {
    console.error('Router choice error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update policy with reward
router.post('/update', (req, res) => {
  try {
    const { policyId, reward, context } = req.body;
    
    if (!policyId || typeof reward !== 'number') {
      return res.status(400).json({ error: 'policyId and reward required' });
    }
    
    strategyRouter.update({
      policyId,
      reward,
      context: context || {},
      timestamp: Date.now()
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Router update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current snapshot
router.get('/snapshot', (req, res) => {
  try {
    const snapshot = strategyRouter.getSnapshot();
    res.json(snapshot);
  } catch (error) {
    console.error('Router snapshot error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as routerRouter };
