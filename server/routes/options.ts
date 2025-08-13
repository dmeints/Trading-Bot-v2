import express from 'express';
import { optionsSmile } from '../services/options/Smile.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// POST /api/options/chain/:symbol - Store options chain
router.post('/chain/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const chainData = req.body;

    if (!chainData.chain || !Array.isArray(chainData.chain)) {
      return res.status(400).json({ error: 'Invalid chain data format' });
    }

    optionsSmile.storeChain(symbol.toUpperCase(), chainData);

    res.json({
      status: 'success',
      message: `Stored options chain for ${symbol}`,
      chainSize: chainData.chain.length,
      timestamp: Date.now()
    });

  } catch (error) {
    logger.error('Error storing options chain:', { error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/options/smile/:symbol - Get smile metrics
router.get('/smile/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;

    const metrics = optionsSmile.getSmileMetrics(symbol.toUpperCase());

    if (!metrics) {
      return res.status(404).json({ error: 'No options data found for symbol' });
    }

    res.json(metrics);

  } catch (error) {
    logger.error('Error getting smile metrics:', { error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;