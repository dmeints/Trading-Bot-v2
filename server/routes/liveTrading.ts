import { Router } from 'express';
import { logger } from '../utils/logger.js';

const liveTradingRouter = Router();

// Import broker manager service dynamically
let brokerManager: any = null;

async function initializeBrokerManager() {
  if (!brokerManager) {
    try {
      const { BrokerManager } = await import('../services/BrokerManager.js');
      brokerManager = new BrokerManager(false); // Start in paper mode for safety
      logger.info('[LiveTrading] BrokerManager service initialized');
    } catch (error) {
      logger.error('[LiveTrading] Failed to initialize BrokerManager:', error);
      throw error;
    }
  }
}

/**
 * GET /api/live/status
 * Get live trading system status
 */
liveTradingRouter.get('/status', async (req, res) => {
  try {
    await initializeBrokerManager();
    
    const isLive = brokerManager.isLiveTradingMode();
    const brokerStatuses = brokerManager.getAllBrokerStatuses();
    
    res.json({
      success: true,
      data: {
        isLiveTradingMode: isLive,
        brokerCount: brokerStatuses.length,
        connectedBrokers: brokerStatuses.filter((s: any) => s.connected).length,
        brokerStatuses,
        lastUpdate: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('[LiveTrading] Error getting system status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system status'
    });
  }
});

/**
 * POST /api/live/mode
 * Toggle between paper and live trading mode
 */
liveTradingRouter.post('/mode', async (req, res) => {
  try {
    await initializeBrokerManager();
    
    const { isLive } = req.body;
    
    if (typeof isLive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isLive must be a boolean value'
      });
    }

    brokerManager.setLiveTradingMode(isLive);
    
    res.json({
      success: true,
      data: {
        isLiveTradingMode: isLive,
        message: `Trading mode changed to ${isLive ? 'LIVE' : 'PAPER'} mode`
      }
    });

  } catch (error) {
    logger.error('[LiveTrading] Error changing trading mode:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change trading mode'
    });
  }
});

/**
 * POST /api/live/brokers
 * Add a new broker connection
 */
liveTradingRouter.post('/brokers', async (req, res) => {
  try {
    await initializeBrokerManager();
    
    const { id, name, type, apiKey, apiSecret, passphrase, testnet = true } = req.body;
    
    if (!id || !name || !type || !apiKey || !apiSecret) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: id, name, type, apiKey, apiSecret'
      });
    }

    if (!['binance', 'coinbase', 'kraken'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid broker type. Supported: binance, coinbase, kraken'
      });
    }

    await brokerManager.addBroker({
      id,
      name,
      type,
      apiKey,
      apiSecret,
      passphrase,
      testnet,
      enabled: true
    });

    res.json({
      success: true,
      data: {
        brokerId: id,
        message: 'Broker added successfully'
      }
    });

  } catch (error) {
    logger.error('[LiveTrading] Error adding broker:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add broker'
    });
  }
});

/**
 * GET /api/live/brokers
 * Get all configured brokers and their status
 */
liveTradingRouter.get('/brokers', async (req, res) => {
  try {
    await initializeBrokerManager();
    
    const brokerStatuses = brokerManager.getAllBrokerStatuses();
    
    res.json({
      success: true,
      data: {
        brokers: brokerStatuses,
        summary: {
          total: brokerStatuses.length,
          connected: brokerStatuses.filter((s: any) => s.connected).length,
          avgLatency: brokerStatuses.reduce((sum: number, s: any) => sum + s.latency, 0) / brokerStatuses.length || 0
        }
      }
    });

  } catch (error) {
    logger.error('[LiveTrading] Error getting brokers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get broker information'
    });
  }
});

/**
 * POST /api/live/orders
 * Place a new live order
 */
liveTradingRouter.post('/orders', async (req, res) => {
  try {
    await initializeBrokerManager();
    
    const { brokerId, symbol, side, type, quantity, price, stopPrice } = req.body;
    
    if (!brokerId || !symbol || !side || !type || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: brokerId, symbol, side, type, quantity'
      });
    }

    if (!['buy', 'sell'].includes(side)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid side. Must be buy or sell'
      });
    }

    if (!['market', 'limit', 'stop'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order type. Supported: market, limit, stop'
      });
    }

    if (type === 'limit' && !price) {
      return res.status(400).json({
        success: false,
        error: 'Price is required for limit orders'
      });
    }

    if (type === 'stop' && !stopPrice) {
      return res.status(400).json({
        success: false,
        error: 'Stop price is required for stop orders'
      });
    }

    const orderId = await brokerManager.placeOrder({
      brokerId,
      symbol,
      side,
      type,
      quantity: parseFloat(quantity),
      price: price ? parseFloat(price) : undefined,
      stopPrice: stopPrice ? parseFloat(stopPrice) : undefined
    });

    res.json({
      success: true,
      data: {
        orderId,
        message: 'Order placed successfully'
      }
    });

  } catch (error) {
    logger.error('[LiveTrading] Error placing order:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to place order'
    });
  }
});

/**
 * GET /api/live/orders
 * Get order history and status
 */
liveTradingRouter.get('/orders', async (req, res) => {
  try {
    await initializeBrokerManager();
    
    const { brokerId, status } = req.query;
    
    const orders = await brokerManager.getOrders(
      brokerId as string,
      status as string
    );

    res.json({
      success: true,
      data: {
        orders,
        summary: {
          total: orders.length,
          open: orders.filter((o: any) => o.status === 'open').length,
          filled: orders.filter((o: any) => o.status === 'filled').length,
          cancelled: orders.filter((o: any) => o.status === 'cancelled').length
        }
      }
    });

  } catch (error) {
    logger.error('[LiveTrading] Error getting orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get orders'
    });
  }
});

/**
 * DELETE /api/live/orders/:orderId
 * Cancel an open order
 */
liveTradingRouter.delete('/orders/:orderId', async (req, res) => {
  try {
    await initializeBrokerManager();
    
    const { orderId } = req.params;
    const cancelled = await brokerManager.cancelOrder(orderId);

    if (cancelled) {
      res.json({
        success: true,
        data: {
          orderId,
          message: 'Order cancelled successfully'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Order could not be cancelled'
      });
    }

  } catch (error) {
    logger.error('[LiveTrading] Error cancelling order:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel order'
    });
  }
});

/**
 * GET /api/live/positions
 * Get current positions
 */
liveTradingRouter.get('/positions', async (req, res) => {
  try {
    await initializeBrokerManager();
    
    const { brokerId } = req.query;
    const positions = await brokerManager.getPositions(brokerId as string);

    const totalValue = positions.reduce((sum: number, p: any) => sum + p.marketValue, 0);
    const totalPnl = positions.reduce((sum: number, p: any) => sum + p.unrealizedPnl, 0);

    res.json({
      success: true,
      data: {
        positions,
        summary: {
          total: positions.length,
          totalValue,
          totalUnrealizedPnl: totalPnl,
          longPositions: positions.filter((p: any) => p.side === 'long').length,
          shortPositions: positions.filter((p: any) => p.side === 'short').length
        }
      }
    });

  } catch (error) {
    logger.error('[LiveTrading] Error getting positions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get positions'
    });
  }
});

/**
 * GET /api/live/balances/:brokerId
 * Get account balances for a broker
 */
liveTradingRouter.get('/balances/:brokerId', async (req, res) => {
  try {
    await initializeBrokerManager();
    
    const { brokerId } = req.params;
    const balances = await brokerManager.getBalances(brokerId);

    const totalUsdValue = balances.reduce((sum: number, b: any) => sum + b.usdValue, 0);

    res.json({
      success: true,
      data: {
        brokerId,
        balances,
        summary: {
          totalAssets: balances.length,
          totalUsdValue,
          largestHolding: balances.reduce((max: any, b: any) => 
            b.usdValue > (max?.usdValue || 0) ? b : max, null
          )
        }
      }
    });

  } catch (error) {
    logger.error('[LiveTrading] Error getting balances:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get balances'
    });
  }
});

/**
 * POST /api/live/emergency/stop
 * Emergency stop all trading
 */
liveTradingRouter.post('/emergency/stop', async (req, res) => {
  try {
    await initializeBrokerManager();
    
    const { brokerId } = req.body;
    await brokerManager.emergencyStopTrading(brokerId);

    res.json({
      success: true,
      data: {
        message: 'Emergency stop activated successfully',
        timestamp: new Date().toISOString(),
        affectedBroker: brokerId || 'ALL'
      }
    });

  } catch (error) {
    logger.error('[LiveTrading] Error activating emergency stop:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to activate emergency stop'
    });
  }
});

/**
 * POST /api/live/emergency/liquidate
 * Emergency liquidate all positions
 */
liveTradingRouter.post('/emergency/liquidate', async (req, res) => {
  try {
    await initializeBrokerManager();
    
    const { brokerId } = req.body;
    await brokerManager.liquidateAllPositions(brokerId);

    res.json({
      success: true,
      data: {
        message: 'Position liquidation initiated successfully',
        timestamp: new Date().toISOString(),
        affectedBroker: brokerId || 'ALL'
      }
    });

  } catch (error) {
    logger.error('[LiveTrading] Error liquidating positions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to liquidate positions'
    });
  }
});

/**
 * GET /api/live/risk/metrics
 * Get real-time risk metrics
 */
liveTradingRouter.get('/risk/metrics', async (req, res) => {
  try {
    await initializeBrokerManager();
    
    const positions = await brokerManager.getPositions();
    const allBrokerStatuses = brokerManager.getAllBrokerStatuses();
    
    // Calculate risk metrics
    const totalExposure = positions.reduce((sum: number, p: any) => sum + Math.abs(p.marketValue), 0);
    const totalPnl = positions.reduce((sum: number, p: any) => sum + p.unrealizedPnl, 0);
    const largestPosition = positions.reduce((max: any, p: any) => 
      Math.abs(p.marketValue) > Math.abs(max?.marketValue || 0) ? p : max, null
    );

    // Calculate concentration risk
    const concentrationRisk = largestPosition ? 
      Math.abs(largestPosition.marketValue) / totalExposure : 0;

    res.json({
      success: true,
      data: {
        totalExposure,
        totalUnrealizedPnl: totalPnl,
        positionCount: positions.length,
        concentrationRisk,
        largestPosition: largestPosition ? {
          symbol: largestPosition.symbol,
          exposure: Math.abs(largestPosition.marketValue),
          pnl: largestPosition.unrealizedPnl
        } : null,
        brokerConnectivity: {
          connected: allBrokerStatuses.filter((s: any) => s.connected).length,
          total: allBrokerStatuses.length,
          avgLatency: allBrokerStatuses.reduce((sum: number, s: any) => sum + s.latency, 0) / allBrokerStatuses.length || 0
        },
        riskLimits: {
          maxExposure: 1000000, // $1M max exposure
          maxConcentration: 0.25, // 25% max single position
          maxDrawdown: 0.15 // 15% max drawdown
        },
        alertLevel: this.calculateRiskAlertLevel(totalPnl, concentrationRisk),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('[LiveTrading] Error getting risk metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get risk metrics'
    });
  }
});

// Helper function to calculate risk alert level
function calculateRiskAlertLevel(totalPnl: number, concentrationRisk: number): string {
  if (totalPnl < -50000 || concentrationRisk > 0.3) return 'HIGH';
  if (totalPnl < -20000 || concentrationRisk > 0.2) return 'MEDIUM';
  return 'LOW';
}

export { liveTradingRouter };