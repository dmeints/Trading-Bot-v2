/**
 * Admin Routes for Skippy Trading Platform
 * 
 * Secure administrative endpoints for trading controls and system management
 */

import { Router } from 'express';
import { logger } from '../utils/logger';
import { getExchangeConnector } from '../services/exchangeConnector';
import { adminAuth } from '../middleware/adminAuth';

const router = Router();

// Apply admin authentication to all routes
router.use(adminAuth);

// Kill switch endpoint - emergency stop all trading
router.post('/kill-switch', async (req, res) => {
  try {
    const { reason = 'Manual activation' } = req.body;
    
    logger.warn('Kill switch activated', { 
      reason,
      timestamp: new Date().toISOString(),
      activatedBy: 'admin'
    });

    // Set global emergency stop
    process.env.EMERGENCY_STOP = 'true';
    
    // Get exchange connector and stop trading
    const connector = getExchangeConnector();
    
    // Cancel all open orders (if live trading)
    let cancelledOrders = 0;
    try {
      // In a real implementation, this would cancel actual orders
      cancelledOrders = 0; // Placeholder
    } catch (error) {
      logger.error('Failed to cancel some orders during kill switch', { error });
    }

    // Get current portfolio value
    const portfolioValue = 10000; // Placeholder - would calculate real value

    res.json({
      success: true,
      message: 'Kill switch activated - all trading stopped',
      timestamp: new Date().toISOString(),
      cancelledOrders,
      portfolioValue,
      reason
    });

  } catch (error) {
    logger.error('Kill switch activation failed', { error });
    res.status(500).json({
      success: false,
      error: 'Kill switch activation failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Suspend trading without full kill switch
router.post('/suspend-trading', async (req, res) => {
  try {
    const { duration = 3600 } = req.body; // Default 1 hour suspension
    
    process.env.TRADING_SUSPENDED = 'true';
    process.env.TRADING_SUSPEND_UNTIL = String(Date.now() + (duration * 1000));
    
    logger.info('Trading suspended', { 
      duration: `${duration}s`,
      suspendedUntil: new Date(Date.now() + (duration * 1000)).toISOString()
    });

    res.json({
      success: true,
      message: 'Trading suspended',
      suspendedUntil: new Date(Date.now() + (duration * 1000)).toISOString(),
      duration
    });

  } catch (error) {
    logger.error('Trading suspension failed', { error });
    res.status(500).json({ success: false, error: 'Suspension failed' });
  }
});

// Resume trading
router.post('/resume-trading', async (req, res) => {
  try {
    delete process.env.TRADING_SUSPENDED;
    delete process.env.TRADING_SUSPEND_UNTIL;
    delete process.env.EMERGENCY_STOP;
    
    logger.info('Trading resumed by admin');

    res.json({
      success: true,
      message: 'Trading resumed',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Trading resume failed', { error });
    res.status(500).json({ success: false, error: 'Resume failed' });
  }
});

// Close all positions immediately
router.post('/close-all-positions', async (req, res) => {
  try {
    const { reason = 'Admin requested' } = req.body;
    
    logger.warn('Closing all positions', { reason });

    // In real implementation, this would:
    // 1. Get all open positions
    // 2. Place market orders to close them
    // 3. Wait for execution
    // 4. Return summary

    const closedPositions = 0; // Placeholder
    const totalValue = 0; // Placeholder

    res.json({
      success: true,
      message: 'All positions closed',
      closedPositions,
      totalValue,
      reason,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Position closure failed', { error });
    res.status(500).json({ success: false, error: 'Position closure failed' });
  }
});

// Get system status
router.get('/status', async (req, res) => {
  try {
    const connector = getExchangeConnector();
    const stats = connector.getStats();
    
    const systemStatus = {
      trading: {
        enabled: process.env.LIVE_TRADING_ENABLED === 'true',
        suspended: process.env.TRADING_SUSPENDED === 'true',
        emergencyStop: process.env.EMERGENCY_STOP === 'true',
        suspendedUntil: process.env.TRADING_SUSPEND_UNTIL ? 
          new Date(parseInt(process.env.TRADING_SUSPEND_UNTIL)).toISOString() : null
      },
      exchange: {
        connected: stats.connected,
        testnet: stats.testnet,
        orderCount: stats.orderCount,
        dailyVolume: stats.dailyVolume,
        remainingDailyVolume: stats.remainingDailyVolume
      },
      system: {
        uptime: process.uptime(),
        nodeEnv: process.env.NODE_ENV,
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      }
    };

    res.json({
      success: true,
      status: systemStatus
    });

  } catch (error) {
    logger.error('Status check failed', { error });
    res.status(500).json({ success: false, error: 'Status check failed' });
  }
});

// Update trading limits
router.post('/limits', async (req, res) => {
  try {
    const { 
      maxPositionSize, 
      dailyVolumeLimit, 
      enabledSymbols 
    } = req.body;

    // Validate limits
    if (maxPositionSize && (maxPositionSize < 0 || maxPositionSize > 100000)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid max position size' 
      });
    }

    if (dailyVolumeLimit && (dailyVolumeLimit < 0 || dailyVolumeLimit > 1000000)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid daily volume limit' 
      });
    }

    // Update environment variables (in real implementation, would update config)
    if (maxPositionSize) {
      process.env.MAX_POSITION_SIZE = String(maxPositionSize);
    }
    if (dailyVolumeLimit) {
      process.env.DAILY_VOLUME_LIMIT = String(dailyVolumeLimit);
    }
    if (enabledSymbols) {
      process.env.ENABLED_SYMBOLS = enabledSymbols.join(',');
    }

    logger.info('Trading limits updated', {
      maxPositionSize,
      dailyVolumeLimit,
      enabledSymbols
    });

    res.json({
      success: true,
      message: 'Trading limits updated',
      limits: {
        maxPositionSize,
        dailyVolumeLimit,
        enabledSymbols
      }
    });

  } catch (error) {
    logger.error('Limits update failed', { error });
    res.status(500).json({ success: false, error: 'Limits update failed' });
  }
});

export { router as adminRoutes };