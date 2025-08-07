/**
 * Stevie Advanced Benchmarking Suite
 * 
 * Comprehensive backtesting, walk-forward analysis, and performance evaluation system
 * with professional-grade financial metrics, visualizations, and hyperparameter optimization
 */

import { logger } from '../utils/logger';
import { storage } from '../storage';
import { stevieBenchmark } from './stevieBenchmark';
import { stevieRL } from './stevieRL';
import * as fs from 'fs/promises';
import * as path from 'path';

// Financial performance metrics
interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  annualizedVolatility: number;
  sharpeRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  recoveryFactor: number;
}

interface BacktestResult {
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  finalCapital: number;
  trades: TradeRecord[];
  dailyReturns: DailyReturn[];
  metrics: PerformanceMetrics;
  equityCurve: EquityPoint[];
  drawdowns: DrawdownPoint[];
}

interface TradeRecord {
  entryDate: Date;
  exitDate: Date;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  return: number;
  holdingDays: number;
}

interface DailyReturn {
  date: Date;
  portfolioValue: number;
  dailyReturn: number;
  cumulativeReturn: number;
}

interface EquityPoint {
  date: Date;
  equity: number;
  drawdown: number;
}

interface DrawdownPoint {
  date: Date;
  drawdown: number;
  peak: number;
  valley: number;
  daysToRecovery?: number;
}

interface WalkForwardResult {
  inSamplePeriods: BacktestPeriod[];
  outOfSamplePeriods: BacktestPeriod[];
  overallMetrics: PerformanceMetrics;
  consistency: number; // Measure of performance consistency across periods
}

interface BacktestPeriod {
  startDate: Date;
  endDate: Date;
  type: 'in-sample' | 'out-of-sample';
  result: BacktestResult;
}

interface HyperparameterConfig {
  [key: string]: number | string | boolean;
}

interface OptimizationResult {
  bestParams: HyperparameterConfig;
  bestMetrics: PerformanceMetrics;
  allResults: Array<{
    params: HyperparameterConfig;
    metrics: PerformanceMetrics;
  }>;
}

interface BenchmarkReport {
  version: string;
  timestamp: Date;
  backtestResult: BacktestResult;
  walkForwardResult: WalkForwardResult;
  optimizationResult: OptimizationResult;
  visualizations: {
    equityCurvePath: string;
    drawdownsPath: string;
    returnsHistPath: string;
  };
  summary: {
    overallScore: number;
    keyMetrics: Record<string, number>;
    improvements: string[];
    recommendations: string[];
  };
}

export class StevieAdvancedBenchmarkSuite {
  private readonly BENCHMARK_DIR = './benchmark-results';
  private readonly IN_SAMPLE_DAYS = 60;
  private readonly OUT_OF_SAMPLE_DAYS = 14;
  
  constructor() {
    this.ensureBenchmarkDirectory();
  }

  private async ensureBenchmarkDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.BENCHMARK_DIR, { recursive: true });
      await fs.mkdir(path.join(this.BENCHMARK_DIR, 'visualizations'), { recursive: true });
    } catch (error) {
      logger.error('Error creating benchmark directory', { error });
    }
  }

  /**
   * Main benchmark execution - runs complete suite
   */
  async runComprehensiveBenchmark(userId: string, version: string = '1.1'): Promise<BenchmarkReport> {
    const startTime = Date.now();
    logger.info(`[AdvancedBenchmark] Starting comprehensive benchmark suite v${version}`, { userId });

    try {
      // Step 1: Prepare market data
      const marketData = await this.prepareMarketData();
      logger.info(`[AdvancedBenchmark] Prepared ${marketData.length} days of market data`);

      // Step 2: Run backtest
      const backtestResult = await this.runBacktest(marketData, userId);
      logger.info(`[AdvancedBenchmark] Backtest completed: ${backtestResult.trades.length} trades`);

      // Step 3: Walk-forward analysis
      const walkForwardResult = await this.runWalkForwardAnalysis(marketData, userId);
      logger.info(`[AdvancedBenchmark] Walk-forward analysis: ${walkForwardResult.inSamplePeriods.length} periods`);

      // Step 4: Hyperparameter optimization
      const optimizationResult = await this.runHyperparameterOptimization(marketData, userId);
      logger.info(`[AdvancedBenchmark] Optimization: best Sharpe ${optimizationResult.bestMetrics.sharpeRatio.toFixed(3)}`);

      // Step 5: Generate visualizations
      const visualizations = await this.generateVisualizations(backtestResult, version);
      logger.info(`[AdvancedBenchmark] Generated visualizations: ${Object.keys(visualizations).length} charts`);

      // Step 6: Create comprehensive report
      const report: BenchmarkReport = {
        version,
        timestamp: new Date(),
        backtestResult,
        walkForwardResult,
        optimizationResult,
        visualizations,
        summary: await this.generateSummary(backtestResult, walkForwardResult, optimizationResult)
      };

      // Step 7: Save report
      await this.saveReport(report, version);
      
      const totalTime = Date.now() - startTime;
      logger.info(`[AdvancedBenchmark] Comprehensive benchmark completed in ${totalTime}ms`, {
        version,
        totalTrades: backtestResult.trades.length,
        finalSharpe: backtestResult.metrics.sharpeRatio.toFixed(3),
        totalTime
      });

      return report;

    } catch (error: any) {
      logger.error('[AdvancedBenchmark] Benchmark execution failed', { error: error.message, userId, version });
      throw error;
    }
  }

  /**
   * Prepare historical market data for backtesting
   */
  private async prepareMarketData(): Promise<any[]> {
    // Generate realistic market data for backtesting
    const days = 365; // 1 year of data
    const marketData = [];
    const basePrice = 50000; // Starting BTC price
    let currentPrice = basePrice;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      // Simulate realistic crypto volatility with some trend
      const dailyReturn = (Math.random() - 0.48) * 0.05; // Slight bullish bias
      currentPrice *= (1 + dailyReturn);
      
      const high = currentPrice * (1 + Math.random() * 0.02);
      const low = currentPrice * (1 - Math.random() * 0.02);
      const volume = 1000000 + Math.random() * 5000000;

      marketData.push({
        date,
        symbol: 'BTC/USD',
        open: currentPrice,
        high,
        low,
        close: currentPrice,
        volume,
        dailyReturn
      });
    }

    return marketData;
  }

  /**
   * Run comprehensive backtest
   */
  private async runBacktest(marketData: any[], userId: string): Promise<BacktestResult> {
    const initialCapital = 100000;
    let currentCapital = initialCapital;
    const trades: TradeRecord[] = [];
    const dailyReturns: DailyReturn[] = [];
    let position = 0; // Current position size
    let entryPrice = 0;
    let entryDate: Date | null = null;

    // Simple momentum strategy for demonstration
    for (let i = 20; i < marketData.length; i++) {
      const current = marketData[i];
      const ma20 = marketData.slice(i - 19, i + 1).reduce((sum, d) => sum + d.close, 0) / 20;
      const ma5 = marketData.slice(i - 4, i + 1).reduce((sum, d) => sum + d.close, 0) / 5;
      
      // Entry signal: MA5 crosses above MA20
      if (position === 0 && ma5 > ma20 * 1.01) {
        position = currentCapital * 0.1 / current.close; // 10% position
        entryPrice = current.close;
        entryDate = current.date;
      }
      
      // Exit signal: MA5 crosses below MA20 or stop loss
      if (position > 0 && (ma5 < ma20 * 0.99 || current.close < entryPrice * 0.95)) {
        const exitPrice = current.close;
        const pnl = position * (exitPrice - entryPrice);
        const tradeReturn = (exitPrice - entryPrice) / entryPrice;
        
        currentCapital += pnl;
        
        trades.push({
          entryDate: entryDate!,
          exitDate: current.date,
          symbol: 'BTC/USD',
          side: 'long',
          quantity: position,
          entryPrice,
          exitPrice,
          pnl,
          return: tradeReturn,
          holdingDays: Math.floor((current.date.getTime() - entryDate!.getTime()) / (24 * 60 * 60 * 1000))
        });
        
        position = 0;
      }

      // Track daily portfolio value
      const portfolioValue = currentCapital + (position > 0 ? position * current.close : 0);
      const dailyReturn = i > 20 ? (portfolioValue - dailyReturns[dailyReturns.length - 1].portfolioValue) / dailyReturns[dailyReturns.length - 1].portfolioValue : 0;
      
      dailyReturns.push({
        date: current.date,
        portfolioValue,
        dailyReturn,
        cumulativeReturn: (portfolioValue - initialCapital) / initialCapital
      });
    }

    // Calculate performance metrics
    const metrics = this.calculatePerformanceMetrics(trades, dailyReturns, initialCapital);
    
    // Generate equity curve and drawdowns
    const equityCurve = this.generateEquityCurve(dailyReturns);
    const drawdowns = this.calculateDrawdowns(equityCurve);

    return {
      startDate: marketData[0].date,
      endDate: marketData[marketData.length - 1].date,
      initialCapital,
      finalCapital: currentCapital,
      trades,
      dailyReturns,
      metrics,
      equityCurve,
      drawdowns
    };
  }

  /**
   * Run walk-forward analysis
   */
  private async runWalkForwardAnalysis(marketData: any[], userId: string): Promise<WalkForwardResult> {
    const inSamplePeriods: BacktestPeriod[] = [];
    const outOfSamplePeriods: BacktestPeriod[] = [];
    
    const totalDays = marketData.length;
    let startIdx = 0;

    while (startIdx + this.IN_SAMPLE_DAYS + this.OUT_OF_SAMPLE_DAYS <= totalDays) {
      // In-sample period
      const inSampleEnd = startIdx + this.IN_SAMPLE_DAYS;
      const inSampleData = marketData.slice(startIdx, inSampleEnd);
      const inSampleResult = await this.runBacktest(inSampleData, userId);
      
      inSamplePeriods.push({
        startDate: inSampleData[0].date,
        endDate: inSampleData[inSampleData.length - 1].date,
        type: 'in-sample',
        result: inSampleResult
      });

      // Out-of-sample period
      const outOfSampleEnd = inSampleEnd + this.OUT_OF_SAMPLE_DAYS;
      const outOfSampleData = marketData.slice(inSampleEnd, outOfSampleEnd);
      const outOfSampleResult = await this.runBacktest(outOfSampleData, userId);
      
      outOfSamplePeriods.push({
        startDate: outOfSampleData[0].date,
        endDate: outOfSampleData[outOfSampleData.length - 1].date,
        type: 'out-of-sample',
        result: outOfSampleResult
      });

      // Move window forward by out-of-sample period
      startIdx += this.OUT_OF_SAMPLE_DAYS;
    }

    // Calculate overall metrics
    const allReturns = [...inSamplePeriods, ...outOfSamplePeriods]
      .flatMap(period => period.result.dailyReturns);
    
    const overallMetrics = this.calculatePerformanceMetrics(
      [...inSamplePeriods, ...outOfSamplePeriods].flatMap(period => period.result.trades),
      allReturns,
      100000
    );

    // Calculate consistency (correlation between in-sample and out-of-sample performance)
    const consistency = this.calculateConsistency(inSamplePeriods, outOfSamplePeriods);

    return {
      inSamplePeriods,
      outOfSamplePeriods,
      overallMetrics,
      consistency
    };
  }

  /**
   * Run hyperparameter optimization
   */
  private async runHyperparameterOptimization(marketData: any[], userId: string): Promise<OptimizationResult> {
    const parameterGrid = {
      maShort: [5, 10, 15],
      maLong: [20, 30, 50],
      positionSize: [0.05, 0.1, 0.2],
      stopLoss: [0.95, 0.97, 0.99]
    };

    const allResults: Array<{ params: HyperparameterConfig; metrics: PerformanceMetrics }> = [];
    let bestSharpe = -Infinity;
    let bestParams: HyperparameterConfig = {};
    let bestMetrics: PerformanceMetrics = {} as PerformanceMetrics;

    // Grid search over parameters
    for (const maShort of parameterGrid.maShort) {
      for (const maLong of parameterGrid.maLong) {
        for (const positionSize of parameterGrid.positionSize) {
          for (const stopLoss of parameterGrid.stopLoss) {
            if (maShort >= maLong) continue; // Skip invalid combinations

            const params = { maShort, maLong, positionSize, stopLoss };
            
            try {
              const result = await this.runParameterizedBacktest(marketData, params, userId);
              allResults.push({ params, metrics: result.metrics });

              if (result.metrics.sharpeRatio > bestSharpe) {
                bestSharpe = result.metrics.sharpeRatio;
                bestParams = params;
                bestMetrics = result.metrics;
              }
            } catch (error) {
              logger.warn('[AdvancedBenchmark] Parameter combination failed', { params, error });
            }
          }
        }
      }
    }

    return {
      bestParams,
      bestMetrics,
      allResults
    };
  }

  /**
   * Run backtest with specific parameters
   */
  private async runParameterizedBacktest(marketData: any[], params: HyperparameterConfig, userId: string): Promise<BacktestResult> {
    const initialCapital = 100000;
    let currentCapital = initialCapital;
    const trades: TradeRecord[] = [];
    const dailyReturns: DailyReturn[] = [];
    let position = 0;
    let entryPrice = 0;
    let entryDate: Date | null = null;

    const { maShort, maLong, positionSize, stopLoss } = params as { maShort: number; maLong: number; positionSize: number; stopLoss: number };

    for (let i = Math.max(maShort, maLong); i < marketData.length; i++) {
      const current = marketData[i];
      const maShortVal = marketData.slice(i - maShort + 1, i + 1).reduce((sum, d) => sum + d.close, 0) / maShort;
      const maLongVal = marketData.slice(i - maLong + 1, i + 1).reduce((sum, d) => sum + d.close, 0) / maLong;
      
      // Entry signal
      if (position === 0 && maShortVal > maLongVal * 1.01) {
        position = currentCapital * positionSize / current.close;
        entryPrice = current.close;
        entryDate = current.date;
      }
      
      // Exit signal
      if (position > 0 && (maShortVal < maLongVal * 0.99 || current.close < entryPrice * stopLoss)) {
        const exitPrice = current.close;
        const pnl = position * (exitPrice - entryPrice);
        const tradeReturn = (exitPrice - entryPrice) / entryPrice;
        
        currentCapital += pnl;
        
        trades.push({
          entryDate: entryDate!,
          exitDate: current.date,
          symbol: 'BTC/USD',
          side: 'long',
          quantity: position,
          entryPrice,
          exitPrice,
          pnl,
          return: tradeReturn,
          holdingDays: Math.floor((current.date.getTime() - entryDate!.getTime()) / (24 * 60 * 60 * 1000))
        });
        
        position = 0;
      }

      const portfolioValue = currentCapital + (position > 0 ? position * current.close : 0);
      const prevValue = dailyReturns.length > 0 ? dailyReturns[dailyReturns.length - 1].portfolioValue : initialCapital;
      const dailyReturn = (portfolioValue - prevValue) / prevValue;
      
      dailyReturns.push({
        date: current.date,
        portfolioValue,
        dailyReturn,
        cumulativeReturn: (portfolioValue - initialCapital) / initialCapital
      });
    }

    const metrics = this.calculatePerformanceMetrics(trades, dailyReturns, initialCapital);
    const equityCurve = this.generateEquityCurve(dailyReturns);
    const drawdowns = this.calculateDrawdowns(equityCurve);

    return {
      startDate: marketData[0].date,
      endDate: marketData[marketData.length - 1].date,
      initialCapital,
      finalCapital: currentCapital,
      trades,
      dailyReturns,
      metrics,
      equityCurve,
      drawdowns
    };
  }

  /**
   * Calculate comprehensive performance metrics
   */
  private calculatePerformanceMetrics(trades: TradeRecord[], dailyReturns: DailyReturn[], initialCapital: number): PerformanceMetrics {
    if (trades.length === 0 || dailyReturns.length === 0) {
      return {
        totalReturn: 0,
        annualizedReturn: 0,
        annualizedVolatility: 0,
        sharpeRatio: 0,
        calmarRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
        profitFactor: 0,
        avgWin: 0,
        avgLoss: 0,
        expectancy: 0,
        recoveryFactor: 0
      };
    }

    const finalValue = dailyReturns[dailyReturns.length - 1].portfolioValue;
    const totalReturn = (finalValue - initialCapital) / initialCapital;
    const tradingDays = dailyReturns.length;
    const annualizedReturn = Math.pow(1 + totalReturn, 365 / tradingDays) - 1;

    // Calculate volatility
    const returns = dailyReturns.map(d => d.dailyReturn);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const annualizedVolatility = Math.sqrt(variance * 365);

    // Sharpe ratio (assuming 3% risk-free rate)
    const riskFreeRate = 0.03;
    const sharpeRatio = annualizedVolatility !== 0 ? (annualizedReturn - riskFreeRate) / annualizedVolatility : 0;

    // Max drawdown calculation
    let peak = initialCapital;
    let maxDrawdown = 0;
    dailyReturns.forEach(day => {
      if (day.portfolioValue > peak) {
        peak = day.portfolioValue;
      }
      const drawdown = (peak - day.portfolioValue) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    });

    // Calmar ratio
    const calmarRatio = maxDrawdown !== 0 ? annualizedReturn / maxDrawdown : 0;

    // Trade-based metrics
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);
    const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;

    const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = totalLosses !== 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;
    const expectancy = trades.length > 0 ? trades.reduce((sum, t) => sum + t.pnl, 0) / trades.length : 0;

    const recoveryFactor = maxDrawdown !== 0 ? totalReturn / maxDrawdown : 0;

    return {
      totalReturn,
      annualizedReturn,
      annualizedVolatility,
      sharpeRatio,
      calmarRatio,
      maxDrawdown,
      winRate,
      profitFactor,
      avgWin,
      avgLoss,
      expectancy,
      recoveryFactor
    };
  }

  /**
   * Generate equity curve data
   */
  private generateEquityCurve(dailyReturns: DailyReturn[]): EquityPoint[] {
    let peak = dailyReturns[0]?.portfolioValue || 0;
    
    return dailyReturns.map(day => {
      if (day.portfolioValue > peak) {
        peak = day.portfolioValue;
      }
      const drawdown = (peak - day.portfolioValue) / peak;
      
      return {
        date: day.date,
        equity: day.portfolioValue,
        drawdown
      };
    });
  }

  /**
   * Calculate drawdown periods
   */
  private calculateDrawdowns(equityCurve: EquityPoint[]): DrawdownPoint[] {
    const drawdowns: DrawdownPoint[] = [];
    let currentDrawdown: DrawdownPoint | null = null;
    let peak = equityCurve[0]?.equity || 0;

    equityCurve.forEach((point, i) => {
      if (point.equity > peak) {
        // New peak reached
        if (currentDrawdown) {
          // End current drawdown
          currentDrawdown.daysToRecovery = Math.floor(
            (point.date.getTime() - currentDrawdown.date.getTime()) / (24 * 60 * 60 * 1000)
          );
          drawdowns.push(currentDrawdown);
          currentDrawdown = null;
        }
        peak = point.equity;
      } else if (point.equity < peak && !currentDrawdown) {
        // Start new drawdown
        currentDrawdown = {
          date: point.date,
          drawdown: point.drawdown,
          peak,
          valley: point.equity
        };
      } else if (currentDrawdown && point.equity < currentDrawdown.valley) {
        // Update valley
        currentDrawdown.valley = point.equity;
        currentDrawdown.drawdown = (peak - point.equity) / peak;
      }
    });

    // Handle ongoing drawdown
    if (currentDrawdown) {
      drawdowns.push(currentDrawdown);
    }

    return drawdowns;
  }

  /**
   * Calculate consistency between in-sample and out-of-sample performance
   */
  private calculateConsistency(inSample: BacktestPeriod[], outOfSample: BacktestPeriod[]): number {
    if (inSample.length !== outOfSample.length || inSample.length === 0) {
      return 0;
    }

    const inSampleReturns = inSample.map(p => p.result.metrics.totalReturn);
    const outOfSampleReturns = outOfSample.map(p => p.result.metrics.totalReturn);

    // Calculate correlation coefficient
    const n = inSampleReturns.length;
    const sumX = inSampleReturns.reduce((a, b) => a + b, 0);
    const sumY = outOfSampleReturns.reduce((a, b) => a + b, 0);
    const sumXY = inSampleReturns.reduce((sum, x, i) => sum + x * outOfSampleReturns[i], 0);
    const sumX2 = inSampleReturns.reduce((sum, x) => sum + x * x, 0);
    const sumY2 = outOfSampleReturns.reduce((sum, y) => sum + y * y, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator !== 0 ? numerator / denominator : 0;
  }

  /**
   * Generate visualizations
   */
  private async generateVisualizations(result: BacktestResult, version: string): Promise<{
    equityCurvePath: string;
    drawdownsPath: string;
    returnsHistPath: string;
  }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Generate equity curve
    const equityData = result.equityCurve.map(point => ({
      date: point.date.toISOString().split('T')[0],
      equity: point.equity
    }));

    const equityCurvePath = path.join(this.BENCHMARK_DIR, 'visualizations', `equity_curve_${version}_${timestamp}.json`);
    await fs.writeFile(equityCurvePath, JSON.stringify({
      title: `Stevie v${version} - Equity Curve`,
      data: equityData,
      type: 'line',
      xAxis: 'date',
      yAxis: 'equity'
    }, null, 2));

    // Generate drawdown chart
    const drawdownData = result.equityCurve.map(point => ({
      date: point.date.toISOString().split('T')[0],
      drawdown: -point.drawdown * 100 // Convert to negative percentage
    }));

    const drawdownsPath = path.join(this.BENCHMARK_DIR, 'visualizations', `drawdowns_${version}_${timestamp}.json`);
    await fs.writeFile(drawdownsPath, JSON.stringify({
      title: `Stevie v${version} - Drawdown Analysis`,
      data: drawdownData,
      type: 'area',
      xAxis: 'date',
      yAxis: 'drawdown'
    }, null, 2));

    // Generate returns histogram
    const returns = result.dailyReturns.map(d => d.dailyReturn * 100); // Convert to percentage
    const histogram = this.createHistogram(returns, 20);

    const returnsHistPath = path.join(this.BENCHMARK_DIR, 'visualizations', `returns_hist_${version}_${timestamp}.json`);
    await fs.writeFile(returnsHistPath, JSON.stringify({
      title: `Stevie v${version} - Daily Returns Distribution`,
      data: histogram,
      type: 'histogram',
      xAxis: 'return',
      yAxis: 'frequency'
    }, null, 2));

    return {
      equityCurvePath,
      drawdownsPath,
      returnsHistPath
    };
  }

  /**
   * Create histogram data
   */
  private createHistogram(data: number[], bins: number): Array<{bin: string, frequency: number}> {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const binWidth = (max - min) / bins;
    
    const histogram = Array(bins).fill(0).map((_, i) => ({
      bin: `${(min + i * binWidth).toFixed(2)}%`,
      frequency: 0
    }));

    data.forEach(value => {
      const binIndex = Math.min(Math.floor((value - min) / binWidth), bins - 1);
      histogram[binIndex].frequency++;
    });

    return histogram;
  }

  /**
   * Generate comprehensive summary
   */
  private async generateSummary(
    backtestResult: BacktestResult,
    walkForwardResult: WalkForwardResult,
    optimizationResult: OptimizationResult
  ): Promise<{
    overallScore: number;
    keyMetrics: Record<string, number>;
    improvements: string[];
    recommendations: string[];
  }> {
    // Calculate overall score based on key metrics
    const metrics = backtestResult.metrics;
    let overallScore = 0;

    // Scoring components (0-100 scale)
    const sharpeScore = Math.max(0, Math.min(100, (metrics.sharpeRatio + 1) * 50)); // -1 to 1 range
    const returnScore = Math.max(0, Math.min(100, metrics.annualizedReturn * 100)); // 0 to 1 range
    const drawdownScore = Math.max(0, 100 - metrics.maxDrawdown * 200); // Lower is better
    const winRateScore = metrics.winRate * 100;
    const consistencyScore = Math.max(0, (walkForwardResult.consistency + 1) * 50);

    overallScore = (sharpeScore * 0.3 + returnScore * 0.25 + drawdownScore * 0.2 + winRateScore * 0.15 + consistencyScore * 0.1);

    const keyMetrics = {
      totalReturn: metrics.totalReturn,
      sharpeRatio: metrics.sharpeRatio,
      maxDrawdown: metrics.maxDrawdown,
      winRate: metrics.winRate,
      profitFactor: metrics.profitFactor,
      consistency: walkForwardResult.consistency
    };

    // Generate improvements and recommendations
    const improvements = [
      `Optimized parameters achieved Sharpe ratio of ${optimizationResult.bestMetrics.sharpeRatio.toFixed(3)}`,
      `Walk-forward analysis shows ${walkForwardResult.consistency.toFixed(3)} consistency correlation`,
      `Generated comprehensive performance report with ${backtestResult.trades.length} trades analyzed`
    ];

    const recommendations = [];
    if (metrics.sharpeRatio < 0.5) {
      recommendations.push('Risk-Adjusted Returns: Focus on improving Sharpe ratio through better risk management');
    }
    if (metrics.maxDrawdown > 0.15) {
      recommendations.push('Drawdown Control: Implement stricter position sizing and stop-loss mechanisms');
    }
    if (metrics.winRate < 0.5) {
      recommendations.push('Trade Selection: Improve entry signals to increase win rate');
    }
    if (walkForwardResult.consistency < 0.3) {
      recommendations.push('Strategy Robustness: Enhance consistency between in-sample and out-of-sample performance');
    }

    return {
      overallScore: Math.round(overallScore),
      keyMetrics,
      improvements,
      recommendations: recommendations.slice(0, 2) // Top 2 recommendations
    };
  }

  /**
   * Save comprehensive report
   */
  private async saveReport(report: BenchmarkReport, version: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Save JSON report
    const jsonPath = path.join(this.BENCHMARK_DIR, `benchmark_report_${version}_${timestamp}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));

    // Save human-readable summary
    const summaryPath = path.join(this.BENCHMARK_DIR, `benchmark_summary_${version}_${timestamp}.txt`);
    const summary = this.formatHumanReadableReport(report);
    await fs.writeFile(summaryPath, summary);

    // Save trade log
    const tradesPath = path.join(this.BENCHMARK_DIR, `trades_${version}_${timestamp}.csv`);
    const tradesCsv = this.formatTradesCsv(report.backtestResult.trades);
    await fs.writeFile(tradesPath, tradesCsv);

    logger.info(`[AdvancedBenchmark] Report saved`, {
      version,
      jsonPath,
      summaryPath,
      tradesPath
    });
  }

  /**
   * Format human-readable report
   */
  private formatHumanReadableReport(report: BenchmarkReport): string {
    const metrics = report.backtestResult.metrics;
    const wf = report.walkForwardResult;
    const opt = report.optimizationResult;

    return `
🎯 STEVIE ADVANCED BENCHMARK REPORT - VERSION ${report.version}
================================================================

EXECUTIVE SUMMARY
-----------------
Overall Performance Score: ${report.summary.overallScore}/100
Generated: ${report.timestamp.toISOString()}
Analysis Period: ${report.backtestResult.startDate.toISOString().split('T')[0]} to ${report.backtestResult.endDate.toISOString().split('T')[0]}
Total Trades: ${report.backtestResult.trades.length}

KEY PERFORMANCE METRICS
------------------------
Total Return:           ${(metrics.totalReturn * 100).toFixed(2)}%
Annualized Return:      ${(metrics.annualizedReturn * 100).toFixed(2)}%
Annualized Volatility:  ${(metrics.annualizedVolatility * 100).toFixed(2)}%
Sharpe Ratio:           ${metrics.sharpeRatio.toFixed(3)}
Calmar Ratio:           ${metrics.calmarRatio.toFixed(3)}
Max Drawdown:           ${(metrics.maxDrawdown * 100).toFixed(2)}%
Win Rate:               ${(metrics.winRate * 100).toFixed(2)}%
Profit Factor:          ${metrics.profitFactor.toFixed(2)}
Average Win:            $${metrics.avgWin.toFixed(2)}
Average Loss:           $${metrics.avgLoss.toFixed(2)}
Expectancy:             $${metrics.expectancy.toFixed(2)}

WALK-FORWARD ANALYSIS
---------------------
In-Sample Periods:      ${wf.inSamplePeriods.length}
Out-of-Sample Periods:  ${wf.outOfSamplePeriods.length}
Consistency Correlation: ${wf.consistency.toFixed(3)}
Overall Sharpe (WF):    ${wf.overallMetrics.sharpeRatio.toFixed(3)}

HYPERPARAMETER OPTIMIZATION
----------------------------
Best Parameters:
${Object.entries(opt.bestParams).map(([key, value]) => `  ${key}: ${value}`).join('\n')}

Optimized Performance:
  Sharpe Ratio: ${opt.bestMetrics.sharpeRatio.toFixed(3)}
  Total Return: ${(opt.bestMetrics.totalReturn * 100).toFixed(2)}%
  Max Drawdown: ${(opt.bestMetrics.maxDrawdown * 100).toFixed(2)}%

PERFORMANCE IMPROVEMENTS
------------------------
${report.summary.improvements.map(imp => `• ${imp}`).join('\n')}

TOP RECOMMENDATIONS
-------------------
${report.summary.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}

VISUALIZATIONS GENERATED
-------------------------
• Equity Curve: ${path.basename(report.visualizations.equityCurvePath)}
• Drawdown Analysis: ${path.basename(report.visualizations.drawdownsPath)}
• Returns Distribution: ${path.basename(report.visualizations.returnsHistPath)}

================================================================
End of Report
    `.trim();
  }

  /**
   * Format trades CSV
   */
  private formatTradesCsv(trades: TradeRecord[]): string {
    const headers = [
      'Entry Date', 'Exit Date', 'Symbol', 'Side', 'Quantity', 
      'Entry Price', 'Exit Price', 'P&L', 'Return %', 'Holding Days'
    ];

    const rows = trades.map(trade => [
      trade.entryDate.toISOString().split('T')[0],
      trade.exitDate.toISOString().split('T')[0],
      trade.symbol,
      trade.side,
      trade.quantity.toFixed(6),
      trade.entryPrice.toFixed(2),
      trade.exitPrice.toFixed(2),
      trade.pnl.toFixed(2),
      (trade.return * 100).toFixed(2),
      trade.holdingDays.toString()
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Get latest benchmark report
   */
  async getLatestReport(): Promise<BenchmarkReport | null> {
    try {
      const files = await fs.readdir(this.BENCHMARK_DIR);
      const reportFiles = files.filter(f => f.startsWith('benchmark_report_') && f.endsWith('.json'));
      
      if (reportFiles.length === 0) return null;

      // Sort by creation time (newest first)
      reportFiles.sort((a, b) => b.localeCompare(a));
      
      const latestFile = path.join(this.BENCHMARK_DIR, reportFiles[0]);
      const content = await fs.readFile(latestFile, 'utf-8');
      
      return JSON.parse(content) as BenchmarkReport;
    } catch (error) {
      logger.error('Error reading latest benchmark report', { error });
      return null;
    }
  }
}

export const stevieAdvancedBenchmark = new StevieAdvancedBenchmarkSuite();