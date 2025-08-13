
/**
 * Alpha Registry API Routes
 */

import { Router } from 'express';
import { alphaRegistry } from '../services/alpha/Registry';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/alpha/registry
 * List all registered alpha signals
 */
router.get('/registry', (req, res) => {
  try {
    const registry = alphaRegistry.getRegistry();
    res.json({
      count: registry.length,
      alphas: registry.map(alpha => ({
        id: alpha.id,
        name: alpha.name,
        description: alpha.description,
        category: alpha.category,
        weight_init: alpha.weight_init
      }))
    });
  } catch (error) {
    logger.error('[Alpha] Error getting registry:', error);
    res.status(500).json({ error: 'Failed to get alpha registry' });
  }
});

/**
 * POST /api/alpha/signal/:symbol
 * Generate blended signal for symbol
 */
router.post('/signal/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const context = { symbol: symbol.toUpperCase(), ...req.body };
    
    const signal = await alphaRegistry.generateSignal(context);
    res.json(signal);
    
  } catch (error) {
    logger.error('[Alpha] Error generating signal:', error);
    res.status(500).json({ error: 'Failed to generate alpha signal' });
  }
});

/**
 * GET /api/alpha/signal/:symbol
 * Get latest signal for symbol
 */
router.get('/signal/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    const signal = alphaRegistry.getLatestSignal(symbol.toUpperCase());
    
    if (!signal) {
      return res.status(404).json({ error: 'No signal found for symbol' });
    }
    
    res.json(signal);
    
  } catch (error) {
    logger.error('[Alpha] Error getting signal:', error);
    res.status(500).json({ error: 'Failed to get alpha signal' });
  }
});

/**
 * GET /api/alpha/attribution
 * Get trade attribution
 */
router.get('/attribution', (req, res) => {
  try {
    const { tradeId } = req.query;
    
    if (tradeId && tradeId !== 'latest') {
      const attribution = alphaRegistry.getTradeAttribution(tradeId as string);
      if (!attribution) {
        return res.status(404).json({ error: 'Trade attribution not found' });
      }
      res.json(attribution);
    } else {
      // Get latest or all attributions
      const attributions = alphaRegistry.getAllAttributions();
      if (tradeId === 'latest' && attributions.length > 0) {
        res.json(attributions[attributions.length - 1]);
      } else {
        res.json({ count: attributions.length, attributions: attributions.slice(-10) });
      }
    }
    
  } catch (error) {
    logger.error('[Alpha] Error getting attribution:', error);
    res.status(500).json({ error: 'Failed to get attribution' });
  }
});

/**
 * POST /api/alpha/attribution
 * Record trade attribution
 */
router.post('/attribution', (req, res) => {
  try {
    const { trade_id, symbol, pnl } = req.body;
    
    if (!trade_id || !symbol || typeof pnl !== 'number') {
      return res.status(400).json({ error: 'Missing required fields: trade_id, symbol, pnl' });
    }
    
    alphaRegistry.recordTradeAttribution(trade_id, symbol.toUpperCase(), pnl);
    res.json({ success: true });
    
  } catch (error) {
    logger.error('[Alpha] Error recording attribution:', error);
    res.status(500).json({ error: 'Failed to record attribution' });
  }
});

export default router;
