/**
 * External Connectors API Routes - Phase A Implementation
 * RESTful endpoints for managing all 8 external data connectors with health monitoring
 */

import { Router } from 'express';
import { connectorManager } from '../connectors/index';
import { db } from '../db';
import { marketBars, orderbookSnaps, sentimentTicks, onchainTicks, macroEvents, connectorHealth } from '@shared/schema';
import { desc, eq, and, gte, lte } from 'drizzle-orm';
import { logger } from '../utils/logger';

export const externalConnectorsRouter = Router();

/**
 * GET /api/connectors/health
 * Get health status of all connectors
 */
externalConnectorsRouter.get('/health', async (req, res) => {
  try {
    const healthSummaries = await connectorManager.getAllConnectorHealth();
    
    // Also get latest health data from database
    const dbHealth = await db
      .select()
      .from(connectorHealth)
      .orderBy(desc(connectorHealth.updatedAt));

    const combinedHealth = healthSummaries.map(summary => {
      const dbRecord = dbHealth.find(h => h.provider === summary.provider);
      return {
        ...summary,
        lastSuccessfulFetch: dbRecord?.lastSuccessfulFetch,
        quotaUsed: dbRecord?.quotaUsed || summary.requestCount,
        quotaLimit: dbRecord?.quotaLimit,
        lastError: dbRecord?.lastError,
      };
    });

    res.json({
      success: true,
      data: {
        connectors: combinedHealth,
        summary: {
          total: combinedHealth.length,
          healthy: combinedHealth.filter(c => c.status === 'healthy').length,
          degraded: combinedHealth.filter(c => c.status === 'degraded').length,
          down: combinedHealth.filter(c => c.status === 'down').length,
          configured: combinedHealth.filter(c => c.configured).length,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get connector health', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve connector health status',
    });
  }
});

/**
 * POST /api/connectors/fetch-all
 * Trigger comprehensive data fetch from all connectors
 */
externalConnectorsRouter.post('/fetch-all', async (req, res) => {
  try {
    const result = await connectorManager.fetchAllData();
    
    res.json({
      success: true,
      data: {
        summary: result.summary,
        results: result.results,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to fetch data from all connectors', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch data from connectors',
    });
  }
});

/**
 * POST /api/connectors/fetch-market
 * Fetch market data (CoinGecko + Binance)
 */
externalConnectorsRouter.post('/fetch-market', async (req, res) => {
  try {
    const { symbols } = req.body;
    const results = await connectorManager.fetchMarketData(symbols);
    
    res.json({
      success: true,
      data: {
        results,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to fetch market data', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market data',
    });
  }
});

/**
 * POST /api/connectors/fetch-sentiment
 * Fetch sentiment data (Twitter + Reddit + CryptoPanic)
 */
externalConnectorsRouter.post('/fetch-sentiment', async (req, res) => {
  try {
    const { symbols } = req.body;
    const results = await connectorManager.fetchSentimentData(symbols);
    
    res.json({
      success: true,
      data: {
        results,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to fetch sentiment data', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sentiment data',
    });
  }
});

/**
 * POST /api/connectors/fetch-onchain
 * Fetch on-chain data (Etherscan + Blockchair)
 */
externalConnectorsRouter.post('/fetch-onchain', async (req, res) => {
  try {
    const results = await connectorManager.fetchOnChainData();
    
    res.json({
      success: true,
      data: {
        results,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to fetch on-chain data', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch on-chain data',
    });
  }
});

/**
 * POST /api/connectors/fetch-macro
 * Fetch macro economic data (Trading Economics)
 */
externalConnectorsRouter.post('/fetch-macro', async (req, res) => {
  try {
    const results = await connectorManager.fetchMacroData();
    
    res.json({
      success: true,
      data: {
        results,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to fetch macro data', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch macro data',
    });
  }
});

/**
 * GET /api/connectors/data/market-bars
 * Get stored market bars data
 */
externalConnectorsRouter.get('/data/market-bars', async (req, res) => {
  try {
    const { symbol, provider, timeframe, from, to, limit = '100' } = req.query;
    
    let query = db.select().from(marketBars);
    const conditions = [];
    
    if (symbol) {
      conditions.push(eq(marketBars.symbol, symbol as string));
    }
    
    if (provider) {
      conditions.push(eq(marketBars.provider, provider as string));
    }
    
    if (timeframe) {
      conditions.push(eq(marketBars.timeframe, timeframe as string));
    }
    
    if (from) {
      conditions.push(gte(marketBars.timestamp, new Date(from as string)));
    }
    
    if (to) {
      conditions.push(lte(marketBars.timestamp, new Date(to as string)));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const bars = await query
      .orderBy(desc(marketBars.timestamp))
      .limit(parseInt(limit as string, 10));
    
    res.json({
      success: true,
      data: {
        bars,
        count: bars.length,
        query_params: { symbol, provider, timeframe, from, to, limit },
      },
    });
  } catch (error) {
    logger.error('Failed to retrieve market bars', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve market bars',
    });
  }
});

/**
 * GET /api/connectors/data/sentiment-ticks
 * Get stored sentiment ticks data
 */
externalConnectorsRouter.get('/data/sentiment-ticks', async (req, res) => {
  try {
    const { symbol, source, from, to, limit = '100' } = req.query;
    
    let query = db.select().from(sentimentTicks);
    const conditions = [];
    
    if (symbol) {
      conditions.push(eq(sentimentTicks.symbol, symbol as string));
    }
    
    if (source) {
      conditions.push(eq(sentimentTicks.source, source as string));
    }
    
    if (from) {
      conditions.push(gte(sentimentTicks.timestamp, new Date(from as string)));
    }
    
    if (to) {
      conditions.push(lte(sentimentTicks.timestamp, new Date(to as string)));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const ticks = await query
      .orderBy(desc(sentimentTicks.timestamp))
      .limit(parseInt(limit as string, 10));
    
    res.json({
      success: true,
      data: {
        ticks,
        count: ticks.length,
        query_params: { symbol, source, from, to, limit },
      },
    });
  } catch (error) {
    logger.error('Failed to retrieve sentiment ticks', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve sentiment ticks',
    });
  }
});

/**
 * GET /api/connectors/data/onchain-ticks
 * Get stored on-chain ticks data
 */
externalConnectorsRouter.get('/data/onchain-ticks', async (req, res) => {
  try {
    const { chain, metric, provider, from, to, limit = '100' } = req.query;
    
    let query = db.select().from(onchainTicks);
    const conditions = [];
    
    if (chain) {
      conditions.push(eq(onchainTicks.chain, chain as string));
    }
    
    if (metric) {
      conditions.push(eq(onchainTicks.metric, metric as string));
    }
    
    if (provider) {
      conditions.push(eq(onchainTicks.provider, provider as string));
    }
    
    if (from) {
      conditions.push(gte(onchainTicks.timestamp, new Date(from as string)));
    }
    
    if (to) {
      conditions.push(lte(onchainTicks.timestamp, new Date(to as string)));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const ticks = await query
      .orderBy(desc(onchainTicks.timestamp))
      .limit(parseInt(limit as string, 10));
    
    res.json({
      success: true,
      data: {
        ticks,
        count: ticks.length,
        query_params: { chain, metric, provider, from, to, limit },
      },
    });
  } catch (error) {
    logger.error('Failed to retrieve on-chain ticks', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve on-chain ticks',
    });
  }
});

/**
 * GET /api/connectors/data/macro-events
 * Get stored macro economic events
 */
externalConnectorsRouter.get('/data/macro-events', async (req, res) => {
  try {
    const { importance, from, to, limit = '100' } = req.query;
    
    let query = db.select().from(macroEvents);
    const conditions = [];
    
    if (importance) {
      conditions.push(eq(macroEvents.importance, importance as string));
    }
    
    if (from) {
      conditions.push(gte(macroEvents.timestamp, new Date(from as string)));
    }
    
    if (to) {
      conditions.push(lte(macroEvents.timestamp, new Date(to as string)));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const events = await query
      .orderBy(desc(macroEvents.timestamp))
      .limit(parseInt(limit as string, 10));
    
    res.json({
      success: true,
      data: {
        events,
        count: events.length,
        query_params: { importance, from, to, limit },
      },
    });
  } catch (error) {
    logger.error('Failed to retrieve macro events', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve macro events',
    });
  }
});

/**
 * GET /api/connectors/data/orderbook-snaps
 * Get stored order book snapshots
 */
externalConnectorsRouter.get('/data/orderbook-snaps', async (req, res) => {
  try {
    const { symbol, provider, from, to, limit = '100' } = req.query;
    
    let query = db.select().from(orderbookSnaps);
    const conditions = [];
    
    if (symbol) {
      conditions.push(eq(orderbookSnaps.symbol, symbol as string));
    }
    
    if (provider) {
      conditions.push(eq(orderbookSnaps.provider, provider as string));
    }
    
    if (from) {
      conditions.push(gte(orderbookSnaps.timestamp, new Date(from as string)));
    }
    
    if (to) {
      conditions.push(lte(orderbookSnaps.timestamp, new Date(to as string)));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const snaps = await query
      .orderBy(desc(orderbookSnaps.timestamp))
      .limit(parseInt(limit as string, 10));
    
    res.json({
      success: true,
      data: {
        snapshots: snaps,
        count: snaps.length,
        query_params: { symbol, provider, from, to, limit },
      },
    });
  } catch (error) {
    logger.error('Failed to retrieve order book snapshots', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve order book snapshots',
    });
  }
});

/**
 * GET /api/connectors/stats
 * Get database statistics for all connector data
 */
externalConnectorsRouter.get('/stats', async (req, res) => {
  try {
    const [
      marketBarStats,
      sentimentStats,
      onchainStats,
      macroStats,
      orderbookStats
    ] = await Promise.all([
      // Market bars total count
      db.select()
        .from(marketBars)
        .then(rows => ({ total: rows.length }))
        .catch(() => ({ total: 0 })),
      
      // Sentiment ticks total count  
      db.select()
        .from(sentimentTicks)
        .then(rows => ({ total: rows.length }))
        .catch(() => ({ total: 0 })),
      
      // On-chain ticks total count
      db.select()
        .from(onchainTicks)
        .then(rows => ({ total: rows.length }))
        .catch(() => ({ total: 0 })),
      
      // Macro events total count
      db.select()
        .from(macroEvents)
        .then(rows => ({ total: rows.length }))
        .catch(() => ({ total: 0 })),
      
      // Order book snapshots total count
      db.select()
        .from(orderbookSnaps)
        .then(rows => ({ total: rows.length }))
        .catch(() => ({ total: 0 })),
    ]);

    res.json({
      success: true,
      data: {
        market_bars: {
          total: marketBarStats.total,
        },
        sentiment_ticks: {
          total: sentimentStats.total,
        },
        onchain_ticks: {
          total: onchainStats.total,
        },
        macro_events: {
          total: macroStats.total,
        },
        orderbook_snapshots: {
          total: orderbookStats.total,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to retrieve connector stats', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve database statistics',
    });
  }
});

/**
 * POST /api/connectors/realtime/start
 * Start real-time data streams
 */
externalConnectorsRouter.post('/realtime/start', async (req, res) => {
  try {
    connectorManager.startRealTimeStreams();
    
    res.json({
      success: true,
      message: 'Real-time data streams started successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to start real-time streams', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start real-time streams',
    });
  }
});

/**
 * POST /api/connectors/test
 * Test connectivity to all connectors
 */
externalConnectorsRouter.post('/test', async (req, res) => {
  try {
    const { provider } = req.body;
    
    if (provider) {
      // Test specific provider
      switch (provider) {
        case 'coingecko':
          const cgResults = await connectorManager.fetchMarketData(['BTCUSDT']);
          res.json({
            success: true,
            provider,
            result: cgResults[0],
            timestamp: new Date().toISOString(),
          });
          break;
        default:
          res.status(400).json({
            success: false,
            error: `Unknown provider: ${provider}`,
          });
      }
    } else {
      // Test all providers with minimal data
      const testResults = await connectorManager.fetchAllData();
      
      res.json({
        success: true,
        message: 'All connectors tested',
        results: testResults.results,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Failed to test connectors', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test connector connectivity',
    });
  }
});

export default externalConnectorsRouter;