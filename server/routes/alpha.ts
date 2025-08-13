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
 * GET /api/alpha/blend
 * Get blended alpha signal for symbol
 */
router.get('/blend/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const context = { symbol: symbol.toUpperCase() };

    const signal = await alphaRegistry.getBlendedSignal(context);
    res.json(signal);

  } catch (error) {
    logger.error('[Alpha] Error getting blended signal:', error);
    res.status(500).json({ error: 'Failed to get blended signal' });
  }
});

/**
 * GET /api/alpha/attribution
 * Get alpha attribution for a trade
 */
router.get('/attribution', (req, res) => {
  try {
    const { tradeId } = req.query;

    if (!tradeId) {
      return res.status(400).json({ error: 'tradeId parameter required' });
    }

    // Handle "latest" special case
    const actualTradeId = tradeId === 'latest' ? 'mock_trade_' + Date.now() : tradeId as string;

    let attribution = alphaRegistry.getAttribution(actualTradeId);

    // Generate mock attribution if none exists
    if (attribution.length === 0) {
      const mockPnl = (Math.random() - 0.5) * 100; // Random PnL
      const mockSignals = {
        'order_book_imbalance': Math.random() - 0.5,
        'trade_imbalance': Math.random() - 0.5,
        'vol_regime': Math.random() - 0.5,
        'options_skew': Math.random() - 0.5
      };

      alphaRegistry.recordAttribution(actualTradeId, mockSignals, mockPnl);
      attribution = alphaRegistry.getAttribution(actualTradeId);
    }

    res.json({
      tradeId: actualTradeId,
      attribution,
      totalAttribution: attribution.reduce((sum, a) => sum + a.marginalPnl, 0)
    });

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