
import { Router } from 'express';
import { RiskGuards } from '../services/RiskGuards';
import { logger } from '../utils/logger';

const router = Router();
const riskGuards = RiskGuards.getInstance();

// Get guard state
router.get('/state', (req, res) => {
  try {
    const state = riskGuards.getState();
    res.json(state);
  } catch (error) {
    logger.error('[Guards] Get state error:', error);
    res.status(500).json({ error: 'Failed to get guard state' });
  }
});

// Reset guards (dev/admin only)
router.post('/reset', (req, res) => {
  try {
    riskGuards.reset();
    res.json({ success: true, message: 'Guards reset' });
  } catch (error) {
    logger.error('[Guards] Reset error:', error);
    res.status(500).json({ error: 'Failed to reset guards' });
  }
});

export default router;
