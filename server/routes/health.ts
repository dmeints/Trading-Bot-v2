
import { Router } from 'express';
import { strategyRouter } from '../services/StrategyRouter.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        router: strategyRouter.getStatus(),
        database: 'active',
        websocket: 'active'
      }
    };
    
    res.json(health);
  } catch (error) {
    logger.error('[Health] Error checking health:', error);
    res.status(500).json({ 
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

export default router;
