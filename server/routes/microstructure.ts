
/**
 * Microstructure API Routes
 */

import { Router } from 'express';
import { microstructureFeatures } from '../services/microstructure/Features';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/microstructure/:symbol
 * Get latest microstructure snapshot for symbol
 */
router.get('/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    
    let snapshot = microstructureFeatures.getSnapshot(symbol.toUpperCase());
    
    // Generate mock data if no real data available
    if (!snapshot) {
      snapshot = microstructureFeatures.generateMockSnapshot(symbol.toUpperCase());
      logger.info(`[Microstructure] Generated mock snapshot for ${symbol}`);
    }
    
    res.json(snapshot);
  } catch (error) {
    logger.error('[Microstructure] Error getting snapshot:', error);
    res.status(500).json({ error: 'Failed to get microstructure snapshot' });
  }
});

/**
 * POST /api/microstructure/:symbol/orderbook
 * Update order book and compute features
 */
router.post('/:symbol/orderbook', (req, res) => {
  try {
    const { symbol } = req.params;
    const { bids, asks } = req.body;
    
    if (!bids || !asks || !Array.isArray(bids) || !Array.isArray(asks)) {
      return res.status(400).json({ error: 'Invalid order book data' });
    }

    const orderBook = {
      symbol: symbol.toUpperCase(),
      timestamp: new Date(),
      bids: bids.map((b: any) => ({ price: Number(b.price), size: Number(b.size) })),
      asks: asks.map((a: any) => ({ price: Number(a.price), size: Number(a.size) }))
    };

    const snapshot = microstructureFeatures.updateOrderBook(orderBook);
    res.json(snapshot);
  } catch (error) {
    logger.error('[Microstructure] Error updating order book:', error);
    res.status(500).json({ error: 'Failed to update order book' });
  }
});

/**
 * POST /api/microstructure/:symbol/trade
 * Update with trade event
 */
router.post('/:symbol/trade', (req, res) => {
  try {
    const { symbol } = req.params;
    const { price, size, side } = req.body;
    
    if (!price || !size || !side) {
      return res.status(400).json({ error: 'Missing trade data' });
    }

    const trade = {
      symbol: symbol.toUpperCase(),
      timestamp: new Date(),
      price: Number(price),
      size: Number(size),
      side: side as 'buy' | 'sell'
    };

    microstructureFeatures.updateTrade(trade);
    res.json({ success: true });
  } catch (error) {
    logger.error('[Microstructure] Error updating trade:', error);
    res.status(500).json({ error: 'Failed to update trade' });
  }
});

export default router;
