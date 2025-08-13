
import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { app } from '../server';

describe('Report Rollups', () => {
  it('should generate alpha PnL report', async () => {
    const response = await request(app)
      .get('/api/report/alpha-pnl?window=7d')
      .expect(200);

    expect(response.body.window).toBe('7d');
    expect(response.body.alphas).toBeDefined();
    expect(Array.isArray(response.body.alphas)).toBe(true);
    expect(response.body.totalPnL).toBeDefined();
    expect(response.body.bestAlpha).toBeDefined();
  });

  it('should generate risk report', async () => {
    const response = await request(app)
      .get('/api/report/risk?window=7d')
      .expect(200);

    expect(response.body.realizedVol).toBeDefined();
    expect(response.body.cvar95).toBeDefined();
    expect(response.body.maxDrawdown).toBeDefined();
    expect(response.body.turnover).toBeDefined();
    expect(response.body.avgSlippage).toBeDefined();
  });

  it('should generate venue report', async () => {
    const response = await request(app)
      .get('/api/report/venue?window=7d')
      .expect(200);

    expect(response.body.venues).toBeDefined();
    expect(Array.isArray(response.body.venues)).toBe(true);
    expect(response.body.bestVenue).toBeDefined();
    
    if (response.body.venues.length > 0) {
      const venue = response.body.venues[0];
      expect(venue.venue).toBeDefined();
      expect(venue.winRate).toBeDefined();
      expect(venue.avgSlippage).toBeDefined();
    }
  });

  it('should return performance attribution', async () => {
    const response = await request(app)
      .get('/api/report/attribution?window=30d')
      .expect(200);

    expect(response.body.attribution).toBeDefined();
    expect(response.body.factors).toBeDefined();
    expect(response.body.attribution.market).toBeDefined();
    expect(response.body.factors.momentum).toBeDefined();
  });

  it('should enhance health endpoint', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.body.db.latencyMs).toBeDefined();
    expect(response.body.ws.clients).toBeDefined();
    expect(response.body.router.decisionsLastMin).toBeDefined();
    expect(response.body.exec.blockedLastMin).toBeDefined();
    expect(response.body.lastOHLCVSync).toBeDefined();
  });

  it('should provide Prometheus metrics', async () => {
    const response = await request(app)
      .get('/metrics')
      .expect(200);

    expect(response.text).toContain('venue_score');
    expect(response.text).toContain('l2_resyncs_total');
    expect(response.text).toContain('router_decisions_total');
    expect(response.text).toContain('ohlcv_last_sync_ts_seconds');
  });
});
