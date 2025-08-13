
import express from 'express';
import { executionRouter } from '../services/ExecutionRouter.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// POST /api/exec/simulate - Simulate execution plan and cost
router.post('/simulate', async (req, res) => {
  try {
    const { symbol, size, ...context } = req.body;
    
    if (!symbol || !size) {
      return res.status(400).json({ error: 'Missing symbol or size' });
    }
    
    const plan = await executionRouter.plan({
      symbol: symbol.toUpperCase(),
      maxSize: parseFloat(size),
      ...context
    });
    
    res.json({
      plan,
      simulation: true,
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('Error simulating execution:', { error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/exec/plan-and-execute - Plan and execute trade
router.post('/plan-and-execute', async (req, res) => {
  try {
    const { symbol, ...context } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Missing symbol' });
    }
    
    // Create plan
    const plan = await executionRouter.plan({
      symbol: symbol.toUpperCase(),
      ...context
    });
    
    // Execute plan
    const execution = await executionRouter.execute(plan);
    
    res.json(execution);
    
  } catch (error) {
    logger.error('Error planning and executing:', { error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/exec/sizing/last - Get last sizing snapshot
router.get('/sizing/last', async (req, res) => {
  try {
    const sizing = executionRouter.getLastSizing();
    
    if (!sizing) {
      return res.status(404).json({ error: 'No sizing data available' });
    }
    
    res.json(sizing);
    
  } catch (error) {
    logger.error('Error getting sizing data:', { error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/exec/history - Get execution history
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const history = executionRouter.getExecutionHistory(limit);
    
    res.json(history);
    
  } catch (error) {
    logger.error('Error getting execution history:', { error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
