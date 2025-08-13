
/**
 * Venue Registry and Smart Routing API Routes
 */

import { Router } from 'express';
import { venueRegistry } from '../services/venues/VenueRegistry.js';
import { smartVenueRouter, type RoutingContext } from '../services/venues/SmartVenueRouter.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/venues/registry
 * Get all venues with current metrics
 */
router.get('/registry', (req, res) => {
  try {
    const venues = venueRegistry.getAllVenues();
    res.json(venues);
  } catch (error) {
    logger.error('[VenueRoutes] Error getting registry:', error);
    res.status(500).json({ error: 'Failed to get venue registry' });
  }
});

/**
 * POST /api/venues/score
 * Score venues for symbol/size combination
 */
router.post('/score', (req, res) => {
  try {
    const { symbol, size } = req.body;
    
    if (!symbol || typeof size !== 'number') {
      return res.status(400).json({ error: 'Missing symbol or size' });
    }

    const scores = venueRegistry.scoreVenues(symbol, size);
    res.json(scores);
  } catch (error) {
    logger.error('[VenueRoutes] Error scoring venues:', error);
    res.status(500).json({ error: 'Failed to score venues' });
  }
});

/**
 * POST /api/venues/select
 * Select best venue using smart routing
 */
router.post('/select', (req, res) => {
  try {
    const context: RoutingContext = req.body;
    
    if (!context.symbol || typeof context.size !== 'number') {
      return res.status(400).json({ error: 'Missing symbol or size' });
    }

    // Set defaults
    context.urgency = context.urgency || 'medium';

    const selection = smartVenueRouter.selectVenue(context);
    res.json(selection);
  } catch (error) {
    logger.error('[VenueRoutes] Error selecting venue:', error);
    res.status(500).json({ error: 'Failed to select venue' });
  }
});

/**
 * POST /api/venues/outcome
 * Record execution outcome for learning
 */
router.post('/outcome', (req, res) => {
  try {
    const { venue, symbol, success, latency } = req.body;
    
    if (!venue || !symbol || typeof success !== 'boolean') {
      return res.status(400).json({ error: 'Missing venue, symbol, or success' });
    }

    smartVenueRouter.recordOutcome(venue, symbol, success, latency);
    res.json({ success: true });
  } catch (error) {
    logger.error('[VenueRoutes] Error recording outcome:', error);
    res.status(500).json({ error: 'Failed to record outcome' });
  }
});

/**
 * GET /api/venues/stats
 * Get routing statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = smartVenueRouter.getRoutingStats();
    res.json(stats);
  } catch (error) {
    logger.error('[VenueRoutes] Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get routing stats' });
  }
});

export default router;
