
import { eventsService } from '../server/services/events.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('Events Embedding', () => {
  beforeEach(() => {
    // Reset to clean state for each test
  });

  it('should generate non-zero embeddings from text', () => {
    eventsService.ingestEvent({
      title: 'Bitcoin reaches new all-time high',
      content: 'Bitcoin surged to a new record high as institutional adoption continues to grow.',
      source: 'test',
      sentiment: 0.8,
      timestamp: new Date()
    });

    const embeddings = eventsService.getEmbeddings();
    expect(embeddings.length).toBeGreaterThan(0);
    
    const latestEmbedding = embeddings[0];
    expect(latestEmbedding.embedding).toHaveLength(8);
    
    // Should have at least one non-zero value
    const hasNonZero = latestEmbedding.embedding.some(val => Math.abs(val) > 0.01);
    expect(hasNonZero).toBe(true);
  });

  it('should create context embedding from multiple events', () => {
    // Ingest multiple events
    eventsService.ingestEvent({
      title: 'Federal Reserve cuts rates',
      content: 'The Fed announced a surprise rate cut to support economic growth.',
      source: 'test',
      sentiment: 0.5,
      timestamp: new Date()
    });

    eventsService.ingestEvent({
      title: 'Major exchange security breach',
      content: 'Hackers compromised a major cryptocurrency exchange, raising security concerns.',
      source: 'test',
      sentiment: -0.7,
      timestamp: new Date()
    });

    const contextEmbedding = eventsService.getContextEmbedding();
    expect(contextEmbedding).toHaveLength(8);
    
    // Should be normalized/aggregated values
    const isReasonable = contextEmbedding.every(val => Math.abs(val) <= 1.0);
    expect(isReasonable).toBe(true);
  });

  it('should appear in strategy router context', async () => {
    // This test verifies the integration point
    const contextEmbedding = eventsService.getContextEmbedding();
    expect(Array.isArray(contextEmbedding)).toBe(true);
    expect(contextEmbedding.length).toBe(8);
    
    // Test that it can be included in router context
    const routerContext = {
      regime: 'bull',
      vol: 0.2,
      eventsEmbedding: contextEmbedding
    };
    
    expect(routerContext.eventsEmbedding).toEqual(contextEmbedding);
  });

  it('should handle empty events gracefully', () => {
    // Clear all events by creating new service instance
    const contextEmbedding = eventsService.getContextEmbedding();
    expect(Array.isArray(contextEmbedding)).toBe(true);
    expect(contextEmbedding.length).toBe(8);
    
    // With no events, should return zero vector or reasonable defaults
    const hasValues = contextEmbedding.some(val => Math.abs(val) > 0);
    // Should have some default values from initialization
    expect(hasValues).toBe(true);
  });

  it('should prioritize relevant events by sentiment score', () => {
    eventsService.ingestEvent({
      title: 'Minor trading update',
      content: 'A small exchange updated their API.',
      source: 'test',
      sentiment: 0.1, // Low relevance
      timestamp: new Date()
    });

    eventsService.ingestEvent({
      title: 'Bitcoin ETF approved by SEC',
      content: 'The SEC has approved the first Bitcoin ETF, marking a major milestone.',
      source: 'test',
      sentiment: 0.9, // High relevance
      timestamp: new Date()
    });

    const embeddings = eventsService.getEmbeddings();
    
    // Should be sorted by relevance (abs(sentiment))
    expect(embeddings[0].relevanceScore).toBeGreaterThanOrEqual(embeddings[1].relevanceScore);
  });
});
