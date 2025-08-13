
import { Router } from 'express';
import { riskGuards } from '../services/RiskGuards.js';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/guards/state - Get current risk guard state
router.get('/state', (req, res) => {
  try {
    const state = riskGuards.getState();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      state: {
        totalNotional: state.totalNotional,
        notionalLimit: state.config.maxNotional,
        notionalUtilization: (state.totalNotional / state.config.maxNotional * 100).toFixed(2) + '%',
        symbolNotionals: state.symbolNotionals,
        symbolNotionalCap: state.config.symbolNotionalCap,
        drawdownBreaker: {
          active: state.drawdownBreaker.active,
          reason: state.drawdownBreaker.reason,
          activatedAt: state.drawdownBreaker.activatedAt,
          cooldownRemaining: state.drawdownBreaker.activatedAt 
            ? Math.max(0, (state.drawdownBreaker.activatedAt.getTime() + state.config.breakerCooldownMs) - Date.now())
            : 0
        },
        orderRateLimits: state.orderCounts,
        ordersPerMinuteLimit: state.config.ordersPerMinuteLimit,
        recentTradesCount: state.recentTrades.length,
        lastCheck: state.lastCheck,
        config: state.config
      }
    });
    
    logger.debug('[Guards] State retrieved successfully');
  } catch (error) {
    logger.error('[Guards] Failed to get state:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve risk guard state',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/guards/reset - Reset risk guard state (admin only)
router.post('/reset', (req, res) => {
  try {
    riskGuards.reset();
    
    res.json({
      success: true,
      message: 'Risk guard state reset successfully',
      timestamp: new Date().toISOString()
    });
    
    logger.info('[Guards] State reset by admin request');
  } catch (error) {
    logger.error('[Guards] Failed to reset state:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset risk guard state',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/guards/check - Check if execution would be allowed
router.post('/check', (req, res) => {
  try {
    const { symbol, side, notionalSize } = req.body;
    
    if (!symbol || !side || !notionalSize) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: symbol, side, notionalSize',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = riskGuards.checkExecution(symbol, side, notionalSize);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      check: result
    });
    
    logger.debug(`[Guards] Execution check: ${symbol} ${side} ${notionalSize} = ${result.allowed ? 'ALLOWED' : 'BLOCKED'}`);
  } catch (error) {
    logger.error('[Guards] Failed to check execution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check execution',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
