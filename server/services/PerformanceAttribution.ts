/**
 * Phase K - Performance Attribution Service
 * Strategy component analysis, factor attribution reporting, and performance decomposition
 */

import { logger } from "../utils/logger";
import { db } from "../db";
import { trades, positions, marketBars, sentimentTicksExtended } from "@shared/schema";
import { desc, gte, and, lte, eq } from "drizzle-orm";

export interface FactorAttribution {
  factor: string;
  contribution: number;
  weight: number;
  description: string;
}

export interface StrategyComponentAnalysis {
  component: string;
  returns: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  avgTrade: number;
  tradeCount: number;
}

export interface PerformanceDecomposition {
  totalReturn: number;
  benchmarkReturn: number;
  alpha: number;
  beta: number;
  factorAttributions: FactorAttribution[];
  componentAnalysis: StrategyComponentAnalysis[];
  riskMetrics: {
    volatility: number;
    var95: number;
    expectedShortfall: number;
    calmarRatio: number;
  };
  timeSeriesAnalysis: {
    dates: string[];
    cumulativeReturns: number[];
    drawdowns: number[];
    rollingVolatility: number[];
  };
}

export class PerformanceAttributionService {
  private static instance: PerformanceAttributionService;
  
  public static getInstance(): PerformanceAttributionService {
    if (!PerformanceAttributionService.instance) {
      PerformanceAttributionService.instance = new PerformanceAttributionService();
    }
    return PerformanceAttributionService.instance;
  }

  /**
   * Calculate comprehensive performance attribution for a given period
   */
  async calculatePerformanceAttribution(
    userId: string,
    startDate: Date,
    endDate: Date,
    benchmarkSymbol = 'BTCUSDT'
  ): Promise<PerformanceDecomposition> {
    try {
      logger.info('[PerformanceAttribution] Starting attribution analysis', {
        userId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        benchmark: benchmarkSymbol
      });

      // Fetch user trades in the period
      const userTrades = await db
        .select()
        .from(trades)
        .where(
          and(
            eq(trades.userId, userId),
            gte(trades.executedAt, startDate),
            lte(trades.executedAt, endDate)
          )
        )
        .orderBy(desc(trades.executedAt));

      // Fetch benchmark data
      const benchmarkData = await db
        .select()
        .from(marketBars)
        .where(
          and(
            eq(marketBars.symbol, benchmarkSymbol),
            gte(marketBars.timestamp, startDate),
            lte(marketBars.timestamp, endDate)
          )
        )
        .orderBy(marketBars.timestamp);

      // Calculate returns and performance metrics
      const portfolioReturns = this.calculatePortfolioReturns(userTrades);
      const benchmarkReturns = this.calculateBenchmarkReturns(benchmarkData);
      
      // Perform factor attribution analysis
      const factorAttributions = await this.performFactorAttribution(
        userTrades, 
        startDate, 
        endDate
      );

      // Analyze strategy components
      const componentAnalysis = this.analyzeStrategyComponents(userTrades);

      // Calculate risk metrics
      const riskMetrics = this.calculateRiskMetrics(portfolioReturns);

      // Generate time series analysis
      const timeSeriesAnalysis = this.generateTimeSeriesAnalysis(
        userTrades,
        benchmarkData
      );

      // Calculate alpha and beta
      const { alpha, beta } = this.calculateAlphaBeta(
        portfolioReturns,
        benchmarkReturns
      );

      const totalReturn = portfolioReturns.reduce((sum, ret) => sum + ret, 0);
      const benchmarkReturn = benchmarkReturns.reduce((sum, ret) => sum + ret, 0);

      const result: PerformanceDecomposition = {
        totalReturn,
        benchmarkReturn,
        alpha,
        beta,
        factorAttributions,
        componentAnalysis,
        riskMetrics,
        timeSeriesAnalysis
      };

      logger.info('[PerformanceAttribution] Analysis complete', {
        totalReturn: totalReturn.toFixed(4),
        alpha: alpha.toFixed(4),
        beta: beta.toFixed(4),
        factorCount: factorAttributions.length
      });

      return result;

    } catch (error) {
      logger.error('[PerformanceAttribution] Analysis failed', error);
      throw error;
    }
  }

  /**
   * Calculate portfolio returns from trades
   */
  private calculatePortfolioReturns(trades: any[]): number[] {
    if (trades.length === 0) return [];

    const returns: number[] = [];
    let portfolioValue = 10000; // Starting value

    trades.forEach((trade) => {
      const tradeReturn = (trade.exitPrice - trade.entryPrice) / trade.entryPrice;
      const adjustedReturn = trade.side === 'SELL' ? -tradeReturn : tradeReturn;
      
      const periodReturn = adjustedReturn * (trade.quantity * trade.entryPrice) / portfolioValue;
      returns.push(periodReturn);
      
      portfolioValue *= (1 + periodReturn);
    });

    return returns;
  }

  /**
   * Calculate benchmark returns from market data
   */
  private calculateBenchmarkReturns(marketData: any[]): number[] {
    if (marketData.length < 2) return [];

    const returns: number[] = [];
    
    for (let i = 1; i < marketData.length; i++) {
      const currentPrice = marketData[i].close;
      const previousPrice = marketData[i - 1].close;
      const return_ = (currentPrice - previousPrice) / previousPrice;
      returns.push(return_);
    }

    return returns;
  }

  /**
   * Perform multi-factor attribution analysis
   */
  private async performFactorAttribution(
    trades: any[],
    startDate: Date,
    endDate: Date
  ): Promise<FactorAttribution[]> {
    const attributions: FactorAttribution[] = [];

    // Market Factor (Beta exposure)
    const marketExposure = this.calculateMarketExposure(trades);
    attributions.push({
      factor: 'Market Beta',
      contribution: marketExposure * 0.05, // Assume 5% market return
      weight: Math.abs(marketExposure),
      description: 'Systematic market risk exposure'
    });

    // Momentum Factor
    const momentumExposure = await this.calculateMomentumFactor(trades, startDate, endDate);
    attributions.push({
      factor: 'Momentum',
      contribution: momentumExposure * 0.02,
      weight: Math.abs(momentumExposure),
      description: 'Price momentum and trend following'
    });

    // Mean Reversion Factor
    const meanReversionExposure = this.calculateMeanReversionFactor(trades);
    attributions.push({
      factor: 'Mean Reversion',
      contribution: meanReversionExposure * 0.015,
      weight: Math.abs(meanReversionExposure),
      description: 'Contrarian and mean reversion strategies'
    });

    // Volatility Factor
    const volatilityExposure = this.calculateVolatilityFactor(trades);
    attributions.push({
      factor: 'Volatility',
      contribution: volatilityExposure * -0.01,
      weight: Math.abs(volatilityExposure),
      description: 'Volatility timing and risk management'
    });

    // Sentiment Factor
    const sentimentExposure = await this.calculateSentimentFactor(trades, startDate, endDate);
    attributions.push({
      factor: 'Sentiment',
      contribution: sentimentExposure * 0.008,
      weight: Math.abs(sentimentExposure),
      description: 'Social and news sentiment exposure'
    });

    return attributions;
  }

  /**
   * Analyze individual strategy components
   */
  private analyzeStrategyComponents(trades: any[]): StrategyComponentAnalysis[] {
    const components: StrategyComponentAnalysis[] = [];

    // Group trades by strategy (if available) or by symbol
    const tradeGroups = this.groupTradesByStrategy(trades);

    Object.entries(tradeGroups).forEach(([strategy, strategyTrades]) => {
      const returns = strategyTrades.map((trade: any) => {
        const return_ = (trade.exitPrice - trade.entryPrice) / trade.entryPrice;
        return trade.side === 'SELL' ? -return_ : return_;
      });

      const totalReturn = returns.reduce((sum, ret) => sum + ret, 0);
      const avgReturn = returns.length > 0 ? totalReturn / returns.length : 0;
      
      const winningTrades = returns.filter(ret => ret > 0).length;
      const winRate = returns.length > 0 ? winningTrades / returns.length : 0;

      // Calculate Sharpe ratio (simplified)
      const returnStd = this.calculateStandardDeviation(returns);
      const sharpeRatio = returnStd > 0 ? avgReturn / returnStd : 0;

      // Calculate max drawdown
      const maxDrawdown = this.calculateMaxDrawdown(returns);

      components.push({
        component: strategy,
        returns: totalReturn,
        sharpeRatio,
        maxDrawdown,
        winRate,
        avgTrade: avgReturn,
        tradeCount: strategyTrades.length
      });
    });

    return components;
  }

  /**
   * Calculate comprehensive risk metrics
   */
  private calculateRiskMetrics(returns: number[]): {
    volatility: number;
    var95: number;
    expectedShortfall: number;
    calmarRatio: number;
  } {
    if (returns.length === 0) {
      return { volatility: 0, var95: 0, expectedShortfall: 0, calmarRatio: 0 };
    }

    const volatility = this.calculateStandardDeviation(returns) * Math.sqrt(252); // Annualized
    
    // Calculate VaR (95% confidence)
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const var95Index = Math.floor(returns.length * 0.05);
    const var95 = sortedReturns[var95Index] || 0;

    // Calculate Expected Shortfall (Conditional VaR)
    const tailReturns = sortedReturns.slice(0, var95Index + 1);
    const expectedShortfall = tailReturns.length > 0 
      ? tailReturns.reduce((sum, ret) => sum + ret, 0) / tailReturns.length 
      : 0;

    // Calculate Calmar Ratio
    const totalReturn = returns.reduce((sum, ret) => sum + ret, 0);
    const maxDrawdown = this.calculateMaxDrawdown(returns);
    const calmarRatio = maxDrawdown !== 0 ? totalReturn / Math.abs(maxDrawdown) : 0;

    return {
      volatility,
      var95,
      expectedShortfall,
      calmarRatio
    };
  }

  /**
   * Generate time series analysis for charting
   */
  private generateTimeSeriesAnalysis(
    trades: any[],
    benchmarkData: any[]
  ): {
    dates: string[];
    cumulativeReturns: number[];
    drawdowns: number[];
    rollingVolatility: number[];
  } {
    const dates: string[] = [];
    const cumulativeReturns: number[] = [];
    const drawdowns: number[] = [];
    const rollingVolatility: number[] = [];

    let cumulativeReturn = 0;
    let peak = 0;
    const returns: number[] = [];

    trades.forEach((trade, index) => {
      const date = new Date(trade.timestamp).toISOString().split('T')[0];
      dates.push(date);

      const tradeReturn = (trade.exitPrice - trade.entryPrice) / trade.entryPrice;
      const adjustedReturn = trade.side === 'SELL' ? -tradeReturn : tradeReturn;
      
      cumulativeReturn += adjustedReturn;
      cumulativeReturns.push(cumulativeReturn);

      // Update peak and calculate drawdown
      if (cumulativeReturn > peak) {
        peak = cumulativeReturn;
      }
      const drawdown = (cumulativeReturn - peak) / (1 + peak);
      drawdowns.push(drawdown);

      // Calculate rolling volatility (20-period)
      returns.push(adjustedReturn);
      if (returns.length >= 20) {
        const recentReturns = returns.slice(-20);
        const volatility = this.calculateStandardDeviation(recentReturns);
        rollingVolatility.push(volatility);
        
        if (returns.length > 20) {
          returns.shift(); // Keep only last 20
        }
      } else {
        rollingVolatility.push(0);
      }
    });

    return {
      dates,
      cumulativeReturns,
      drawdowns,
      rollingVolatility
    };
  }

  // Helper methods for factor calculations
  private calculateMarketExposure(trades: any[]): number {
    // Simplified: average position size relative to portfolio
    const avgPositionSize = trades.reduce((sum, trade) => {
      return sum + (trade.quantity * trade.entryPrice);
    }, 0) / (trades.length || 1);
    
    return Math.min(avgPositionSize / 10000, 2.0); // Cap at 2.0 beta
  }

  private async calculateMomentumFactor(trades: any[], startDate: Date, endDate: Date): number {
    // Analyze if trades follow momentum patterns
    let momentumScore = 0;
    
    for (const trade of trades) {
      // Get price data before trade
      const priorBars = await db
        .select()
        .from(marketBars)
        .where(
          and(
            eq(marketBars.symbol, trade.symbol),
            lte(marketBars.timestamp, new Date(trade.timestamp)),
            gte(marketBars.timestamp, new Date(Date.parse(trade.timestamp) - 7 * 24 * 60 * 60 * 1000))
          )
        )
        .orderBy(desc(marketBars.timestamp))
        .limit(5);

      if (priorBars.length >= 2) {
        const recentReturn = (priorBars[0].close - priorBars[1].close) / priorBars[1].close;
        const tradeDirection = trade.side === 'BUY' ? 1 : -1;
        
        // Check if trade follows momentum
        if ((recentReturn > 0 && tradeDirection > 0) || (recentReturn < 0 && tradeDirection < 0)) {
          momentumScore += 1;
        }
      }
    }

    return trades.length > 0 ? momentumScore / trades.length : 0;
  }

  private calculateMeanReversionFactor(trades: any[]): number {
    // Simplified mean reversion calculation
    let reversionScore = 0;
    
    trades.forEach(trade => {
      const entryReturn = (trade.exitPrice - trade.entryPrice) / trade.entryPrice;
      const expectedReversion = trade.side === 'BUY' ? -0.01 : 0.01; // Expected mean reversion
      
      if (Math.sign(entryReturn) === Math.sign(expectedReversion)) {
        reversionScore += Math.abs(entryReturn);
      }
    });

    return trades.length > 0 ? reversionScore / trades.length : 0;
  }

  private calculateVolatilityFactor(trades: any[]): number {
    // Calculate exposure to volatility changes
    const returns = trades.map(trade => {
      const return_ = (trade.exitPrice - trade.entryPrice) / trade.entryPrice;
      return trade.side === 'SELL' ? -return_ : return_;
    });

    return this.calculateStandardDeviation(returns);
  }

  private async calculateSentimentFactor(trades: any[], startDate: Date, endDate: Date): number {
    // Analyze correlation with sentiment data
    const sentimentData = await db
      .select()
      .from(sentimentTicksExtended)
      .where(
        and(
          gte(sentimentTicksExtended.timestamp, startDate),
          lte(sentimentTicksExtended.timestamp, endDate)
        )
      )
      .orderBy(sentimentTicksExtended.timestamp);

    if (sentimentData.length === 0) return 0;

    const avgSentiment = sentimentData.reduce((sum, tick) => sum + tick.score, 0) / sentimentData.length;
    return Math.min(Math.max(avgSentiment, -1), 1); // Normalize to [-1, 1]
  }

  private groupTradesByStrategy(trades: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {};
    
    trades.forEach(trade => {
      const strategy = trade.strategy || trade.symbol || 'default';
      if (!groups[strategy]) {
        groups[strategy] = [];
      }
      groups[strategy].push(trade);
    });

    return groups;
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateMaxDrawdown(returns: number[]): number {
    let maxDrawdown = 0;
    let peak = 0;
    let cumulativeReturn = 0;

    returns.forEach(return_ => {
      cumulativeReturn += return_;
      if (cumulativeReturn > peak) {
        peak = cumulativeReturn;
      }
      const drawdown = (peak - cumulativeReturn) / (1 + peak);
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    return maxDrawdown;
  }

  private calculateAlphaBeta(portfolioReturns: number[], benchmarkReturns: number[]): { alpha: number; beta: number } {
    if (portfolioReturns.length === 0 || benchmarkReturns.length === 0) {
      return { alpha: 0, beta: 1 };
    }

    const minLength = Math.min(portfolioReturns.length, benchmarkReturns.length);
    const portfolioSlice = portfolioReturns.slice(0, minLength);
    const benchmarkSlice = benchmarkReturns.slice(0, minLength);

    // Calculate covariance and variance for beta
    const portfolioMean = portfolioSlice.reduce((sum, ret) => sum + ret, 0) / minLength;
    const benchmarkMean = benchmarkSlice.reduce((sum, ret) => sum + ret, 0) / minLength;

    let covariance = 0;
    let benchmarkVariance = 0;

    for (let i = 0; i < minLength; i++) {
      covariance += (portfolioSlice[i] - portfolioMean) * (benchmarkSlice[i] - benchmarkMean);
      benchmarkVariance += Math.pow(benchmarkSlice[i] - benchmarkMean, 2);
    }

    covariance /= minLength;
    benchmarkVariance /= minLength;

    const beta = benchmarkVariance > 0 ? covariance / benchmarkVariance : 1;
    const alpha = portfolioMean - beta * benchmarkMean;

    return { alpha, beta };
  }
}

export const performanceAttributionService = PerformanceAttributionService.getInstance();