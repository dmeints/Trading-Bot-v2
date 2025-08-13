import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

const router = Router();

// Market data schema
const MarketDataSchema = z.object({
  symbol: z.string().min(1),
  timeframe: z.string().optional().default('1h'),
  limit: z.number().optional().default(100)
});

// Get market data
router.get('/data/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '1h', limit = 100 } = req.query;

    const validation = MarketDataSchema.safeParse({
      symbol,
      timeframe,
      limit: Number(limit)
    });

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        details: validation.error.errors
      });
    }

    // Mock market data response
    const marketData = {
      symbol: validation.data.symbol,
      timeframe: validation.data.timeframe,
      data: Array.from({ length: validation.data.limit }, (_, i) => ({
        timestamp: Date.now() - (i * 3600000),
        open: 50000 + Math.random() * 1000,
        high: 50500 + Math.random() * 1000,
        low: 49500 + Math.random() * 1000,
        close: 50000 + Math.random() * 1000,
        volume: Math.random() * 1000000
      }))
    };

    res.json({
      success: true,
      data: marketData
    });

  } catch (error: any) {
    logger.error('[MarketRoutes] Error fetching market data', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market data'
    });
  }
});

// Get market overview
router.get('/overview', async (req, res) => {
  try {
    const overview = {
      totalMarketCap: 2500000000000,
      btcDominance: 42.5,
      ethDominance: 18.2,
      fearGreedIndex: 75,
      activeTraders: 45230,
      dailyVolume: 125000000000
    };

    res.json({
      success: true,
      data: overview
    });

  } catch (error: any) {
    logger.error('[MarketRoutes] Error fetching market overview', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market overview'
    });
  }
});

// Get top movers
router.get('/movers', async (req, res) => {
  try {
    const movers = {
      gainers: [
        { symbol: 'BTC', change: 5.2, price: 52000 },
        { symbol: 'ETH', change: 3.8, price: 3200 },
        { symbol: 'SOL', change: 7.1, price: 150 }
      ],
      losers: [
        { symbol: 'ADA', change: -2.3, price: 0.45 },
        { symbol: 'DOT', change: -1.8, price: 7.2 },
        { symbol: 'LINK', change: -3.1, price: 15.8 }
      ]
    };

    res.json({
      success: true,
      data: movers
    });

  } catch (error: any) {
    logger.error('[MarketRoutes] Error fetching market movers', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market movers'
    });
  }
});

export function registerMarketRoutes(app: any) {
  app.use('/api/market', router);
}

export { router as marketRoutes };