#!/usr/bin/env tsx

/**
 * STEVIE VERSIONED BENCHMARK TEST
 * Runs comprehensive benchmark with version tracking and difficulty scaling
 */

import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';

interface BenchmarkConfig {
  version: string;
  days: number;
  marketShocks: number;
  noiseLevel: number;
  slippageRate: number;
  minTradesRequired: number;
}

interface BenchmarkResult {
  version: string;
  timestamp: number;
  duration: number;
  config: BenchmarkConfig;
  performance: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
    avgTradeReturn: number;
    volatility: number;
    calmarRatio: number;
  };
  difficulty: {
    level: number;
    modifiers: string[];
  };
  metadata: {
    dataPoints: number;
    marketRegimes: string[];
    testPeriod: { start: string; end: string };
  };
}

export class StevieVersionedBenchmark {
  private resultsDir = './benchmark-results';

  constructor() {
    // Ensure results directory exists
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  async runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult> {
    console.log(`🎯 STEVIE BENCHMARK v${config.version} - Training Day`);
    console.log(`⚙️ Configuration: ${config.days} days, ${config.marketShocks} shocks, ${config.noiseLevel}% noise`);
    
    const startTime = performance.now();
    
    // Generate synthetic historical data with difficulty modifiers
    const marketData = this.generateMarketData(config);
    
    // Run Stevie's trading simulation
    const tradingResults = await this.runTradingSimulation(marketData, config);
    
    // Calculate comprehensive performance metrics
    const performanceMetrics = this.calculatePerformanceMetrics(tradingResults, config);
    
    const duration = performance.now() - startTime;
    
    const result: BenchmarkResult = {
      version: config.version,
      timestamp: Date.now(),
      duration,
      config,
      performance: performanceMetrics,
      difficulty: {
        level: this.calculateDifficultyLevel(config),
        modifiers: this.getDifficultyModifiers(config)
      },
      metadata: {
        dataPoints: marketData.length,
        marketRegimes: this.detectMarketRegimes(marketData),
        testPeriod: {
          start: new Date(Date.now() - config.days * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString()
        }
      }
    };

    // Save results
    await this.saveResults(result);
    
    // Display results
    this.displayResults(result);
    
    return result;
  }

  private generateMarketData(config: BenchmarkConfig): any[] {
    const dataPoints = config.days * 24 * 4; // 15-minute intervals
    const data: any[] = [];
    
    let basePrice = 45000; // Starting BTC price
    let trend = 0.0001; // Base trend
    
    for (let i = 0; i < dataPoints; i++) {
      const timestamp = new Date(Date.now() - (dataPoints - i) * 15 * 60 * 1000);
      
      // Apply market shocks based on difficulty
      let shock = 0;
      if (config.marketShocks > 0 && Math.random() < (config.marketShocks / dataPoints)) {
        shock = (Math.random() - 0.5) * 0.1; // ±5% shock
      }
      
      // Add noise based on difficulty
      const noise = (Math.random() - 0.5) * (config.noiseLevel / 100);
      
      // Calculate price movement
      const movement = trend + shock + noise;
      basePrice *= (1 + movement);
      
      data.push({
        timestamp,
        price: basePrice,
        volume: 1000000 + Math.random() * 500000,
        rsi: 30 + Math.random() * 40,
        macd: (Math.random() - 0.5) * 100,
        sma20: basePrice * (0.98 + Math.random() * 0.04),
        sma50: basePrice * (0.96 + Math.random() * 0.08),
        volatility: 0.02 + Math.random() * 0.03
      });
    }
    
    return data;
  }

  private async runTradingSimulation(marketData: any[], config: BenchmarkConfig): Promise<any[]> {
    const trades: any[] = [];
    let balance = 10000; // Starting balance
    let position = 0; // Current BTC position
    let entryPrice = 0;
    
    // Stevie's trading logic simulation
    for (let i = 50; i < marketData.length; i++) {
      const current = marketData[i];
      const previous = marketData.slice(i-50, i);
      
      // Simple momentum strategy with RSI filter
      const rsiSignal = current.rsi < 30 ? 'buy' : current.rsi > 70 ? 'sell' : 'hold';
      const momentumSignal = current.sma20 > current.sma50 ? 'buy' : 'sell';
      
      let signal = 'hold';
      if (rsiSignal === 'buy' && momentumSignal === 'buy' && position === 0) {
        signal = 'buy';
      } else if ((rsiSignal === 'sell' || momentumSignal === 'sell') && position > 0) {
        signal = 'sell';
      }
      
      // Execute trades with slippage
      if (signal === 'buy' && balance > 0) {
        const slippage = 1 + (config.slippageRate / 100);
        const buyPrice = current.price * slippage;
        position = balance / buyPrice;
        entryPrice = buyPrice;
        balance = 0;
        
        trades.push({
          timestamp: current.timestamp,
          action: 'buy',
          price: buyPrice,
          amount: position,
          balance: 0
        });
        
      } else if (signal === 'sell' && position > 0) {
        const slippage = 1 - (config.slippageRate / 100);
        const sellPrice = current.price * slippage;
        balance = position * sellPrice;
        const profit = balance - (position * entryPrice);
        position = 0;
        
        trades.push({
          timestamp: current.timestamp,
          action: 'sell',
          price: sellPrice,
          amount: balance / sellPrice,
          balance: balance,
          profit: profit,
          return: profit / (position * entryPrice)
        });
      }
    }
    
    return trades;
  }

  private calculatePerformanceMetrics(trades: any[], config: BenchmarkConfig): any {
    if (trades.length === 0) {
      return {
        totalReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
        totalTrades: 0,
        avgTradeReturn: 0,
        volatility: 0,
        calmarRatio: 0
      };
    }

    const completedTrades = trades.filter(t => t.action === 'sell');
    const returns = completedTrades.map(t => t.return || 0);
    
    // Calculate metrics
    const totalReturn = returns.reduce((sum, r) => sum + r, 0);
    const avgReturn = totalReturn / Math.max(returns.length, 1);
    const volatility = this.calculateVolatility(returns);
    const sharpeRatio = volatility > 0 ? (avgReturn * Math.sqrt(252)) / volatility : 0;
    const maxDrawdown = this.calculateMaxDrawdown(completedTrades);
    const winRate = returns.filter(r => r > 0).length / Math.max(returns.length, 1);
    const calmarRatio = maxDrawdown > 0 ? totalReturn / Math.abs(maxDrawdown) : 0;

    return {
      totalReturn: totalReturn * 100, // Convert to percentage
      sharpeRatio,
      maxDrawdown: maxDrawdown * 100,
      winRate: winRate * 100,
      totalTrades: completedTrades.length,
      avgTradeReturn: avgReturn * 100,
      volatility: volatility * 100,
      calmarRatio
    };
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    return Math.sqrt(variance * 252); // Annualized
  }

  private calculateMaxDrawdown(trades: any[]): number {
    if (trades.length === 0) return 0;
    
    let peak = 0;
    let maxDrawdown = 0;
    let runningBalance = 10000;
    
    for (const trade of trades) {
      runningBalance = trade.balance;
      if (runningBalance > peak) peak = runningBalance;
      const drawdown = (peak - runningBalance) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    
    return maxDrawdown;
  }

  private calculateDifficultyLevel(config: BenchmarkConfig): number {
    let level = 1;
    level += Math.floor(config.days / 7); // +1 per week
    level += config.marketShocks; // +1 per shock
    level += Math.floor(config.noiseLevel / 5); // +1 per 5% noise
    level += Math.floor(config.slippageRate * 10); // +1 per 0.1% slippage
    return level;
  }

  private getDifficultyModifiers(config: BenchmarkConfig): string[] {
    const modifiers: string[] = [];
    if (config.days > 7) modifiers.push(`Extended period: ${config.days} days`);
    if (config.marketShocks > 0) modifiers.push(`Market shocks: ${config.marketShocks}`);
    if (config.noiseLevel > 0) modifiers.push(`Price noise: ${config.noiseLevel}%`);
    if (config.slippageRate > 0) modifiers.push(`Slippage: ${config.slippageRate}%`);
    return modifiers;
  }

  private detectMarketRegimes(data: any[]): string[] {
    const regimes: string[] = [];
    const volatilities = data.map(d => d.volatility);
    const avgVol = volatilities.reduce((sum, v) => sum + v, 0) / volatilities.length;
    
    if (avgVol > 0.04) regimes.push('high_volatility');
    if (avgVol < 0.02) regimes.push('low_volatility');
    
    // Trend detection
    const firstPrice = data[0].price;
    const lastPrice = data[data.length - 1].price;
    const trend = (lastPrice - firstPrice) / firstPrice;
    
    if (trend > 0.1) regimes.push('bull_market');
    else if (trend < -0.1) regimes.push('bear_market');
    else regimes.push('sideways_market');
    
    return regimes;
  }

  private async saveResults(result: BenchmarkResult): Promise<void> {
    const filename = `benchmark_v${result.version}_${Date.now()}.json`;
    const filepath = path.join(this.resultsDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
    
    // Update latest results
    const latestPath = path.join(this.resultsDir, 'latest.json');
    fs.writeFileSync(latestPath, JSON.stringify(result, null, 2));
    
    console.log(`📄 Results saved: ${filename}`);
  }

  private displayResults(result: BenchmarkResult): void {
    console.log('\n📊 BENCHMARK RESULTS');
    console.log('='.repeat(50));
    console.log(`🏷️  Version: ${result.version}`);
    console.log(`⏱️  Duration: ${(result.duration / 1000).toFixed(2)}s`);
    console.log(`📈 Total Return: ${result.performance.totalReturn.toFixed(2)}%`);
    console.log(`📊 Sharpe Ratio: ${result.performance.sharpeRatio.toFixed(3)}`);
    console.log(`📉 Max Drawdown: ${result.performance.maxDrawdown.toFixed(2)}%`);
    console.log(`🎯 Win Rate: ${result.performance.winRate.toFixed(1)}%`);
    console.log(`🔄 Total Trades: ${result.performance.totalTrades}`);
    console.log(`💰 Avg Trade Return: ${result.performance.avgTradeReturn.toFixed(2)}%`);
    console.log(`📊 Volatility: ${result.performance.volatility.toFixed(2)}%`);
    console.log(`📈 Calmar Ratio: ${result.performance.calmarRatio.toFixed(3)}`);
    console.log(`🎚️  Difficulty Level: ${result.difficulty.level}`);
    console.log(`⚙️  Modifiers: ${result.difficulty.modifiers.join(', ')}`);
    console.log(`🏛️  Market Regimes: ${result.metadata.marketRegimes.join(', ')}`);
    console.log('='.repeat(50));
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const version = args.find(arg => arg.startsWith('--version='))?.split('=')[1] || '1.1';
  const days = parseInt(args.find(arg => arg.startsWith('--days='))?.split('=')[1] || '7');
  
  const benchmark = new StevieVersionedBenchmark();
  
  const config: BenchmarkConfig = {
    version,
    days,
    marketShocks: Math.floor(days / 7), // 1 shock per week
    noiseLevel: Math.min(10, days), // Up to 10% noise
    slippageRate: 0.1, // 0.1% slippage
    minTradesRequired: 5
  };
  
  benchmark.runBenchmark(config).catch(console.error);
}

export { BenchmarkConfig, BenchmarkResult };