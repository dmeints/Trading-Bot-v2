/**
 * Backtesting Engine - Strategy Simulation & Performance Analysis
 * 
 * Simulates trading strategies against historical data with synthetic event generation
 */

import { storage } from "../storage";
import type { MarketPrice } from '../services/marketData';
import type { TradeRequest } from '../services/tradingEngine';

export interface BacktestConfig {
  strategy: string;
  symbol: string;
  startDate: Date;
  endDate: Date;
  initialBalance: number;
  riskPerTrade: number;
  stopLoss?: number;
  takeProfit?: number;
  syntheticEvents: SyntheticEvent[];
}

export interface SyntheticEvent {
  type: 'news' | 'whale_move' | 'social_buzz' | 'regulatory';
  timestamp: Date;
  impact: number; // -1 to 1
  description: string;
  duration: number; // minutes
}

export interface BacktestResult {
  id: string;
  config: BacktestConfig;
  performance: {
    totalReturn: number;
    winRate: number;
    sharpeRatio: number;
    maxDrawdown: number;
    totalTrades: number;
    avgTradeReturn: number;
    profitFactor: number;
  };
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
  statistics: BacktestStats;
  reportUrl?: string;
}

export interface BacktestTrade {
  timestamp: Date;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  pnl: number;
  reason: string;
  confidence: number;
}

export interface EquityPoint {
  timestamp: Date;
  equity: number;
  drawdown: number;
}

export interface BacktestStats {
  duration: number; // days
  avgDailyReturn: number;
  volatility: number;
  bestTrade: number;
  worstTrade: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  monthlyReturns: { [month: string]: number };
}

export class BacktestEngine {
  private runningBacktests: Map<string, boolean> = new Map();

  /**
   * Run backtesting simulation with given configuration
   */
  async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
    const backtestId = `backtest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.runningBacktests.set(backtestId, true);

    try {
      console.log(`[Backtest] Starting simulation: ${backtestId} for ${config.symbol} (${config.strategy})`);

      // Generate historical market data
      const historicalData = await this.generateHistoricalData(config);
      
      // Apply synthetic events
      const enhancedData = this.applySyntheticEvents(historicalData, config.syntheticEvents);
      
      // Run trading simulation
      const trades = await this.simulateTrading(config, enhancedData);
      
      // Calculate performance metrics
      const performance = this.calculatePerformance(trades, config.initialBalance);
      
      // Generate equity curve
      const equityCurve = this.generateEquityCurve(trades, config.initialBalance);
      
      // Calculate statistics
      const statistics = this.calculateStatistics(trades, equityCurve, config);
      
      const result: BacktestResult = {
        id: backtestId,
        config,
        performance,
        trades,
        equityCurve,
        statistics
      };

      // Store backtest results
      await this.storeBacktestResult(result);
      
      console.log(`[Backtest] Completed: ${backtestId}, Return: ${performance.totalReturn.toFixed(2)}%, Trades: ${trades.length}`);
      
      return result;
    } catch (error) {
      console.error(`[Backtest] Error in ${backtestId}:`, error);
      throw error;
    } finally {
      this.runningBacktests.delete(backtestId);
    }
  }

  /**
   * Generate historical market data for backtesting
   */
  private async generateHistoricalData(config: BacktestConfig): Promise<MarketPrice[]> {
    const data: MarketPrice[] = [];
    const duration = config.endDate.getTime() - config.startDate.getTime();
    const minuteInterval = 5; // 5-minute candles
    const totalPoints = Math.floor(duration / (minuteInterval * 60 * 1000));
    
    let currentPrice = this.getStartingPrice(config.symbol);
    let currentVolume = 1000000; // Starting volume
    
    for (let i = 0; i < totalPoints; i++) {
      const timestamp = new Date(config.startDate.getTime() + (i * minuteInterval * 60 * 1000));
      
      // Generate realistic price movement using random walk with trend
      const trend = this.calculateTrend(i, totalPoints);
      const volatility = 0.02; // 2% volatility
      const randomChange = (Math.random() - 0.5) * 2 * volatility;
      const priceChange = trend + randomChange;
      
      currentPrice *= (1 + priceChange);
      
      // Generate volume with some correlation to price movement
      const volumeMultiplier = 1 + (Math.abs(priceChange) * 5) + (Math.random() - 0.5) * 0.5;
      currentVolume *= volumeMultiplier;
      
      const change24h = this.calculate24hChange(data, currentPrice, i);
      
      data.push({
        symbol: config.symbol,
        price: currentPrice,
        change24h,
        volume24h: currentVolume,
        timestamp
      });
    }
    
    return data;
  }

  /**
   * Apply synthetic events to historical data
   */
  private applySyntheticEvents(data: MarketPrice[], events: SyntheticEvent[]): MarketPrice[] {
    const enhancedData = [...data];
    
    for (const event of events) {
      const eventIndex = enhancedData.findIndex(d => d.timestamp >= event.timestamp);
      if (eventIndex === -1) continue;
      
      // Apply event impact over its duration
      const impactPoints = Math.floor(event.duration / 5); // 5-minute intervals
      for (let i = 0; i < impactPoints && (eventIndex + i) < enhancedData.length; i++) {
        const point = enhancedData[eventIndex + i];
        const decayFactor = Math.exp(-i / impactPoints); // Exponential decay
        const priceImpact = event.impact * 0.1 * decayFactor; // Max 10% impact
        const volumeImpact = Math.abs(event.impact) * 2 * decayFactor; // Volume surge
        
        point.price *= (1 + priceImpact);
        point.volume24h *= (1 + volumeImpact);
      }
    }
    
    return enhancedData;
  }

  /**
   * Simulate trading strategy execution
   */
  private async simulateTrading(config: BacktestConfig, data: MarketPrice[]): Promise<BacktestTrade[]> {
    const trades: BacktestTrade[] = [];
    let position: { side: 'buy' | 'sell'; quantity: number; entryPrice: number; entryTime: Date } | null = null;
    
    for (let i = 1; i < data.length; i++) {
      const currentPoint = data[i];
      const previousPoint = data[i - 1];
      
      // Generate trading signal based on strategy
      const signal = this.generateTradingSignal(config.strategy, data.slice(Math.max(0, i - 20), i + 1));
      
      if (signal.action !== 'hold' && !position) {
        // Open position
        const quantity = this.calculatePositionSize(config, currentPoint.price);
        position = {
          side: signal.action as 'buy' | 'sell',
          quantity,
          entryPrice: currentPoint.price,
          entryTime: currentPoint.timestamp
        };
      } else if (position && this.shouldClosePosition(position, currentPoint, config)) {
        // Close position
        const exitPrice = currentPoint.price;
        const pnl = this.calculatePnL(position, exitPrice);
        
        trades.push({
          timestamp: position.entryTime,
          symbol: config.symbol,
          side: position.side,
          quantity: position.quantity,
          price: position.entryPrice,
          pnl,
          reason: `Strategy: ${config.strategy}, Signal confidence: ${signal.confidence.toFixed(2)}`,
          confidence: signal.confidence
        });
        
        // Add closing trade
        trades.push({
          timestamp: currentPoint.timestamp,
          symbol: config.symbol,
          side: position.side === 'buy' ? 'sell' : 'buy',
          quantity: position.quantity,
          price: exitPrice,
          pnl: -pnl, // Opposite PnL for closing trade
          reason: `Close position, PnL: ${pnl.toFixed(2)}`,
          confidence: signal.confidence
        });
        
        position = null;
      }
    }
    
    return trades;
  }

  /**
   * Generate trading signals based on strategy
   */
  private generateTradingSignal(strategy: string, data: MarketPrice[]): { action: 'buy' | 'sell' | 'hold'; confidence: number } {
    if (data.length < 10) return { action: 'hold', confidence: 0.1 };
    
    const current = data[data.length - 1];
    const previous = data[data.length - 2];
    
    switch (strategy) {
      case 'momentum':
        return this.momentumStrategy(data);
      case 'mean_reversion':
        return this.meanReversionStrategy(data);
      case 'breakout':
        return this.breakoutStrategy(data);
      case 'ai_hybrid':
        return this.aiHybridStrategy(data);
      default:
        // Simple trend following
        const trend = current.price > previous.price ? 'buy' : 'sell';
        const confidence = Math.min(Math.abs(current.change24h) / 10, 0.8);
        return { action: trend, confidence };
    }
  }

  // Strategy implementations
  private momentumStrategy(data: MarketPrice[]): { action: 'buy' | 'sell' | 'hold'; confidence: number } {
    const recent = data.slice(-5);
    const momentum = recent[recent.length - 1].price / recent[0].price - 1;
    const avgVolume = recent.reduce((sum, d) => sum + d.volume24h, 0) / recent.length;
    const currentVolume = recent[recent.length - 1].volume24h;
    
    if (momentum > 0.02 && currentVolume > avgVolume * 1.2) {
      return { action: 'buy', confidence: Math.min(momentum * 10, 0.9) };
    } else if (momentum < -0.02 && currentVolume > avgVolume * 1.2) {
      return { action: 'sell', confidence: Math.min(Math.abs(momentum) * 10, 0.9) };
    }
    
    return { action: 'hold', confidence: 0.1 };
  }

  private meanReversionStrategy(data: MarketPrice[]): { action: 'buy' | 'sell' | 'hold'; confidence: number } {
    if (data.length < 20) return { action: 'hold', confidence: 0.1 };
    
    const prices = data.map(d => d.price);
    const sma20 = prices.slice(-20).reduce((sum, p) => sum + p, 0) / 20;
    const currentPrice = prices[prices.length - 1];
    const deviation = (currentPrice - sma20) / sma20;
    
    if (deviation < -0.05) {
      return { action: 'buy', confidence: Math.min(Math.abs(deviation) * 10, 0.85) };
    } else if (deviation > 0.05) {
      return { action: 'sell', confidence: Math.min(deviation * 10, 0.85) };
    }
    
    return { action: 'hold', confidence: 0.2 };
  }

  private breakoutStrategy(data: MarketPrice[]): { action: 'buy' | 'sell' | 'hold'; confidence: number } {
    if (data.length < 20) return { action: 'hold', confidence: 0.1 };
    
    const prices = data.map(d => d.price);
    const recent20 = prices.slice(-20);
    const high20 = Math.max(...recent20);
    const low20 = Math.min(...recent20);
    const currentPrice = prices[prices.length - 1];
    
    if (currentPrice > high20 * 1.01) {
      return { action: 'buy', confidence: 0.75 };
    } else if (currentPrice < low20 * 0.99) {
      return { action: 'sell', confidence: 0.75 };
    }
    
    return { action: 'hold', confidence: 0.15 };
  }

  private aiHybridStrategy(data: MarketPrice[]): { action: 'buy' | 'sell' | 'hold'; confidence: number } {
    // Combine multiple signals
    const momentum = this.momentumStrategy(data);
    const meanReversion = this.meanReversionStrategy(data);
    const breakout = this.breakoutStrategy(data);
    
    // Weighted combination
    const signals = [
      { ...momentum, weight: 0.4 },
      { ...meanReversion, weight: 0.3 },
      { ...breakout, weight: 0.3 }
    ];
    
    const buyScore = signals.filter(s => s.action === 'buy').reduce((sum, s) => sum + s.confidence * s.weight, 0);
    const sellScore = signals.filter(s => s.action === 'sell').reduce((sum, s) => sum + s.confidence * s.weight, 0);
    
    if (buyScore > sellScore && buyScore > 0.3) {
      return { action: 'buy', confidence: buyScore };
    } else if (sellScore > buyScore && sellScore > 0.3) {
      return { action: 'sell', confidence: sellScore };
    }
    
    return { action: 'hold', confidence: 0.2 };
  }

  // Helper methods
  private getStartingPrice(symbol: string): number {
    const basePrices: { [key: string]: number } = {
      'BTC/USD': 50000,
      'ETH/USD': 3000,
      'SOL/USD': 100,
      'ADA/USD': 0.5,
      'DOT/USD': 5
    };
    return basePrices[symbol] || 1000;
  }

  private calculateTrend(index: number, totalPoints: number): number {
    // Simulate market cycles
    const cycleLength = totalPoints / 4; // 4 cycles in the backtest period
    const cyclePosition = (index % cycleLength) / cycleLength;
    return Math.sin(cyclePosition * 2 * Math.PI) * 0.001; // Small trend component
  }

  private calculate24hChange(data: MarketPrice[], currentPrice: number, index: number): number {
    const pointsIn24h = Math.floor(24 * 60 / 5); // 5-minute intervals in 24 hours
    const lookbackIndex = Math.max(0, index - pointsIn24h);
    if (lookbackIndex >= data.length) return 0;
    
    const oldPrice = data[lookbackIndex].price;
    return ((currentPrice - oldPrice) / oldPrice) * 100;
  }

  private calculatePositionSize(config: BacktestConfig, price: number): number {
    const riskAmount = config.initialBalance * (config.riskPerTrade / 100);
    return riskAmount / price;
  }

  private shouldClosePosition(position: any, currentPoint: MarketPrice, config: BacktestConfig): boolean {
    const currentPnl = this.calculatePnL(position, currentPoint.price);
    const pnlPercent = (currentPnl / (position.quantity * position.entryPrice)) * 100;
    
    // Stop loss
    if (config.stopLoss && pnlPercent <= -config.stopLoss) {
      return true;
    }
    
    // Take profit
    if (config.takeProfit && pnlPercent >= config.takeProfit) {
      return true;
    }
    
    // Time-based exit (hold for max 24 hours in simulation)
    const holdTime = currentPoint.timestamp.getTime() - position.entryTime.getTime();
    if (holdTime > 24 * 60 * 60 * 1000) {
      return true;
    }
    
    return false;
  }

  private calculatePnL(position: any, exitPrice: number): number {
    const multiplier = position.side === 'buy' ? 1 : -1;
    return (exitPrice - position.entryPrice) * position.quantity * multiplier;
  }

  private calculatePerformance(trades: BacktestTrade[], initialBalance: number): BacktestResult['performance'] {
    if (trades.length === 0) {
      return {
        totalReturn: 0,
        winRate: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        totalTrades: 0,
        avgTradeReturn: 0,
        profitFactor: 0
      };
    }

    const totalPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);
    const totalReturn = (totalPnl / initialBalance) * 100;
    
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);
    const winRate = (winningTrades.length / trades.length) * 100;
    
    const avgTradeReturn = totalPnl / trades.length;
    
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
    
    // Simplified Sharpe ratio calculation
    const returns = trades.map(t => t.pnl);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized
    
    // Calculate max drawdown
    let peak = initialBalance;
    let maxDrawdown = 0;
    let currentBalance = initialBalance;
    
    for (const trade of trades) {
      currentBalance += trade.pnl;
      if (currentBalance > peak) {
        peak = currentBalance;
      }
      const drawdown = ((peak - currentBalance) / peak) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    
    return {
      totalReturn,
      winRate,
      sharpeRatio,
      maxDrawdown,
      totalTrades: trades.length,
      avgTradeReturn,
      profitFactor
    };
  }

  private generateEquityCurve(trades: BacktestTrade[], initialBalance: number): EquityPoint[] {
    const curve: EquityPoint[] = [];
    let currentEquity = initialBalance;
    let peak = initialBalance;
    
    curve.push({
      timestamp: trades[0]?.timestamp || new Date(),
      equity: currentEquity,
      drawdown: 0
    });
    
    for (const trade of trades) {
      currentEquity += trade.pnl;
      if (currentEquity > peak) {
        peak = currentEquity;
      }
      
      const drawdown = ((peak - currentEquity) / peak) * 100;
      
      curve.push({
        timestamp: trade.timestamp,
        equity: currentEquity,
        drawdown
      });
    }
    
    return curve;
  }

  private calculateStatistics(trades: BacktestTrade[], equityCurve: EquityPoint[], config: BacktestConfig): BacktestStats {
    const duration = (config.endDate.getTime() - config.startDate.getTime()) / (1000 * 60 * 60 * 24);
    const returns = trades.map(t => t.pnl);
    
    const avgDailyReturn = returns.length > 0 ? 
      (returns.reduce((sum, r) => sum + r, 0) / returns.length) * (1440 / 5) / duration : 0; // Scaled to daily
    
    const variance = returns.length > 1 ? 
      returns.reduce((sum, r) => sum + Math.pow(r - (returns.reduce((s, x) => s + x, 0) / returns.length), 2), 0) / (returns.length - 1) : 0;
    const volatility = Math.sqrt(variance) * Math.sqrt(252); // Annualized
    
    const bestTrade = returns.length > 0 ? Math.max(...returns) : 0;
    const worstTrade = returns.length > 0 ? Math.min(...returns) : 0;
    
    // Calculate consecutive wins/losses
    let consecutiveWins = 0;
    let consecutiveLosses = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    
    for (const trade of trades) {
      if (trade.pnl > 0) {
        currentWinStreak++;
        currentLossStreak = 0;
        consecutiveWins = Math.max(consecutiveWins, currentWinStreak);
      } else if (trade.pnl < 0) {
        currentLossStreak++;
        currentWinStreak = 0;
        consecutiveLosses = Math.max(consecutiveLosses, currentLossStreak);
      }
    }
    
    // Monthly returns (simplified)
    const monthlyReturns: { [month: string]: number } = {};
    trades.forEach(trade => {
      const month = trade.timestamp.toISOString().substring(0, 7); // YYYY-MM
      monthlyReturns[month] = (monthlyReturns[month] || 0) + trade.pnl;
    });
    
    return {
      duration,
      avgDailyReturn,
      volatility,
      bestTrade,
      worstTrade,
      consecutiveWins,
      consecutiveLosses,
      monthlyReturns
    };
  }

  private async storeBacktestResult(result: BacktestResult): Promise<void> {
    try {
      // Store in analytics logger for now
      // TODO: Add proper database schema for backtest results
      await storage.logAgentActivity({
        agentType: 'backtest_engine',
        activity: `Backtest completed: ${result.config.strategy} on ${result.config.symbol}`,
        confidence: result.performance.winRate / 100,
        data: {
          backtestId: result.id,
          performance: result.performance,
          config: result.config,
          tradeCount: result.trades.length
        }
      });
    } catch (error) {
      console.error('Failed to store backtest result:', error);
    }
  }

  /**
   * Get backtest result by ID
   */
  async getBacktestResult(id: string): Promise<BacktestResult | null> {
    // TODO: Implement proper storage retrieval
    return null;
  }

  /**
   * Export backtest results to CSV format
   */
  async exportBacktestCSV(id: string): Promise<string> {
    // TODO: Implement CSV export functionality
    return `timestamp,symbol,side,quantity,price,pnl,confidence\n`;
  }

  /**
   * Get list of available strategies
   */
  getAvailableStrategies(): string[] {
    return ['momentum', 'mean_reversion', 'breakout', 'ai_hybrid'];
  }

  /**
   * Check if a backtest is currently running
   */
  isRunning(id: string): boolean {
    return this.runningBacktests.get(id) || false;
  }

  /**
   * Get synthetic events templates
   */
  getSyntheticEventTemplates(): SyntheticEvent[] {
    return [
      {
        type: 'news',
        timestamp: new Date(),
        impact: 0.15,
        description: 'Major exchange partnership announcement',
        duration: 120
      },
      {
        type: 'whale_move',
        timestamp: new Date(),
        impact: -0.1,
        description: 'Large whale wallet movement detected',
        duration: 60
      },
      {
        type: 'regulatory',
        timestamp: new Date(),
        impact: -0.2,
        description: 'Regulatory concerns in major market',
        duration: 480
      }
    ];
  }
}

// Global backtest engine instance
export const backtestEngine = new BacktestEngine();