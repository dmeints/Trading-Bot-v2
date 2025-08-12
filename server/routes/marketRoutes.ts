import type { Express } from "express";
import { marketDataService } from "../services/marketData";

// Helper function for timeframe conversion
function getTimeframeMilliseconds(timeframe: string): number {
  const timeframeMap: { [key: string]: number } = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1H': 60 * 60 * 1000,
    '4H': 4 * 60 * 60 * 1000,
    '1D': 24 * 60 * 60 * 1000,
    '1W': 7 * 24 * 60 * 60 * 1000
  };
  return timeframeMap[timeframe] || 60 * 60 * 1000;
}

export function registerMarketRoutes(app: Express, requireAuth: any) {
  // OHLCV candlestick data endpoint
  app.get('/api/market/ohlcv', requireAuth, async (req, res) => {
    try {
      const symbol = req.query.symbol as string || 'BTC/USD';
      const timeframe = req.query.timeframe as string || '1H';
      const limit = parseInt(req.query.limit as string) || 100;

      // Get current price as base
      const currentPrice = await marketDataService.getPrice(symbol.split('/')[0]);

      // Generate realistic OHLCV data
      const candles = [];
      const timeframeMs = getTimeframeMilliseconds(timeframe);
      const now = Date.now();
      let basePrice = currentPrice * 0.995;

      for (let i = limit - 1; i >= 0; i--) {
        const timestamp = now - (i * timeframeMs);
        const volatility = 0.002; // 0.2% volatility per candle
        const trend = 0.0001; // Small upward trend
        const change = (Math.random() - 0.5) * volatility + trend;

        const open = basePrice;
        const close = open * (1 + change);
        const high = Math.max(open, close) * (1 + Math.random() * 0.001);
        const low = Math.min(open, close) * (1 - Math.random() * 0.001);
        const volume = 50 + Math.random() * 100;

        candles.push({
          timestamp,
          open,
          high,
          low,
          close,
          volume
        });

        basePrice = close;
      }

      res.json({ success: true, data: candles, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('OHLCV fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch OHLCV data' });
    }
  });

  // Market event templates for simulation
  app.get('/api/market/event-templates', requireAuth, async (req, res) => {
    try {
      const templates = [
        {
          id: 'fed_rate_decision',
          name: 'Federal Reserve Rate Decision',
          description: 'Interest rate announcement causing market volatility',
          impact: 'high',
          duration: '2-4 hours',
          priceEffect: { min: -5, max: 8 }
        },
        {
          id: 'btc_halving',
          name: 'Bitcoin Halving Event',
          description: 'Reduction in mining rewards affecting supply',
          impact: 'extreme',
          duration: '1-3 months',
          priceEffect: { min: 10, max: 50 }
        },
        {
          id: 'regulatory_news',
          name: 'Regulatory Announcement',
          description: 'Government crypto regulation updates',
          impact: 'medium',
          duration: '1-2 days',
          priceEffect: { min: -10, max: 5 }
        },
        {
          id: 'whale_movement',
          name: 'Large Wallet Transfer',
          description: 'Significant cryptocurrency movement detected',
          impact: 'medium',
          duration: '30 minutes - 2 hours',
          priceEffect: { min: -3, max: 2 }
        },
        {
          id: 'exchange_hack',
          name: 'Exchange Security Incident',
          description: 'Major exchange reporting security breach',
          impact: 'high',
          duration: '1-7 days',
          priceEffect: { min: -15, max: -2 }
        }
      ];

      res.json({ success: true, data: templates, timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch event templates' });
    }
  });

  // Order book depth data
  app.get('/api/market/depth/:symbol', requireAuth, async (req, res) => {
    try {
      const symbol = req.params.symbol || 'BTC';
      const currentPrice = await marketDataService.getPrice(symbol);

      // Generate realistic order book depth
      const bids = [];
      const asks = [];

      // Generate bids (below current price)
      for (let i = 0; i < 20; i++) {
        const priceLevel = currentPrice * (1 - (i + 1) * 0.001);
        const size = Math.random() * 10 + 1;
        bids.push({
          price: priceLevel,
          size,
          total: bids.reduce((sum, bid) => sum + bid.size, 0) + size
        });
      }

      // Generate asks (above current price)
      for (let i = 0; i < 20; i++) {
        const priceLevel = currentPrice * (1 + (i + 1) * 0.001);
        const size = Math.random() * 10 + 1;
        asks.push({
          price: priceLevel,
          size,
          total: asks.reduce((sum, ask) => sum + ask.size, 0) + size
        });
      }

      const spread = asks[0].price - bids[0].price;

      res.json({
        success: true,
        data: {
          symbol,
          bids,
          asks,
          spread,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Depth fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch market depth' });
    }
  });
}