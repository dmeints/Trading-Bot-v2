/**
 * PHASE 2: ENHANCED SIMULATION ENGINE - SEQUENTIAL FEATURE FEEDING
 * Optimized simulation engine that feeds FeatureVector data to RL environment
 */

import { featureService, FeatureVector } from './featureService';
import { historicalDataService } from './dataService';
import { logger } from '../utils/logger';
import { stevieRL } from './stevieRL';

export interface SimulationConfig {
  symbol: string;
  startTime: number;
  endTime: number;
  initialBalance: number;
  timeStep: number; // milliseconds between steps
  riskPerTrade: number;
  maxPositionSize: number;
  commission: number;
}

export interface SimulationState {
  timestamp: number;
  balance: number;
  position: {
    symbol: string;
    size: number;
    avgPrice: number;
    unrealizedPnl: number;
  } | null;
  features: FeatureVector;
  action: 'hold' | 'buy' | 'sell';
  confidence: number;
  reasoning: string;
}

export interface SimulationResult {
  config: SimulationConfig;
  states: SimulationState[];
  performance: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
    avgTradeReturn: number;
    finalBalance: number;
  };
  metrics: {
    duration: number;
    dataPoints: number;
    executionTime: number;
  };
}

export class EnhancedSimulationEngine {
  private isRunning = false;
  
  async runSimulation(config: SimulationConfig): Promise<SimulationResult> {
    this.isRunning = true;
    const startTime = Date.now();
    
    logger.info(`🚀 Starting enhanced simulation for ${config.symbol}`, {
      period: new Date(config.startTime).toISOString() + ' - ' + new Date(config.endTime).toISOString(),
      initialBalance: config.initialBalance
    });

    const states: SimulationState[] = [];
    let currentBalance = config.initialBalance;
    let currentPosition: SimulationState['position'] = null;
    let trades = 0;
    let wins = 0;
    let totalReturn = 0;
    let maxBalance = config.initialBalance;
    let maxDrawdown = 0;

    // Sequential time steps
    for (let timestamp = config.startTime; timestamp <= config.endTime && this.isRunning; timestamp += config.timeStep) {
      try {
        // Generate features for current timestamp
        const features = await featureService.getFeatures(config.symbol, timestamp);
        
        // Get RL agent decision
        const decision = await this.getAgentDecision(features, currentBalance, currentPosition);
        
        // Execute action and update state
        const { newBalance, newPosition, trade } = await this.executeAction(
          decision.action,
          features,
          currentBalance,
          currentPosition,
          config
        );

        // Update tracking variables
        currentBalance = newBalance;
        currentPosition = newPosition;
        maxBalance = Math.max(maxBalance, currentBalance);
        
        if (trade) {
          trades++;
          if (trade.pnl > 0) wins++;
          totalReturn += trade.pnl;
        }

        // Calculate current drawdown
        const drawdown = (maxBalance - currentBalance) / maxBalance;
        maxDrawdown = Math.max(maxDrawdown, drawdown);

        // Record state
        const state: SimulationState = {
          timestamp,
          balance: currentBalance,
          position: currentPosition,
          features,
          action: decision.action,
          confidence: decision.confidence,
          reasoning: decision.reasoning
        };
        
        states.push(state);

        // Progress logging every 1000 steps
        if (states.length % 1000 === 0) {
          logger.info(`Simulation progress: ${states.length} steps completed`, {
            currentBalance,
            totalReturn: ((currentBalance / config.initialBalance - 1) * 100).toFixed(2) + '%',
            maxDrawdown: (maxDrawdown * 100).toFixed(2) + '%'
          });
        }

      } catch (error) {
        logger.error(`Simulation error at timestamp ${timestamp}:`, error);
        break;
      }
    }

    const executionTime = Date.now() - startTime;
    const finalBalance = currentBalance;
    const totalReturnPct = (finalBalance / config.initialBalance - 1) * 100;
    
    // Calculate Sharpe ratio
    const returns = states.slice(1).map((state, i) => 
      (state.balance - states[i].balance) / states[i].balance
    );
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const returnStd = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    const sharpeRatio = returnStd > 0 ? (avgReturn / returnStd) * Math.sqrt(365 * 24) : 0;

    const result: SimulationResult = {
      config,
      states,
      performance: {
        totalReturn: totalReturnPct,
        sharpeRatio,
        maxDrawdown: maxDrawdown * 100,
        winRate: trades > 0 ? (wins / trades) * 100 : 0,
        totalTrades: trades,
        avgTradeReturn: trades > 0 ? totalReturn / trades : 0,
        finalBalance
      },
      metrics: {
        duration: config.endTime - config.startTime,
        dataPoints: states.length,
        executionTime
      }
    };

    logger.info('✅ Enhanced simulation completed', {
      totalReturn: totalReturnPct.toFixed(2) + '%',
      sharpeRatio: sharpeRatio.toFixed(2),
      trades,
      winRate: result.performance.winRate.toFixed(1) + '%',
      executionTime: executionTime + 'ms'
    });

    this.isRunning = false;
    return result;
  }

  private async getAgentDecision(
    features: FeatureVector, 
    balance: number, 
    position: SimulationState['position']
  ): Promise<{ action: 'hold' | 'buy' | 'sell'; confidence: number; reasoning: string }> {
    try {
      // Use Stevie RL for decision making
      const marketConditions = {
        symbol: features.symbol,
        price: features.price,
        volume: features.volume,
        volatility: features.volatility_24h,
        trend: features.market_regime,
        sentiment: features.sentiment_score,
        rsi: features.rsi_14,
        macd: features.macd,
        bbPosition: features.bb_position
      };

      const decision = await stevieRL.getRecommendation(marketConditions);
      
      // Enhanced decision logic with risk management
      let action: 'hold' | 'buy' | 'sell' = 'hold';
      let confidence = decision.confidence || 0.5;
      let reasoning = decision.reasoning || 'Standard algorithm decision';

      // Buy signals
      if (decision.action === 'buy' && !position && balance > 0) {
        if (features.rsi_14 < 30 && features.sentiment_score > 0 && features.bb_position < 0.2) {
          action = 'buy';
          confidence = Math.min(0.9, confidence + 0.2);
          reasoning = 'Oversold condition with positive sentiment and lower Bollinger Band';
        } else if (features.macd > features.macd_signal && features.market_regime === 'bull') {
          action = 'buy';
          reasoning = 'MACD bullish crossover in bull market';
        }
      }
      
      // Sell signals
      else if (decision.action === 'sell' && position) {
        if (features.rsi_14 > 70 || features.sentiment_score < -0.5 || features.bb_position > 0.8) {
          action = 'sell';
          confidence = Math.min(0.9, confidence + 0.2);
          reasoning = 'Overbought condition or negative sentiment';
        } else if (features.macd < features.macd_signal && features.market_regime === 'bear') {
          action = 'sell';
          reasoning = 'MACD bearish crossover in bear market';
        }
      }

      // Risk management overrides
      if (position) {
        const currentPnl = (features.price - position.avgPrice) * position.size;
        const pnlPercent = (currentPnl / (position.avgPrice * Math.abs(position.size))) * 100;
        
        // Stop loss at -5%
        if (pnlPercent < -5) {
          action = 'sell';
          confidence = 0.95;
          reasoning = 'Stop loss triggered at -5%';
        }
        // Take profit at +10%
        else if (pnlPercent > 10) {
          action = 'sell';
          confidence = 0.8;
          reasoning = 'Take profit at +10%';
        }
      }

      return { action, confidence, reasoning };
    } catch (error) {
      logger.error('Error in agent decision:', error);
      return { action: 'hold', confidence: 0.1, reasoning: 'Error in decision making' };
    }
  }

  private async executeAction(
    action: 'hold' | 'buy' | 'sell',
    features: FeatureVector,
    balance: number,
    position: SimulationState['position'],
    config: SimulationConfig
  ): Promise<{
    newBalance: number;
    newPosition: SimulationState['position'];
    trade?: { pnl: number; size: number; price: number };
  }> {
    const currentPrice = features.price;
    const commission = config.commission;
    
    if (action === 'hold') {
      // Update unrealized PnL if we have a position
      if (position) {
        const unrealizedPnl = (currentPrice - position.avgPrice) * position.size;
        return {
          newBalance: balance,
          newPosition: { ...position, unrealizedPnl }
        };
      }
      return { newBalance: balance, newPosition: position };
    }

    if (action === 'buy' && !position && balance > 0) {
      // Calculate position size based on risk
      const riskAmount = balance * config.riskPerTrade;
      const maxPositionValue = balance * config.maxPositionSize;
      const positionValue = Math.min(riskAmount / (features.volatility_24h / 100), maxPositionValue);
      const size = positionValue / currentPrice;
      const totalCost = size * currentPrice * (1 + commission);
      
      if (totalCost <= balance) {
        return {
          newBalance: balance - totalCost,
          newPosition: {
            symbol: features.symbol,
            size,
            avgPrice: currentPrice,
            unrealizedPnl: 0
          }
        };
      }
    }

    if (action === 'sell' && position) {
      const saleValue = Math.abs(position.size) * currentPrice * (1 - commission);
      const pnl = (currentPrice - position.avgPrice) * position.size;
      
      return {
        newBalance: balance + saleValue,
        newPosition: null,
        trade: { pnl, size: position.size, price: currentPrice }
      };
    }

    return { newBalance: balance, newPosition: position };
  }

  stopSimulation(): void {
    this.isRunning = false;
    logger.info('Simulation stopped by user');
  }

  // Batch simulation for multiple symbols
  async runBatchSimulation(configs: SimulationConfig[]): Promise<SimulationResult[]> {
    const results: SimulationResult[] = [];
    
    for (const config of configs) {
      if (!this.isRunning) break;
      
      try {
        const result = await this.runSimulation(config);
        results.push(result);
      } catch (error) {
        logger.error(`Batch simulation failed for ${config.symbol}:`, error);
      }
    }
    
    return results;
  }

  // Get simulation statistics across multiple runs
  async getSimulationStatistics(results: SimulationResult[]): Promise<{
    avgReturn: number;
    avgSharpe: number;
    avgWinRate: number;
    bestPerformer: string;
    worstPerformer: string;
    consistency: number;
  }> {
    if (results.length === 0) {
      return {
        avgReturn: 0,
        avgSharpe: 0,
        avgWinRate: 0,
        bestPerformer: 'none',
        worstPerformer: 'none',
        consistency: 0
      };
    }

    const returns = results.map(r => r.performance.totalReturn);
    const sharpes = results.map(r => r.performance.sharpeRatio);
    const winRates = results.map(r => r.performance.winRate);
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const avgSharpe = sharpes.reduce((sum, s) => sum + s, 0) / sharpes.length;
    const avgWinRate = winRates.reduce((sum, w) => sum + w, 0) / winRates.length;
    
    const best = results.reduce((best, current) => 
      current.performance.totalReturn > best.performance.totalReturn ? current : best
    );
    const worst = results.reduce((worst, current) => 
      current.performance.totalReturn < worst.performance.totalReturn ? current : worst
    );
    
    // Calculate consistency (inverse of return standard deviation)
    const returnStd = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    const consistency = returnStd > 0 ? avgReturn / returnStd : 0;

    return {
      avgReturn,
      avgSharpe,
      avgWinRate,
      bestPerformer: best.config.symbol,
      worstPerformer: worst.config.symbol,
      consistency
    };
  }
}

export const simulationEngine = new EnhancedSimulationEngine();