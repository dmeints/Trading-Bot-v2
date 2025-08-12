
import { Router } from 'express';
import { logger } from '../utils/logger.js';

const router = Router();

interface BacktestRequest {
  symbol: string;
  timeframe: string;
  from: string;
  to: string;
  fast: number;
  slow: number;
}

interface BacktestTrade {
  timestamp: number;
  action: 'buy' | 'sell';
  price: number;
  size: number;
  pnl?: number;
}

interface BacktestResult {
  metrics: {
    totalPnL: number;
    sharpeRatio: number;
    maxDrawdown: number;
    totalTrades: number;
    winRate: number;
  };
  trades: BacktestTrade[];
}

// Simple Moving Average calculation
function calculateSMA(prices: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
    } else {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
  }
  return sma;
}

router.post('/run', async (req, res) => {
  try {
    const { symbol, timeframe, from, to, fast, slow }: BacktestRequest = req.body;
    
    // Validation
    if (!symbol || !timeframe || !from || !to || !fast || !slow) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    if (fast >= slow) {
      return res.status(400).json({ error: 'Fast SMA period must be less than slow SMA period' });
    }
    
    // Get real candles from Binance
    try {
      const { getOHLCV } = await import('../services/exchanges/binance.js');
      
      // For demo, get recent data (ignore from/to for now due to Binance limits)
      const limit = Math.max(slow + 100, 500); // Ensure we have enough data
      const candles = await getOHLCV(symbol, timeframe, limit);
      
      if (candles.length < slow) {
        return res.status(400).json({ error: `Not enough data points. Need at least ${slow}, got ${candles.length}` });
      }
      
      // Extract closing prices
      const closes = candles.map(c => c.close);
      const timestamps = candles.map(c => c.timestamp);
      
      // Calculate SMAs
      const fastSMA = calculateSMA(closes, fast);
      const slowSMA = calculateSMA(closes, slow);
      
      // Run backtest
      const trades: BacktestTrade[] = [];
      let position = 0; // 0 = flat, 1 = long
      let cash = 100000; // Starting capital
      let shares = 0;
      let entryPrice = 0;
      const transactionFee = 0.001; // 0.1%
      
      for (let i = slow; i < closes.length; i++) {
        const currentPrice = closes[i];
        const fastValue = fastSMA[i];
        const slowValue = slowSMA[i];
        
        if (isNaN(fastValue) || isNaN(slowValue)) continue;
        
        // Signal: long when fast SMA > slow SMA
        const shouldBeLong = fastValue > slowValue;
        
        if (shouldBeLong && position === 0) {
          // Enter long position
          const tradeCash = cash * 0.95; // Use 95% of cash
          const fee = tradeCash * transactionFee;
          shares = (tradeCash - fee) / currentPrice;
          cash -= tradeCash;
          position = 1;
          entryPrice = currentPrice;
          
          trades.push({
            timestamp: timestamps[i],
            action: 'buy',
            price: currentPrice,
            size: shares
          });
        } else if (!shouldBeLong && position === 1) {
          // Exit long position
          const tradeValue = shares * currentPrice;
          const fee = tradeValue * transactionFee;
          const pnl = (tradeValue - fee) - (shares * entryPrice * (1 + transactionFee));
          cash += tradeValue - fee;
          position = 0;
          
          trades.push({
            timestamp: timestamps[i],
            action: 'sell',
            price: currentPrice,
            size: shares,
            pnl
          });
          
          shares = 0;
        }
      }
      
      // Close any open position at the end
      if (position === 1) {
        const currentPrice = closes[closes.length - 1];
        const tradeValue = shares * currentPrice;
        const fee = tradeValue * transactionFee;
        const pnl = (tradeValue - fee) - (shares * entryPrice * (1 + transactionFee));
        cash += tradeValue - fee;
        
        trades.push({
          timestamp: timestamps[timestamps.length - 1],
          action: 'sell',
          price: currentPrice,
          size: shares,
          pnl
        });
      }
      
      // Calculate metrics
      const totalPnL = cash - 100000 + (position === 1 ? shares * closes[closes.length - 1] : 0);
      const profitableTrades = trades.filter(t => (t.pnl || 0) > 0).length;
      const totalCompleteTrades = trades.filter(t => t.action === 'sell').length;
      const winRate = totalCompleteTrades > 0 ? profitableTrades / totalCompleteTrades : 0;
      
      // Simplified Sharpe calculation (daily returns)
      const returns = trades
        .filter(t => t.pnl !== undefined)
        .map(t => t.pnl! / 100000);
      
      const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
      const returnStd = returns.length > 1 ? 
        Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1)) : 0;
      const sharpeRatio = returnStd > 0 ? (avgReturn / returnStd) * Math.sqrt(252) : 0;
      
      // Simplified max drawdown
      let peak = 100000;
      let maxDrawdown = 0;
      let runningValue = 100000;
      
      for (const trade of trades) {
        if (trade.pnl !== undefined) {
          runningValue += trade.pnl;
        }
        peak = Math.max(peak, runningValue);
        const drawdown = (peak - runningValue) / peak;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
      
      const result: BacktestResult = {
        metrics: {
          totalPnL,
          sharpeRatio,
          maxDrawdown,
          totalTrades: trades.length,
          winRate
        },
        trades
      };
      
      logger.info(`[Backtest] Completed for ${symbol}: PnL=${totalPnL.toFixed(2)}, Trades=${trades.length}`);
      
      res.json({
        success: true,
        ...result,
        parameters: { symbol, timeframe, fast, slow },
        dataPoints: candles.length
      });
      
    } catch (error) {
      logger.error('[Backtest] Failed to get market data:', error);
      res.status(500).json({ error: 'Failed to fetch market data for backtest' });
    }
    
  } catch (error) {
    logger.error('[Backtest] Failed to run backtest:', error);
    res.status(500).json({ error: 'Failed to run backtest' });
  }
});

export default router;
