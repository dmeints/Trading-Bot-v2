
import { Router } from 'express';
import { DataQuality } from '../services/DataQuality';
import { logger } from '../utils/logger';

const router = Router();
const dataQuality = DataQuality.getInstance();

// Get data quality stats
router.get('/stats', (req, res) => {
  try {
    const stats = dataQuality.getStats();
    res.json(stats);
  } catch (error) {
    logger.error('[DataQuality] Get stats error:', error);
    res.status(500).json({ error: 'Failed to get data quality stats' });
  }
});

// Get quarantined candles
router.get('/quarantined', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const quarantined = dataQuality.getQuarantinedCandles(limit);
    res.json(quarantined);
  } catch (error) {
    logger.error('[DataQuality] Get quarantined error:', error);
    res.status(500).json({ error: 'Failed to get quarantined candles' });
  }
});

// Reset data quality (dev only)
router.post('/reset', (req, res) => {
  try {
    dataQuality.reset();
    res.json({ success: true, message: 'Data quality stats reset' });
  } catch (error) {
    logger.error('[DataQuality] Reset error:', error);
    res.status(500).json({ error: 'Failed to reset data quality' });
  }
});

export default router;
