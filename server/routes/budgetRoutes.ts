
/**
 * Budget Routes - API cost and rate limit management
 */

import { Router } from 'express';
import { budgeter } from '../services/Budgeter';
import { logger } from '../utils/logger';

const router = Router();

// Get budget status
router.get('/status', (req, res) => {
  try {
    const status = budgeter.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('[BudgetRoutes] Failed to get status:', error);
    res.status(500).json({ error: 'Failed to get budget status' });
  }
});

// Get specific provider status
router.get('/status/:provider', (req, res) => {
  try {
    const { provider } = req.params;
    const status = budgeter.getProviderStatus(provider);
    
    if (!status) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    
    res.json(status);
  } catch (error) {
    logger.error('[BudgetRoutes] Failed to get provider status:', error);
    res.status(500).json({ error: 'Failed to get provider status' });
  }
});

// Update provider limits (admin only)
router.post('/limits/:provider', (req, res) => {
  try {
    const { provider } = req.params;
    const updates = req.body;
    
    budgeter.updateLimits(provider, updates);
    res.json({ success: true });
  } catch (error) {
    logger.error('[BudgetRoutes] Failed to update limits:', error);
    res.status(500).json({ error: 'Failed to update limits' });
  }
});

export { router as budgetRoutes };
