
import { Router } from 'express';
import { eventsService } from '../services/events.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/events/embeddings
 * Returns current event embeddings for RAG context
 */
router.get('/embeddings', async (req, res) => {
  try {
    const embeddings = eventsService.getEmbeddings();
    res.json(embeddings);
  } catch (error) {
    logger.error('Error fetching event embeddings:', error);
    res.status(500).json({ error: 'Failed to fetch event embeddings' });
  }
});

/**
 * GET /api/events/context
 * Returns aggregated context embedding for strategy router
 */
router.get('/context', async (req, res) => {
  try {
    const contextEmbedding = eventsService.getContextEmbedding();
    res.json({ eventsEmbedding: contextEmbedding });
  } catch (error) {
    logger.error('Error fetching event context:', error);
    res.status(500).json({ error: 'Failed to fetch event context' });
  }
});

/**
 * GET /api/events/recent
 * Returns recent news events
 */
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const events = eventsService.getRecentEvents(limit);
    res.json(events);
  } catch (error) {
    logger.error('Error fetching recent events:', error);
    res.status(500).json({ error: 'Failed to fetch recent events' });
  }
});

/**
 * POST /api/events/ingest
 * Ingest new event for processing
 */
router.post('/ingest', async (req, res) => {
  try {
    const { title, content, source, sentiment } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    eventsService.ingestEvent({
      title,
      content,
      source: source || 'manual',
      sentiment: sentiment || 0,
      timestamp: new Date()
    });

    res.json({ success: true, message: 'Event ingested successfully' });
  } catch (error) {
    logger.error('Error ingesting event:', error);
    res.status(500).json({ error: 'Failed to ingest event' });
  }
});

export default router;
import express from 'express';
import { eventsService } from '../services/events.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.get('/embeddings', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const embeddings = eventsService.getEmbeddings(limit);
    res.json(embeddings);
  } catch (error) {
    logger.error('Error getting event embeddings:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: String(error)
    });
  }
});

router.get('/summary', (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const summary = eventsService.getEventSummary(hours);
    res.json(summary);
  } catch (error) {
    logger.error('Error getting event summary:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: String(error)
    });
  }
});

export default router;
