
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
