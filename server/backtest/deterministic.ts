/**
 * Deterministic Backtest System
 * No-network backtesting with comprehensive artifact persistence
 */

import { db } from "../db";
import { marketBars } from "@shared/schema";
// Note: backtestRuns table may need to be added to schema
import { eq, gte, lte, and, desc } from "drizzle-orm";
import { calculateUnifiedFeatures, UnifiedFeatures } from "../features";
import { decide } from "../strategy/stevie";
import { scoreTrade } from "../strategy/scorecard";
import { defaultStevieConfig } from "../strategy/stevieConfig";
import { defaultScoreConfig } from "../../shared/stevie/score_config";
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

export interface BacktestConfig {
  symbol: string;
  startTime: Date;
  endTime: Date;
  initialBalance: number;
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  stevieConfig?: typeof defaultStevieConfig;
  scoreConfig?: typeof defaultScoreConfig;
}

export interface BacktestResult {
  runId: string;
  symbol: string;
  startTime: Date;
  endTime: Date;
  totalTrades: number;
  winningTrades: number;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgTradeScore: number;
  artifacts: {
    manifestPath: string;
    metricsPath: string;
    tradesPath: string;
    logsPath: string;
  };
  datasetId: string;
  commit: string;
  generatedAt: Date;
}

interface TradeExecution {
  entryTime: Date;
  exitTime?: Date;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  pnl?: number;
  score?: any;
  reason: string;
}

/**
 * Generate unique run ID
 */
function generateRunId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `bt_${timestamp}_${random}`;
}

/**
 * Generate dataset hash for reproducibility
 */
function generateDatasetId(config: BacktestConfig, barCount: number): string {
  const hash = createHash('sha256');
  hash.update(JSON.stringify({
    symbol: config.symbol,
    start: config.startTime.toISOString(),
    end: config.endTime.toISOString(),
    timeframe: config.timeframe,
    barCount
  }));
  return hash.digest('hex').slice(0, 12);
}

/**
 * Disable network calls during backtest
 */
function disableNetwork(): () => void {
  const originalFetch = global.fetch;
  const originalHttpRequest = require('http').request;
  const originalHttpsRequest = require('https').request;
  
  // @ts-ignore
  global.fetch = () => {
    throw new Error('Network call attempted during deterministic backtest');
  };
  
  require('http').request = () => {
    throw new Error('HTTP request attempted during deterministic backtest');
  };
  
  require('https').request = () => {
    throw new Error('HTTPS request attempted during deterministic backtest');
  };
  
  return () => {
    global.fetch = originalFetch;
    require('http').request = originalHttpRequest;
    require('https').request = originalHttpsRequest;
  };
}

/**
 * Load market data from database (no network calls)
 */
async function loadMarketData(config: BacktestConfig): Promise<Array<{
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}>> {
  const bars = await db
    .select()
    .from(marketBars)
    .where(
      and(
        eq(marketBars.symbol, config.symbol),
        gte(marketBars.timestamp, config.startTime),
        lte(marketBars.timestamp, config.endTime)
      )
    )
    .orderBy(marketBars.timestamp);

  if (bars.length === 0) {
    throw new Error(`No market data found for ${config.symbol} in specified time range`);
  }

  return bars.map(bar => ({
    timestamp: bar.timestamp,
    open: parseFloat(bar.open),
    high: parseFloat(bar.high),
    low: parseFloat(bar.low),
    close: parseFloat(bar.close),
    volume: bar.volume ? parseFloat(bar.volume) : 0
  }));
}

/**
 * Execute deterministic backtest
 */
export async function runDeterministicBacktest(config: BacktestConfig): Promise<BacktestResult> {
  const runId = generateRunId();
  const startTime = new Date();
  
  // Disable network access
  const restoreNetwork = disableNetwork();
  
  const logs: string[] = [];
  const trades: TradeExecution[] = [];
  
  try {
    logs.push(`[${startTime.toISOString()}] Starting backtest ${runId}`);
    logs.push(`Symbol: ${config.symbol}, Period: ${config.startTime.toISOString()} to ${config.endTime.toISOString()}`);
    
    // Load historical data from database only
    const marketData = await loadMarketData(config);
    logs.push(`Loaded ${marketData.length} bars from database`);
    
    const datasetId = generateDatasetId(config, marketData.length);
    logs.push(`Dataset ID: ${datasetId}`);
    
    let balance = config.initialBalance;
    let currentPosition: TradeExecution | null = null;
    let equity = balance;
    const equityHistory: number[] = [];
    let maxEquity = balance;
    let maxDrawdown = 0;
    
    // Process each bar
    for (let i = 1; i < marketData.length; i++) {
      const currentBar = marketData[i];
      const windowStart = new Date(currentBar.timestamp.getTime() - 24 * 60 * 60 * 1000); // 24h lookback
      
      try {
        // Get features for current window (from cached DB data only)
        const features = await calculateUnifiedFeatures(
          config.symbol,
          windowStart,
          currentBar.timestamp,
          config.timeframe
        );
        
        // Skip if insufficient data
        if (!features.bars || features.bars.length < 10) {
          logs.push(`[${currentBar.timestamp.toISOString()}] Skipping - insufficient data`);
          continue;
        }
        
        // Make trading decision
        const position = currentPosition ? {
          symbol: currentPosition.symbol,
          qty: currentPosition.quantity,
          avgPrice: currentPosition.entryPrice
        } : null;
        
        const decision = decide(features, position, config.stevieConfig || defaultStevieConfig);
        
        // Execute trades based on decision
        if (decision.type !== "HOLD") {
          // Close existing position if opening new one
          if (currentPosition && !decision.reduceOnly) {
            const exitPrice = currentBar.close;
            const pnl = (exitPrice - currentPosition.entryPrice) * currentPosition.quantity;
            
            currentPosition.exitTime = currentBar.timestamp;
            currentPosition.exitPrice = exitPrice;
            currentPosition.pnl = pnl;
            
            balance += pnl;
            equity = balance;
            
            // Score the trade
            const tradeScore = scoreTrade({
              symbol: currentPosition.symbol,
              entryTs: currentPosition.entryTime.getTime(),
              exitTs: currentPosition.exitTime.getTime(),
              entryPx: currentPosition.entryPrice,
              exitPx: currentPosition.exitPrice,
              qty: currentPosition.quantity,
              equityAtEntry: config.initialBalance,
              feeBps: 7, // Assume 7bps fees
              slippageRealizedBps: 2, // Assume 2bps slippage
              ackMs: 100, // Assume 100ms latency
              mfeBps: Math.max(0, (currentBar.high - currentPosition.entryPrice) / currentPosition.entryPrice * 10000),
              maeBps: Math.min(0, (currentBar.low - currentPosition.entryPrice) / currentPosition.entryPrice * 10000),
              midAfter1sBps: 0
            }, config.scoreConfig || defaultScoreConfig, {
              runId,
              datasetId,
              commit: process.env.GIT_COMMIT || 'dev',
              generatedAt: new Date().toISOString()
            });
            
            currentPosition.score = tradeScore;
            trades.push({ ...currentPosition });
            
            logs.push(`[${currentBar.timestamp.toISOString()}] Closed position: ${currentPosition.side} ${currentPosition.quantity} @ ${exitPrice}, PnL: ${pnl.toFixed(2)}, Score: ${tradeScore.total.toFixed(2)}`);
            currentPosition = null;
          }
          
          // Open new position
          if (decision.type.startsWith('ENTER_') && !decision.reduceOnly) {
            const positionSize = (balance * (decision.sizePct / 100));
            const quantity = positionSize / currentBar.close;
            
            currentPosition = {
              entryTime: currentBar.timestamp,
              symbol: config.symbol,
              side: 'long', // Simplified for demo
              entryPrice: currentBar.close,
              quantity,
              reason: decision.tag || 'unknown'
            };
            
            logs.push(`[${currentBar.timestamp.toISOString()}] Opened position: ${currentPosition.side} ${quantity.toFixed(4)} @ ${currentBar.close}, Size: ${decision.sizePct}%`);
          }
        }
        
        // Update equity tracking
        if (currentPosition) {
          const unrealizedPnl = (currentBar.close - currentPosition.entryPrice) * currentPosition.quantity;
          equity = balance + unrealizedPnl;
        } else {
          equity = balance;
        }
        
        equityHistory.push(equity);
        maxEquity = Math.max(maxEquity, equity);
        const drawdown = (maxEquity - equity) / maxEquity;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
        
      } catch (error) {
        logs.push(`[${currentBar.timestamp.toISOString()}] Error: ${error.message}`);
        continue;
      }
    }
    
    // Close any remaining position
    if (currentPosition) {
      const lastBar = marketData[marketData.length - 1];
      const pnl = (lastBar.close - currentPosition.entryPrice) * currentPosition.quantity;
      currentPosition.exitTime = lastBar.timestamp;
      currentPosition.exitPrice = lastBar.close;
      currentPosition.pnl = pnl;
      trades.push({ ...currentPosition });
      balance += pnl;
    }
    
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    logs.push(`[${endTime.toISOString()}] Backtest completed in ${duration}ms`);
    
    // Calculate metrics
    const totalTrades = trades.filter(t => t.exitTime).length;
    const winningTrades = trades.filter(t => t.pnl && t.pnl > 0).length;
    const totalReturn = (balance - config.initialBalance) / config.initialBalance;
    
    // Calculate Sharpe ratio
    const returns = equityHistory.map((eq, i) => i === 0 ? 0 : (eq - equityHistory[i-1]) / equityHistory[i-1]);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const returnStd = Math.sqrt(returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = returnStd > 0 ? avgReturn / returnStd * Math.sqrt(252 * 24 * 12) : 0; // Annualized
    
    const avgTradeScore = totalTrades > 0 
      ? trades.filter(t => t.score).reduce((sum, t) => sum + t.score.total, 0) / totalTrades 
      : 0;
    
    // Create artifacts directory
    const artifactsDir = path.join('artifacts', runId);
    await fs.mkdir(artifactsDir, { recursive: true });
    
    // Save artifacts
    const manifest = {
      runId,
      config,
      datasetId,
      commit: process.env.GIT_COMMIT || 'dev',
      generatedAt: startTime.toISOString(),
      completedAt: endTime.toISOString(),
      duration,
      barCount: marketData.length
    };
    
    const metrics = {
      totalTrades,
      winningTrades,
      winRate: totalTrades > 0 ? winningTrades / totalTrades : 0,
      totalReturn,
      finalBalance: balance,
      sharpeRatio,
      maxDrawdown,
      avgTradeScore,
      equityHistory
    };
    
    const manifestPath = path.join(artifactsDir, 'manifest.json');
    const metricsPath = path.join(artifactsDir, 'metrics.json');
    const tradesPath = path.join(artifactsDir, 'trades.csv');
    const logsPath = path.join(artifactsDir, 'logs.ndjson');
    
    await Promise.all([
      fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2)),
      fs.writeFile(metricsPath, JSON.stringify(metrics, null, 2)),
      fs.writeFile(tradesPath, tradesToCSV(trades)),
      fs.writeFile(logsPath, logs.map(log => JSON.stringify({ timestamp: new Date().toISOString(), message: log })).join('\n'))
    ]);
    
    // Store run in database (commented out until backtestRuns table is added)
    // await db.insert(backtestRuns).values({...});
    
    return {
      runId,
      symbol: config.symbol,
      startTime: config.startTime,
      endTime: config.endTime,
      totalTrades,
      winningTrades,
      totalReturn,
      sharpeRatio,
      maxDrawdown,
      avgTradeScore,
      artifacts: {
        manifestPath,
        metricsPath,
        tradesPath,
        logsPath
      },
      datasetId,
      commit: process.env.GIT_COMMIT || 'dev',
      generatedAt: startTime
    };
    
  } finally {
    restoreNetwork();
  }
}

/**
 * Convert trades to CSV format
 */
function tradesToCSV(trades: TradeExecution[]): string {
  const headers = ['entryTime', 'exitTime', 'symbol', 'side', 'entryPrice', 'exitPrice', 'quantity', 'pnl', 'score', 'reason'];
  const rows = trades.map(trade => [
    trade.entryTime.toISOString(),
    trade.exitTime?.toISOString() || '',
    trade.symbol,
    trade.side,
    trade.entryPrice.toString(),
    trade.exitPrice?.toString() || '',
    trade.quantity.toString(),
    trade.pnl?.toString() || '',
    trade.score ? trade.score.total.toString() : '',
    trade.reason
  ]);
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}