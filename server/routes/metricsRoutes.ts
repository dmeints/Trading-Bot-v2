
/**
 * Metrics Routes - Prometheus metrics
 */

import { Router } from 'express';
import { venueRegistry } from '../services/venues/VenueRegistry';
import { binanceMaintainer } from '../services/l2/BookMaintainer';
import { chaos } from '../services/Chaos';
import { smartVenueRouter } from '../services/venues/SmartVenueRouter';
import { logger } from '../utils/logger';

const router = Router();

// Prometheus metrics endpoint
router.get('/', (req, res) => {
  try {
    const metrics: string[] = [];
    
    // Venue metrics
    const venues = venueRegistry.getMetrics();
    for (const venue of venues) {
      metrics.push(`venue_score{venue="${venue.venue}",symbol="${venue.symbol}"} ${venue.reliabilityScore}`);
      metrics.push(`venue_latency_ms{venue="${venue.venue}",symbol="${venue.symbol}"} ${venue.latencyMs}`);
      metrics.push(`venue_spread_bps{venue="${venue.venue}",symbol="${venue.symbol}"} ${venue.spread_bps}`);
      metrics.push(`venue_depth{venue="${venue.venue}",symbol="${venue.symbol}"} ${venue.topDepth}`);
      metrics.push(`venue_rate_remaining{venue="${venue.venue}",symbol="${venue.symbol}"} ${venue.rateRemaining}`);
    }
    
    // L2 metrics
    const books = binanceMaintainer.getAllBooks();
    metrics.push(`l2_books_total ${books.length}`);
    metrics.push(`l2_connected ${binanceMaintainer.isHealthy() ? 1 : 0}`);
    
    for (const book of books) {
      const sequence = book.getSequence();
      const lastUpdate = book.getLastUpdate();
      const spread = book.getSpread();
      
      metrics.push(`l2_sequence{venue="${book.venue}",symbol="${book.symbol}"} ${sequence}`);
      metrics.push(`l2_last_update_timestamp_seconds{venue="${book.venue}",symbol="${book.symbol}"} ${Math.floor(lastUpdate / 1000)}`);
      metrics.push(`l2_spread{venue="${book.venue}",symbol="${book.symbol}"} ${spread}`);
    }
    
    // Chaos metrics
    const activeEvents = chaos.getActiveEvents();
    const eventHistory = chaos.getEventHistory(100);
    
    metrics.push(`chaos_active_events_total ${activeEvents.length}`);
    
    const eventCounts = eventHistory.reduce((counts, event) => {
      counts[event.type] = (counts[event.type] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    for (const [type, count] of Object.entries(eventCounts)) {
      metrics.push(`chaos_injections_total{type="${type}"} ${count}`);
    }
    
    // System health
    const systemHealth = chaos.getSystemHealth();
    metrics.push(`system_healthy ${systemHealth.healthy ? 1 : 0}`);
    
    // Router metrics (mock)
    metrics.push(`router_decisions_total 42`);
    metrics.push(`exec_blocked_total 5`);
    
    // Price stream status (mock)
    metrics.push(`price_stream_connected 1`);
    metrics.push(`ohlcv_last_sync_timestamp_seconds ${Math.floor(Date.now() / 1000)}`);
    
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(metrics.join('\n') + '\n');
  } catch (error) {
    logger.error('[MetricsRoutes] Failed to generate metrics:', error);
    res.status(500).send('# Failed to generate metrics\n');
  }
});

export { router as metricsRoutes };
