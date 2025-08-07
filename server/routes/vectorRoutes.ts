import { Router } from 'express';
import { vectorService } from '../services/vectorService';
import { logger } from '../utils/logger';
import { isAuthenticated } from '../replitAuth';

const router = Router();

// Get similar records by ID
router.get('/similar', isAuthenticated, async (req, res) => {
  try {
    const { type, id, k = 5 } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Record ID is required'
      });
    }

    await vectorService.initialize();

    let results;
    if (type && typeof type === 'string') {
      // Query by type and similarity
      results = await vectorService.querySimilar(id as string, type, parseInt(k as string));
    } else {
      // Find similar by specific record ID
      results = await vectorService.findSimilarById(id as string, parseInt(k as string));
    }

    // Filter out the original record if it's in results
    const filteredResults = results.filter(result => !result.id.endsWith(`_${id}`));

    res.json({
      success: true,
      data: filteredResults.slice(0, parseInt(k as string))
    });
  } catch (error) {
    logger.error('Failed to find similar records', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to find similar records'
    });
  }
});

// Query similar records by text
router.post('/query', isAuthenticated, async (req, res) => {
  try {
    const { query, type, k = 5 } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query text is required'
      });
    }

    await vectorService.initialize();

    const results = await vectorService.querySimilar(query, type, k);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error('Failed to query similar records', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to query similar records'
    });
  }
});

// Trigger manual indexing
router.post('/reindex', isAuthenticated, async (req, res) => {
  try {
    const { type } = req.body;

    await vectorService.initialize();

    let result;
    if (type === 'full') {
      result = await vectorService.runFullReindex();
    } else if (type === 'trades') {
      const trades = await vectorService.indexTradeEvents();
      result = { trades, signals: 0, backtests: 0 };
    } else if (type === 'signals') {
      const signals = await vectorService.indexAISignals();
      result = { trades: 0, signals, backtests: 0 };
    } else if (type === 'backtests') {
      const backtests = await vectorService.indexBacktestResults();
      result = { trades: 0, signals: 0, backtests };
    } else {
      // Index all types
      const trades = await vectorService.indexTradeEvents();
      const signals = await vectorService.indexAISignals();
      const backtests = await vectorService.indexBacktestResults();
      result = { trades, signals, backtests };
    }

    logger.info('Manual indexing triggered', { 
      type, 
      result, 
      user: (req.user as any)?.claims?.sub 
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Manual indexing failed', { error });
    res.status(500).json({
      success: false,
      error: 'Manual indexing failed'
    });
  }
});

// Get index statistics
router.get('/stats', isAuthenticated, async (req, res) => {
  try {
    await vectorService.initialize();

    const { db } = await import('../db');
    
    const result = await db.execute(`
      SELECT 
        index_type,
        total_records,
        last_indexed_at,
        version
      FROM vector_index_metadata
      ORDER BY index_type
    `);

    const totalVectors = await db.execute(`
      SELECT COUNT(*) as total FROM vector_records
    `);

    res.json({
      success: true,
      data: {
        indices: result.rows,
        total_vectors: totalVectors.rows[0]?.total || 0
      }
    });
  } catch (error) {
    logger.error('Failed to get vector stats', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get vector statistics'
    });
  }
});

export default router;