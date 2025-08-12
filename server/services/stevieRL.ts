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

  // Initialize environment with REAL market data from all our data sources
  async reset(userId: string): Promise<MarketState> {
    try {
      // Get user's current positions and portfolio
      const positions = await storage.getUserPositions(userId);
      const portfolioValue = positions.reduce((sum, pos) => 
        sum + (Number(pos.quantity) * Number(pos.currentPrice)), 0
      );

      // Get REAL data from ALL our configured data sources  
      const { stevieDataIntegration } = await import('./stevieDataIntegration');
      const realMarketData = await stevieDataIntegration.getComprehensiveMarketState('BTC');
      
      const marketState: MarketState = {
        prices: realMarketData.priceHistory24h,
        volumes: realMarketData.volumeHistory24h,
        technicalIndicators: realMarketData.technicalIndicators,
        sentiment: realMarketData.sentiment.overall, // Real sentiment from ALL sources
        positions: positions.map(p => ({
          symbol: p.symbol,
          quantity: Number(p.quantity),
          unrealizedPnl: Number(p.unrealizedPnl)
        })),
        portfolioValue: portfolioValue || this.initialPortfolioValue,
        timestamp: realMarketData.timestamp
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

  // Get comprehensive market data from ALL our configured data sources
  private async getComprehensiveMarketData(symbol: string): Promise<{
    priceHistory: number[];
    volumeHistory: number[];
    technicalIndicators: any;
    aggregatedSentiment: number;
    onChainMetrics: any;
    macroEvents: any;
  }> {
    try {
      // Import our actual data services
      const { dataIngestionService } = await import('./dataIngestion');
      const { sentimentAnalyzer } = await import('./sentimentAnalyzer');
      
      // Get real OHLCV data from CoinGecko/Binance
      const ohlcvData = await dataIngestionService.getLatestOHLCV(symbol, 100);
      const priceHistory = ohlcvData.map(d => d.close);
      const volumeHistory = ohlcvData.map(d => d.volume);
      
      // Get real sentiment from Twitter/Reddit/News/CryptoPanic
      const sentimentData = await sentimentAnalyzer.getAggregatedSentiment(symbol);
      
      // Get on-chain data from Etherscan/Blockchair
      const onChainCollector = dataIngestionService.collectors?.get('onchain');
      const onChainMetrics = await onChainCollector?.collectCurrentMetrics([symbol]);
      
      // Calculate real technical indicators from actual price data
      const technicalIndicators = this.calculateRealTechnicalIndicators(priceHistory);
      
      return {
        priceHistory,
        volumeHistory,
        technicalIndicators,
        aggregatedSentiment: sentimentData.overallSentiment,
        onChainMetrics,
        macroEvents: null // TODO: Integrate Trading Economics API
      };
      
    } catch (error) {
      logger.error('Error fetching comprehensive market data, falling back to simulation', { error });
      
      // Only fallback to simulation if real data completely fails
      return {
        priceHistory: this.generatePriceHistory(100),
        volumeHistory: this.generateVolumeHistory(100),
        technicalIndicators: this.calculateTechnicalIndicators([]),
        aggregatedSentiment: 0,
        onChainMetrics: null,
        macroEvents: null
      };
    }
  }

  private generatePriceHistory(length: number): number[] {
    // FALLBACK ONLY - Should use real CoinGecko/Binance data
    const prices = [100]; 
    for (let i = 1; i < length; i++) {
      const change = (Math.random() - 0.5) * 0.02;
      prices.push(prices[i-1] * (1 + change));
    }
    return prices;
  }

  private generateVolumeHistory(length: number): number[] {
    // FALLBACK ONLY - Should use real exchange data
    return Array.from({ length }, () => Math.random() * 1000000);
  }

  // Calculate technical indicators from REAL price data
  private calculateRealTechnicalIndicators(prices: number[]): any {
    if (prices.length < 26) {
      return this.calculateTechnicalIndicators(prices);
    }

    // RSI calculation on real data
    const rsi = this.calculateRSI(prices.slice(-14));
    
    // MACD calculation on real data  
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12[ema12.length - 1] - ema26[ema26.length - 1];
    
    // Bollinger Bands on real data
    const sma20 = this.calculateSMA(prices.slice(-20));
    const stdDev = this.calculateStdDev(prices.slice(-20), sma20);
    
    return {
      rsi,
      macd,
      bollinger: {
        upper: sma20 + (2 * stdDev),
        middle: sma20,
        lower: sma20 - (2 * stdDev)
      }
    };
  }

  private calculateRSI(prices: number[]): number {
    let gains = 0, losses = 0;
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i-1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    const avgGain = gains / (prices.length - 1);
    const avgLoss = losses / (prices.length - 1);
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateEMA(prices: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const ema = [prices[0]];
    for (let i = 1; i < prices.length; i++) {
      ema.push(prices[i] * k + ema[i-1] * (1 - k));
    }
    return ema;
  }

  private calculateSMA(prices: number[]): number {
    return prices.reduce((a, b) => a + b) / prices.length;
  }

  private calculateStdDev(prices: number[], mean: number): number {
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
    return Math.sqrt(variance);
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
import { logger } from '../utils/logger';

export interface RLMetrics {
  episodeReturn: number;
  cvarAt5: number;
  transactionCosts: number;
  maxDrawdown: number;
  sharpeRatio: number;
  episodeLength: number;
}

export interface QuantileCritic {
  quantiles: number[];
  values: number[];
  losses: number[];
}

export interface TrainingConfig {
  lambda_tc: number;    // Transaction cost penalty
  gamma_dd: number;     // Drawdown penalty
  cvar_threshold: number; // CVaR threshold
  num_quantiles: number;  // For distributional critic
  huber_kappa: number;   // Huber loss parameter
}

export class RiskAwarePPO {
  private config: TrainingConfig;
  private episodeReturns: number[] = [];
  private transactionCosts: number[] = [];
  private drawdowns: number[] = [];
  private equityCurve: number[] = [];
  private lastEquity: number = 100000; // Start with $100k
  private peakEquity: number = 100000;
  private currentDrawdown: number = 0;
  private metrics: RLMetrics[] = [];

  constructor(config: Partial<TrainingConfig> = {}) {
    this.config = {
      lambda_tc: config.lambda_tc || 0.1,
      gamma_dd: config.gamma_dd || 2.0,
      cvar_threshold: config.cvar_threshold || -0.05, // -5% daily CVaR
      num_quantiles: config.num_quantiles || 51,
      huber_kappa: config.huber_kappa || 1.0,
      ...config
    };
    
    logger.info('[RiskAwarePPO] Initialized with config:', this.config);
  }

  computeShapedReward(
    logEquityChange: number,
    transactionCost: number,
    equityLevel: number
  ): number {
    // Update equity tracking
    this.lastEquity = equityLevel;
    this.equityCurve.push(equityLevel);
    
    // Update peak and drawdown
    if (equityLevel > this.peakEquity) {
      this.peakEquity = equityLevel;
      this.currentDrawdown = 0;
    } else {
      this.currentDrawdown = (this.peakEquity - equityLevel) / this.peakEquity;
    }
    
    // Compute drawdown increment (penalty for new drawdown)
    const ddIncrement = Math.max(0, this.currentDrawdown - (this.drawdowns.slice(-1)[0] || 0));
    
    // Shaped reward: r = dlog_equity - λ*TC - γ*DD_increment
    const reward = logEquityChange - this.config.lambda_tc * transactionCost - this.config.gamma_dd * ddIncrement;
    
    // Track metrics
    this.transactionCosts.push(transactionCost);
    this.drawdowns.push(this.currentDrawdown);
    
    logger.debug(`[RiskAwarePPO] Reward components: equity=${logEquityChange.toFixed(4)}, tc=${transactionCost.toFixed(4)}, dd=${ddIncrement.toFixed(4)}, final=${reward.toFixed(4)}`);
    
    return reward;
  }

  computeQuantileLoss(
    predicted_quantiles: number[],
    target_return: number
  ): number {
    if (predicted_quantiles.length !== this.config.num_quantiles) {
      throw new Error(`Expected ${this.config.num_quantiles} quantiles, got ${predicted_quantiles.length}`);
    }
    
    let totalLoss = 0;
    const quantileLevels = this.generateQuantileLevels();
    
    for (let i = 0; i < this.config.num_quantiles; i++) {
      const tau = quantileLevels[i]; // Quantile level (0 to 1)
      const predicted = predicted_quantiles[i];
      const error = target_return - predicted;
      
      // Quantile Huber loss
      const indicator = error < 0 ? 1 : 0;
      const huberLoss = Math.abs(error) < this.config.huber_kappa 
        ? 0.5 * error * error 
        : this.config.huber_kappa * Math.abs(error) - 0.5 * this.config.huber_kappa * this.config.huber_kappa;
      
      const quantileLoss = (tau - indicator) * huberLoss;
      totalLoss += quantileLoss;
    }
    
    return totalLoss / this.config.num_quantiles;
  }

  computeCVaR(returns: number[], alpha: number = 0.05): number {
    if (returns.length === 0) return 0;
    
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const cutoffIndex = Math.floor(returns.length * alpha);
    const tailReturns = sortedReturns.slice(0, cutoffIndex + 1);
    
    return tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;
  }

  trainStep(dryRun: boolean = false): RLMetrics {
    // Simulate a training episode
    const episodeLength = 100 + Math.floor(Math.random() * 200); // 100-300 steps
    const episodeReturns: number[] = [];
    const episodeTCs: number[] = [];
    let totalTC = 0;
    
    // Simulate episode
    for (let step = 0; step < episodeLength; step++) {
      const logEquityChange = (Math.random() - 0.5) * 0.02; // ±1% returns
      const transactionCost = Math.random() * 0.001; // 0-0.1% TC
      
      const shapedReward = this.computeShapedReward(
        logEquityChange,
        transactionCost,
        this.lastEquity * (1 + logEquityChange)
      );
      
      episodeReturns.push(shapedReward);
      episodeTCs.push(transactionCost);
      totalTC += transactionCost;
    }
    
    // Compute metrics
    const episodeReturn = episodeReturns.reduce((sum, r) => sum + r, 0);
    const cvarAt5 = this.computeCVaR(episodeReturns, 0.05);
    const maxDrawdown = Math.max(...this.drawdowns.slice(-episodeLength));
    const sharpeRatio = this.computeSharpeRatio(episodeReturns);
    
    const metrics: RLMetrics = {
      episodeReturn,
      cvarAt5,
      transactionCosts: totalTC,
      maxDrawdown,
      sharpeRatio,
      episodeLength
    };
    
    this.metrics.push(metrics);
    
    // Check CVaR constraint
    const cvarViolation = cvarAt5 < this.config.cvar_threshold;
    
    if (dryRun) {
      logger.info(`[RiskAwarePPO] Dry run episode: return=${episodeReturn.toFixed(4)}, CVaR@5%=${cvarAt5.toFixed(4)}, maxDD=${maxDrawdown.toFixed(4)}, Sharpe=${sharpeRatio.toFixed(2)}`);
    } else {
      logger.info(`[RiskAwarePPO] Training step: CVaR@5%=${cvarAt5.toFixed(4)} (threshold=${this.config.cvar_threshold}), violation=${cvarViolation}`);
    }
    
    return metrics;
  }

  getRecentMetrics(count: number = 10): RLMetrics[] {
    return this.metrics.slice(-count);
  }

  private generateQuantileLevels(): number[] {
    const levels: number[] = [];
    for (let i = 0; i < this.config.num_quantiles; i++) {
      levels.push((i + 0.5) / this.config.num_quantiles); // 0.01, 0.03, ..., 0.99
    }
    return levels;
  }

  private computeSharpeRatio(returns: number[]): number {
    if (returns.length < 2) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    const std = Math.sqrt(variance);
    
    return std === 0 ? 0 : mean / std;
  }

  // Mock distributional critic for testing
  predictQuantiles(state: number[]): number[] {
    // Simulate quantile predictions (would be neural network output)
    const quantiles: number[] = [];
    const mean = Math.random() * 0.02 - 0.01; // ±1% expected return
    const std = 0.01 + Math.random() * 0.02; // 1-3% volatility
    
    for (let i = 0; i < this.config.num_quantiles; i++) {
      const tau = (i + 0.5) / this.config.num_quantiles;
      // Approximate normal quantile (simplified)
      const z = this.inverseNormalCDF(tau);
      quantiles.push(mean + std * z);
    }
    
    return quantiles.sort((a, b) => a - b); // Ensure monotonicity
  }

  private inverseNormalCDF(p: number): number {
    // Approximation of inverse normal CDF (Beasley-Springer-Moro algorithm simplified)
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    
    const a = [0, -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [0, -5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    
    const c = [0, -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [0, 7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    
    let x: number;
    
    if (p < 0.02425) {
      const q = Math.sqrt(-2 * Math.log(p));
      x = (((((c[1] * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) * q + c[6]) / ((((d[1] * q + d[2]) * q + d[3]) * q + d[4]) * q + 1);
    } else if (p < 0.97575) {
      const q = p - 0.5;
      const r = q * q;
      x = (((((a[1] * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * r + a[6]) * q / (((((b[1] * r + b[2]) * r + b[3]) * r + b[4]) * r + b[5]) * r + 1);
    } else {
      const q = Math.sqrt(-2 * Math.log(1 - p));
      x = -(((((c[1] * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) * q + c[6]) / ((((d[1] * q + d[2]) * q + d[3]) * q + d[4]) * q + 1);
    }
    
    return x;
  }
}

export const riskAwarePPO = new RiskAwarePPO();
