import { db } from '../db.js';
import { marketBars } from '../../shared/schema.js';
import { binanceConnector } from '../connectors/binance.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

async function loadCandles(
  symbol: string,
  timeframe: string,
  from: string,
  to: string,
  fast: number,
  slow: number
): Promise<Candle[]> {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  // Calculate needed candles with buffer for indicators
  const intervalMs = timeframe === '1m' ? 60000 : timeframe === '5m' ? 300000 : 3600000;
  const neededCount = Math.ceil((toDate.getTime() - fromDate.getTime()) / intervalMs) + Math.max(fast, slow) + 10;

  logger.info(`Loading ${neededCount} candles for ${symbol} ${timeframe} from DB`);

  try {
    // Try to get from database first
    const dbBars = await db
      .select()
      .from(marketBars)
      .where(
        and(
          eq(marketBars.symbol, symbol),
          eq(marketBars.timeframe, timeframe),
          gte(marketBars.timestamp, fromDate),
          lte(marketBars.timestamp, toDate)
        )
      )
      .orderBy(marketBars.timestamp);

    if (dbBars.length >= neededCount * 0.8) {
      logger.info(`Using ${dbBars.length} candles from DB`);
      return dbBars.map(bar => ({
        timestamp: bar.timestamp.getTime(),
        open: parseFloat(bar.open),
        high: parseFloat(bar.high),
        low: parseFloat(bar.low),
        close: parseFloat(bar.close),
        volume: parseFloat(bar.volume)
      }));
    }

    logger.info(`Insufficient DB data (${dbBars.length}/${neededCount}), fetching from Binance`);

    // Fallback to Binance API
    const freshBars = await binanceConnector.fetchKlines(
      symbol,
      timeframe as '1m' | '5m' | '1h' | '1d',
      neededCount
    );

    // Persist to DB
    if (freshBars.length > 0) {
      await binanceConnector.storeMarketBars(freshBars);
      logger.info(`Persisted ${freshBars.length} fresh bars to DB`);
    }

    return freshBars.map(bar => ({
      timestamp: bar.timestamp.getTime(),
      open: parseFloat(bar.open),
      high: parseFloat(bar.high),
      low: parseFloat(bar.low),
      close: parseFloat(bar.close),
      volume: parseFloat(bar.volume)
    }));

  } catch (error) {
    logger.error('Error loading candles:', error);
    throw error;
  }
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

export async function runSMABacktest(params: {
  symbol: string;
  timeframe: string;
  from: string;
  to: string;
  fast: number;
  slow: number;
}) {
  try {
    const candles = await loadCandles(
      params.symbol,
      params.timeframe,
      params.from,
      params.to,
      params.fast,
      params.slow
    );

    if (candles.length < Math.max(params.fast, params.slow)) {
      throw new Error('Insufficient candle data for backtest');
    }

    const closes = candles.map(c => c.close);
    const fastSMA = calculateSMA(closes, params.fast);
    const slowSMA = calculateSMA(closes, params.slow);

    let position = 0;
    let cash = 10000;
    let equity = cash;
    let trades = 0;
    let wins = 0;
    let maxEquity = cash;
    let maxDrawdown = 0;

    const equityCurve: number[] = [];

    for (let i = params.slow; i < candles.length; i++) {
      const price = candles[i].close;
      const prevFast = fastSMA[i - 1];
      const prevSlow = slowSMA[i - 1];
      const currFast = fastSMA[i];
      const currSlow = slowSMA[i];

      // Buy signal: fast SMA crosses above slow SMA
      if (position === 0 && prevFast <= prevSlow && currFast > currSlow) {
        position = cash / price;
        cash = 0;
        trades++;
      }
      // Sell signal: fast SMA crosses below slow SMA
      else if (position > 0 && prevFast >= prevSlow && currFast < currSlow) {
        const sellValue = position * price;
        if (sellValue > cash) wins++;
        cash = sellValue;
        position = 0;
      }

      equity = cash + (position * price);
      equityCurve.push(equity);

      if (equity > maxEquity) maxEquity = equity;
      const drawdown = (maxEquity - equity) / maxEquity;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // Close final position
    if (position > 0) {
      cash = position * candles[candles.length - 1].close;
      position = 0;
    }

    const finalEquity = cash;
    const totalReturn = (finalEquity - 10000) / 10000;
    const winRate = trades > 0 ? wins / trades : 0;

    // Simple Sharpe calculation
    const returns = equityCurve.map((eq, i) =>
      i === 0 ? 0 : (eq - equityCurve[i - 1]) / equityCurve[i - 1]
    ).slice(1);

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const returnStd = Math.sqrt(
      returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length
    );
    const sharpe = returnStd > 0 ? (avgReturn / returnStd) * Math.sqrt(252) : 0;

    return {
      success: true,
      metrics: {
        pnl: totalReturn,
        sharpe,
        maxDrawdown,
        winRate,
        trades,
        finalEquity
      },
      candles: candles.length
    };

  } catch (error) {
    logger.error('SMA backtest error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}