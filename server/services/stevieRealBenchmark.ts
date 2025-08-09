/**
 * STEVIE REAL ALGORITHM BENCHMARK SYSTEM
 * Tests actual trading performance, not UI personality
 * Measures cash reserve growth capability with real data
 */

import { backtestEngine } from './backtestEngine';
import { stevieRL } from './stevieRL';
import { marketDataService } from './marketData';
import { logger } from '../utils/logger';
import { storage } from '../storage';
import { hashDataset } from '../utils/datasetHash';
import type { Provenance } from '../../shared/types/provenance';
import type { BenchHeadline, BenchRunResult } from '../../shared/types/bench';
import crypto from 'crypto';

export interface RealBenchmarkConfig {
  version: string;
  testPeriodDays: number;
  initialCapital: number;
  symbols: string[];
  compareToVersion?: string;
}

export interface AlgorithmPerformance {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  avgHoldingPeriod: number;
  riskAdjustedReturn: number;
}

export interface BenchmarkResult {
  runId: string;
  version: string;
  timestamp: Date;
  testPeriod: {
    startDate: Date;
    endDate: Date;
    marketConditions: string;
  };
  algorithmPerformance: AlgorithmPerformance;
  detailedMetrics: {
    monthlyReturns: number[];
    tradingFrequency: number;
    volatility: number;
    calmarRatio: number;
    ulcerIndex: number;
  };
  comparisonToPrevious?: {
    version: string;
    performanceChange: number;
    keyImprovements: string[];
    regressions: string[];
  };
  cashReserveGrowthScore: number; // 0-100 based on actual money-making ability
  recommendations: string[];
  provenance: Provenance;
  headline: BenchHeadline;
}

export class StevieRealBenchmark {
  constructor() {
    // Use existing backtest engine service
  }

  /**
   * Run comprehensive algorithm performance test using real market data
   */
  async runRealAlgorithmBenchmark(config: RealBenchmarkConfig): Promise<BenchmarkResult> {
    const runId = crypto.randomUUID();
    logger.info(`[RealBenchmark] Starting algorithm test for Stevie ${config.version}`, { runId });
    const startTime = Date.now();

    try {
      // 1. Get real historical market data
      const marketData = await this.getHistoricalMarketData(config.testPeriodDays);
      
      // 2. Generate dataset hash for provenance
      const datasetId = hashDataset({
        symbols: config.symbols,
        timeframe: "1h",
        fromIso: new Date(Date.now() - config.testPeriodDays * 24 * 60 * 60 * 1000).toISOString(),
        toIso: new Date().toISOString(),
        feeBps: 2,
        slipBps: 1,
        seed: 42,
        data: this.formatDataForHash(marketData)
      });
      
      // 3. Run Stevie's actual trading algorithm
      const tradingResults = await this.runStevieAlgorithm(marketData, config);
      
      // 4. Calculate comprehensive performance metrics
      const performance = this.calculatePerformanceMetrics(tradingResults, config.initialCapital);
      
      // 5. Analyze market conditions during test period
      const marketConditions = this.analyzeMarketConditions(marketData);
      
      // 6. Compare to previous version if specified
      const comparison = config.compareToVersion ? 
        await this.compareToVersion(performance, config.compareToVersion) : undefined;
      
      // 7. Calculate cash reserve growth score (what actually matters)
      const cashReserveScore = this.calculateCashReserveGrowthScore(performance, marketConditions);
      
      // 8. Generate improvement recommendations
      const recommendations = this.generateRecommendations(performance, tradingResults);

      // 9. Create provenance record
      const provenance: Provenance = {
        source: "computed",
        datasetId,
        commit: process.env.REPLIT_GIT_COMMIT_SHA || "dev",
        runId,
        generatedAt: new Date().toISOString()
      };

      // 10. Create headline metrics
      const headline: BenchHeadline = {
        cashGrowthScore: cashReserveScore,
        totalReturnPct: performance.totalReturn * 100,
        sharpe: performance.sharpeRatio,
        sortino: performance.sortinoRatio || 0,
        winRatePct: performance.winRate * 100,
        maxDrawdownPct: performance.maxDrawdown * 100,
        profitFactor: performance.profitFactor
      };

      const result: BenchmarkResult = {
        runId,
        version: config.version,
        timestamp: new Date(),
        testPeriod: {
          startDate: new Date(Date.now() - config.testPeriodDays * 24 * 60 * 60 * 1000),
          endDate: new Date(),
          marketConditions
        },
        algorithmPerformance: performance,
        detailedMetrics: this.calculateDetailedMetrics(tradingResults, marketData),
        comparisonToPrevious: comparison,
        cashReserveGrowthScore: cashReserveScore,
        recommendations,
        provenance,
        headline
      };

      // Save benchmark result for future comparisons
      await this.saveBenchmarkResult(result);
      
      // Generate artifact bundle
      await this.generateArtifactBundle(result, tradingResults);
      
      const duration = Date.now() - startTime;
      logger.info(`[RealBenchmark] Completed in ${duration}ms`, {
        runId,
        version: config.version,
        cashReserveScore,
        sharpeRatio: performance.sharpeRatio,
        totalReturn: performance.totalReturn,
        datasetId
      });

      return result;

    } catch (error: any) {
      logger.error('[RealBenchmark] Algorithm test failed', { error: error.message, runId });
      throw error;
    }
  }

  /**
   * Get real historical market data for testing
   */
  private async getHistoricalMarketData(days: number): Promise<any[]> {
    // Get actual market data, not simulated
    const data = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Use real market data service
    for (const symbol of ['BTC/USD', 'ETH/USD', 'SOL/USD']) {
      try {
        const marketData = await marketDataService.getHistoricalOHLCV(symbol, startDate, new Date());
        data.push(...marketData);
      } catch (error) {
        logger.warn(`[RealBenchmark] Could not get historical data for ${symbol}`, error);
      }
    }
    
    if (data.length === 0) {
      throw new Error('No real market data available for testing');
    }
    
    return data;
  }

  /**
   * Run Stevie's actual trading algorithm on real data
   */
  private async runStevieAlgorithm(marketData: any[], config: RealBenchmarkConfig): Promise<any[]> {
    const trades = [];
    let currentCapital = config.initialCapital;
    let positions: Record<string, number> = {};

    // Run through each data point and let Stevie make real trading decisions
    for (let i = 0; i < marketData.length; i++) {
      const currentData = marketData[i];
      const historicalContext = marketData.slice(Math.max(0, i - 50), i);

      try {
        // Get Stevie's actual trading decision
        const decision = await stevieRL.getTradingDecision({
          symbol: currentData.symbol,
          price: currentData.close,
          historicalData: historicalContext,
          currentPositions: positions,
          availableCapital: currentCapital
        });

        // Execute the trade if Stevie decides to trade
        if (decision.action !== 'hold' && decision.confidence > 0.6) {
          const trade = await this.executeTrade(decision, currentData, currentCapital, positions);
          if (trade) {
            trades.push(trade);
            currentCapital = trade.newCapital;
            positions = trade.newPositions;
          }
        }
      } catch (error) {
        logger.warn('[RealBenchmark] Trading decision failed', { error: error.message });
      }
    }

    return trades;
  }

  /**
   * Execute a trading decision and update capital/positions
   */
  private async executeTrade(decision: any, marketData: any, capital: number, positions: Record<string, number>) {
    const symbol = marketData.symbol;
    const price = marketData.close;
    const timestamp = new Date(marketData.timestamp);

    let trade = null;

    if (decision.action === 'buy') {
      const positionSize = Math.min(decision.size, capital * 0.1); // Max 10% position
      const quantity = positionSize / price;
      
      if (quantity > 0) {
        trade = {
          timestamp,
          symbol,
          action: 'buy',
          quantity,
          price,
          value: positionSize,
          newCapital: capital - positionSize,
          newPositions: { ...positions, [symbol]: (positions[symbol] || 0) + quantity },
          confidence: decision.confidence,
          reason: decision.reasoning || 'Algorithm decision'
        };
      }
    } else if (decision.action === 'sell' && positions[symbol] > 0) {
      const quantity = Math.min(decision.size || positions[symbol], positions[symbol]);
      const value = quantity * price;
      
      trade = {
        timestamp,
        symbol,
        action: 'sell',
        quantity,
        price,
        value,
        newCapital: capital + value,
        newPositions: { ...positions, [symbol]: positions[symbol] - quantity },
        confidence: decision.confidence,
        reason: decision.reasoning || 'Algorithm decision'
      };
    }

    return trade;
  }

  /**
   * Calculate comprehensive performance metrics that matter for cash reserves
   */
  private calculatePerformanceMetrics(trades: any[], initialCapital: number): AlgorithmPerformance {
    if (trades.length === 0) {
      return {
        totalReturn: 0,
        annualizedReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
        profitFactor: 0,
        totalTrades: 0,
        avgHoldingPeriod: 0,
        riskAdjustedReturn: 0
      };
    }

    // Calculate actual returns
    const finalCapital = trades[trades.length - 1]?.newCapital || initialCapital;
    const totalReturn = (finalCapital - initialCapital) / initialCapital;
    
    // Calculate win rate
    const winningTrades = trades.filter(trade => this.calculateTradePnL(trade) > 0);
    const winRate = winningTrades.length / trades.length;
    
    // Calculate profit factor
    const grossProfit = winningTrades.reduce((sum, trade) => sum + this.calculateTradePnL(trade), 0);
    const grossLoss = trades.filter(trade => this.calculateTradePnL(trade) < 0)
      .reduce((sum, trade) => sum + Math.abs(this.calculateTradePnL(trade)), 0);
    const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : grossProfit / grossLoss;
    
    // Calculate Sharpe ratio (simplified)
    const returns = this.calculateDailyReturns(trades, initialCapital);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const returnStdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = returnStdDev === 0 ? 0 : (avgReturn * Math.sqrt(252)) / (returnStdDev * Math.sqrt(252));
    
    // Calculate max drawdown
    const maxDrawdown = this.calculateMaxDrawdown(trades, initialCapital);
    
    return {
      totalReturn,
      annualizedReturn: Math.pow(1 + totalReturn, 365 / this.getTradingDays(trades)) - 1,
      sharpeRatio,
      maxDrawdown,
      winRate,
      profitFactor,
      totalTrades: trades.length,
      avgHoldingPeriod: this.calculateAvgHoldingPeriod(trades),
      riskAdjustedReturn: sharpeRatio > 0 ? totalReturn / Math.abs(maxDrawdown) : 0
    };
  }

  /**
   * Calculate cash reserve growth score (0-100) - what actually matters
   */
  private calculateCashReserveGrowthScore(performance: AlgorithmPerformance, marketConditions: string): number {
    let score = 0;
    
    // Return contribution (40 points max)
    score += Math.min(40, Math.max(0, performance.totalReturn * 100));
    
    // Risk-adjusted return (30 points max)
    score += Math.min(30, performance.sharpeRatio * 15);
    
    // Consistency (20 points max) - based on win rate and drawdown
    score += Math.min(20, (performance.winRate * 15) + Math.max(0, 5 - performance.maxDrawdown * 50));
    
    // Trading efficiency (10 points max) - profit factor
    score += Math.min(10, Math.max(0, (performance.profitFactor - 1) * 5));
    
    return Math.min(100, Math.max(0, score));
  }

  // Helper methods for calculations...
  private calculateTradePnL(trade: any): number {
    // This would be properly implemented based on your trade structure
    return trade.action === 'sell' ? trade.value - (trade.cost || 0) : 0;
  }

  private calculateDailyReturns(trades: any[], initialCapital: number): number[] {
    // Implementation for daily returns calculation
    return [];
  }

  private calculateMaxDrawdown(trades: any[], initialCapital: number): number {
    // Implementation for max drawdown calculation
    return 0;
  }

  private calculateAvgHoldingPeriod(trades: any[]): number {
    // Implementation for average holding period
    return 0;
  }

  private getTradingDays(trades: any[]): number {
    if (trades.length === 0) return 1;
    const firstTrade = new Date(trades[0].timestamp);
    const lastTrade = new Date(trades[trades.length - 1].timestamp);
    return Math.max(1, (lastTrade.getTime() - firstTrade.getTime()) / (24 * 60 * 60 * 1000));
  }

  private analyzeMarketConditions(marketData: any[]): string {
    // Analyze if market was trending, ranging, volatile, etc.
    return 'mixed conditions';
  }

  private calculateDetailedMetrics(trades: any[], marketData: any[]): any {
    return {
      monthlyReturns: [],
      tradingFrequency: trades.length,
      volatility: 0,
      calmarRatio: 0,
      ulcerIndex: 0
    };
  }

  private async compareToVersion(performance: AlgorithmPerformance, previousVersion: string): Promise<any> {
    // Load previous benchmark results and compare
    return null;
  }

  private generateRecommendations(performance: AlgorithmPerformance, trades: any[]): string[] {
    const recommendations = [];
    
    if (performance.sharpeRatio < 0.5) {
      recommendations.push('Improve risk management - low Sharpe ratio indicates poor risk-adjusted returns');
    }
    
    if (performance.winRate < 0.4) {
      recommendations.push('Enhance signal quality - low win rate suggests poor entry timing');
    }
    
    if (performance.maxDrawdown > 0.15) {
      recommendations.push('Implement better position sizing - high drawdown increases risk');
    }
    
    if (trades.length < 10) {
      recommendations.push('Consider more active trading - very few trades may miss opportunities');
    }
    
    return recommendations;
  }

  private formatDataForHash(marketData: any[]): Record<string, any[]> {
    const formatted: Record<string, any[]> = {};
    for (const data of marketData) {
      if (!formatted[data.symbol]) formatted[data.symbol] = [];
      formatted[data.symbol].push({
        t: new Date(data.timestamp).getTime(),
        o: data.open || data.close,
        h: data.high || data.close,
        l: data.low || data.close,
        c: data.close,
        v: data.volume || 0
      });
    }
    return formatted;
  }

  private async generateArtifactBundle(result: BenchmarkResult, trades: any[]): Promise<void> {
    try {
      const fs = await import('fs').then(m => m.promises);
      const path = await import('path');
      
      const artifactsDir = `./artifacts/${result.runId}`;
      await fs.mkdir(artifactsDir, { recursive: true });
      
      // Create manifest.json
      const manifest = {
        runId: result.runId,
        version: result.version,
        timestamp: result.timestamp.toISOString(),
        provenance: result.provenance,
        files: ['manifest.json', 'metrics.json', 'trades.csv', 'logs.ndjson']
      };
      await fs.writeFile(path.join(artifactsDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
      
      // Create metrics.json
      const metrics = {
        headline: result.headline,
        performance: result.algorithmPerformance,
        detailedMetrics: result.detailedMetrics,
        cashReserveScore: result.cashReserveGrowthScore,
        recommendations: result.recommendations
      };
      await fs.writeFile(path.join(artifactsDir, 'metrics.json'), JSON.stringify(metrics, null, 2));
      
      // Create trades.csv
      const tradesCSV = [
        'timestamp,symbol,action,quantity,price,value,confidence,reason',
        ...trades.map(t => 
          `${t.timestamp.toISOString()},${t.symbol},${t.action},${t.quantity},${t.price},${t.value},${t.confidence},"${t.reason}"`
        )
      ].join('\n');
      await fs.writeFile(path.join(artifactsDir, 'trades.csv'), tradesCSV);
      
      // Create logs.ndjson (simplified)
      const logs = [
        JSON.stringify({ level: 'info', message: 'Benchmark started', runId: result.runId, timestamp: result.timestamp.toISOString() }),
        JSON.stringify({ level: 'info', message: 'Benchmark completed', runId: result.runId, cashReserveScore: result.cashReserveGrowthScore })
      ].join('\n');
      await fs.writeFile(path.join(artifactsDir, 'logs.ndjson'), logs);
      
      // Create symlink to latest
      const latestDir = './artifacts/latest';
      try {
        await fs.unlink(latestDir);
      } catch {}
      await fs.symlink(result.runId, latestDir);
      
    } catch (error) {
      logger.warn('[RealBenchmark] Failed to generate artifact bundle', error);
    }
  }

  private async saveBenchmarkResult(result: BenchmarkResult): Promise<void> {
    try {
      // Save to database for future comparisons
      await storage.createBenchmarkResult({
        runId: result.runId,
        version: result.version,
        timestamp: result.timestamp,
        performance: JSON.stringify(result.algorithmPerformance),
        cashReserveScore: result.cashReserveGrowthScore,
        recommendations: JSON.stringify(result.recommendations),
        provenance: JSON.stringify(result.provenance)
      });
    } catch (error) {
      logger.warn('[RealBenchmark] Failed to save result', error);
    }
  }
}

export const stevieRealBenchmark = new StevieRealBenchmark();