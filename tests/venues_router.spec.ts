
/**
 * Venue Router Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { venueRegistry } from '../server/services/venues/VenueRegistry';
import { smartVenueRouter } from '../server/services/venues/SmartVenueRouter';

describe('Venue Router', () => {
  beforeEach(() => {
    // Reset registry
  });

  it('should score venues based on spread, depth, and fees', () => {
    const scores = smartVenueRouter.scoreVenue('BTCUSDT', 0.01);
    
    expect(scores).toHaveLength(4); // binance, coinbase, kraken, deribit
    expect(scores[0]).toHaveProperty('venue');
    expect(scores[0]).toHaveProperty('score');
    expect(scores[0]).toHaveProperty('reasons');
    
    // Higher score should be better
    expect(scores[0].score).toBeGreaterThanOrEqual(scores[1].score);
  });

  it('should choose best venue with rationale', () => {
    const choice = smartVenueRouter.chooseVenue('BTCUSDT', 0.01);
    
    expect(choice).toHaveProperty('venue');
    expect(choice).toHaveProperty('score');
    expect(choice).toHaveProperty('reasons');
    expect(choice).toHaveProperty('confidence');
    
    expect(choice.score).toBeGreaterThan(0);
    expect(choice.confidence).toBeGreaterThan(0);
    expect(choice.confidence).toBeLessThanOrEqual(1);
    expect(Array.isArray(choice.reasons)).toBe(true);
  });

  it('should apply reliability penalty for low reliability venues', () => {
    // Update a venue to have low reliability
    venueRegistry.updateVenueMetric('binance', 'BTCUSDT', {
      reliabilityScore: 0.3
    });
    
    const scores = smartVenueRouter.scoreVenue('BTCUSDT', 0.01);
    const binanceScore = scores.find(s => s.venue === 'binance');
    
    expect(binanceScore?.reasons.reliability).toBeLessThan(0.5);
  });

  it('should prefer venues with lower spread and higher depth', () => {
    // Set up venues with different characteristics
    venueRegistry.updateVenueMetric('binance', 'BTCUSDT', {
      spread_bps: 1, // Very tight spread
      topDepth: 100000 // High depth
    });
    
    venueRegistry.updateVenueMetric('coinbase', 'BTCUSDT', {
      spread_bps: 10, // Wide spread  
      topDepth: 1000 // Low depth
    });
    
    const scores = smartVenueRouter.scoreVenue('BTCUSDT', 0.01);
    const binanceScore = scores.find(s => s.venue === 'binance')?.score || 0;
    const coinbaseScore = scores.find(s => s.venue === 'coinbase')?.score || 0;
    
    expect(binanceScore).toBeGreaterThan(coinbaseScore);
  });
});
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VenueRegistry } from '../server/services/venues/VenueRegistry.js';
import { SmartVenueRouter } from '../server/services/venues/SmartVenueRouter.js';

describe('Venue Registry', () => {
  let registry: VenueRegistry;

  beforeEach(() => {
    registry = new VenueRegistry();
  });

  afterEach(() => {
    registry.destroy();
  });

  it('should initialize with default venues', () => {
    const venues = registry.getAllVenues();
    expect(venues.length).toBeGreaterThan(0);
    
    const binance = registry.getVenue('binance');
    expect(binance).toBeDefined();
    expect(binance?.latency).toBeGreaterThan(0);
    expect(binance?.spread_bps).toBeGreaterThan(0);
    expect(binance?.reliability).toBeGreaterThan(0.8);
  });

  it('should update venue metrics', () => {
    const originalMetrics = registry.getVenue('binance')!;
    const originalLatency = originalMetrics.latency;

    registry.updateVenue('binance', { latency: 999 });

    const updatedMetrics = registry.getVenue('binance')!;
    expect(updatedMetrics.latency).toBe(999);
    expect(updatedMetrics.lastUpdate).toBeGreaterThan(originalMetrics.lastUpdate);
  });

  it('should handle venue degradation', () => {
    const originalMetrics = registry.getVenue('binance')!;
    const originalReliability = originalMetrics.reliability;

    registry.markDegraded('binance', 'test degradation');

    const degradedMetrics = registry.getVenue('binance')!;
    expect(degradedMetrics.reliability).toBeLessThan(originalReliability);
    expect(degradedMetrics.latency).toBeGreaterThan(originalMetrics.latency);
  });
});

describe('Smart Venue Router', () => {
  let registry: VenueRegistry;
  let router: SmartVenueRouter;

  beforeEach(() => {
    registry = new VenueRegistry();
    router = new SmartVenueRouter(registry);
  });

  afterEach(() => {
    registry.destroy();
  });

  it('should score venues correctly', () => {
    const request = {
      symbol: 'BTCUSDT',
      size: 1.0
    };

    const scores = router.scoreAllVenues(request);
    
    expect(scores.length).toBeGreaterThan(0);
    expect(scores[0].score).toBeGreaterThanOrEqual(scores[1]?.score || 0);
    
    for (const score of scores) {
      expect(score.venue).toBeDefined();
      expect(typeof score.score).toBe('number');
      expect(score.reasons).toBeInstanceOf(Array);
      expect(score.metrics).toBeDefined();
    }
  });

  it('should choose best venue', () => {
    const request = {
      symbol: 'BTCUSDT',
      size: 0.5
    };

    const choice = router.chooseVenue(request);
    
    expect(choice).toBeDefined();
    expect(choice?.venue).toBeDefined();
    expect(choice?.score).toBeGreaterThan(0);
    expect(choice?.reasons.length).toBeGreaterThan(0);
  });

  it('should adjust scoring for urgency', () => {
    const baseRequest = {
      symbol: 'BTCUSDT',
      size: 1.0
    };

    const urgentRequest = {
      ...baseRequest,
      urgency: 'high' as const
    };

    const baseScores = router.scoreAllVenues(baseRequest);
    const urgentScores = router.scoreAllVenues(urgentRequest);

    // Urgent requests should potentially reorder venues based on latency
    expect(urgentScores.length).toBe(baseScores.length);
    
    // Find low-latency venue in urgent scores
    const lowLatencyVenue = urgentScores.find(s => s.metrics.latency < 60);
    expect(lowLatencyVenue).toBeDefined();
  });

  it('should penalize insufficient depth', () => {
    const largeRequest = {
      symbol: 'BTCUSDT',
      size: 100.0 // Very large order
    };

    const scores = router.scoreAllVenues(largeRequest);
    
    // Should penalize venues with insufficient depth
    for (const score of scores) {
      if (score.metrics.topDepth < 1000000) { // $1M threshold
        expect(score.reasons.some(r => r.includes('depth'))).toBe(true);
      }
    }
  });

  it('should provide routing recommendations', () => {
    const recommendations = router.getRecommendations('BTCUSDT', 1.0);

    expect(recommendations.primary).toBeDefined();
    expect(recommendations.alternatives).toBeInstanceOf(Array);
    expect(recommendations.warnings).toBeInstanceOf(Array);

    if (recommendations.primary) {
      expect(recommendations.primary.venue).toBeDefined();
      expect(recommendations.primary.score).toBeGreaterThan(0);
    }

    expect(recommendations.alternatives.length).toBeLessThanOrEqual(3);
  });

  it('should handle BTC-specific routing', () => {
    const btcRequest = {
      symbol: 'BTCUSDT',
      size: 1.0
    };

    const scores = router.scoreAllVenues(btcRequest);
    
    // Major exchanges should get bonus for BTC
    const majorExchanges = ['binance', 'coinbase', 'kraken'];
    const majorScore = scores.find(s => majorExchanges.includes(s.venue));
    
    if (majorScore) {
      expect(majorScore.reasons.some(r => r.includes('BTC major exchange'))).toBe(true);
    }
  });
});
