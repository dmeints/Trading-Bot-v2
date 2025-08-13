import { Router } from 'express';
import { strategyRouter } from '../services/StrategyRouter.js';
import { logger } from '../utils/logger.js';

const router = Router();

// POST /api/router/choose - Choose policy based on context
router.post('/choose', (req, res) => {
  try {
    const { context } = req.body;

    if (!context || typeof context !== 'object') {
      return res.status(400).json({ error: 'Context object required' });
    }

    const choice = strategyRouter.choose(context);

    res.json({
      policyId: choice.policyId,
      score: choice.score,
      explorationBonus: choice.explorationBonus,
      timestamp: choice.timestamp
    });
  } catch (error) {
    logger.error('Router choose error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/router/update - Update policy with reward
router.post('/update', (req, res) => {
  try {
    const { policyId, reward, context } = req.body;

    if (!policyId || typeof reward !== 'number' || !context) {
      return res.status(400).json({ error: 'policyId, reward, and context required' });
    }

    strategyRouter.update(policyId, reward, context);

    res.json({ success: true, updated: policyId });
  } catch (error) {
    logger.error('Router update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/router/snapshot - Get router state snapshot
router.get('/snapshot', (req, res) => {
  try {
    const snapshot = strategyRouter.getSnapshot();
    res.json(snapshot);
  } catch (error) {
    logger.error('Router snapshot error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;