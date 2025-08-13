import { logger } from '../../utils/logger.js';

export interface VenueMetrics {
  venue: string;
  latency: number;        // ms
  spread_bps: number;     // basis points
  topDepth: number;       // USD
  feeBps: number;         // basis points
  reliability: number;    // 0-1
  rateRemaining: number;  // requests/min
  lastUpdate: number;
}

export class VenueRegistry {
  private venues: Map<string, VenueMetrics> = new Map();
  private updateInterval?: NodeJS.Timer;

  constructor() {
    this.initializeVenues();
    this.startMetricsUpdater();
  }

  private initializeVenues(): void {
    const defaultVenues: VenueMetrics[] = [
      {
        venue: 'binance',
        latency: 45,
        spread_bps: 1.2,
        topDepth: 500000,
        feeBps: 10,
        reliability: 0.98,
        rateRemaining: 1200,
        lastUpdate: Date.now()
      },
      {
        venue: 'coinbase',
        latency: 65,
        spread_bps: 2.1,
        topDepth: 350000,
        feeBps: 50,
        reliability: 0.96,
        rateRemaining: 600,
        lastUpdate: Date.now()
      },
      {
        venue: 'kraken',
        latency: 85,
        spread_bps: 3.5,
        topDepth: 200000,
        feeBps: 26,
        reliability: 0.94,
        rateRemaining: 900,
        lastUpdate: Date.now()
      },
      {
        venue: 'bybit',
        latency: 55,
        spread_bps: 1.8,
        topDepth: 300000,
        feeBps: 10,
        reliability: 0.95,
        rateRemaining: 1000,
        lastUpdate: Date.now()
      },
      {
        venue: 'okx',
        latency: 70,
        spread_bps: 2.2,
        topDepth: 250000,
        feeBps: 8,
        reliability: 0.93,
        rateRemaining: 800,
        lastUpdate: Date.now()
      }
    ];

    for (const venue of defaultVenues) {
      this.venues.set(venue.venue, venue);
    }
  }

  private startMetricsUpdater(): void {
    this.updateInterval = setInterval(() => {
      this.updateMetrics();
    }, 30000); // Update every 30s
  }

  private updateMetrics(): void {
    for (const [venueName, metrics] of this.venues) {
      // Simulate realistic metric updates
      const variance = 0.1; // 10% variance

      metrics.latency = Math.max(20, metrics.latency * (1 + (Math.random() - 0.5) * variance));
      metrics.spread_bps = Math.max(0.5, metrics.spread_bps * (1 + (Math.random() - 0.5) * variance));
      metrics.topDepth = Math.max(50000, metrics.topDepth * (1 + (Math.random() - 0.5) * variance * 2));
      metrics.reliability = Math.min(1, Math.max(0.8, metrics.reliability + (Math.random() - 0.5) * 0.02));
      metrics.rateRemaining = Math.max(100, metrics.rateRemaining + Math.floor((Math.random() - 0.5) * 200));
      metrics.lastUpdate = Date.now();

      logger.debug(`Updated metrics for ${venueName}: latency=${metrics.latency.toFixed(0)}ms, spread=${metrics.spread_bps.toFixed(1)}bps`);
    }
  }

  getVenue(venue: string): VenueMetrics | null {
    return this.venues.get(venue) || null;
  }

  getAllVenues(): VenueMetrics[] {
    return Array.from(this.venues.values());
  }

  updateVenue(venue: string, updates: Partial<VenueMetrics>): void {
    const existing = this.venues.get(venue);
    if (existing) {
      Object.assign(existing, updates, { lastUpdate: Date.now() });
      logger.info(`Updated venue ${venue} metrics`);
    } else {
      logger.warn(`Venue ${venue} not found for update`);
    }
  }

  // Health check - mark venue as degraded
  markDegraded(venue: string, reason: string): void {
    const metrics = this.venues.get(venue);
    if (metrics) {
      metrics.reliability = Math.max(0.5, metrics.reliability * 0.9);
      metrics.latency *= 1.5;
      logger.warn(`Marked venue ${venue} as degraded: ${reason}`);
    }
  }

  // Recovery - improve venue metrics
  markRecovered(venue: string): void {
    const metrics = this.venues.get(venue);
    if (metrics) {
      metrics.reliability = Math.min(1.0, metrics.reliability * 1.1);
      metrics.latency *= 0.9;
      logger.info(`Marked venue ${venue} as recovered`);
    }
  }

  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }
}

export const venueRegistry = new VenueRegistry();