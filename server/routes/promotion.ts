
import { Router } from 'express';
import { promotionService } from '../services/promotion.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.get('/status', (req, res) => {
  try {
    const status = promotionService.getStatus();
    const champion = promotionService.getChampion();
    res.json({ policies: status, champion });
  } catch (error) {
    logger.error('[Promotion] Get status error:', error);
    res.status(500).json({ error: 'Failed to get promotion status' });
  }
});

router.post('/evaluate/:challengerId', (req, res) => {
  try {
    const { challengerId } = req.params;
    const result = promotionService.evaluatePromotion(challengerId);
    res.json(result);
  } catch (error) {
    logger.error('[Promotion] Evaluate error:', error);
    res.status(500).json({ error: 'Failed to evaluate promotion' });
  }
});

router.post('/simulate/:policyId', (req, res) => {
  try {
    const { policyId } = req.params;
    const { count = 100, performance = 'neutral' } = req.body;
    promotionService.simulatePolicyReturns(policyId, count, performance);
    res.json({ success: true, policyId, count, performance });
  } catch (error) {
    logger.error('[Promotion] Simulate error:', error);
    res.status(500).json({ error: 'Failed to simulate returns' });
  }
});

export default router;
