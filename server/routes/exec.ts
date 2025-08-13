
import express from 'express';
import { executionRouter } from '../services/ExecutionRouter.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// POST /api/exec/simulate - Simulate execution plan and cost
router.post('/simulate', async (req, res) => {
  try {
    const { symbol, size } = req.body;
    
    if (!symbol || size === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: symbol, size'
      });
    }
    
    const context = {
      symbol,
      maxSize: Math.abs(size),
      ...req.body
    };
    
    const plan = await executionRouter.plan(context);
    
    res.json({
      success: true,
      simulation: {
        plan,
        estimatedCost: plan.estimatedCost,
        executionStyle: plan.executionStyle,
        targetSize: plan.targetSize,
        urgency: plan.urgency
      },
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('Error in execution simulation:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: String(error)
    });
  }
});

// POST /api/exec/plan-and-execute - Plan and execute trade
router.post('/plan-and-execute', async (req, res) => {
  try {
    const { symbol } = req.body;
    
    if (!symbol) {
      return res.status(400).json({
        error: 'Missing required field: symbol'
      });
    }
    
    const context = {
      symbol,
      ...req.body
    };
    
    // Create execution plan
    const plan = await executionRouter.plan(context);
    
    // Execute the plan
    const executionRecord = await executionRouter.execute(plan);
    
    res.json({
      success: true,
      execution: executionRecord,
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('Error in plan-and-execute:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: String(error)
    });
  }
});

// GET /api/exec/sizing/last - Get last sizing snapshot
router.get('/sizing/last', (req, res) => {
  try {
    const lastSizing = executionRouter.getLastSizing();
    
    if (!lastSizing) {
      return res.status(404).json({
        error: 'No sizing data available'
      });
    }
    
    res.json({
      success: true,
      sizing: lastSizing,
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('Error getting last sizing:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: String(error)
    });
  }
});

// GET /api/exec/history - Get execution history
router.get('/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const history = executionRouter.getExecutionHistory(limit);
    
    res.json({
      success: true,
      history,
      count: history.length,
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('Error getting execution history:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: String(error)
    });
  }
});

export default router;
