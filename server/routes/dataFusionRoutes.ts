import { Router } from 'express';
import { onChainService } from '../services/onChainService';
import { sentimentService } from '../services/sentimentService';
import { logger } from '../utils/logger';
import { isAuthenticated } from '../replitAuth';

const router = Router();

// Get recent on-chain events
router.get('/onchain/events', isAuthenticated, async (req, res) => {
  try {
    const { hours = 24, token } = req.query;

    await onChainService.initialize();

    let events;
    if (token) {
      events = await onChainService.getEventsByToken(token as string, 50);
    } else {
      events = await onChainService.getRecentEvents(parseInt(hours as string));
    }

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    logger.error('Failed to fetch on-chain events', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch on-chain events'
    });
  }
});

// Trigger manual on-chain data fetch
router.post('/onchain/fetch', isAuthenticated, async (req, res) => {
  try {
    await onChainService.initialize();
    const events = await onChainService.fetchWhaleTransfers();

    logger.info('Manual on-chain data fetch triggered', { 
      eventsIngested: events.length,
      user: (req.user as any)?.claims?.sub 
    });

    res.json({
      success: true,
      data: {
        eventsIngested: events.length,
        events: events.slice(0, 10) // Return first 10 for preview
      }
    });
  } catch (error) {
    logger.error('Manual on-chain data fetch failed', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch on-chain data'
    });
  }
});

// Get sentiment data
router.get('/sentiment', isAuthenticated, async (req, res) => {
  try {
    const { days = 7, token, source } = req.query;

    await sentimentService.initialize();

    let sentimentData;
    if (token) {
      sentimentData = await sentimentService.getSentimentByToken(token as string, parseInt(days as string));
    } else {
      sentimentData = await sentimentService.getRecentSentiment(parseInt(days as string));
    }

    // Filter by source if specified
    if (source) {
      sentimentData = sentimentData.filter(data => data.source === source);
    }

    res.json({
      success: true,
      data: sentimentData
    });
  } catch (error) {
    logger.error('Failed to fetch sentiment data', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sentiment data'
    });
  }
});

// Get aggregated sentiment summary
router.get('/sentiment/aggregate', isAuthenticated, async (req, res) => {
  try {
    const { days = 7 } = req.query;

    await sentimentService.initialize();
    const aggregatedData = await sentimentService.getAggregatedSentiment(parseInt(days as string));

    res.json({
      success: true,
      data: aggregatedData
    });
  } catch (error) {
    logger.error('Failed to fetch aggregated sentiment', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch aggregated sentiment'
    });
  }
});

// Trigger manual sentiment data fetch
router.post('/sentiment/fetch', isAuthenticated, async (req, res) => {
  try {
    await sentimentService.initialize();
    const sentimentData = await sentimentService.fetchDailySentiment();

    logger.info('Manual sentiment data fetch triggered', { 
      recordsCreated: sentimentData.length,
      user: (req.user as any)?.claims?.sub 
    });

    res.json({
      success: true,
      data: {
        recordsCreated: sentimentData.length,
        sentiment: sentimentData
      }
    });
  } catch (error) {
    logger.error('Manual sentiment data fetch failed', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sentiment data'
    });
  }
});

// Get combined market context (on-chain + sentiment)
router.get('/market-context', isAuthenticated, async (req, res) => {
  try {
    const { token = 'BTC', hours = 24 } = req.query;

    await Promise.all([
      onChainService.initialize(),
      sentimentService.initialize()
    ]);

    const [onChainEvents, sentimentData] = await Promise.all([
      onChainService.getEventsByToken(token as string, 10),
      sentimentService.getSentimentByToken(token as string, 1)
    ]);

    res.json({
      success: true,
      data: {
        token,
        onchain_events: onChainEvents,
        sentiment: sentimentData,
        summary: {
          recent_whale_activity: onChainEvents.length,
          avg_sentiment: sentimentData.length > 0 
            ? sentimentData.reduce((sum, s) => sum + s.score, 0) / sentimentData.length 
            : 0,
          total_mentions: sentimentData.reduce((sum, s) => sum + (s.metadata.total_mentions || 0), 0)
        }
      }
    });
  } catch (error) {
    logger.error('Failed to fetch market context', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market context'
    });
  }
});

export default router;