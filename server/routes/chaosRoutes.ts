
/**
 * Chaos Routes - Chaos injection for resilience testing
 */

import { Router } from 'express';
import { chaos } from '../services/Chaos';
import { logger } from '../utils/logger';

const router = Router();

// Inject chaos (dev only)
router.post('/inject', (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Chaos injection disabled in production' });
    }
    
    const { type, target, duration, parameters } = req.body;
    
    if (!type) {
      return res.status(400).json({ error: 'type required' });
    }
    
    const event = chaos.inject({
      type,
      target,
      duration,
      parameters
    });
    
    res.json(event);
  } catch (error) {
    logger.error('[ChaosRoutes] Failed to inject chaos:', error);
    res.status(500).json({ error: 'Failed to inject chaos' });
  }
});

// Get active chaos events
router.get('/active', (req, res) => {
  try {
    const events = chaos.getActiveEvents();
    res.json(events);
  } catch (error) {
    logger.error('[ChaosRoutes] Failed to get active events:', error);
    res.status(500).json({ error: 'Failed to get active events' });
  }
});

// Get chaos event history
router.get('/history', (req, res) => {
  try {
    const { limit } = req.query;
    const events = chaos.getEventHistory(parseInt(limit as string) || 50);
    res.json(events);
  } catch (error) {
    logger.error('[ChaosRoutes] Failed to get history:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// Force recover all chaos events
router.post('/recover-all', (req, res) => {
  try {
    chaos.forceRecoverAll();
    res.json({ success: true });
  } catch (error) {
    logger.error('[ChaosRoutes] Failed to recover all:', error);
    res.status(500).json({ error: 'Failed to recover all' });
  }
});

// Get system health
router.get('/health', (req, res) => {
  try {
    const health = chaos.getSystemHealth();
    res.json(health);
  } catch (error) {
    logger.error('[ChaosRoutes] Failed to get system health:', error);
    res.status(500).json({ error: 'Failed to get system health' });
  }
});

export { router as chaosRoutes };
