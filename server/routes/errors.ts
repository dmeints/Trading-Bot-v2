
import express from 'express';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const errorData = req.body;
    
    // Log the client-side error
    logger.error('[ClientError]', {
      message: errorData.message,
      stack: errorData.stack,
      componentStack: errorData.componentStack,
      timestamp: errorData.timestamp,
      url: errorData.url,
      userAgent: errorData.userAgent
    });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('[ErrorLogging] Failed to log client error:', error);
    res.status(500).json({ success: false, error: 'Failed to log error' });
  }
});

export default router;
