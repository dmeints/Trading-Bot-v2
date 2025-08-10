/**
 * Stevie Real Decision API
 * Exposes the actual algorithmic trading engine to the frontend
 */

import express from 'express';
import { stevieDecisionEngine } from '../services/stevieDecisionEngine';
import { storage } from '../storage';
import { logger } from '../utils/logger';

const router = express.Router();

// Get real trading decision from Stevie's algorithm
router.get('/decision/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const userId = (req as any).user?.claims?.sub || 'dev-user-123';
    
    // Get current position for the symbol
    const positions = await storage.getUserPositions(userId);
    const currentPosition = positions.find(p => p.symbol === symbol);
    
    // Get algorithmic decision
    const decision = await stevieDecisionEngine.getTradingDecision(symbol, currentPosition);
    
    // Get algorithm metrics
    const metrics = stevieDecisionEngine.getAlgorithmMetrics(symbol);
    
    res.json({
      decision,
      metrics,
      timestamp: new Date().toISOString(),
      algorithm: 'stevie-v2.0-real',
      provenance: {
        dataSource: 'comprehensive-8-stream',
        commit: process.env.REPLIT_SHA || 'dev'
      }
    });
    
  } catch (error) {
    logger.error('[Stevie Decision API] Error getting decision', { 
      error: error instanceof Error ? error.message : String(error),
      symbol: req.params.symbol 
    });
    
    res.status(500).json({
      error: 'Failed to get trading decision',
      algorithm: 'stevie-v2.0-real',
      fallback: {
        action: 'HOLD',
        confidence: 0,
        reasoning: 'Algorithm temporarily unavailable'
      }
    });
  }
});

// Get decision history for analysis
router.get('/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const history = stevieDecisionEngine.getDecisionHistory(symbol);
    const metrics = stevieDecisionEngine.getAlgorithmMetrics(symbol);
    
    res.json({
      symbol,
      history,
      metrics,
      count: history.length
    });
    
  } catch (error) {
    logger.error('[Stevie Decision API] Error getting history', { error });
    res.status(500).json({ error: 'Failed to get decision history' });
  }
});

export default router;