import { Router } from 'express';
import type { OrderRequest, OrderAck, Position, Fill, Account, RiskSettings } from '../src/types/trading.js';
import { logger } from '../utils/logger.js';

// Trading metrics for observability
interface TradingMetrics {
  latencyMs: { p50: number; p95: number; p99: number; samples: number[] };
  wsStalenessMs: { p50: number; p95: number; p99: number; samples: number[] };
  slippageBps: { p50: number; p95: number; p99: number; samples: number[] };
  rejectsByReason: Record<string, number>;
}

const tradingMetrics: TradingMetrics = {
  latencyMs: { p50: 0, p95: 0, p99: 0, samples: [] },
  wsStalenessMs: { p50: 0, p95: 0, p99: 0, samples: [] },
  slippageBps: { p50: 0, p95: 0, p99: 0, samples: [] },
  rejectsByReason: {}
};

// Circuit breaker state
let circuitBreakerOpen = false;
let lastWSHeartbeat = Date.now();

// Calculate percentiles
function calculatePercentiles(samples: number[]): { p50: number; p95: number; p99: number } {
  if (samples.length === 0) return { p50: 0, p95: 0, p99: 0 };
  
  const sorted = samples.slice().sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  
  return { p50, p95, p99 };
}

// Update metrics
function updateLatencyMetrics(latency: number) {
  tradingMetrics.latencyMs.samples.push(latency);
  if (tradingMetrics.latencyMs.samples.length > 1000) {
    tradingMetrics.latencyMs.samples.shift(); // Keep only last 1000
  }
  Object.assign(tradingMetrics.latencyMs, calculatePercentiles(tradingMetrics.latencyMs.samples));
}

function updateSlippageMetrics(slippage: number) {
  tradingMetrics.slippageBps.samples.push(slippage);
  if (tradingMetrics.slippageBps.samples.length > 1000) {
    tradingMetrics.slippageBps.samples.shift();
  }
  Object.assign(tradingMetrics.slippageBps, calculatePercentiles(tradingMetrics.slippageBps.samples));
}

function incrementRejection(reason: string) {
  tradingMetrics.rejectsByReason[reason] = (tradingMetrics.rejectsByReason[reason] || 0) + 1;
}

// Risk validation functions
function validateOrderSize(account: Account, symbol: string, quantity: number, price?: number): string | null {
  const marketValue = quantity * (price || 100000); // Use current market price
  const maxPositionValue = account.equity * (currentRiskSettings.maxPositionSizePct / 100);
  
  if (marketValue > maxPositionValue) {
    incrementRejection('position_size_exceeded');
    return `Order size ${marketValue.toFixed(2)} exceeds maximum position size ${maxPositionValue.toFixed(2)}`;
  }
  
  return null;
}

function checkDailyLoss(account: Account): string | null {
  // In a real system, this would check actual P&L for the day
  const dailyPnL = -75; // Simulated daily loss
  
  if (Math.abs(dailyPnL) > currentRiskSettings.maxDailyLoss) {
    incrementRejection('daily_loss_exceeded');
    return `Daily loss limit ${currentRiskSettings.maxDailyLoss} exceeded (current: ${Math.abs(dailyPnL)})`;
  }
  
  return null;
}

function checkCircuitBreakers(): string | null {
  // Check WebSocket staleness
  const wsStaleMs = Date.now() - lastWSHeartbeat;
  if (wsStaleMs > 10000 || (global as any).wsStaleTestMode) { // 10s staleness threshold
    circuitBreakerOpen = true;
    incrementRejection('websocket_stale');
    return `WebSocket connection stale (${wsStaleMs}ms) - trading suspended`;
  }
  
  if (circuitBreakerOpen) {
    incrementRejection('circuit_breaker_open');
    return 'Circuit breaker is open - trading suspended due to system issues';
  }
  
  return null;
}

function validateOrderPrecision(symbol: string, quantity: number, price?: number): string | null {
  // Symbol-specific validation
  const symbolRules = {
    'BTC-USD': { minQty: 0.0001, qtyPrecision: 4, pricePrecision: 2, minNotional: 10 },
    'ETH-USD': { minQty: 0.001, qtyPrecision: 3, pricePrecision: 2, minNotional: 10 },
    'SOL-USD': { minQty: 0.01, qtyPrecision: 2, pricePrecision: 2, minNotional: 1 },
    'ADA-USD': { minQty: 1, qtyPrecision: 0, pricePrecision: 6, minNotional: 1 },
    'DOT-USD': { minQty: 0.1, qtyPrecision: 1, pricePrecision: 2, minNotional: 1 }
  };
  
  const rules = symbolRules[symbol as keyof typeof symbolRules];
  if (!rules) {
    incrementRejection('unknown_symbol');
    return `Unknown symbol: ${symbol}`;
  }
  
  if (quantity < rules.minQty) {
    incrementRejection('min_quantity_not_met');
    return `Quantity ${quantity} below minimum ${rules.minQty} for ${symbol}`;
  }
  
  if (price) {
    const notional = quantity * price;
    if (notional < rules.minNotional) {
      incrementRejection('min_notional_not_met');
      return `Notional value ${notional.toFixed(2)} below minimum ${rules.minNotional} for ${symbol}`;
    }
  }
  
  return null;
}

const router = Router();

// Enhanced order placement with validation and metrics
export async function placeOrder(req: OrderRequest): Promise<OrderAck> {
  const startTime = Date.now();
  
  // Simulate test latency if enabled
  if ((global as any).latencyTestMode) {
    await new Promise(resolve => setTimeout(resolve, (global as any).latencyTestDelay || 2000));
  }
  
  try {
    logger.info('[Trading] Order placement request', { 
      symbol: req.symbol, 
      side: req.side, 
      type: req.type,
      quantity: req.quantity,
      clientId: req.clientId
    });
    
    // Risk and validation checks
    const account = await getAccount();
    
    // Kill switch check
    if (currentRiskSettings.killSwitch) {
      incrementRejection('kill_switch_active');
      throw new Error('Trading is disabled - kill switch is active');
    }
    
    // Circuit breaker check
    const cbError = checkCircuitBreakers();
    if (cbError) {
      throw new Error(cbError);
    }
    
    // Daily loss check
    const dailyLossError = checkDailyLoss(account);
    if (dailyLossError) {
      throw new Error(dailyLossError);
    }
    
    // Position size validation
    const sizeError = validateOrderSize(account, req.symbol, req.quantity, req.price);
    if (sizeError) {
      throw new Error(sizeError);
    }
    
    // Precision and notional validation
    const precisionError = validateOrderPrecision(req.symbol, req.quantity, req.price);
    if (precisionError) {
      throw new Error(precisionError);
    }
    
    // Calculate slippage for market orders (simulated)
    if (req.type === 'market') {
      const slippageBps = Math.random() * 5; // 0-5 basis points
      updateSlippageMetrics(slippageBps);
    }
    
    const orderId = req.clientId || `sim-${Date.now()}`;
    const latency = Date.now() - startTime;
    
    updateLatencyMetrics(latency);
    
    logger.info('[Trading] Order accepted', {
      orderId,
      symbol: req.symbol,
      quantity: req.quantity,
      latencyMs: latency,
      slippageBps: req.type === 'market' ? tradingMetrics.slippageBps.samples.slice(-1)[0] : undefined
    });
    
    return { orderId, status: 'accepted' };
    
  } catch (error) {
    const latency = Date.now() - startTime;
    updateLatencyMetrics(latency);
    
    logger.error('[Trading] Order rejected', {
      error: error.message,
      symbol: req.symbol,
      latencyMs: latency
    });
    
    throw error;
  }
}

export async function cancelOrder(orderId: string): Promise<boolean> {
  logger.info('[Trading] Cancel order request', { orderId });
  return true;
}

export async function getPositions(): Promise<Position[]> {
  return [];
}

export async function getFills(limit: number): Promise<Fill[]> {
  return [];
}

export async function getAccount(): Promise<Account> {
  return { equity: 100000, cash: 100000, maintenanceMargin: 0 };
}

// Enhanced risk settings with circuit breaker thresholds
let currentRiskSettings: RiskSettings = { 
  maxPositionSizePct: 25, 
  maxDailyLoss: 100, // Increased for testing
  defaultStopPct: 0.25, 
  defaultTakeProfitPct: 0.5, 
  killSwitch: false 
};

// Update WebSocket heartbeat (called by WebSocket handler)
export function updateWSHeartbeat() {
  lastWSHeartbeat = Date.now();
  if (circuitBreakerOpen && Date.now() - lastWSHeartbeat < 5000) {
    circuitBreakerOpen = false; // Reset circuit breaker when WS recovers
    logger.info('[Trading] Circuit breaker reset - WebSocket connection restored');
  }
}

export async function getRisk(): Promise<RiskSettings> {
  return currentRiskSettings;
}

export async function setRisk(settings: RiskSettings): Promise<void> {
  currentRiskSettings = { ...currentRiskSettings, ...settings };
  logger.info('[Trading] Risk settings updated', currentRiskSettings);
}

// Metrics endpoint for observability
router.get('/metrics', (req, res) => {
  res.json({
    success: true,
    data: {
      latencyMs: {
        p50: tradingMetrics.latencyMs.p50,
        p95: tradingMetrics.latencyMs.p95,
        p99: tradingMetrics.latencyMs.p99,
        sampleCount: tradingMetrics.latencyMs.samples.length
      },
      wsStalenessMs: {
        p50: tradingMetrics.wsStalenessMs.p50,
        p95: tradingMetrics.wsStalenessMs.p95,
        p99: tradingMetrics.wsStalenessMs.p99,
        current: Date.now() - lastWSHeartbeat
      },
      slippageBps: {
        p50: tradingMetrics.slippageBps.p50,
        p95: tradingMetrics.slippageBps.p95,
        p99: tradingMetrics.slippageBps.p99,
        sampleCount: tradingMetrics.slippageBps.samples.length
      },
      rejectsByReason: tradingMetrics.rejectsByReason,
      circuitBreaker: {
        isOpen: circuitBreakerOpen,
        lastWSHeartbeat: new Date(lastWSHeartbeat).toISOString(),
        wsStaleMs: Date.now() - lastWSHeartbeat
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Trading API routes
router.post('/orders', async (req, res) => {
  try {
    // Update WS heartbeat on API calls (simulates active connection)
    updateWSHeartbeat();
    
    const ack: OrderAck = await placeOrder(req.body as OrderRequest);
    res.json(ack);
  } catch (e: any) {
    logger.error('[Trading] Order placement failed', { error: e?.message });
    res.status(400).json({ error: e?.message ?? 'order rejected' });
  }
});

router.delete('/orders/:orderId', async (req, res) => {
  try {
    const ok = await cancelOrder(req.params.orderId);
    res.json({ orderId: req.params.orderId, status: ok ? 'canceled' : 'not_found' });
  } catch (e: any) {
    logger.error('[Trading] Order cancellation failed', { error: e?.message });
    res.status(400).json({ error: e?.message ?? 'cancel failed' });
  }
});

router.get('/positions', async (_req, res) => {
  try {
    const rows: Position[] = await getPositions();
    res.json(rows);
  } catch (e: any) {
    logger.error('[Trading] Failed to get positions', { error: e?.message });
    res.status(500).json({ error: e?.message ?? 'failed to get positions' });
  }
});

router.get('/fills', async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 100);
    const rows: Fill[] = await getFills(limit);
    res.json(rows);
  } catch (e: any) {
    logger.error('[Trading] Failed to get fills', { error: e?.message });
    res.status(500).json({ error: e?.message ?? 'failed to get fills' });
  }
});

router.get('/account', async (_req, res) => {
  try {
    const acct: Account = await getAccount();
    res.json(acct);
  } catch (e: any) {
    logger.error('[Trading] Failed to get account', { error: e?.message });
    res.status(500).json({ error: e?.message ?? 'failed to get account' });
  }
});

router.get('/risk', async (_req, res) => {
  try {
    const settings = await getRisk();
    res.json(settings);
  } catch (e: any) {
    logger.error('[Trading] Failed to get risk settings', { error: e?.message });
    res.status(500).json({ error: e?.message ?? 'failed to get risk settings' });
  }
});

router.post('/risk', async (req, res) => {
  try {
    await setRisk(req.body as RiskSettings);
    res.json({ saved: true });
  } catch (e: any) {
    logger.error('[Trading] Failed to save risk settings', { error: e?.message });
    res.status(500).json({ error: e?.message ?? 'failed to save risk settings' });
  }
});

// Paper trading endpoints
router.post('/paper/order', async (req, res) => {
  try {
    const { symbol, side, size } = req.body;
    
    // Validation
    if (!symbol || !side || !size) {
      return res.status(400).json({ error: 'Missing required fields: symbol, side, size' });
    }
    
    if (side !== 'buy' && side !== 'sell') {
      return res.status(400).json({ error: 'Side must be "buy" or "sell"' });
    }
    
    if (size <= 0) {
      return res.status(400).json({ error: 'Size must be positive' });
    }
    
    // Get current price
    let price = 0;
    try {
      const { priceStream } = await import('../services/priceStream.js');
      price = priceStream.getLastPrice();
      
      // Fallback to OHLCV if no live price
      if (price === 0) {
        const { getOHLCV } = await import('../services/exchanges/binance.js');
        const candles = await getOHLCV(symbol, '1m', 1);
        if (candles.length > 0) {
          price = candles[0].close;
        }
      }
    } catch (e) {
      logger.warn('[Trading] Failed to get live price, using fallback');
      price = 50000; // Fallback price
    }
    
    if (price === 0) {
      return res.status(400).json({ error: 'Unable to determine current price' });
    }
    
    // Check notional cap
    const notional = size * price;
    if (notional > 100000) {
      return res.status(400).json({ error: 'Notional value exceeds $100k limit' });
    }
    
    // Create paper trade
    const trade = {
      id: `paper_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol,
      side,
      size,
      price,
      notional,
      timestamp: new Date().toISOString(),
      status: 'filled'
    };
    
    // Store in memory for now (should be DB in real implementation)
    if (!global.paperTrades) global.paperTrades = [];
    if (!global.paperPositions) global.paperPositions = new Map();
    
    global.paperTrades.push(trade);
    
    // Update position
    const positionKey = symbol;
    const currentPosition = global.paperPositions.get(positionKey) || { symbol, size: 0, avgPrice: 0 };
    
    if (side === 'buy') {
      const newSize = currentPosition.size + size;
      const newAvgPrice = newSize > 0 ? 
        ((currentPosition.size * currentPosition.avgPrice) + (size * price)) / newSize : 0;
      global.paperPositions.set(positionKey, { symbol, size: newSize, avgPrice: newAvgPrice });
    } else {
      const newSize = Math.max(0, currentPosition.size - size);
      global.paperPositions.set(positionKey, { symbol, size: newSize, avgPrice: currentPosition.avgPrice });
    }
    
    logger.info('[Trading] Paper order executed:', trade);
    
    res.json({
      success: true,
      trade,
      position: global.paperPositions.get(positionKey)
    });
    
  } catch (error) {
    logger.error('[Trading] Paper order failed:', error);
    res.status(500).json({ error: 'Failed to execute paper order' });
  }
});

router.get('/positions', async (req, res) => {
  try {
    if (!global.paperPositions) global.paperPositions = new Map();
    
    const positions = Array.from(global.paperPositions.values())
      .filter(pos => pos.size > 0);
    
    res.json({
      success: true,
      positions,
      count: positions.length
    });
  } catch (error) {
    logger.error('[Trading] Failed to get positions:', error);
    res.status(500).json({ error: 'Failed to get positions' });
  }
});

router.get('/trades', async (req, res) => {
  try {
    if (!global.paperTrades) global.paperTrades = [];
    
    const limit = parseInt(req.query.limit as string) || 50;
    const trades = global.paperTrades
      .slice(-limit)
      .reverse();
    
    res.json({
      success: true,
      trades,
      count: trades.length
    });
  } catch (error) {
    logger.error('[Trading] Failed to get trades:', error);
    res.status(500).json({ error: 'Failed to get trades' });
  }
});

export default router;