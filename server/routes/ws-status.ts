
import { Router } from 'express';
import { WebSocketStatus } from '../services/WebSocketStatus';
import { logger } from '../utils/logger';

const router = Router();
const wsStatus = WebSocketStatus.getInstance();

// Get WebSocket status
router.get('/status', (req, res) => {
  try {
    const status = wsStatus.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('[WSStatus] Get status error:', error);
    res.status(500).json({ error: 'Failed to get WebSocket status' });
  }
});

// Clear message queue (dev only)
router.post('/clear-queue', (req, res) => {
  try {
    wsStatus.clearQueue();
    res.json({ success: true, message: 'WebSocket queue cleared' });
  } catch (error) {
    logger.error('[WSStatus] Clear queue error:', error);
    res.status(500).json({ error: 'Failed to clear WebSocket queue' });
  }
});

export default router;
