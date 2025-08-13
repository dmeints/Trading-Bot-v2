
/**
 * L2 Depth API Routes
 */

import { Router } from 'express';
import { bookMaintainer } from '../services/l2/BookMaintainer.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/l2/:venue/:symbol
 * Get current order book snapshot
 */
router.get('/:venue/:symbol', async (req, res) => {
  try {
    const { venue, symbol } = req.params;
    
    // Initialize book if not exists
    const book = await bookMaintainer.initializeBook(venue.toLowerCase(), symbol.toUpperCase());
    
    const snapshot = book.getSnapshot();
    
    res.json(snapshot);
  } catch (error) {
    logger.error('[L2Routes] Error getting order book:', error);
    res.status(500).json({ error: 'Failed to get order book' });
  }
});

/**
 * GET /api/l2/:venue/:symbol/spread
 * Get current spread metrics
 */
router.get('/:venue/:symbol/spread', async (req, res) => {
  try {
    const { venue, symbol } = req.params;
    
    const book = bookMaintainer.getBook(venue.toLowerCase(), symbol.toUpperCase());
    
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const bestBid = book.getBestBid();
    const bestAsk = book.getBestAsk();
    const spreadBps = book.getSpreadBps();
    const depth = book.getDepthWithinPercent(0.001); // 0.1%

    res.json({
      venue,
      symbol,
      bestBid,
      bestAsk,
      spreadBps,
      midPrice: bestBid && bestAsk ? (bestBid + bestAsk) / 2 : null,
      depth,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('[L2Routes] Error getting spread:', error);
    res.status(500).json({ error: 'Failed to get spread' });
  }
});

export default router;
