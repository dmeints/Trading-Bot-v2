
/**
 * Options Smile & Skew API Routes
 */

import { Router } from 'express';
import { optionsSmile } from '../services/options/Smile';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/options/chain/:symbol
 * Store option chain snapshot
 */
router.post('/chain/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    const { chain, spot } = req.body;
    
    if (!chain || !Array.isArray(chain)) {
      return res.status(400).json({ error: 'Invalid option chain data' });
    }

    // Validate chain structure
    for (const option of chain) {
      if (!option.k || !option.tenor || !option.type || typeof option.iv !== 'number') {
        return res.status(400).json({ error: 'Invalid option data structure' });
      }
    }

    const storedChain = optionsSmile.storeChain(symbol.toUpperCase(), chain, spot);
    res.json(storedChain);

  } catch (error) {
    logger.error('[Options] Error storing chain:', error);
    res.status(500).json({ error: 'Failed to store option chain' });
  }
});

/**
 * GET /api/options/smile/:symbol
 * Get computed smile metrics
 */
router.get('/smile/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    
    let metrics = optionsSmile.getMetrics(symbol.toUpperCase());
    
    // Generate mock data if no real data available
    if (!metrics) {
      optionsSmile.generateMockChain(symbol.toUpperCase());
      metrics = optionsSmile.getMetrics(symbol.toUpperCase());
      logger.info(`[Options] Generated mock chain for ${symbol}`);
    }
    
    res.json(metrics);

  } catch (error) {
    logger.error('[Options] Error getting smile metrics:', error);
    res.status(500).json({ error: 'Failed to get smile metrics' });
  }
});

/**
 * GET /api/options/chain/:symbol
 * Get stored option chain
 */
router.get('/chain/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    
    const chain = optionsSmile.getChain(symbol.toUpperCase());
    
    if (!chain) {
      return res.status(404).json({ error: 'No option chain found for symbol' });
    }
    
    res.json(chain);

  } catch (error) {
    logger.error('[Options] Error getting chain:', error);
    res.status(500).json({ error: 'Failed to get option chain' });
  }
});

export default router;
