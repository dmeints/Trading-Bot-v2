import type { Express } from "express";
import { getOHLCV } from "../services/exchanges/binance";
import { logger } from '../utils/logger';
import { storage } from '../storage';
import type { InsertMarketBar } from '@shared/schema';

let lastOHLCVSync = new Date().toISOString();

export function getLastOHLCVSync() {
  return lastOHLCVSync;
}

function toBarsForDB(symbol: string, timeframe: string, candles: {timestamp:number,open:number,high:number,low:number,close:number,volume:number}[]): InsertMarketBar[] {
  const ds = (ts:number) => `binance:${symbol}:${timeframe}:${new Date(ts).toISOString().slice(0,10)}`;
  return candles.map(c => ({
    symbol,
    timeframe,
    timestamp: new Date(c.timestamp),
    open: String(c.open),
    high: String(c.high),
    low: String(c.low),
    close: String(c.close),
    volume: String(c.volume ?? 0),
    provider: 'binance',
    datasetId: ds(c.timestamp),
    provenance: { source: 'binance', endpoint: 'klines', symbol, timeframe }
  }));
}

export function registerMarketRoutes(app: Express, requireAuth: any) {
  // OHLCV candlestick data endpoint - now using real Binance data
  app.get('/api/market/ohlcv', requireAuth, async (req, res) => {
    try {
      const symbol = req.query.symbol as string || 'BTCUSDT';
      const timeframe = req.query.timeframe as string || '1h';
      const limit = parseInt(req.query.limit as string) || 100;

      // Fetch real data from Binance
      const candles = await getOHLCV(symbol, timeframe, limit);

      // Persist to database
      try {
        const bars = toBarsForDB(symbol, timeframe, candles);
        await storage.storeMarketBars(bars);
        lastOHLCVSync = new Date().toISOString();
      } catch (e) {
        // Do not fail the endpoint on storage error; just log
        logger.error('Failed to persist OHLCV:', { error: String(e) });
      }

      res.json({
        success: true,
        data: candles,
        timestamp: new Date().toISOString(),
        source: 'binance'
      });
    } catch (error) {
      console.error('OHLCV fetch error:', error);
      res.status(500).json({
        error: 'Failed to fetch OHLCV data',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
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
      const symbol = req.params.symbol || 'BTCUSDT';

      // Get current price from Binance
      const candles = await getOHLCV(symbol, '1m', 1);
      const currentPrice = candles[0]?.close || 50000;

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

// Export for health check access
export { lastOHLCVSync };