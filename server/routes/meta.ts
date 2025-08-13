
import { Router } from 'express';
import { metaMonitor } from '../services/MetaMonitor.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.get('/quality', (req, res) => {
  try {
    const quality = metaMonitor.getQuality();
    res.json(quality);
  } catch (error) {
    logger.error('[MetaMonitor] Get quality error:', error);
    res.status(500).json({ error: 'Failed to get quality metrics' });
  }
});

router.post('/apply-nudges', (req, res) => {
  try {
    const nudges = metaMonitor.generateNudges();
    metaMonitor.applyNudges(nudges);
    res.json(nudges);
  } catch (error) {
    logger.error('[MetaMonitor] Apply nudges error:', error);
    res.status(500).json({ error: 'Failed to apply nudges' });
  }
});

router.post('/simulate', (req, res) => {
  try {
    metaMonitor.simulateData();
    res.json({ success: true, message: 'Simulated 100 prediction/outcome pairs' });
  } catch (error) {
    logger.error('[MetaMonitor] Simulate error:', error);
    res.status(500).json({ error: 'Failed to simulate data' });
  }
});

export default router;
