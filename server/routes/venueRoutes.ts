
/**
 * Venue Routes - Smart venue routing endpoints
 */

import { Router } from 'express';
import { venueRegistry } from '../services/venues/VenueRegistry';
import { smartVenueRouter } from '../services/venues/SmartVenueRouter';
import { logger } from '../utils/logger';

const router = Router();

// Get venue registry metrics
router.get('/registry', (req, res) => {
  try {
    const { venue, symbol } = req.query;
    const metrics = venueRegistry.getMetrics(
      venue as string, 
      symbol as string
    );
    
    res.json(metrics);
  } catch (error) {
    logger.error('[VenueRoutes] Failed to get registry:', error);
    res.status(500).json({ error: 'Failed to get venue registry' });
  }
});

// Score venues for a specific order
router.post('/score', (req, res) => {
  try {
    const { symbol, size } = req.body;
    
    if (!symbol || !size) {
      return res.status(400).json({ error: 'symbol and size required' });
    }
    
    const scores = smartVenueRouter.scoreVenue(symbol, size);
    const choice = smartVenueRouter.chooseVenue(symbol, size);
    
    res.json({
      scores,
      recommendation: choice
    });
  } catch (error) {
    logger.error('[VenueRoutes] Failed to score venues:', error);
    res.status(500).json({ error: 'Failed to score venues' });
  }
});

// Update venue metrics (internal use)
router.post('/update', (req, res) => {
  try {
    const { venue, symbol, metrics } = req.body;
    
    if (!venue || !symbol || !metrics) {
      return res.status(400).json({ error: 'venue, symbol, and metrics required' });
    }
    
    venueRegistry.updateVenueMetric(venue, symbol, metrics);
    res.json({ success: true });
  } catch (error) {
    logger.error('[VenueRoutes] Failed to update metrics:', error);
    res.status(500).json({ error: 'Failed to update venue metrics' });
  }
});

export { router as venueRoutes };
