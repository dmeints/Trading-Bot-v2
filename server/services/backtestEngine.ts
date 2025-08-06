import { storage } from '../storage';
import { ensembleOrchestrator } from './ensembleAI';
import type { InsertBacktestResults, User } from '@shared/schema';

export interface BacktestConfiguration {
  userId: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  strategy: BacktestStrategy;
  benchmarks?: string[];
  riskLimits?: RiskLimits;
}

export interface BacktestStrategy {
  name: string;
  type: 'ai_ensemble' | 'technical' | 'fundamental' | 'hybrid';
  parameters: any;
  rebalanceFrequency: 'daily' | 'weekly' | 'monthly';
}

export interface RiskLimits {
  maxDrawdown: number;
  maxPositionSize: number;
  stopLoss: number;
  dailyVaR: number;
}

export interface BacktestResult {
  summary: BacktestSummary;
  trades: BacktestTrade[];
  performance: PerformanceMetrics;
  riskMetrics: RiskAnalysis;
  timeline: TimelineData[];
}

export interface BacktestSummary {
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
}

export interface BacktestTrade {
  timestamp: Date;
  symbol: string;
  action: 'buy' | 'sell';
  quantity: number;
  price: number;
  reason: string;
  confidence: number;
}

export interface PerformanceMetrics {
  cumulativeReturns: number[];
  rollingReturns: number[];
  drawdowns: number[];
  benchmarkComparison: BenchmarkComparison[];
}

export interface BenchmarkComparison {
  benchmark: string;
  correlation: number;
  beta: number;
  alpha: number;
  trackingError: number;
}

export interface RiskAnalysis {
  valueAtRisk: { daily: number; weekly: number; monthly: number };
  conditionalVaR: { daily: number; weekly: number; monthly: number };
  maximumDrawdownPeriods: DrawdownPeriod[];
  volatility: { daily: number; annualized: number };
}

export interface DrawdownPeriod {
  start: Date;
  end: Date;
  peak: number;
  trough: number;
  drawdown: number;
  recovery: Date | null;
}

export interface TimelineData {
  date: Date;
  portfolioValue: number;
  benchmark: number;
  drawdown: number;
  positions: { [symbol: string]: number };
}

export class BacktestEngine {
  async runBacktest(config: BacktestConfiguration): Promise<BacktestResult> {
    console.log(`Starting backtest: ${config.strategy.name} from ${config.startDate} to ${config.endDate}`);
    
    // Initialize backtest state
    const state = this.initializeBacktestState(config);
    
    // Generate historical data points
    const timePoints = this.generateTimePoints(config.startDate, config.endDate, config.strategy.rebalanceFrequency);
    
    // Run simulation through time
    for (const timePoint of timePoints) {
      await this.processTimePoint(state, timePoint, config);
    }
    
    // Calculate final metrics
    const result = this.calculateResults(state, config);
    
    // Store backtest result
    await this.storeBacktestResult(config, result);
    
    return result;
  }

  private initializeBacktestState(config: BacktestConfiguration) {
    return {
      currentDate: config.startDate,
      cash: config.initialCapital,
      positions: new Map<string, number>(),
      portfolioHistory: [],
      tradeHistory: [],
      metrics: {
        totalValue: config.initialCapital,
        peak: config.initialCapital,
        maxDrawdown: 0,
        returns: []
      }
    };
  }

  private generateTimePoints(startDate: Date, endDate: Date, frequency: string): Date[] {
    const points: Date[] = [];
    const current = new Date(startDate);
    
    const incrementDays = frequency === 'daily' ? 1 : frequency === 'weekly' ? 7 : 30;
    
    while (current <= endDate) {
      points.push(new Date(current));
      current.setDate(current.getDate() + incrementDays);
    }
    
    return points;
  }

  private async processTimePoint(state: any, date: Date, config: BacktestConfiguration): Promise<void> {
    // Simulate market data for this time point
    const marketData = await this.getSimulatedMarketData(date);
    
    // Update position values
    this.updatePositionValues(state, marketData);
    
    // Generate trading signals based on strategy
    const signals = await this.generateTradingSignals(config.strategy, marketData, state);
    
    // Execute trades with risk checks
    for (const signal of signals) {
      if (this.passesRiskChecks(signal, state, config.riskLimits)) {
        this.executeTrade(state, signal, date);
      }
    }
    
    // Update portfolio metrics
    this.updatePortfolioMetrics(state, date);
  }

  private async getSimulatedMarketData(date: Date): Promise<any> {
    // In a real backtest, this would fetch historical data
    // For now, we'll simulate realistic price movements
    const symbols = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'ADA/USD', 'DOT/USD'];
    const data: any = {};
    
    symbols.forEach(symbol => {
      const basePrice = this.getBasePriceForSymbol(symbol);
      const volatility = this.getVolatilityForSymbol(symbol);
      const trend = this.getTrendForDate(date, symbol);
      
      // Simulate price with trend and volatility
      const randomFactor = 1 + (Math.random() - 0.5) * volatility;
      const trendFactor = 1 + trend;
      
      data[symbol] = {
        price: basePrice * trendFactor * randomFactor,
        volume: Math.random() * 1000000 + 500000,
        change24h: (randomFactor - 1) * 100
      };
    });
    
    return data;
  }

  private getBasePriceForSymbol(symbol: string): number {
    const basePrices = {
      'BTC/USD': 45000,
      'ETH/USD': 3000,
      'SOL/USD': 100,
      'ADA/USD': 0.5,
      'DOT/USD': 7
    };
    return (basePrices as any)[symbol] || 100;
  }

  private getVolatilityForSymbol(symbol: string): number {
    const volatilities = {
      'BTC/USD': 0.04,
      'ETH/USD': 0.05,
      'SOL/USD': 0.08,
      'ADA/USD': 0.06,
      'DOT/USD': 0.07
    };
    return (volatilities as any)[symbol] || 0.05;
  }

  private getTrendForDate(date: Date, symbol: string): number {
    // Simulate market cycles - this would be based on actual historical patterns
    const daysSinceStart = Math.floor((date.getTime() - new Date('2023-01-01').getTime()) / (1000 * 60 * 60 * 24));
    const cycleFactor = Math.sin(daysSinceStart / 100) * 0.002; // Long-term cycle
    const shortCycleFactor = Math.sin(daysSinceStart / 30) * 0.001; // Short-term volatility
    
    return cycleFactor + shortCycleFactor;
  }

  private updatePositionValues(state: any, marketData: any): void {
    let totalValue = state.cash;
    
    for (const [symbol, quantity] of state.positions.entries()) {
      if (marketData[symbol]) {
        totalValue += quantity * marketData[symbol].price;
      }
    }
    
    state.metrics.totalValue = totalValue;
  }

  private async generateTradingSignals(strategy: BacktestStrategy, marketData: any, state: any): Promise<any[]> {
    const signals = [];
    
    if (strategy.type === 'ai_ensemble') {
      // Use ensemble AI for signal generation
      for (const symbol of Object.keys(marketData)) {
        try {
          const recommendation = await ensembleOrchestrator.generateEnsembleRecommendation(symbol, marketData[symbol]);
          
          if (recommendation.confidence > 0.6) {
            signals.push({
              symbol,
              action: recommendation.action,
              confidence: recommendation.confidence,
              reasoning: recommendation.reasoning,
              targetQuantity: this.calculatePositionSize(recommendation, state, marketData[symbol])
            });
          }
        } catch (error) {
          console.error(`Error generating signal for ${symbol}:`, error);
        }
      }
    } else {
      // Implement other strategy types (technical, fundamental, etc.)
      signals.push(...this.generateTechnicalSignals(marketData, state));
    }
    
    return signals;
  }

  private generateTechnicalSignals(marketData: any, state: any): any[] {
    // Simple technical analysis - in reality this would be much more sophisticated
    const signals = [];
    
    for (const [symbol, data] of Object.entries(marketData)) {
      const change = (data as any).change24h;
      
      if (change > 5) {
        signals.push({
          symbol,
          action: 'buy',
          confidence: 0.6,
          reasoning: 'Strong upward momentum',
          targetQuantity: state.metrics.totalValue * 0.1 / (data as any).price
        });
      } else if (change < -5) {
        signals.push({
          symbol,
          action: 'sell',
          confidence: 0.6,
          reasoning: 'Strong downward momentum',
          targetQuantity: state.positions.get(symbol) || 0
        });
      }
    }
    
    return signals;
  }

  private calculatePositionSize(recommendation: any, state: any, marketData: any): number {
    // Kelly Criterion-based position sizing
    const winRate = 0.55; // Historical win rate
    const avgWin = 0.08;
    const avgLoss = 0.05;
    
    const kelly = (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin;
    const conservativeKelly = Math.max(0, kelly * 0.5); // Use half-Kelly for safety
    
    const maxPositionValue = state.metrics.totalValue * Math.min(conservativeKelly, 0.2); // Cap at 20%
    return maxPositionValue / marketData.price;
  }

  private passesRiskChecks(signal: any, state: any, riskLimits?: RiskLimits): boolean {
    if (!riskLimits) return true;
    
    // Check maximum position size
    const positionValue = signal.targetQuantity * signal.price;
    const positionRatio = positionValue / state.metrics.totalValue;
    
    if (positionRatio > riskLimits.maxPositionSize) {
      return false;
    }
    
    // Check maximum drawdown
    const currentDrawdown = (state.metrics.peak - state.metrics.totalValue) / state.metrics.peak;
    if (currentDrawdown > riskLimits.maxDrawdown) {
      return false;
    }
    
    return true;
  }

  private executeTrade(state: any, signal: any, date: Date): void {
    const currentPosition = state.positions.get(signal.symbol) || 0;
    let quantityToTrade = 0;
    
    if (signal.action === 'buy') {
      const maxQuantity = state.cash / signal.price;
      quantityToTrade = Math.min(signal.targetQuantity, maxQuantity);
      
      if (quantityToTrade > 0) {
        state.cash -= quantityToTrade * signal.price;
        state.positions.set(signal.symbol, currentPosition + quantityToTrade);
      }
    } else if (signal.action === 'sell') {
      quantityToTrade = Math.min(signal.targetQuantity, currentPosition);
      
      if (quantityToTrade > 0) {
        state.cash += quantityToTrade * signal.price;
        state.positions.set(signal.symbol, currentPosition - quantityToTrade);
      }
    }
    
    if (quantityToTrade > 0) {
      state.tradeHistory.push({
        timestamp: date,
        symbol: signal.symbol,
        action: signal.action,
        quantity: quantityToTrade,
        price: signal.price,
        reason: signal.reasoning,
        confidence: signal.confidence
      });
    }
  }

  private updatePortfolioMetrics(state: any, date: Date): void {
    // Update peak and drawdown
    if (state.metrics.totalValue > state.metrics.peak) {
      state.metrics.peak = state.metrics.totalValue;
    }
    
    const currentDrawdown = (state.metrics.peak - state.metrics.totalValue) / state.metrics.peak;
    state.metrics.maxDrawdown = Math.max(state.metrics.maxDrawdown, currentDrawdown);
    
    // Record portfolio snapshot
    state.portfolioHistory.push({
      date: new Date(date),
      portfolioValue: state.metrics.totalValue,
      cash: state.cash,
      positions: new Map(state.positions),
      drawdown: currentDrawdown
    });
  }

  private calculateResults(state: any, config: BacktestConfiguration): BacktestResult {
    const returns = this.calculateReturns(state.portfolioHistory);
    const summary = this.calculateSummary(state, config, returns);
    const performance = this.calculatePerformance(state.portfolioHistory);
    const riskMetrics = this.calculateRiskMetrics(returns, state.portfolioHistory);
    
    return {
      summary,
      trades: state.tradeHistory,
      performance,
      riskMetrics,
      timeline: state.portfolioHistory
    };
  }

  private calculateReturns(portfolioHistory: any[]): number[] {
    const returns = [];
    for (let i = 1; i < portfolioHistory.length; i++) {
      const currentValue = portfolioHistory[i].portfolioValue;
      const previousValue = portfolioHistory[i - 1].portfolioValue;
      returns.push((currentValue - previousValue) / previousValue);
    }
    return returns;
  }

  private calculateSummary(state: any, config: BacktestConfiguration, returns: number[]): BacktestSummary {
    const finalValue = state.metrics.totalValue;
    const totalReturn = (finalValue - config.initialCapital) / config.initialCapital;
    
    const daysDiff = Math.floor((config.endDate.getTime() - config.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const annualizedReturn = Math.pow(1 + totalReturn, 365 / daysDiff) - 1;
    
    const winningTrades = state.tradeHistory.filter((t: any) => t.action === 'sell' && t.pnl > 0).length;
    const winRate = state.tradeHistory.length > 0 ? winningTrades / state.tradeHistory.length : 0;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const returnStd = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = returnStd > 0 ? (avgReturn - 0.02/365) / returnStd : 0; // Assuming 2% risk-free rate
    
    return {
      totalReturn,
      annualizedReturn,
      maxDrawdown: state.metrics.maxDrawdown,
      sharpeRatio,
      sortinoRatio: this.calculateSortinoRatio(returns),
      winRate,
      profitFactor: this.calculateProfitFactor(state.tradeHistory),
      totalTrades: state.tradeHistory.length
    };
  }

  private calculateSortinoRatio(returns: number[]): number {
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const negativeReturns = returns.filter(r => r < 0);
    
    if (negativeReturns.length === 0) return avgReturn > 0 ? 10 : 0;
    
    const downsideDeviation = Math.sqrt(
      negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length
    );
    
    return downsideDeviation > 0 ? (avgReturn - 0.02/365) / downsideDeviation : 0;
  }

  private calculateProfitFactor(trades: any[]): number {
    const profits = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
    const losses = Math.abs(trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
    
    return losses > 0 ? profits / losses : profits > 0 ? 10 : 1;
  }

  private calculatePerformance(portfolioHistory: any[]): PerformanceMetrics {
    const cumulativeReturns = portfolioHistory.map(p => 
      (p.portfolioValue - portfolioHistory[0].portfolioValue) / portfolioHistory[0].portfolioValue
    );
    
    const rollingReturns = [];
    for (let i = 30; i < portfolioHistory.length; i++) {
      const currentValue = portfolioHistory[i].portfolioValue;
      const pastValue = portfolioHistory[i - 30].portfolioValue;
      rollingReturns.push((currentValue - pastValue) / pastValue);
    }
    
    const drawdowns = portfolioHistory.map(p => p.drawdown);
    
    return {
      cumulativeReturns,
      rollingReturns,
      drawdowns,
      benchmarkComparison: [] // Would compare against benchmarks like BTC, S&P 500, etc.
    };
  }

  private calculateRiskMetrics(returns: number[], portfolioHistory: any[]): RiskAnalysis {
    const sortedReturns = [...returns].sort((a, b) => a - b);
    
    return {
      valueAtRisk: {
        daily: this.calculateVaR(sortedReturns, 0.05),
        weekly: this.calculateVaR(sortedReturns, 0.05) * Math.sqrt(7),
        monthly: this.calculateVaR(sortedReturns, 0.05) * Math.sqrt(30)
      },
      conditionalVaR: {
        daily: this.calculateCVaR(sortedReturns, 0.05),
        weekly: this.calculateCVaR(sortedReturns, 0.05) * Math.sqrt(7),
        monthly: this.calculateCVaR(sortedReturns, 0.05) * Math.sqrt(30)
      },
      maximumDrawdownPeriods: this.identifyDrawdownPeriods(portfolioHistory),
      volatility: {
        daily: Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / returns.length),
        annualized: Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / returns.length) * Math.sqrt(365)
      }
    };
  }

  private calculateVaR(sortedReturns: number[], alpha: number): number {
    const index = Math.floor(alpha * sortedReturns.length);
    return sortedReturns[index] || 0;
  }

  private calculateCVaR(sortedReturns: number[], alpha: number): number {
    const index = Math.floor(alpha * sortedReturns.length);
    const tailReturns = sortedReturns.slice(0, index);
    return tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;
  }

  private identifyDrawdownPeriods(portfolioHistory: any[]): DrawdownPeriod[] {
    const periods: DrawdownPeriod[] = [];
    let inDrawdown = false;
    let currentPeriod: Partial<DrawdownPeriod> = {};
    
    for (let i = 0; i < portfolioHistory.length; i++) {
      const snapshot = portfolioHistory[i];
      
      if (snapshot.drawdown > 0 && !inDrawdown) {
        // Start of new drawdown
        inDrawdown = true;
        currentPeriod = {
          start: snapshot.date,
          peak: snapshot.portfolioValue / (1 - snapshot.drawdown)
        };
      } else if (snapshot.drawdown === 0 && inDrawdown) {
        // End of drawdown
        inDrawdown = false;
        if (currentPeriod.start && currentPeriod.peak) {
          periods.push({
            start: currentPeriod.start,
            end: snapshot.date,
            peak: currentPeriod.peak,
            trough: currentPeriod.trough || 0,
            drawdown: currentPeriod.drawdown || 0,
            recovery: snapshot.date
          });
        }
      } else if (inDrawdown) {
        // Update current drawdown
        currentPeriod.trough = Math.min(currentPeriod.trough || Infinity, snapshot.portfolioValue);
        currentPeriod.drawdown = Math.max(currentPeriod.drawdown || 0, snapshot.drawdown);
      }
    }
    
    return periods;
  }

  private async storeBacktestResult(config: BacktestConfiguration, result: BacktestResult): Promise<void> {
    try {
      await storage.createBacktestResult({
        userId: config.userId,
        strategyId: null, // Could link to shared strategy
        startDate: config.startDate,
        endDate: config.endDate,
        initialCapital: config.initialCapital.toString(),
        finalCapital: (config.initialCapital * (1 + result.summary.totalReturn)).toString(),
        totalReturn: result.summary.totalReturn,
        maxDrawdown: result.summary.maxDrawdown,
        winRate: result.summary.winRate,
        totalTrades: result.summary.totalTrades,
        profitFactor: result.summary.profitFactor,
        sharpeRatio: result.summary.sharpeRatio,
        details: {
          strategy: config.strategy,
          riskLimits: config.riskLimits,
          trades: result.trades,
          performance: result.performance,
          riskMetrics: result.riskMetrics
        }
      });
    } catch (error) {
      console.error('Error storing backtest result:', error);
    }
  }
}

export const backtestEngine = new BacktestEngine();