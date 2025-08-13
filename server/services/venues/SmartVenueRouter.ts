/**
 * Smart Venue Router - Intelligent venue selection
 */

import { VenueRegistry, VenueMetrics, venueRegistry } from './VenueRegistry.js';
import { logger } from '../../utils/logger.js';

interface VenueScore {
  venue: string;
  score: number;
  reasons: string[];
  metrics: VenueMetrics;
}

interface RoutingRequest {
  symbol: string;
  size: number;
  urgency?: 'low' | 'medium' | 'high';
  maxLatency?: number;
  minDepth?: number;
}

export class SmartVenueRouter {
  constructor(private registry: VenueRegistry) {}

  scoreVenue(venue: VenueMetrics, request: RoutingRequest): VenueScore {
    const reasons: string[] = [];
    let score = 100; // Start with perfect score

    // Latency penalty
    const latencyPenalty = Math.max(0, venue.latency - 50) * 0.5;
    score -= latencyPenalty;
    if (latencyPenalty > 0) {
      reasons.push(`latency penalty: -${latencyPenalty.toFixed(1)}`);
    }

    // Spread penalty
    const spreadPenalty = venue.spread_bps * 2;
    score -= spreadPenalty;
    reasons.push(`spread penalty: -${spreadPenalty.toFixed(1)}`);

    // Fee penalty
    const feePenalty = venue.feeBps * 0.5;
    score -= feePenalty;
    reasons.push(`fee penalty: -${feePenalty.toFixed(1)}`);

    // Reliability bonus
    const reliabilityBonus = (venue.reliability - 0.9) * 100;
    score += reliabilityBonus;
    if (reliabilityBonus !== 0) {
      reasons.push(`reliability: ${reliabilityBonus > 0 ? '+' : ''}${reliabilityBonus.toFixed(1)}`);
    }

    // Depth adequacy
    const depthRatio = venue.topDepth / (request.size * 50000); // Assume $50k per unit
    if (depthRatio < 1) {
      const depthPenalty = (1 - depthRatio) * 50;
      score -= depthPenalty;
      reasons.push(`insufficient depth: -${depthPenalty.toFixed(1)}`);
    } else if (depthRatio > 2) {
      const depthBonus = Math.min(10, (depthRatio - 2) * 5);
      score += depthBonus;
      reasons.push(`excellent depth: +${depthBonus.toFixed(1)}`);
    }

    // Rate limit consideration
    if (venue.rateRemaining < 100) {
      const ratePenalty = (100 - venue.rateRemaining) * 0.1;
      score -= ratePenalty;
      reasons.push(`rate limit: -${ratePenalty.toFixed(1)}`);
    }

    // Urgency adjustments
    if (request.urgency === 'high') {
      // Prioritize latency and reliability for urgent trades
      const urgencyAdjustment = (50 - venue.latency) * 0.2 + (venue.reliability - 0.9) * 50;
      score += urgencyAdjustment;
      if (urgencyAdjustment !== 0) {
        reasons.push(`urgency adjustment: ${urgencyAdjustment > 0 ? '+' : ''}${urgencyAdjustment.toFixed(1)}`);
      }
    } else if (request.urgency === 'low') {
      // Prioritize cost for non-urgent trades
      const costAdjustment = -(venue.feeBps + venue.spread_bps) * 0.3;
      score += costAdjustment;
      reasons.push(`cost optimization: ${costAdjustment.toFixed(1)}`);
    }

    // Symbol-specific adjustments
    if (request.symbol.includes('BTC')) {
      // BTC usually has better liquidity on major exchanges
      if (['binance', 'coinbase', 'kraken'].includes(venue.venue)) {
        score += 5;
        reasons.push(`BTC major exchange bonus: +5`);
      }
    }

    return {
      venue: venue.venue,
      score: Math.max(0, score),
      reasons,
      metrics: venue
    };
  }

  scoreAllVenues(request: RoutingRequest): VenueScore[] {
    const venues = this.registry.getAllVenues();
    const scores = venues
      .map(venue => this.scoreVenue(venue, request))
      .sort((a, b) => b.score - a.score);

    logger.debug(`Scored ${scores.length} venues for ${request.symbol} size ${request.size}`);
    return scores;
  }

  chooseVenue(request: RoutingRequest): VenueScore | null {
    const scores = this.scoreAllVenues(request);

    if (scores.length === 0) {
      logger.error('No venues available for routing');
      return null;
    }

    const chosen = scores[0];

    // Apply minimum score threshold
    if (chosen.score < 20) {
      logger.warn(`Best venue ${chosen.venue} has low score ${chosen.score}, execution may be suboptimal`);
    }

    logger.info(`Chose venue ${chosen.venue} with score ${chosen.score.toFixed(1)} for ${request.symbol}`);
    return chosen;
  }

  // Get routing recommendations
  getRecommendations(symbol: string, size: number): {
    primary: VenueScore | null;
    alternatives: VenueScore[];
    warnings: string[];
  } {
    const request: RoutingRequest = { symbol, size };
    const scores = this.scoreAllVenues(request);
    const warnings: string[] = [];

    if (scores.length === 0) {
      warnings.push('No venues available');
      return { primary: null, alternatives: [], warnings };
    }

    const primary = scores[0];
    const alternatives = scores.slice(1, 4); // Top 3 alternatives

    // Generate warnings
    if (primary.score < 50) {
      warnings.push('Primary venue has suboptimal conditions');
    }

    const avgReliability = scores.reduce((sum, s) => sum + s.metrics.reliability, 0) / scores.length;
    if (avgReliability < 0.9) {
      warnings.push('Market conditions appear degraded across venues');
    }

    const totalDepth = scores.reduce((sum, s) => sum + s.metrics.topDepth, 0);
    const requiredDepth = size * 50000; // Estimate
    if (totalDepth < requiredDepth * 2) {
      warnings.push('Limited liquidity available for this order size');
    }

    return { primary, alternatives, warnings };
  }
}

export const smartVenueRouter = new SmartVenueRouter(venueRegistry);