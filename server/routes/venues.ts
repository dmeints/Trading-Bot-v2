
import { Router } from 'express';
import { venueRegistry } from '../services/venues/VenueRegistry.js';
import { smartVenueRouter } from '../services/venues/SmartVenueRouter.js';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/venues/registry - Get all venue metrics
router.get('/registry', (req, res) => {
  try {
    const venues = venueRegistry.getAllVenues();
    res.json(venues);
  } catch (error) {
    logger.error('Venue registry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/venues/:venue - Get specific venue metrics
router.get('/:venue', (req, res) => {
  try {
    const { venue } = req.params;
    const metrics = venueRegistry.getVenue(venue);
    
    if (!metrics) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    res.json(metrics);
  } catch (error) {
    logger.error('Venue lookup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/venues/score - Score venues for trading request
router.post('/score', (req, res) => {
  try {
    const { symbol, size, urgency, maxLatency, minDepth } = req.body;
    
    if (!symbol || typeof size !== 'number') {
      return res.status(400).json({ error: 'symbol and size required' });
    }

    const request = { symbol, size, urgency, maxLatency, minDepth };
    const chosen = smartVenueRouter.chooseVenue(request);
    
    if (!chosen) {
      return res.status(404).json({ error: 'No suitable venues found' });
    }

    res.json(chosen);
  } catch (error) {
    logger.error('Venue scoring error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/venues/recommendations - Get routing recommendations
router.post('/recommendations', (req, res) => {
  try {
    const { symbol, size } = req.body;
    
    if (!symbol || typeof size !== 'number') {
      return res.status(400).json({ error: 'symbol and size required' });
    }

    const recommendations = smartVenueRouter.getRecommendations(symbol, size);
    res.json(recommendations);
  } catch (error) {
    logger.error('Venue recommendations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/venues/:venue/metrics - Update venue metrics
router.put('/:venue/metrics', (req, res) => {
  try {
    const { venue } = req.params;
    const updates = req.body;
    
    venueRegistry.updateVenue(venue, updates);
    res.json({ success: true, venue });
  } catch (error) {
    logger.error('Venue update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
