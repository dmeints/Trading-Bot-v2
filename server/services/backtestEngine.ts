/**
 * Real Backtesting Engine with Actual Market Data Integration
 * 
 * This system provides comprehensive backtesting capabilities using real market data,
 * technical analysis, and robust risk management for cryptocurrency trading strategies.
 */

import { storage } from '../storage';
import { marketDataService } from './marketData';
import { logger } from '../utils/logger';
import type { InsertBacktestResults } from '../../shared/schema';
import { getOHLCV } from "./exchanges/binance";
import { calculateSMA } from '../utils/indicators';
import type { InsertMarketBar } from '@shared/schema';


function toBarsForDB(symbol: string, timeframe: string, candles: {timestamp:number,open:number,high:number,low:number,close:number,volume:number}[]): InsertMarketBar[] {
  const ds = (ts:number) => `binance:${symbol}:${timeframe}:${new Date(ts).toISOString().slice(0,10)}`;
  return candles.map(c => ({
    symbol,
    timeframe,
    timestamp: new Date(c.timestamp),
    open: String(c.open),
    high: String(c.high),
    low: String(c.low),
    close: String(c.close),
    volume: String(c.volume ?? 0),
    provider: 'binance',
    datasetId: ds(c.timestamp),
    provenance: { source: 'binance', endpoint: 'klines', symbol, timeframe }
  }));
}

async function loadCandles(symbol: string, timeframe: string, from: Date, to: Date, fast: number, slow: number) {
  const ms: Record<string, number> = { 
    '1m': 60000, '5m': 300000, '15m': 900000, 
    '1h': 3600000, '4h': 14400000, '1d': 86400000 
  };
  const msPerCandle = ms[timeframe] ?? 3600000;
  const needed = Math.ceil((+to - +from) / msPerCandle) + slow + 10;

  try {
    const rows = await storage.getMarketBars(symbol, timeframe, needed);
    if (rows && rows.length >= slow + 10) {
      logger.info(`Using ${rows.length} candles from database`);
      return rows.map(r => ({ 
        timestamp: +new Date(r.timestamp), 
        open: +r.open, 
        high: +r.high, 
        low: +r.low, 
        close: +r.close, 
        volume: +(r.volume || 0) 
      }));
    }
  } catch (e) {
    logger.warn('Failed to load candles from database, falling back to Binance:', { error: String(e) });
  }

  // Fallback to Binance HTTP
  logger.info('Loading candles from Binance API');
  const candles = await getOHLCV(symbol, timeframe, Math.min(1000, needed));

  // Try to persist the fetched candles
  try {
    await storage.storeMarketBars(toBarsForDB(symbol, timeframe, candles));
    logger.info(`Persisted ${candles.length} candles to database`);
  } catch (e) {
    logger.warn('Failed to persist candles to database:', { error: String(e) });
  }

  return candles;
}


interface BacktestParams {
  symbol: string;
  timeframe: string;
  from: string;
  to: string;
  fast: number;
  slow: number;
}

interface BacktestTrade {
  timestamp: number;
  price: number;
  side: 'buy' | 'sell';
  size: number;
  pnl?: number;
}

interface BacktestMetrics {
  totalPnL: number;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalTrades: number;
  winRate: number;
  startValue: number;
  endValue: number;
}

interface BacktestResult {
  metrics: BacktestMetrics;
  trades: BacktestTrade[];
  equity: number[];
  parameters: BacktestParams;
}

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

export async function runSMABacktest(params: BacktestParams): Promise<BacktestResult> {
  const { symbol, timeframe, from, to, fast, slow } = params;
  const fromDate = new Date(from);
  const toDate = new Date(to);

  // Validate parameters
  if (fast >= slow) {
    throw new Error('Fast SMA period must be less than slow SMA period');
  }

  // Get historical data (DB first, then Binance fallback)
  const candles = await loadCandles(symbol, timeframe, fromDate, toDate, fast, slow);

  if (candles.length < slow) {
    throw new Error(`Insufficient data: need at least ${slow} candles, got ${candles.length}`);
  }

  const closePrices = candles.map(c => c.close);
  const fastSMA = calculateSMA(closePrices, fast);
  const slowSMA = calculateSMA(closePrices, slow);

  const trades: BacktestTrade[] = [];
  const equity: number[] = [];

  let position = 0; // 0 = flat, 1 = long
  let cash = 10000; // Starting capital
  let shares = 0;
  let entryPrice = 0;

  const txnFee = 0.001; // 0.1% transaction fee

  for (let i = slow; i < candles.length; i++) {
    const currentPrice = candles[i].close;
    const fastValue = fastSMA[i];
    const slowValue = slowSMA[i];

    if (isNaN(fastValue) || isNaN(slowValue)) continue;

    // Strategy logic: Long when fast > slow, flat otherwise
    const shouldBeLong = fastValue > slowValue;

    if (shouldBeLong && position === 0) {
      // Enter long position
      const size = cash / currentPrice;
      const cost = size * currentPrice;
      const fee = cost * txnFee;

      shares = size;
      cash = cash - cost - fee;
      position = 1;
      entryPrice = currentPrice;

      trades.push({
        timestamp: candles[i].timestamp,
        price: currentPrice,
        side: 'buy',
        size: size
      });
    } else if (!shouldBeLong && position === 1) {
      // Exit long position
      const proceeds = shares * currentPrice;
      const fee = proceeds * txnFee;
      const pnl = proceeds - fee - (shares * entryPrice);

      cash = cash + proceeds - fee;

      trades.push({
        timestamp: candles[i].timestamp,
        price: currentPrice,
        side: 'sell',
        size: shares,
        pnl: pnl
      });

      shares = 0;
      position = 0;
    }

    // Calculate current portfolio value
    const portfolioValue = cash + (shares * currentPrice);
    equity.push(portfolioValue);
  }

  // Final metrics calculation
  const startValue = 10000;
  const endValue = cash + (shares * candles[candles.length - 1].close);
  const totalPnL = endValue - startValue;
  const totalReturn = (endValue / startValue - 1) * 100;

  // Calculate Sharpe ratio (simplified)
  const returns = equity.slice(1).map((val, i) => (val - equity[i]) / equity[i]);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const volatility = Math.sqrt(
    returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length
  );
  const sharpeRatio = volatility > 0 ? (avgReturn / volatility) * Math.sqrt(252) : 0;

  // Calculate max drawdown
  let maxDrawdown = 0;
  let peak = startValue;
  for (const value of equity) {
    if (value > peak) peak = value;
    const drawdown = (peak - value) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Win rate
  const profitableTrades = trades.filter(t => t.pnl && t.pnl > 0).length;
  const totalTradesPairs = Math.floor(trades.length / 2);
  const winRate = totalTradesPairs > 0 ? (profitableTrades / totalTradesPairs) * 100 : 0;

  const metrics: BacktestMetrics = {
    totalPnL,
    totalReturn,
    sharpeRatio,
    maxDrawdown: maxDrawdown * 100,
    totalTrades: trades.length,
    winRate,
    startValue,
    endValue
  };

  return {
    metrics,
    trades,
    equity,
    parameters: params
  };
}