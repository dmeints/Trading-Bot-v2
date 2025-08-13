
/**
 * Venue Registry - Track per-venue metrics for smart routing
 */

import { logger } from '../../utils/logger';

export interface VenueMetrics {
  venue: string;
  symbol: string;
  latencyMs: number;
  spread_bps: number;
  topDepth: number;
  feeBps: number;
  reliabilityScore: number;
  rateRemaining: number;
  lastUpdate: number;
}

export class VenueRegistry {
  private metrics = new Map<string, VenueMetrics>();
  private updateInterval?: NodeJS.Timeout;

  constructor() {
    this.initializeVenues();
    this.startMetricsUpdater();
  }

  private initializeVenues(): void {
    const venues = ['binance', 'coinbase', 'kraken', 'deribit'];
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

    for (const venue of venues) {
      for (const symbol of symbols) {
        const key = `${venue}:${symbol}`;
        this.metrics.set(key, {
          venue,
          symbol,
          latencyMs: 50 + Math.random() * 100,
          spread_bps: 1 + Math.random() * 10,
          topDepth: 10000 + Math.random() * 50000,
          feeBps: 1 + Math.random() * 5,
          reliabilityScore: 0.85 + Math.random() * 0.14,
          rateRemaining: 900 + Math.random() * 100,
          lastUpdate: Date.now()
        });
      }
    }

    logger.info('[VenueRegistry] Initialized venues with base metrics');
  }

  private startMetricsUpdater(): void {
    this.updateInterval = setInterval(() => {
      this.updateMetrics();
    }, 5000);
  }

  private updateMetrics(): void {
    for (const [key, metric] of this.metrics) {
      // Simulate realistic metric updates
      metric.latencyMs = Math.max(10, metric.latencyMs + (Math.random() - 0.5) * 20);
      metric.spread_bps = Math.max(0.1, metric.spread_bps + (Math.random() - 0.5) * 2);
      metric.topDepth = Math.max(1000, metric.topDepth + (Math.random() - 0.5) * 10000);
      metric.reliabilityScore = Math.max(0.5, Math.min(1.0, 
        metric.reliabilityScore + (Math.random() - 0.5) * 0.1));
      metric.rateRemaining = Math.max(0, metric.rateRemaining - Math.random() * 10);
      metric.lastUpdate = Date.now();
    }
  }

  getMetrics(venue?: string, symbol?: string): VenueMetrics[] {
    const results: VenueMetrics[] = [];
    
    for (const metric of this.metrics.values()) {
      if (venue && metric.venue !== venue) continue;
      if (symbol && metric.symbol !== symbol) continue;
      results.push(metric);
    }

    return results.sort((a, b) => b.lastUpdate - a.lastUpdate);
  }

  updateVenueMetric(venue: string, symbol: string, updates: Partial<VenueMetrics>): void {
    const key = `${venue}:${symbol}`;
    const existing = this.metrics.get(key);
    
    if (existing) {
      Object.assign(existing, updates, { lastUpdate: Date.now() });
    }
  }

  cleanup(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }
}

export const venueRegistry = new VenueRegistry();
