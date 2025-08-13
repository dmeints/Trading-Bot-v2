
import { Router } from 'express';
import { bocpdDetector } from '../services/regime/bo_cpd.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.get('/state', (req, res) => {
  try {
    const state = bocpdDetector.getCurrentRegime();
    res.json(state);
  } catch (error) {
    logger.error('[Regime] Get state error:', error);
    res.status(500).json({ error: 'Failed to get regime state' });
  }
});

router.post('/update', (req, res) => {
  try {
    const { returnValue } = req.body;
    if (typeof returnValue !== 'number') {
      return res.status(400).json({ error: 'returnValue must be a number' });
    }
    
    const state = bocpdDetector.updateWithReturn(returnValue);
    res.json(state);
  } catch (error) {
    logger.error('[Regime] Update error:', error);
    res.status(500).json({ error: 'Failed to update regime' });
  }
});

export default router;
