
import { Router } from 'express';
import { counterfactuals } from '../services/Counterfactuals.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.get('/summary', (req, res) => {
  try {
    const summary = counterfactuals.getSummary();
    res.json(summary);
  } catch (error) {
    logger.error('[Counterfactuals] Get summary error:', error);
    res.status(500).json({ error: 'Failed to get counterfactual summary' });
  }
});

router.post('/simulate/:policyId', (req, res) => {
  try {
    const { policyId } = req.params;
    counterfactuals.simulateData(policyId);
    res.json({ success: true, policyId });
  } catch (error) {
    logger.error('[Counterfactuals] Simulate error:', error);
    res.status(500).json({ error: 'Failed to simulate counterfactual data' });
  }
});

export default router;
import express from 'express';
import { counterfactualLogger } from '../services/Counterfactuals.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.get('/summary', (req, res) => {
  try {
    const summary = counterfactualLogger.getSummary();
    res.json(summary);
  } catch (error) {
    logger.error('Error getting counterfactuals summary:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: String(error)
    });
  }
});

export default router;
