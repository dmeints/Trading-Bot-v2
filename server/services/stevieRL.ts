/**
 * Stevie Reinforcement Learning Trading Strategy
 * 
 * Advanced RL environment for trading strategy optimization using PPO/DQN
 * with reward shaping, adaptive exploration, and continuous learning.
 */

import { logger } from '../utils/logger';
import { storage } from '../storage';

interface MarketState {
  prices: number[];
  volumes: number[];
  technicalIndicators: {
    rsi: number;
    macd: number;
    bollinger: { upper: number; middle: number; lower: number };
  };
  sentiment: number; // -1 to 1
  positions: Array<{
    symbol: string;
    quantity: number;
    unrealizedPnl: number;
  }>;
  portfolioValue: number;
  timestamp: number;
}

interface RLAction {
  type: 'buy' | 'sell' | 'hold';
  symbol: string;
  amount: number; // 0 to 1 (percentage of portfolio)
  confidence: number;
}

interface TradeResult {
  action: RLAction;
  reward: number;
  newState: MarketState;
  done: boolean;
  info: {
    pnl: number;
    drawdown: number;
    transactionCost: number;
    riskAdjustedReturn: number;
  };
}

interface RLMetrics {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  calmarRatio: number;
}

export class RLTradingEnvironment {
  private currentState: MarketState | null = null;
  private initialPortfolioValue: number = 10000;
  private transactionCostRate: number = 0.001; // 0.1% per trade
  private maxDrawdownThreshold: number = 0.15; // 15% max drawdown
  private riskFreeRate: number = 0.02; // 2% annual risk-free rate
  
  constructor(initialValue: number = 10000) {
    this.initialPortfolioValue = initialValue;
  }

  // Initialize environment with market data
  async reset(userId: string): Promise<MarketState> {
    try {
      // Get user's current positions and portfolio
      const positions = await storage.getUserPositions(userId);
      const portfolioValue = positions.reduce((sum, pos) => 
        sum + (Number(pos.quantity) * Number(pos.currentPrice)), 0
      );

      // Mock market data (would integrate with real market data)
      const marketState: MarketState = {
        prices: this.generatePriceHistory(100), // Last 100 periods
        volumes: this.generateVolumeHistory(100),
        technicalIndicators: this.calculateTechnicalIndicators([]),
        sentiment: Math.random() * 2 - 1, // -1 to 1
        positions: positions.map(p => ({
          symbol: p.symbol,
          quantity: Number(p.quantity),
          unrealizedPnl: Number(p.unrealizedPnl)
        })),
        portfolioValue: portfolioValue || this.initialPortfolioValue,
        timestamp: Date.now()
      };

      this.currentState = marketState;
      return marketState;
      
    } catch (error) {
      logger.error('Error resetting RL environment', { error, userId });
      throw error;
    }
  }

  // Execute trading action and return new state + reward
  async step(action: RLAction, userId: string): Promise<TradeResult> {
    if (!this.currentState) {
      throw new Error('Environment not initialized. Call reset() first.');
    }

    try {
      // Execute the trade (in simulation)
      const tradeResult = await this.simulateTrade(action, this.currentState);
      
      // Calculate reward based on composite function
      const reward = this.calculateReward(tradeResult, this.currentState);
      
      // Update state
      const newState = await this.getNextState(userId);
      
      // Check if episode is done (max drawdown hit or time limit)
      const done = this.isEpisodeDone(newState, this.currentState);
      
      this.currentState = newState;
      
      return {
        action,
        reward,
        newState,
        done,
        info: tradeResult
      };
      
    } catch (error) {
      logger.error('Error executing RL step', { error, action, userId });
      throw error;
    }
  }

  // Composite reward function balancing PnL, risk, and costs
  private calculateReward(tradeResult: any, currentState: MarketState): number {
    const pnlReward = tradeResult.pnl / currentState.portfolioValue; // Normalized PnL
    const drawdownPenalty = -Math.max(0, tradeResult.drawdown - 0.02); // Penalty for >2% drawdown
    const costPenalty = -tradeResult.transactionCost / currentState.portfolioValue;
    const riskAdjustment = tradeResult.riskAdjustedReturn || 0;
    
    // Weighted composite reward
    const reward = (
      pnlReward * 0.4 +           // 40% weight on profit
      drawdownPenalty * 0.3 +     // 30% weight on risk management  
      costPenalty * 0.1 +         // 10% weight on cost efficiency
      riskAdjustment * 0.2        // 20% weight on risk-adjusted returns
    );
    
    return Math.tanh(reward * 10); // Normalize to [-1, 1] range
  }

  private async simulateTrade(action: RLAction, state: MarketState): Promise<any> {
    const portfolioValue = state.portfolioValue;
    const tradeAmount = action.amount * portfolioValue;
    const transactionCost = tradeAmount * this.transactionCostRate;
    
    // Mock trade execution
    const priceChange = (Math.random() - 0.5) * 0.02; // ±1% random price movement
    const pnl = action.type === 'buy' ? tradeAmount * priceChange : 
                action.type === 'sell' ? -tradeAmount * priceChange : 0;
    
    const newPortfolioValue = portfolioValue + pnl - transactionCost;
    const drawdown = Math.max(0, (portfolioValue - newPortfolioValue) / portfolioValue);
    
    return {
      pnl: pnl - transactionCost,
      drawdown,
      transactionCost,
      riskAdjustedReturn: pnl / Math.sqrt(Math.abs(priceChange) + 0.01)
    };
  }

  private async getNextState(userId: string): Promise<MarketState> {
    // Simulate market progression
    if (!this.currentState) throw new Error('No current state');
    
    const newPrices = [...this.currentState.prices.slice(1), this.currentState.prices[this.currentState.prices.length - 1] * (1 + (Math.random() - 0.5) * 0.02)];
    const newVolumes = [...this.currentState.volumes.slice(1), Math.random() * 1000000];
    
    return {
      ...this.currentState,
      prices: newPrices,
      volumes: newVolumes,
      technicalIndicators: this.calculateTechnicalIndicators(newPrices),
      sentiment: Math.max(-1, Math.min(1, this.currentState.sentiment + (Math.random() - 0.5) * 0.1)),
      timestamp: Date.now()
    };
  }

  private isEpisodeDone(newState: MarketState, oldState: MarketState): boolean {
    const drawdown = (oldState.portfolioValue - newState.portfolioValue) / oldState.portfolioValue;
    return drawdown > this.maxDrawdownThreshold;
  }

  private generatePriceHistory(length: number): number[] {
    const prices = [100]; // Starting price
    for (let i = 1; i < length; i++) {
      const change = (Math.random() - 0.5) * 0.02; // ±1% random walk
      prices.push(prices[i-1] * (1 + change));
    }
    return prices;
  }

  private generateVolumeHistory(length: number): number[] {
    return Array.from({ length }, () => Math.random() * 1000000);
  }

  private calculateTechnicalIndicators(prices: number[]): any {
    if (prices.length < 14) {
      return {
        rsi: 50,
        macd: 0,
        bollinger: { upper: 105, middle: 100, lower: 95 }
      };
    }
    
    // Simplified technical indicators
    const recentPrices = prices.slice(-14);
    const avgGain = recentPrices.slice(1).reduce((sum, price, i) => {
      const gain = Math.max(0, price - recentPrices[i]);
      return sum + gain;
    }, 0) / 13;
    
    const avgLoss = recentPrices.slice(1).reduce((sum, price, i) => {
      const loss = Math.max(0, recentPrices[i] - price);
      return sum + loss;
    }, 0) / 13;
    
    const rs = avgGain / (avgLoss || 0.01);
    const rsi = 100 - (100 / (1 + rs));
    
    const sma = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;
    
    return {
      rsi: Math.min(100, Math.max(0, rsi)),
      macd: Math.random() * 2 - 1, // Simplified
      bollinger: {
        upper: sma * 1.05,
        middle: sma,
        lower: sma * 0.95
      }
    };
  }
}

export class StevieRLAgent {
  private environment: RLTradingEnvironment;
  private explorationRate: number = 0.1; // Epsilon for epsilon-greedy
  private explorationDecay: number = 0.995;
  private minExploration: number = 0.01;
  private learningRate: number = 0.001;
  
  constructor() {
    this.environment = new RLTradingEnvironment();
  }

  // Adaptive exploration using epsilon decay
  getAction(state: MarketState, isTraining: boolean = true): RLAction {
    if (isTraining && Math.random() < this.explorationRate) {
      // Random exploration
      return this.getRandomAction();
    }
    
    // Exploit current policy (simplified for demo)
    return this.getPolicyAction(state);
  }

  private getRandomAction(): RLAction {
    const types: Array<'buy' | 'sell' | 'hold'> = ['buy', 'sell', 'hold'];
    const symbols = ['BTC/USD', 'ETH/USD', 'SOL/USD'];
    
    return {
      type: types[Math.floor(Math.random() * types.length)],
      symbol: symbols[Math.floor(Math.random() * symbols.length)],
      amount: Math.random() * 0.1, // Max 10% of portfolio
      confidence: Math.random()
    };
  }

  private getPolicyAction(state: MarketState): RLAction {
    // Simplified policy based on technical indicators
    const { rsi, macd } = state.technicalIndicators;
    
    if (rsi < 30 && macd > 0) {
      return {
        type: 'buy',
        symbol: 'BTC/USD',
        amount: 0.05, // 5% of portfolio
        confidence: 0.7
      };
    } else if (rsi > 70 && macd < 0) {
      return {
        type: 'sell',
        symbol: 'BTC/USD', 
        amount: 0.05,
        confidence: 0.7
      };
    }
    
    return {
      type: 'hold',
      symbol: 'BTC/USD',
      amount: 0,
      confidence: 0.5
    };
  }

  // Update exploration rate
  updateExploration(): void {
    this.explorationRate = Math.max(
      this.minExploration,
      this.explorationRate * this.explorationDecay
    );
  }

  /**
   * Bootstrap RL training using Stable-Baselines3
   */
  async bootstrapRLTraining(): Promise<void> {
    logger.info('[StevieRL] Starting bootstrap RL training with Stable-Baselines3');
    
    try {
      const { spawn } = require('child_process');
      
      const pythonProcess = spawn('python3', [
        'server/rl/bootstrap_rl.py'
      ], {
        stdio: ['inherit', 'inherit', 'inherit'],
        cwd: process.cwd()
      });
      
      pythonProcess.on('close', (code: number) => {
        if (code === 0) {
          logger.info('[StevieRL] Bootstrap RL training completed successfully');
          this.trainingMetrics.totalTrainingTime = Date.now() - this.trainingStartTime;
        } else {
          logger.error(`[StevieRL] Bootstrap RL training failed with code ${code}`);
        }
      });
      
    } catch (error) {
      logger.error('[StevieRL] Error starting bootstrap RL training', { error });
    }
  }

  /**
   * Start behavior cloning pre-training
   */
  async startBehaviorCloning(): Promise<void> {
    logger.info('[StevieRL] Starting behavior cloning pre-training');
    
    try {
      const { spawn } = require('child_process');
      
      const pythonProcess = spawn('python3', [
        'server/rl/behaviorClone.py'
      ], {
        stdio: ['inherit', 'inherit', 'inherit'],
        cwd: process.cwd()
      });
      
      pythonProcess.on('close', (code: number) => {
        if (code === 0) {
          logger.info('[StevieRL] Behavior cloning completed successfully');
        } else {
          logger.error(`[StevieRL] Behavior cloning failed with code ${code}`);
        }
      });
      
    } catch (error) {
      logger.error('[StevieRL] Error starting behavior cloning', { error });
    }
  }

  /**
   * Run hyperparameter optimization
   */
  async runHyperparameterOptimization(trials: number = 20): Promise<void> {
    logger.info(`[StevieRL] Starting hyperparameter optimization with ${trials} trials`);
    
    try {
      const { spawn } = require('child_process');
      
      const pythonProcess = spawn('python3', [
        'server/rl/optuna_hpo.py',
        '--trials', trials.toString()
      ], {
        stdio: ['inherit', 'inherit', 'inherit'],
        cwd: process.cwd()
      });
      
      pythonProcess.on('close', (code: number) => {
        if (code === 0) {
          logger.info('[StevieRL] Hyperparameter optimization completed successfully');
        } else {
          logger.error(`[StevieRL] Hyperparameter optimization failed with code ${code}`);
        }
      });
      
    } catch (error) {
      logger.error('[StevieRL] Error starting hyperparameter optimization', { error });
    }
  }

  // Train the agent using recent trade data
  async trainOnHistoricalData(userId: string, episodes: number = 100): Promise<RLMetrics> {
    logger.info(`[StevieRL] Starting training for user ${userId} with ${episodes} episodes`);
    
    const metrics: RLMetrics = {
      totalReturn: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
      calmarRatio: 0
    };

    try {
      const returns: number[] = [];
      let wins = 0;
      let totalWin = 0;
      let totalLoss = 0;
      let maxDrawdown = 0;
      
      for (let episode = 0; episode < episodes; episode++) {
        const state = await this.environment.reset(userId);
        let episodeReturn = 0;
        let steps = 0;
        
        while (steps < 100) { // Max 100 steps per episode
          const action = this.getAction(state, true);
          const result = await this.environment.step(action, userId);
          
          episodeReturn += result.reward;
          
          if (result.info.pnl > 0) {
            wins++;
            totalWin += result.info.pnl;
          } else if (result.info.pnl < 0) {
            totalLoss += Math.abs(result.info.pnl);
          }
          
          maxDrawdown = Math.max(maxDrawdown, result.info.drawdown);
          
          if (result.done) break;
          steps++;
        }
        
        returns.push(episodeReturn);
        this.updateExploration();
        
        if (episode % 10 === 0) {
          logger.debug(`[StevieRL] Episode ${episode}, Return: ${episodeReturn.toFixed(4)}, Exploration: ${this.explorationRate.toFixed(3)}`);
        }
      }
      
      // Calculate final metrics
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const returnStd = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
      
      metrics.totalReturn = avgReturn;
      metrics.sharpeRatio = returnStd > 0 ? (avgReturn - this.environment['riskFreeRate']) / returnStd : 0;
      metrics.maxDrawdown = maxDrawdown;
      metrics.winRate = returns.length > 0 ? wins / returns.length : 0;
      metrics.averageWin = wins > 0 ? totalWin / wins : 0;
      metrics.averageLoss = (returns.length - wins) > 0 ? totalLoss / (returns.length - wins) : 0;
      metrics.profitFactor = totalLoss > 0 ? totalWin / totalLoss : 0;
      metrics.calmarRatio = maxDrawdown > 0 ? avgReturn / maxDrawdown : 0;
      
      logger.info('[StevieRL] Training completed', { metrics });
      
      // Store training results
      await this.storeTrainingMetrics(userId, metrics);
      
      return metrics;
      
    } catch (error) {
      logger.error('[StevieRL] Training failed', { error, userId });
      throw error;
    }
  }

  private async storeTrainingMetrics(userId: string, metrics: RLMetrics): Promise<void> {
    try {
      // Store in model_runs table or similar
      logger.info('[StevieRL] Storing training metrics', { userId, metrics });
      // Implementation would store metrics in database
    } catch (error) {
      logger.error('[StevieRL] Failed to store training metrics', { error });
    }
  }

  // Get current agent status
  getAgentStatus(): any {
    return {
      explorationRate: this.explorationRate,
      learningRate: this.learningRate,
      minExploration: this.minExploration,
      isTraining: this.explorationRate > this.minExploration
    };
  }
}

export const stevieRL = new StevieRLAgent();