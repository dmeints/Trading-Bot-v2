
/**
 * Venue Registry - Track per-venue metrics and performance
 */

import { logger } from '../../utils/logger.js';

export interface VenueMetrics {
  venue: string;
  latencyMs: number;
  spreadBps: number;
  topDepthUsd: number;
  feeBps: number;
  reliability: number;
  rateRemaining: number;
  lastUpdate: Date;
  successRate: number;
  avgFillTime: number;
}

export interface VenueScore {
  venue: string;
  score: number;
  reasons: string[];
  metrics: VenueMetrics;
}

class VenueRegistry {
  private venues = new Map<string, VenueMetrics>();
  private performanceHistory = new Map<string, Array<{ timestamp: Date; latency: number; success: boolean }>>();

  constructor() {
    this.initializeVenues();
  }

  /**
   * Initialize known venues with default metrics
   */
  private initializeVenues(): void {
    const defaultVenues = [
      {
        venue: 'binance',
        latencyMs: 45,
        spreadBps: 2.5,
        topDepthUsd: 2500000,
        feeBps: 10,
        reliability: 0.999,
        rateRemaining: 1200,
        successRate: 0.998,
        avgFillTime: 150
      },
      {
        venue: 'coinbase',
        latencyMs: 85,
        spreadBps: 4.2,
        topDepthUsd: 1800000,
        feeBps: 50,
        reliability: 0.997,
        rateRemaining: 10,
        successRate: 0.995,
        avgFillTime: 220
      },
      {
        venue: 'kraken',
        latencyMs: 120,
        spreadBps: 6.8,
        topDepthUsd: 900000,
        feeBps: 26,
        reliability: 0.993,
        rateRemaining: 60,
        successRate: 0.992,
        avgFillTime: 280
      },
      {
        venue: 'bybit',
        latencyMs: 65,
        spreadBps: 3.1,
        topDepthUsd: 1200000,
        feeBps: 12,
        reliability: 0.995,
        rateRemaining: 600,
        successRate: 0.996,
        avgFillTime: 180
      }
    ];

    for (const venue of defaultVenues) {
      this.venues.set(venue.venue, {
        ...venue,
        lastUpdate: new Date()
      });
      this.performanceHistory.set(venue.venue, []);
    }

    logger.info(`[VenueRegistry] Initialized ${defaultVenues.length} venues`);
  }

  /**
   * Update venue metrics
   */
  updateMetrics(venue: string, updates: Partial<VenueMetrics>): void {
    const existing = this.venues.get(venue);
    
    if (!existing) {
      logger.warn(`[VenueRegistry] Unknown venue: ${venue}`);
      return;
    }

    const updated: VenueMetrics = {
      ...existing,
      ...updates,
      lastUpdate: new Date()
    };

    this.venues.set(venue, updated);
    
    // Record performance history
    if (updates.latencyMs !== undefined) {
      this.recordPerformance(venue, updates.latencyMs, true);
    }

    logger.debug(`[VenueRegistry] Updated metrics for ${venue}`);
  }

  /**
   * Record performance data point
   */
  recordPerformance(venue: string, latency: number, success: boolean): void {
    if (!this.performanceHistory.has(venue)) {
      this.performanceHistory.set(venue, []);
    }

    const history = this.performanceHistory.get(venue)!;
    history.push({
      timestamp: new Date(),
      latency,
      success
    });

    // Keep only last 1000 data points
    if (history.length > 1000) {
      history.shift();
    }

    // Update rolling averages
    this.updateRollingMetrics(venue);
  }

  /**
   * Score venues for symbol/size combination
   */
  scoreVenues(symbol: string, size: number): VenueScore[] {
    const scores: VenueScore[] = [];

    for (const [venue, metrics] of this.venues) {
      const score = this.calculateVenueScore(metrics, symbol, size);
      const reasons = this.getScoreReasons(metrics, size);

      scores.push({
        venue,
        score,
        reasons,
        metrics: { ...metrics }
      });
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    return scores;
  }

  /**
   * Get all venues with current metrics
   */
  getAllVenues(): VenueMetrics[] {
    return Array.from(this.venues.values());
  }

  /**
   * Get specific venue metrics
   */
  getVenue(venue: string): VenueMetrics | null {
    return this.venues.get(venue) || null;
  }

  /**
   * Calculate venue score for given parameters
   */
  private calculateVenueScore(metrics: VenueMetrics, symbol: string, size: number): number {
    let score = 100; // Base score

    // Latency penalty (0-30 points)
    const latencyPenalty = Math.min(30, metrics.latencyMs / 10);
    score -= latencyPenalty;

    // Spread penalty (0-25 points)
    const spreadPenalty = Math.min(25, metrics.spreadBps / 2);
    score -= spreadPenalty;

    // Depth bonus (0-20 points)
    const sizeUsd = size * 50000; // Approximate USD value
    const depthRatio = Math.min(1, sizeUsd / metrics.topDepthUsd);
    const depthBonus = 20 * depthRatio;
    score += depthBonus;

    // Fee penalty (0-15 points)
    const feePenalty = Math.min(15, metrics.feeBps / 5);
    score -= feePenalty;

    // Reliability bonus (0-10 points)
    const reliabilityBonus = 10 * metrics.reliability;
    score += reliabilityBonus;

    // Rate limiting penalty (0-20 points)
    const ratePenalty = metrics.rateRemaining < 10 ? 20 : 0;
    score -= ratePenalty;

    return Math.max(0, score);
  }

  /**
   * Get human-readable score reasons
   */
  private getScoreReasons(metrics: VenueMetrics, size: number): string[] {
    const reasons: string[] = [];

    if (metrics.latencyMs < 50) {
      reasons.push('Low latency');
    } else if (metrics.latencyMs > 100) {
      reasons.push('High latency');
    }

    if (metrics.spreadBps < 3) {
      reasons.push('Tight spreads');
    } else if (metrics.spreadBps > 5) {
      reasons.push('Wide spreads');
    }

    const sizeUsd = size * 50000;
    if (sizeUsd < metrics.topDepthUsd * 0.1) {
      reasons.push('Sufficient depth');
    } else if (sizeUsd > metrics.topDepthUsd * 0.5) {
      reasons.push('Limited depth');
    }

    if (metrics.feeBps < 20) {
      reasons.push('Low fees');
    } else if (metrics.feeBps > 40) {
      reasons.push('High fees');
    }

    if (metrics.reliability > 0.998) {
      reasons.push('High reliability');
    } else if (metrics.reliability < 0.995) {
      reasons.push('Reliability concerns');
    }

    if (metrics.rateRemaining < 10) {
      reasons.push('Rate limited');
    }

    return reasons;
  }

  /**
   * Update rolling metrics from performance history
   */
  private updateRollingMetrics(venue: string): void {
    const history = this.performanceHistory.get(venue);
    const metrics = this.venues.get(venue);
    
    if (!history || !metrics || history.length < 10) {
      return;
    }

    // Calculate rolling averages from last 100 data points
    const recent = history.slice(-100);
    const totalLatency = recent.reduce((sum, point) => sum + point.latency, 0);
    const successCount = recent.filter(point => point.success).length;

    metrics.latencyMs = totalLatency / recent.length;
    metrics.successRate = successCount / recent.length;
    metrics.reliability = Math.min(0.999, metrics.successRate);
  }
}

export const venueRegistry = new VenueRegistry();
