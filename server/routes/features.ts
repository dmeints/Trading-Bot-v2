
import { Router } from 'express';
import { featureStore } from '../services/featureStore/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.get('/ranking', (req, res) => {
  try {
    const ranking = featureStore.getRanking();
    res.json(ranking);
  } catch (error) {
    logger.error('[Features] Ranking error:', error);
    res.status(500).json({ error: 'Failed to get feature ranking' });
  }
});

router.post('/update-return', (req, res) => {
  try {
    const { returnValue } = req.body;
    if (typeof returnValue !== 'number') {
      return res.status(400).json({ error: 'returnValue must be a number' });
    }
    featureStore.updateReturn(returnValue);
    res.json({ success: true });
  } catch (error) {
    logger.error('[Features] Update return error:', error);
    res.status(500).json({ error: 'Failed to update return' });
  }
});

export default router;
