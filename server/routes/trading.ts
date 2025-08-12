import type { Express } from "express";
import { priceStream } from "../services/priceStream";
import { getOHLCV } from "../services/exchanges/binance";
import type { OrderRequest, OrderAck, Position, Fill, Account, RiskSettings } from '../src/types/trading.js';
import { logger } from '../utils/logger.js';

interface PaperTrade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  size: number;
  price: number;
  timestamp: string;
  notional: number;
}

interface PaperPosition {
  symbol: string;
  size: number;
  averagePrice: number;
  unrealizedPnL: number;
  notional: number;
}

// In-memory storage for paper trading (TODO: move to database)
const paperTrades: PaperTrade[] = [];
const paperPositions: Map<string, PaperPosition> = new Map();

export function registerTradingRoutes(app: Express, requireAuth: any) {
  // Paper order endpoint
  app.post('/api/trading/paper/order', requireAuth, async (req, res) => {
    try {
      const { symbol, side, size } = req.body;

      // Validation
      if (!symbol || !side || !size) {
        return res.status(400).json({ error: 'Missing required fields: symbol, side, size' });
      }

      if (!['buy', 'sell'].includes(side)) {
        return res.status(400).json({ error: 'Side must be buy or sell' });
      }

      if (typeof size !== 'number' || size <= 0) {
        return res.status(400).json({ error: 'Size must be a positive number' });
      }

      // Get current price
      let currentPrice: number;
      const lastPrice = priceStream.getLastPrice();

      if (lastPrice > 0) {
        currentPrice = lastPrice;
      } else {
        // Fallback to latest candle data
        try {
          const candles = await getOHLCV(symbol, '1m', 1);
          currentPrice = candles[0]?.close || 0;
        } catch {
          return res.status(400).json({ error: 'Unable to get current price for symbol' });
        }
      }

      const notional = size * currentPrice;

      // Safety check - max $100k notional
      if (notional > 100000) {
        return res.status(400).json({ error: 'Order size exceeds maximum notional of $100,000' });
      }

      // Create trade
      const trade: PaperTrade = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        symbol,
        side,
        size,
        price: currentPrice,
        timestamp: new Date().toISOString(),
        notional
      };

      paperTrades.push(trade);

      // Update position
      const existingPosition = paperPositions.get(symbol);
      if (existingPosition) {
        const newSize = existingPosition.size + (side === 'buy' ? size : -size);
        const newNotional = existingPosition.notional + (side === 'buy' ? notional : -notional);

        paperPositions.set(symbol, {
          symbol,
          size: newSize,
          averagePrice: newSize !== 0 ? newNotional / newSize : 0,
          unrealizedPnL: 0, // TODO: Calculate based on current price
          notional: newNotional
        });
      } else {
        paperPositions.set(symbol, {
          symbol,
          size: side === 'buy' ? size : -size,
          averagePrice: currentPrice,
          unrealizedPnL: 0,
          notional: side === 'buy' ? notional : -notional
        });
      }

      res.json({
        success: true,
        trade,
        message: `${side.toUpperCase()} order executed: ${size} ${symbol} at $${currentPrice.toFixed(2)}`
      });

    } catch (error) {
      console.error('Paper order error:', error);
      res.status(500).json({ error: 'Failed to execute paper order' });
    }
  });

  // Get positions
  app.get('/api/trading/positions', requireAuth, (req, res) => {
    const positions = Array.from(paperPositions.values()).filter(pos => pos.size !== 0);

    res.json({
      success: true,
      data: positions,
      timestamp: new Date().toISOString()
    });
  });

  // Get trades
  app.get('/api/trading/trades', requireAuth, (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const recentTrades = paperTrades
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    res.json({
      success: true,
      data: recentTrades,
      timestamp: new Date().toISOString()
    });
  });
}