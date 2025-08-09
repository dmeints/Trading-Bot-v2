import { Router } from 'express';
import { logger } from '../utils/logger.js';

const router = Router();

// Test harness for trading validation
router.post('/test/circuit-breaker', async (req, res) => {
  try {
    const { type, duration } = req.body;
    
    if (type === 'ws-stale') {
      // Simulate WebSocket staleness
      global.wsStaleTestMode = true;
      setTimeout(() => {
        global.wsStaleTestMode = false;
      }, duration || 10000);
      
      return res.json({ 
        success: true, 
        message: `WebSocket staleness test active for ${duration || 10000}ms` 
      });
    }
    
    if (type === 'latency') {
      // Simulate high latency
      global.latencyTestMode = true;
      global.latencyTestDelay = duration || 2000;
      setTimeout(() => {
        global.latencyTestMode = false;
        global.latencyTestDelay = 0;
      }, 30000);
      
      return res.json({ 
        success: true, 
        message: `High latency test active for 30s with ${duration || 2000}ms delay` 
      });
    }
    
    res.status(400).json({ error: 'Unknown test type' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test risk limits
router.post('/test/risk-limit', async (req, res) => {
  try {
    const { trigger } = req.body;
    
    if (trigger === 'daily-loss') {
      // Set global test mode to simulate daily loss limit
      (global as any).dailyLossTestMode = true;
      (global as any).simulatedDailyLoss = -150; // Exceeds $100 limit
      
      setTimeout(() => {
        (global as any).dailyLossTestMode = false;
        (global as any).simulatedDailyLoss = 0;
      }, 60000); // Reset after 1 minute
      
      return res.json({ 
        success: true, 
        message: 'Daily loss limit triggered via test harness for 60s' 
      });
    }
    
    res.status(400).json({ error: 'Unknown risk trigger' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Soak test endpoint
router.post('/test/soak', async (req, res) => {
  try {
    const { duration = 1800, orderInterval = 60 } = req.body; // 30 min default, 1 order/min
    
    global.soakTestActive = true;
    const symbols = ['BTC-USD', 'ETH-USD'];
    let orderCount = 0;
    
    const soakInterval = setInterval(async () => {
      if (!global.soakTestActive) {
        clearInterval(soakInterval);
        return;
      }
      
      const symbol = symbols[orderCount % symbols.length];
      const quantity = symbol === 'BTC-USD' ? 0.001 : 0.01;
      
      try {
        // Place small test orders
        const order = {
          symbol,
          side: 'buy',
          type: 'market',
          quantity,
          clientId: `soak-test-${Date.now()}-${orderCount}`
        };
        
        // This would normally go through the trading engine
        console.log(`[SoakTest] Order ${orderCount}: ${JSON.stringify(order)}`);
        orderCount++;
        
      } catch (error) {
        console.error(`[SoakTest] Order failed:`, error);
      }
    }, orderInterval * 1000);
    
    // Stop after duration
    setTimeout(() => {
      global.soakTestActive = false;
      clearInterval(soakInterval);
      console.log(`[SoakTest] Completed after ${duration}s with ${orderCount} orders`);
    }, duration * 1000);
    
    res.json({ 
      success: true, 
      message: `Soak test started for ${duration}s with ${orderInterval}s intervals`,
      expectedOrders: Math.floor(duration / orderInterval)
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export { router as default };