
/**
 * Options Smile API Routes
 */

import { Router } from 'express';
import { optionsSmile, OptionChain } from '../services/options/Smile';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/options/chain/:symbol
 * Store option chain snapshot
 */
router.post('/chain/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    const { chain, underlying_price } = req.body;
    
    if (!chain || !Array.isArray(chain)) {
      return res.status(400).json({ error: 'Invalid option chain data' });
    }

    // Validate chain structure
    for (const option of chain) {
      if (!option.k && !option.strike) {
        return res.status(400).json({ error: 'Missing strike price in option data' });
      }
      if (!option.tenor && !option.expiry) {
        return res.status(400).json({ error: 'Missing expiry in option data' });
      }
      if (!option.type || !['call', 'put'].includes(option.type)) {
        return res.status(400).json({ error: 'Invalid option type' });
      }
      if (typeof option.iv !== 'number') {
        return res.status(400).json({ error: 'Invalid implied volatility' });
      }
    }

    // Convert to internal format
    const optionChain: OptionChain = {
      symbol: symbol.toUpperCase(),
      timestamp: new Date(),
      underlying_price: underlying_price || 50000, // Default BTC price
      options: chain.map((opt: any) => ({
        symbol: symbol.toUpperCase(),
        strike: opt.k || opt.strike,
        expiry: opt.tenor || opt.expiry,
        type: opt.type,
        iv: opt.iv,
        price: opt.price,
        delta: opt.delta,
        volume: opt.volume
      }))
    };

    const metrics = optionsSmile.storeChain(optionChain);
    res.json({ success: true, metrics });

  } catch (error) {
    logger.error('[Options] Error storing chain:', error);
    res.status(500).json({ error: 'Failed to store option chain' });
  }
});

/**
 * GET /api/options/smile/:symbol
 * Get smile metrics for symbol
 */
router.get('/smile/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    
    let metrics = optionsSmile.getSmileMetrics(symbol.toUpperCase());
    
    // Generate mock data if none available
    if (!metrics) {
      const mockChain = optionsSmile.generateMockChain(symbol.toUpperCase());
      metrics = optionsSmile.storeChain(mockChain);
      logger.info(`[Options] Generated mock smile data for ${symbol}`);
    }
    
    res.json(metrics);

  } catch (error) {
    logger.error('[Options] Error getting smile:', error);
    res.status(500).json({ error: 'Failed to get smile metrics' });
  }
});

/**
 * POST /api/options/mock/:symbol
 * Generate mock option chain for testing
 */
router.post('/mock/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    const { spot_price } = req.body;
    
    const spotPrice = spot_price || (symbol.includes('BTC') ? 50000 : 3000);
    const mockChain = optionsSmile.generateMockChain(symbol.toUpperCase(), spotPrice);
    const metrics = optionsSmile.storeChain(mockChain);
    
    res.json({ 
      success: true, 
      chain: mockChain,
      metrics 
    });

  } catch (error) {
    logger.error('[Options] Error generating mock:', error);
    res.status(500).json({ error: 'Failed to generate mock data' });
  }
});

export default router;
import { Router } from 'express';
import { optionsSmile, type OptionChainEntry } from '../services/options/Smile.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/options/chain/:symbol
 * Store options chain snapshot
 */
router.post('/chain/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    const { chain, spot } = req.body;

    if (!Array.isArray(chain)) {
      return res.status(400).json({ error: 'Chain must be an array' });
    }

    optionsSmile.storeChain(symbol, chain as OptionChainEntry[], spot || 1);
    
    res.json({ 
      success: true, 
      symbol: symbol.toUpperCase(),
      chainSize: chain.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[OptionsRoutes] Error storing chain:', error);
    res.status(500).json({ error: 'Failed to store options chain' });
  }
});

/**
 * GET /api/options/smile/:symbol
 * Get smile metrics for symbol
 */
router.get('/smile/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    
    let metrics = optionsSmile.calculateMetrics(symbol);
    
    // Generate mock if no real data
    if (!metrics) {
      metrics = optionsSmile.generateMockMetrics(symbol);
    }
    
    res.json(metrics);
  } catch (error) {
    logger.error('[OptionsRoutes] Error calculating smile:', error);
    res.status(500).json({ error: 'Failed to calculate smile metrics' });
  }
});

export default router;
