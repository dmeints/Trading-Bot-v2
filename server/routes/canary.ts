
import { Router } from 'express';
import { Canary } from '../services/Canary';
import { logger } from '../utils/logger';

const router = Router();
const canary = Canary.getInstance();

// Get canary state
router.get('/state', (req, res) => {
  try {
    const status = canary.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('[Canary] Get state error:', error);
    res.status(500).json({ error: 'Failed to get canary state' });
  }
});

// Set canary state
router.post('/state', (req, res) => {
  try {
    const { state } = req.body;
    
    if (!['disabled', 'canary', 'partial', 'live'].includes(state)) {
      return res.status(400).json({ error: 'Invalid state' });
    }

    const success = canary.setState(state);
    if (success) {
      res.json({ success: true, newState: state });
    } else {
      res.status(500).json({ error: 'Failed to set state' });
    }
  } catch (error) {
    logger.error('[Canary] Set state error:', error);
    res.status(500).json({ error: 'Failed to set canary state' });
  }
});

export default router;
