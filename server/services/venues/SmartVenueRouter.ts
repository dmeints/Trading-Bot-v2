
/**
 * Smart Venue Router - Choose optimal venue per order
 */

import { venueRegistry, type VenueMetrics } from './VenueRegistry';
import { logger } from '../../utils/logger';

export interface VenueScore {
  venue: string;
  score: number;
  reasons: {
    spread: number;
    depth: number;
    fee: number;
    latency: number;
    reliability: number;
  };
  metrics: VenueMetrics;
}

export interface VenueChoice {
  venue: string;
  score: number;
  reasons: string[];
  confidence: number;
}

export class SmartVenueRouter {
  private weights = {
    spread: 0.3,
    depth: 0.25,
    fee: 0.2,
    latency: 0.15,
    reliability: 0.1
  };

  scoreVenue(symbol: string, size: number): VenueScore[] {
    const metrics = venueRegistry.getMetrics(undefined, symbol);
    const scores: VenueScore[] = [];

    for (const metric of metrics) {
      const reasons = this.calculateReasons(metric, size);
      const score = this.calculateWeightedScore(reasons);

      scores.push({
        venue: metric.venue,
        score,
        reasons,
        metrics: metric
      });
    }

    return scores.sort((a, b) => b.score - a.score);
  }

  chooseVenue(symbol: string, size: number): VenueChoice {
    const scores = this.scoreVenue(symbol, size);
    
    if (scores.length === 0) {
      throw new Error(`No venues available for ${symbol}`);
    }

    const best = scores[0];
    const reasons = this.generateReasons(best);
    const confidence = this.calculateConfidence(scores);

    logger.info(`[SmartVenueRouter] Chose ${best.venue} for ${symbol} (score: ${best.score.toFixed(3)})`);

    return {
      venue: best.venue,
      score: best.score,
      reasons,
      confidence
    };
  }

  private calculateReasons(metric: VenueMetrics, size: number): VenueScore['reasons'] {
    // Normalize scores (0-1, higher is better)
    return {
      spread: Math.max(0, 1 - (metric.spread_bps / 50)), // Lower spread = better
      depth: Math.min(1, metric.topDepth / (size * 100000)), // Higher depth = better
      fee: Math.max(0, 1 - (metric.feeBps / 20)), // Lower fee = better
      latency: Math.max(0, 1 - (metric.latencyMs / 500)), // Lower latency = better
      reliability: metric.reliabilityScore // Already 0-1
    };
  }

  private calculateWeightedScore(reasons: VenueScore['reasons']): number {
    return (
      reasons.spread * this.weights.spread +
      reasons.depth * this.weights.depth +
      reasons.fee * this.weights.fee +
      reasons.latency * this.weights.latency +
      reasons.reliability * this.weights.reliability
    );
  }

  private generateReasons(score: VenueScore): string[] {
    const reasons: string[] = [];
    
    if (score.reasons.spread > 0.8) reasons.push('tight spread');
    if (score.reasons.depth > 0.8) reasons.push('deep liquidity');
    if (score.reasons.fee > 0.8) reasons.push('low fees');
    if (score.reasons.latency > 0.8) reasons.push('low latency');
    if (score.reasons.reliability > 0.9) reasons.push('high reliability');

    return reasons.length > 0 ? reasons : ['best available option'];
  }

  private calculateConfidence(scores: VenueScore[]): number {
    if (scores.length < 2) return 1.0;
    
    const best = scores[0].score;
    const second = scores[1].score;
    const gap = best - second;
    
    // Higher gap = higher confidence
    return Math.min(1.0, 0.5 + gap);
  }

  updateWeights(weights: Partial<typeof this.weights>): void {
    Object.assign(this.weights, weights);
    logger.info('[SmartVenueRouter] Updated routing weights', weights);
  }
}

export const smartVenueRouter = new SmartVenueRouter();
