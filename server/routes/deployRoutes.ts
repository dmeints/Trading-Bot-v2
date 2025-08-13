
/**
 * Deploy Routes - Blue/green deployment management
 */

import { Router } from 'express';
import { blueGreen } from '../services/BlueGreen';
import { logger } from '../utils/logger';

const router = Router();

// Get deployment status
router.get('/status', (req, res) => {
  try {
    const status = blueGreen.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('[DeployRoutes] Failed to get status:', error);
    res.status(500).json({ error: 'Failed to get deployment status' });
  }
});

// Deploy candidate
router.post('/candidate', (req, res) => {
  try {
    const { stack } = req.body;
    
    if (!stack || !['blue', 'green'].includes(stack)) {
      return res.status(400).json({ error: 'stack must be blue or green' });
    }
    
    blueGreen.deployCandidate(stack);
    res.json({ success: true, stack });
  } catch (error) {
    logger.error('[DeployRoutes] Failed to deploy candidate:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to deploy candidate' });
  }
});

// Force rollback
router.post('/rollback', (req, res) => {
  try {
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ error: 'reason required' });
    }
    
    blueGreen.forceRollback(reason);
    res.json({ success: true, reason });
  } catch (error) {
    logger.error('[DeployRoutes] Failed to rollback:', error);
    res.status(500).json({ error: 'Failed to rollback' });
  }
});

// Update thresholds
router.post('/thresholds', (req, res) => {
  try {
    const updates = req.body;
    blueGreen.updateThresholds(updates);
    res.json({ success: true });
  } catch (error) {
    logger.error('[DeployRoutes] Failed to update thresholds:', error);
    res.status(500).json({ error: 'Failed to update thresholds' });
  }
});

export { router as deployRoutes };
