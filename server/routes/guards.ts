
import express from 'express';
import { riskGuards } from '../services/RiskGuards.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// GET /api/guards/state - Get current risk guard state
router.get('/state', async (req, res) => {
  try {
    const state = riskGuards.getState();
    
    res.json({
      ...state,
      symbolNotionals: Object.fromEntries(state.symbolNotionals),
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('Error getting risk guard state:', { error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/guards/check - Check if order would be allowed
router.post('/check', async (req, res) => {
  try {
    const { symbol, notional } = req.body;
    
    if (!symbol || !notional) {
      return res.status(400).json({ error: 'Missing symbol or notional' });
    }
    
    const result = riskGuards.checkOrder(symbol.toUpperCase(), parseFloat(notional));
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error checking risk guards:', { error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/guards/reset - Reset risk guards (admin only in production)
router.post('/reset', async (req, res) => {
  try {
    riskGuards.reset();
    
    res.json({
      status: 'success',
      message: 'Risk guards reset',
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('Error resetting risk guards:', { error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
