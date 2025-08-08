/**
 * PHASE 5: COMPREHENSIVE RISK MANAGEMENT
 * Advanced position sizing, stop-loss, and portfolio risk controls
 * 
 * Features:
 * - Position sizing with uncertainty-aware scaling
 * - Kelly Criterion and fixed fractional position sizing
 * - Stop-loss and take-profit mechanisms
 * - Portfolio-level risk controls (5% max position, 2% daily loss stop)
 * - Dynamic risk adjustment based on market conditions
 * - Real-time risk monitoring and alerts
 * - Drawdown protection and recovery modes
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import type { ModelPrediction } from './modelZoo.js';
import type { FeatureVector } from './featureEngineering.js';

// Risk management interfaces
export interface RiskParameters {
  maxPositionSize: number; // 5% per position
  dailyLossLimit: number; // 2% daily loss stop
  portfolioHeatLimit: number; // Total exposure limit
  stopLossPercent: number; // Individual position stop-loss
  takeProfitPercent: number; // Individual position take-profit
  volatilityLookback: number; // Days for volatility calculation
  correlationThreshold: number; // Max correlation for new positions
  riskFreeRate: number; // For Sharpe ratio calculations
}

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
  stopLoss: number;
  takeProfit: number;
  entryTime: number;
  confidence: number;
  marketValue: number;
  riskAmount: number;
}

export interface PortfolioRisk {
  totalValue: number;
  totalExposure: number;
  totalRisk: number;
  dailyPnL: number;
  maxDrawdown: number;
  sharpeRatio: number;
  volatility: number;
  var95: number; // Value at Risk 95%
  expectedShortfall: number;
  concentrationRisk: number;
  correlationRisk: number;
  leverageRatio: number;
}

export interface RiskAlert {
  level: 'warning' | 'critical' | 'emergency';
  type: 'position_size' | 'daily_loss' | 'drawdown' | 'correlation' | 'volatility';
  message: string;
  timestamp: number;
  action: string;
  position?: Position;
  metrics?: any;
}

export interface PositionSizeResult {
  recommendedSize: number;
  maxAllowedSize: number;
  riskAmount: number;
  confidence: number;
  reasoning: string;
  alerts: RiskAlert[];
}

/**
 * Kelly Criterion Calculator
 * Optimal position sizing based on win rate and average win/loss
 */
class KellyCriterionCalculator {
  static calculateKellyFraction(
    winRate: number,
    avgWin: number,
    avgLoss: number,
    confidence: number = 1.0
  ): number {
    if (winRate <= 0 || winRate >= 1 || avgWin <= 0 || avgLoss <= 0) {
      return 0;
    }

    // Kelly Fraction = (bp - q) / b
    // where b = odds received (avgWin/avgLoss), p = win rate, q = loss rate
    const odds = avgWin / avgLoss;
    const lossRate = 1 - winRate;
    const kellyFraction = (odds * winRate - lossRate) / odds;

    // Apply confidence scaling and conservative limits
    const scaledKelly = kellyFraction * confidence * 0.25; // Be conservative, use quarter Kelly
    
    return Math.max(0, Math.min(0.05, scaledKelly)); // Cap at 5% per position
  }

  static calculateOptimalSize(
    portfolioValue: number,
    kellyFraction: number,
    volatility: number,
    prediction: ModelPrediction
  ): number {
    // Adjust Kelly for volatility
    const volatilityAdjustment = Math.max(0.1, 1 - volatility);
    const adjustedKelly = kellyFraction * volatilityAdjustment;
    
    // Scale by prediction confidence
    const confidenceScaled = adjustedKelly * prediction.confidence;
    
    return portfolioValue * confidenceScaled;
  }
}

/**
 * Risk Metrics Calculator
 * Calculates comprehensive risk metrics for portfolio and positions
 */
class RiskMetricsCalculator {
  static calculatePortfolioRisk(
    positions: Position[],
    portfolioValue: number,
    dailyReturns: number[],
    riskFreeRate: number = 0.02
  ): PortfolioRisk {
    
    const totalExposure = positions.reduce((sum, pos) => sum + Math.abs(pos.marketValue), 0);
    const totalRisk = positions.reduce((sum, pos) => sum + pos.riskAmount, 0);
    const dailyPnL = positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
    
    // Calculate volatility and Sharpe ratio
    const avgReturn = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / dailyReturns.length;
    const volatility = Math.sqrt(variance * 252); // Annualized
    const sharpeRatio = volatility > 0 ? (avgReturn * 252 - riskFreeRate) / volatility : 0;
    
    // Calculate drawdown
    const cumulativeReturns = dailyReturns.reduce((acc, ret) => {
      const lastValue = acc.length > 0 ? acc[acc.length - 1] : 1;
      acc.push(lastValue * (1 + ret));
      return acc;
    }, [1]);
    
    let maxDrawdown = 0;
    let peak = cumulativeReturns[0];
    
    for (const value of cumulativeReturns) {
      if (value > peak) {
        peak = value;
      } else {
        const drawdown = (peak - value) / peak;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
    }
    
    // Calculate VaR and Expected Shortfall
    const sortedReturns = [...dailyReturns].sort((a, b) => a - b);
    const var95Index = Math.floor(sortedReturns.length * 0.05);
    const var95 = sortedReturns[var95Index] || 0;
    const expectedShortfall = sortedReturns.slice(0, var95Index)
      .reduce((sum, ret) => sum + ret, 0) / Math.max(1, var95Index);
    
    // Calculate concentration risk (Herfindahl index)
    const weights = positions.map(pos => Math.abs(pos.marketValue) / totalExposure);
    const concentrationRisk = weights.reduce((sum, weight) => sum + weight * weight, 0);
    
    // Calculate correlation risk (simplified)
    const correlationRisk = positions.length > 1 ? 0.3 : 0; // Placeholder
    
    return {
      totalValue: portfolioValue,
      totalExposure,
      totalRisk,
      dailyPnL,
      maxDrawdown,
      sharpeRatio,
      volatility,
      var95,
      expectedShortfall,
      concentrationRisk,
      correlationRisk,
      leverageRatio: totalExposure / portfolioValue
    };
  }

  static calculatePositionRisk(
    position: Position,
    volatility: number,
    correlations: Map<string, number>
  ): {
    var95: number;
    expectedShortfall: number;
    riskContribution: number;
    correlationAdjustment: number;
  } {
    
    const positionVar = Math.abs(position.marketValue) * volatility * 1.65; // 95% confidence
    const expectedShortfall = positionVar * 1.3; // Rough approximation
    
    // Risk contribution to portfolio (simplified)
    const riskContribution = position.riskAmount;
    
    // Correlation adjustment factor
    const avgCorrelation = Array.from(correlations.values())
      .reduce((sum, corr) => sum + Math.abs(corr), 0) / Math.max(1, correlations.size);
    const correlationAdjustment = 1 + avgCorrelation * 0.5;
    
    return {
      var95: positionVar,
      expectedShortfall,
      riskContribution,
      correlationAdjustment
    };
  }
}

/**
 * Risk Management Service
 * Central coordinator for all risk management functions
 */
export class RiskManagementService extends EventEmitter {
  private isInitialized = false;
  private positions: Map<string, Position> = new Map();
  private portfolioValue = 100000; // Starting portfolio value
  private dailyReturns: number[] = [];
  private riskParams: RiskParameters;
  private dailyStartValue = 100000;
  private lastResetTime = Date.now();
  private correlationMatrix: Map<string, Map<string, number>> = new Map();
  private volatilityCache: Map<string, number> = new Map();

  constructor(riskParams: Partial<RiskParameters> = {}) {
    super();
    
    this.riskParams = {
      maxPositionSize: 0.05, // 5% max per position
      dailyLossLimit: 0.02, // 2% daily loss stop
      portfolioHeatLimit: 0.15, // 15% total exposure
      stopLossPercent: 0.03, // 3% stop-loss
      takeProfitPercent: 0.06, // 6% take-profit
      volatilityLookback: 30, // 30 days
      correlationThreshold: 0.7, // Max 70% correlation
      riskFreeRate: 0.02, // 2% risk-free rate
      ...riskParams
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('[RiskManagement] Initializing risk management system');
      
      // Reset daily tracking
      this.resetDailyTracking();
      
      // Set up daily reset timer (reset at midnight UTC)
      this.scheduleDailyReset();
      
      this.isInitialized = true;
      logger.info('[RiskManagement] Risk management system initialized');
      
    } catch (error) {
      logger.error('[RiskManagement] Initialization failed:', error as Error);
      throw error;
    }
  }

  calculatePositionSize(
    symbol: string,
    prediction: ModelPrediction,
    currentPrice: number,
    features: FeatureVector
  ): PositionSizeResult {
    
    const alerts: RiskAlert[] = [];
    
    // Check if we're in emergency mode (daily loss limit hit)
    if (this.isDailyLossLimitHit()) {
      alerts.push({
        level: 'emergency',
        type: 'daily_loss',
        message: 'Daily loss limit reached - no new positions allowed',
        timestamp: Date.now(),
        action: 'BLOCK_ALL_TRADES'
      });
      
      return {
        recommendedSize: 0,
        maxAllowedSize: 0,
        riskAmount: 0,
        confidence: 0,
        reasoning: 'Daily loss limit reached',
        alerts
      };
    }

    // Calculate Kelly Criterion position size
    const historicalStats = this.getHistoricalStats(symbol);
    const kellyFraction = KellyCriterionCalculator.calculateKellyFraction(
      historicalStats.winRate,
      historicalStats.avgWin,
      historicalStats.avgLoss,
      prediction.confidence
    );
    
    // Calculate base position size
    const baseSize = KellyCriterionCalculator.calculateOptimalSize(
      this.portfolioValue,
      kellyFraction,
      features.volatility_24h,
      prediction
    );
    
    // Apply risk parameter limits
    const maxPositionValue = this.portfolioValue * this.riskParams.maxPositionSize;
    const maxAllowedSize = maxPositionValue / currentPrice;
    
    // Apply correlation constraints
    const correlationAdjustment = this.calculateCorrelationAdjustment(symbol);
    const correlationAdjustedSize = baseSize * correlationAdjustment;
    
    // Apply volatility adjustment
    const volatilityAdjustment = this.calculateVolatilityAdjustment(features.volatility_24h);
    const volatilityAdjustedSize = correlationAdjustedSize * volatilityAdjustment;
    
    // Final recommended size
    const recommendedSize = Math.min(volatilityAdjustedSize, maxAllowedSize);
    const riskAmount = recommendedSize * currentPrice * this.riskParams.stopLossPercent;
    
    // Generate alerts for risk concerns
    if (correlationAdjustment < 0.5) {
      alerts.push({
        level: 'warning',
        type: 'correlation',
        message: `High correlation with existing positions (adjustment: ${(correlationAdjustment * 100).toFixed(1)}%)`,
        timestamp: Date.now(),
        action: 'REDUCE_SIZE'
      });
    }
    
    if (features.volatility_24h > 0.5) {
      alerts.push({
        level: 'warning',
        type: 'volatility',
        message: `High volatility detected: ${(features.volatility_24h * 100).toFixed(1)}%`,
        timestamp: Date.now(),
        action: 'REDUCE_SIZE'
      });
    }
    
    return {
      recommendedSize,
      maxAllowedSize,
      riskAmount,
      confidence: prediction.confidence,
      reasoning: `Kelly: ${kellyFraction.toFixed(4)}, Corr: ${correlationAdjustment.toFixed(2)}, Vol: ${volatilityAdjustment.toFixed(2)}`,
      alerts
    };
  }

  addPosition(
    symbol: string,
    side: 'long' | 'short',
    quantity: number,
    entryPrice: number,
    confidence: number
  ): Position {
    
    const positionId = `${symbol}_${side}_${Date.now()}`;
    const stopLoss = side === 'long' 
      ? entryPrice * (1 - this.riskParams.stopLossPercent)
      : entryPrice * (1 + this.riskParams.stopLossPercent);
    
    const takeProfit = side === 'long'
      ? entryPrice * (1 + this.riskParams.takeProfitPercent)
      : entryPrice * (1 - this.riskParams.takeProfitPercent);
    
    const position: Position = {
      id: positionId,
      symbol,
      side,
      quantity,
      entryPrice,
      currentPrice: entryPrice,
      unrealizedPnL: 0,
      realizedPnL: 0,
      stopLoss,
      takeProfit,
      entryTime: Date.now(),
      confidence,
      marketValue: quantity * entryPrice,
      riskAmount: quantity * entryPrice * this.riskParams.stopLossPercent
    };
    
    this.positions.set(positionId, position);
    
    logger.info(`[RiskManagement] Added position: ${symbol} ${side} ${quantity} @ ${entryPrice}`);
    this.emit('positionAdded', position);
    
    return position;
  }

  updatePosition(positionId: string, currentPrice: number): Position | null {
    const position = this.positions.get(positionId);
    if (!position) return null;
    
    position.currentPrice = currentPrice;
    position.marketValue = position.quantity * currentPrice;
    
    // Calculate unrealized P&L
    if (position.side === 'long') {
      position.unrealizedPnL = position.quantity * (currentPrice - position.entryPrice);
    } else {
      position.unrealizedPnL = position.quantity * (position.entryPrice - currentPrice);
    }
    
    // Check stop-loss and take-profit
    const shouldClosePosition = this.checkExitConditions(position);
    if (shouldClosePosition) {
      this.emit('positionExit', position, shouldClosePosition.reason);
    }
    
    return position;
  }

  closePosition(positionId: string, exitPrice: number, reason: string = 'manual'): number {
    const position = this.positions.get(positionId);
    if (!position) return 0;
    
    // Calculate realized P&L
    if (position.side === 'long') {
      position.realizedPnL = position.quantity * (exitPrice - position.entryPrice);
    } else {
      position.realizedPnL = position.quantity * (position.entryPrice - exitPrice);
    }
    
    this.positions.delete(positionId);
    
    logger.info(`[RiskManagement] Closed position: ${position.symbol} P&L: ${position.realizedPnL.toFixed(2)} (${reason})`);
    this.emit('positionClosed', position, reason);
    
    return position.realizedPnL;
  }

  getPortfolioRisk(): PortfolioRisk {
    const positions = Array.from(this.positions.values());
    return RiskMetricsCalculator.calculatePortfolioRisk(
      positions,
      this.portfolioValue,
      this.dailyReturns,
      this.riskParams.riskFreeRate
    );
  }

  checkRiskLimits(): RiskAlert[] {
    const alerts: RiskAlert[] = [];
    const portfolioRisk = this.getPortfolioRisk();
    
    // Check daily loss limit
    if (this.isDailyLossLimitHit()) {
      alerts.push({
        level: 'emergency',
        type: 'daily_loss',
        message: `Daily loss limit exceeded: ${(portfolioRisk.dailyPnL / this.dailyStartValue * 100).toFixed(2)}%`,
        timestamp: Date.now(),
        action: 'STOP_TRADING'
      });
    }
    
    // Check maximum drawdown
    if (portfolioRisk.maxDrawdown > 0.1) {
      alerts.push({
        level: 'critical',
        type: 'drawdown',
        message: `High drawdown detected: ${(portfolioRisk.maxDrawdown * 100).toFixed(2)}%`,
        timestamp: Date.now(),
        action: 'REDUCE_RISK'
      });
    }
    
    // Check concentration risk
    if (portfolioRisk.concentrationRisk > 0.25) {
      alerts.push({
        level: 'warning',
        type: 'position_size',
        message: `High concentration risk: ${(portfolioRisk.concentrationRisk * 100).toFixed(2)}%`,
        timestamp: Date.now(),
        action: 'DIVERSIFY'
      });
    }
    
    return alerts;
  }

  private checkExitConditions(position: Position): { shouldExit: boolean, reason: string } | null {
    const currentPrice = position.currentPrice;
    
    // Check stop-loss
    if (position.side === 'long' && currentPrice <= position.stopLoss) {
      return { shouldExit: true, reason: 'stop_loss' };
    }
    if (position.side === 'short' && currentPrice >= position.stopLoss) {
      return { shouldExit: true, reason: 'stop_loss' };
    }
    
    // Check take-profit
    if (position.side === 'long' && currentPrice >= position.takeProfit) {
      return { shouldExit: true, reason: 'take_profit' };
    }
    if (position.side === 'short' && currentPrice <= position.takeProfit) {
      return { shouldExit: true, reason: 'take_profit' };
    }
    
    return null;
  }

  private isDailyLossLimitHit(): boolean {
    const dailyPnL = Array.from(this.positions.values())
      .reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
    
    const dailyLossPercent = dailyPnL / this.dailyStartValue;
    return dailyLossPercent <= -this.riskParams.dailyLossLimit;
  }

  private calculateCorrelationAdjustment(symbol: string): number {
    // Get correlations with existing positions
    const existingSymbols = Array.from(new Set(Array.from(this.positions.values()).map(p => p.symbol)));
    let maxCorrelation = 0;
    
    for (const existingSymbol of existingSymbols) {
      const correlation = this.getCorrelation(symbol, existingSymbol);
      maxCorrelation = Math.max(maxCorrelation, Math.abs(correlation));
    }
    
    // Reduce position size based on correlation
    if (maxCorrelation > this.riskParams.correlationThreshold) {
      return Math.max(0.1, 1 - (maxCorrelation - this.riskParams.correlationThreshold) * 2);
    }
    
    return 1.0;
  }

  private calculateVolatilityAdjustment(volatility: number): number {
    // Reduce position size for high volatility
    const baseVolatility = 0.2; // 20% baseline
    if (volatility > baseVolatility) {
      return Math.max(0.1, baseVolatility / volatility);
    }
    return 1.0;
  }

  private getCorrelation(symbol1: string, symbol2: string): number {
    const corr1 = this.correlationMatrix.get(symbol1);
    if (corr1) {
      return corr1.get(symbol2) || 0;
    }
    return 0; // Default to no correlation
  }

  private getHistoricalStats(symbol: string): { winRate: number, avgWin: number, avgLoss: number } {
    // Placeholder - would get from historical performance tracking
    return {
      winRate: 0.55,
      avgWin: 0.02,
      avgLoss: 0.015
    };
  }

  private resetDailyTracking(): void {
    this.dailyStartValue = this.portfolioValue;
    this.lastResetTime = Date.now();
    logger.info('[RiskManagement] Daily tracking reset');
  }

  private scheduleDailyReset(): void {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      this.resetDailyTracking();
      // Schedule next reset
      setInterval(() => this.resetDailyTracking(), 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }

  // Getters for external access
  getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  getPortfolioValue(): number {
    return this.portfolioValue;
  }

  updatePortfolioValue(newValue: number): void {
    this.portfolioValue = newValue;
  }

  getRiskParameters(): RiskParameters {
    return { ...this.riskParams };
  }

  updateRiskParameters(params: Partial<RiskParameters>): void {
    this.riskParams = { ...this.riskParams, ...params };
    logger.info('[RiskManagement] Risk parameters updated');
  }
}

// Singleton instance
export const riskManagementService = new RiskManagementService();