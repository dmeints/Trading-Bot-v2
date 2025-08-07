/**
 * PHASE 7: EXCHANGE ROUTES - PAPER-RUN & DEPLOYMENT API ENDPOINTS  
 * REST endpoints for paper trading, canary deployment, and kill-switch management
 */

import express from 'express';
import ExchangeService, { ExchangeConfig, PaperRunConfig } from '../services/exchangeService';
import { logger } from '../utils/logger';

const router = express.Router();

// Initialize exchange service with default config
const defaultConfig: ExchangeConfig = {
  mode: 'paper',
  exchange: 'mock',
  testnet: true,
  maxPositionSize: 0.1,
  riskPerTrade: 0.02,
  killSwitchEnabled: true,
  killSwitchConditions: {
    maxDailyLoss: 5,
    maxDrawdown: 10,
    minWinRate: 40
  }
};

const exchangeService = new ExchangeService(defaultConfig);
exchangeService.initialize();

// Start paper run
router.post('/paper-run/start', async (req, res) => {
  try {
    const config: PaperRunConfig = {
      duration: req.body.duration || 30, // 30 days default
      initialBalance: req.body.initialBalance || 10000,
      symbols: req.body.symbols || ['BTC', 'ETH', 'SOL'],
      warmupDays: req.body.warmupDays || 7,
      canaryPercentage: req.body.canaryPercentage || 0,
      monitoringInterval: req.body.monitoringInterval || 60000 // 1 minute
    };

    const runId = await exchangeService.startPaperRun(config);
    
    res.json({
      success: true,
      runId,
      config,
      message: 'Paper run started successfully',
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('Failed to start paper run:', error as Record<string, any>);
    res.status(500).json({
      success: false,
      error: 'Failed to start paper run',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get current paper run status
router.get('/paper-run/current', async (req, res) => {
  try {
    const currentRun = await exchangeService.getCurrentRun();
    
    res.json({
      success: true,
      currentRun,
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('Failed to get current run:', error as Record<string, any>);
    res.status(500).json({
      success: false,
      error: 'Failed to get current run status'
    });
  }
});

// Stop current paper run
router.post('/paper-run/stop', async (req, res) => {
  try {
    const { reason } = req.body;
    
    await exchangeService.stopCurrentRun(reason || 'Manual stop via API');
    
    res.json({
      success: true,
      message: 'Paper run stopped',
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('Failed to stop paper run:', error as Record<string, any>);
    res.status(500).json({
      success: false,
      error: 'Failed to stop paper run'
    });
  }
});

// Get paper run history
router.get('/paper-run/history', async (req, res) => {
  try {
    const { limit } = req.query;
    const history = await exchangeService.getRunHistory();
    
    const limitedHistory = limit ? history.slice(0, parseInt(limit as string)) : history;
    
    res.json({
      success: true,
      history: limitedHistory,
      total: history.length,
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('Failed to get run history:', error as Record<string, any>);
    res.status(500).json({
      success: false,
      error: 'Failed to get run history'
    });
  }
});

// Get current positions
router.get('/positions', async (req, res) => {
  try {
    const positions = await exchangeService.getPositions();
    const positionsArray = Array.from(positions.values());
    
    res.json({
      success: true,
      positions: positionsArray,
      count: positionsArray.length,
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('Failed to get positions:', error as Record<string, any>);
    res.status(500).json({
      success: false,
      error: 'Failed to get positions'
    });
  }
});

// Get order history
router.get('/orders', async (req, res) => {
  try {
    const { symbol, status, limit } = req.query;
    let orders = await exchangeService.getOrders();
    
    // Filter by symbol if provided
    if (symbol) {
      orders = orders.filter(order => order.symbol === (symbol as string).toUpperCase());
    }
    
    // Filter by status if provided
    if (status) {
      orders = orders.filter(order => order.status === status);
    }
    
    // Apply limit
    if (limit) {
      orders = orders.slice(0, parseInt(limit as string));
    }
    
    res.json({
      success: true,
      orders,
      count: orders.length,
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('Failed to get orders:', error as Record<string, any>);
    res.status(500).json({
      success: false,
      error: 'Failed to get orders'
    });
  }
});

// Update exchange configuration
router.put('/config', async (req, res) => {
  try {
    const configUpdate = req.body;
    
    await exchangeService.updateConfig(configUpdate);
    
    res.json({
      success: true,
      message: 'Configuration updated',
      update: configUpdate,
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('Failed to update config:', error as Record<string, any>);
    res.status(500).json({
      success: false,
      error: 'Failed to update configuration'
    });
  }
});

// Canary deployment endpoint
router.post('/canary-deploy', async (req, res) => {
  try {
    const config: PaperRunConfig = {
      ...req.body,
      canaryPercentage: req.body.canaryPercentage || 25, // Default 25% canary
      duration: req.body.duration || 7, // Shorter duration for canary
      initialBalance: req.body.initialBalance || 5000
    };

    const runId = await exchangeService.startPaperRun(config);
    
    res.json({
      success: true,
      runId,
      message: 'Canary deployment started',
      canaryPercentage: config.canaryPercentage,
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('Canary deployment failed:', error as Record<string, any>);
    res.status(500).json({
      success: false,
      error: 'Failed to start canary deployment'
    });
  }
});

// Kill switch status and control
router.get('/kill-switch/status', async (req, res) => {
  try {
    const currentRun = await exchangeService.getCurrentRun();
    const killSwitchStatus = {
      enabled: defaultConfig.killSwitchEnabled,
      triggered: currentRun?.killSwitchTriggered || null,
      conditions: defaultConfig.killSwitchConditions,
      status: currentRun?.status || 'inactive'
    };
    
    res.json({
      success: true,
      killSwitch: killSwitchStatus,
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('Failed to get kill switch status:', error as Record<string, any>);
    res.status(500).json({
      success: false,
      error: 'Failed to get kill switch status'
    });
  }
});

// Manual kill switch trigger
router.post('/kill-switch/trigger', async (req, res) => {
  try {
    const { reason } = req.body;
    
    await exchangeService.stopCurrentRun(`Manual kill switch: ${reason || 'No reason provided'}`);
    
    res.json({
      success: true,
      message: 'Kill switch triggered',
      reason: reason || 'Manual trigger',
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('Failed to trigger kill switch:', error as Record<string, any>);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger kill switch'
    });
  }
});

// Performance metrics endpoint
router.get('/performance/:runId?', async (req, res) => {
  try {
    const { runId } = req.params;
    
    if (runId) {
      // Get specific run performance
      const history = await exchangeService.getRunHistory();
      const run = history.find(r => r.runId === runId);
      
      if (!run) {
        return res.status(404).json({
          success: false,
          error: 'Run not found'
        });
      }
      
      res.json({
        success: true,
        performance: run.performance,
        riskMetrics: run.riskMetrics,
        canaryResults: run.canaryResults,
        timestamp: Date.now()
      });
    } else {
      // Get current run performance
      const currentRun = await exchangeService.getCurrentRun();
      
      if (!currentRun) {
        return res.status(404).json({
          success: false,
          error: 'No active run'
        });
      }
      
      res.json({
        success: true,
        performance: currentRun.performance,
        riskMetrics: currentRun.riskMetrics,
        status: currentRun.status,
        timestamp: Date.now()
      });
    }
    
  } catch (error) {
    logger.error('Failed to get performance:', error as Record<string, any>);
    res.status(500).json({
      success: false,
      error: 'Failed to get performance metrics'
    });
  }
});

export default router;