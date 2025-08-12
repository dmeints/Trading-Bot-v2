
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { marketRouter } from '../routes/marketRoutes';

// Mock dependencies
vi.mock('../services/exchanges/binance', () => ({
  getOHLCV: vi.fn().mockResolvedValue([
    {
      timestamp: 1640995200000,
      open: 50000.00,
      high: 51000.00,
      low: 49500.00,
      close: 50500.00,
      volume: 100.5
    }
  ])
}));

vi.mock('../storage', () => ({
  storage: {
    storeMarketBars: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn()
  }
}));

describe('OHLCV Route', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/market', marketRouter);

  it('should return OHLCV data with correct shape and source', async () => {
    const response = await request(app)
      .get('/api/market/ohlcv?symbol=BTCUSDT&timeframe=1m&limit=3')
      .expect(200);

    expect(response.body).toMatchObject({
      symbol: 'BTCUSDT',
      timeframe: '1m',
      source: 'binance',
      data: expect.arrayContaining([
        expect.objectContaining({
          timestamp: expect.any(Number),
          open: expect.any(Number),
          high: expect.any(Number),
          low: expect.any(Number),
          close: expect.any(Number),
          volume: expect.any(Number)
        })
      ])
    });
  });

  it('should validate required parameters', async () => {
    await request(app)
      .get('/api/market/ohlcv?timeframe=1m&limit=3')
      .expect(400);

    await request(app)
      .get('/api/market/ohlcv?symbol=BTCUSDT&limit=3')
      .expect(400);
  });

  it('should validate timeframe values', async () => {
    await request(app)
      .get('/api/market/ohlcv?symbol=BTCUSDT&timeframe=invalid&limit=3')
      .expect(400);
  });
});
