
/**
 * Smart Venue Router - Intelligent venue selection
 */

import { venueRegistry, type VenueScore } from './VenueRegistry.js';
import { logger } from '../../utils/logger.js';

export interface VenueSelection {
  venue: string;
  score: number;
  reasons: string[];
  fallbacks: string[];
  confidence: number;
}

export interface RoutingContext {
  symbol: string;
  size: number;
  urgency: 'low' | 'medium' | 'high';
  maxSpreadBps?: number;
  minDepthUsd?: number;
  preferredVenues?: string[];
  blacklistedVenues?: string[];
}

class SmartVenueRouter {
  private routingHistory = new Map<string, Array<{ venue: string; success: boolean; timestamp: Date }>>();

  /**
   * Select best venue for execution
   */
  selectVenue(context: RoutingContext): VenueSelection {
    const { symbol, size, urgency, maxSpreadBps, minDepthUsd, preferredVenues, blacklistedVenues } = context;
    
    // Get scored venues
    let scores = venueRegistry.scoreVenues(symbol, size);
    
    // Apply filters
    scores = this.applyFilters(scores, {
      maxSpreadBps,
      minDepthUsd,
      preferredVenues,
      blacklistedVenues,
      urgency
    });

    if (scores.length === 0) {
      throw new Error('No suitable venues found');
    }

    const primary = scores[0];
    const fallbacks = scores.slice(1, 4).map(s => s.venue);
    const confidence = this.calculateConfidence(primary, scores);

    const selection: VenueSelection = {
      venue: primary.venue,
      score: primary.score,
      reasons: primary.reasons,
      fallbacks,
      confidence
    };

    logger.debug(`[SmartVenueRouter] Selected ${primary.venue} for ${symbol} (${size}), score=${primary.score.toFixed(1)}`);

    return selection;
  }

  /**
   * Record execution outcome for learning
   */
  recordOutcome(venue: string, symbol: string, success: boolean, actualLatency?: number): void {
    const key = `${venue}:${symbol}`;
    
    if (!this.routingHistory.has(key)) {
      this.routingHistory.set(key, []);
    }

    const history = this.routingHistory.get(key)!;
    history.push({
      venue,
      success,
      timestamp: new Date()
    });

    // Keep only last 100 outcomes
    if (history.length > 100) {
      history.shift();
    }

    // Update venue metrics
    if (actualLatency) {
      venueRegistry.recordPerformance(venue, actualLatency, success);
    }

    logger.debug(`[SmartVenueRouter] Recorded outcome for ${venue}: success=${success}`);
  }

  /**
   * Get venue routing statistics
   */
  getRoutingStats(): any {
    const stats: any = {};
    
    for (const [key, history] of this.routingHistory) {
      const [venue, symbol] = key.split(':');
      const successRate = history.filter(h => h.success).length / history.length;
      const recentOutcomes = history.slice(-20);
      const recentSuccessRate = recentOutcomes.filter(h => h.success).length / recentOutcomes.length;
      
      if (!stats[venue]) {
        stats[venue] = {};
      }
      
      stats[venue][symbol] = {
        totalOrders: history.length,
        successRate,
        recentSuccessRate,
        lastUsed: history[history.length - 1]?.timestamp
      };
    }
    
    return stats;
  }

  /**
   * Apply filtering logic to venue scores
   */
  private applyFilters(scores: VenueScore[], filters: {
    maxSpreadBps?: number;
    minDepthUsd?: number;
    preferredVenues?: string[];
    blacklistedVenues?: string[];
    urgency: string;
  }): VenueScore[] {
    let filtered = [...scores];

    // Filter by spread
    if (filters.maxSpreadBps) {
      filtered = filtered.filter(s => s.metrics.spreadBps <= filters.maxSpreadBps!);
    }

    // Filter by depth
    if (filters.minDepthUsd) {
      filtered = filtered.filter(s => s.metrics.topDepthUsd >= filters.minDepthUsd!);
    }

    // Apply blacklist
    if (filters.blacklistedVenues) {
      filtered = filtered.filter(s => !filters.blacklistedVenues!.includes(s.venue));
    }

    // Filter by rate limits for urgent orders
    if (filters.urgency === 'high') {
      filtered = filtered.filter(s => s.metrics.rateRemaining > 5);
    }

    // Boost preferred venues
    if (filters.preferredVenues) {
      for (const score of filtered) {
        if (filters.preferredVenues.includes(score.venue)) {
          score.score += 10;
          score.reasons.push('Preferred venue');
        }
      }
    }

    // Re-sort after filtering and boosting
    filtered.sort((a, b) => b.score - a.score);

    return filtered;
  }

  /**
   * Calculate confidence in venue selection
   */
  private calculateConfidence(primary: VenueScore, allScores: VenueScore[]): number {
    if (allScores.length < 2) {
      return 0.5; // Low confidence with only one option
    }

    const scoreDiff = primary.score - allScores[1].score;
    const maxPossibleDiff = 100;
    
    // Base confidence on score separation
    let confidence = Math.min(1, scoreDiff / (maxPossibleDiff * 0.3));
    
    // Adjust based on reliability
    confidence *= primary.metrics.reliability;
    
    // Adjust based on recent performance
    const venueKey = primary.venue;
    const history = this.routingHistory.get(venueKey);
    
    if (history && history.length > 5) {
      const recentSuccess = history.slice(-10).filter(h => h.success).length / Math.min(10, history.length);
      confidence *= recentSuccess;
    }

    return Math.max(0.1, Math.min(1, confidence));
  }
}

export const smartVenueRouter = new SmartVenueRouter();
