
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import marketRoutes from '../server/routes/marketRoutes';

// Mock dependencies
vi.mock('../server/connectors/binance.js', () => ({
  binanceConnector: {
    fetchKlines: vi.fn().mockResolvedValue([
      {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        timestamp: new Date('2024-01-01T00:00:00Z'),
        open: '45000.00',
        high: '46000.00',
        low: '44000.00',
        close: '45500.00',
        volume: '1234.56',
        provider: 'binance',
        datasetId: 'test_dataset',
        provenance: {}
      }
    ]),
    storeMarketBars: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('../server/db.js', () => ({
  db: {}
}));

vi.mock('../server/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

describe('OHLCV Route', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/market', marketRoutes);
    vi.clearAllMocks();
  });

  it('should return OHLCV data with correct structure', async () => {
    const response = await request(app)
      .get('/api/market/ohlcv')
      .query({
        symbol: 'BTCUSDT',
        timeframe: '1m',
        limit: '3'
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
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
});
