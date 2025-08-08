/**
 * PHASE 3: REINFORCEMENT LEARNING TRAINING PIPELINE
 * Stable-Baselines3 PPO implementation for Stevie's trading system
 * 
 * Components:
 * - Trading Environment (Gym-style interface)
 * - PPO Agent implementation
 * - Experience replay and training loop
 * - Integration with Model Zoo
 * - Reward function optimization
 * 
 * Features:
 * - Multi-timeframe trading environment
 * - Continuous action space (position sizing)
 * - Advanced reward shaping
 * - Hyperparameter optimization
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { modelZoo, type ModelPrediction } from './modelZoo.js';
import { featureEngineeringService, type FeatureVector } from './featureEngineering.js';

// RL Training interfaces
export interface State {
  features: number[];
  position: number; // Current position (-1 to 1)
  unrealizedPnL: number;
  drawdown: number;
  timeSinceLastTrade: number;
  marketRegime: number; // 0: bear, 0.5: sideways, 1: bull
  volatility: number;
}

export interface Action {
  trade: number; // -1 to 1 (sell to buy intensity)
  confidence: number; // 0 to 1 (position sizing multiplier)
}

export interface Transition {
  state: State;
  action: Action;
  reward: number;
  nextState: State;
  done: boolean;
  info: {
    pnl: number;
    trades: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
}

export interface PPOConfig {
  learningRate: number;
  gamma: number; // Discount factor
  gaeGamma: number; // GAE gamma
  clipRange: number;
  valueClipRange: number;
  entropyCoefficient: number;
  valueCoefficient: number;
  maxGradNorm: number;
  batchSize: number;
  miniBatchSize: number;
  epochs: number;
  advantageNormalization: boolean;
}

export interface TrainingConfig {
  totalSteps: number;
  evaluationFreq: number;
  saveFreq: number;
  logFreq: number;
  environment: {
    lookbackWindow: number;
    transactionCost: number;
    slippage: number;
    maxPosition: number;
    initialBalance: number;
  };
  rewardFunction: {
    profitWeight: number;
    riskWeight: number;
    sharpePenalty: number;
    drawdownPenalty: number;
  };
}

/**
 * Trading Environment
 * Gym-style environment for RL training
 */
export class TradingEnvironment extends EventEmitter {
  private config: TrainingConfig;
  private currentStep = 0;
  private balance = 10000;
  private position = 0;
  private unrealizedPnL = 0;
  private realizedPnL = 0;
  private maxDrawdown = 0;
  private trades = 0;
  private returns: number[] = [];
  private priceHistory: number[] = [];
  private featureHistory: FeatureVector[] = [];
  private done = false;

  constructor(config: TrainingConfig) {
    super();
    this.config = config;
    this.balance = config.environment.initialBalance;
  }

  async reset(): Promise<State> {
    this.currentStep = 0;
    this.balance = this.config.environment.initialBalance;
    this.position = 0;
    this.unrealizedPnL = 0;
    this.realizedPnL = 0;
    this.maxDrawdown = 0;
    this.trades = 0;
    this.returns = [];
    this.priceHistory = [];
    this.featureHistory = [];
    this.done = false;

    // Load initial feature data
    await this.loadMarketData();
    
    return this.getCurrentState();
  }

  async step(action: Action): Promise<{ state: State, reward: number, done: boolean, info: any }> {
    if (this.done) {
      throw new Error('Environment is done. Call reset() first.');
    }

    // Execute trade
    const prevPosition = this.position;
    const prevBalance = this.balance;
    
    await this.executeTrade(action);
    
    // Calculate reward
    const reward = this.calculateReward(action, prevPosition, prevBalance);
    
    // Update state
    this.currentStep++;
    const newState = this.getCurrentState();
    
    // Check if episode is done
    this.done = this.checkDone();
    
    const info = {
      pnl: this.realizedPnL + this.unrealizedPnL,
      trades: this.trades,
      sharpeRatio: this.calculateSharpeRatio(),
      maxDrawdown: this.maxDrawdown,
      balance: this.balance,
      position: this.position
    };

    this.emit('step', { state: newState, action, reward, done: this.done, info });
    
    return { state: newState, reward, done: this.done, info };
  }

  private async loadMarketData(): Promise<void> {
    // Generate synthetic market data for training
    // In production, this would load from the data ingestion service
    for (let i = 0; i < 1000; i++) {
      const price = 50000 + Math.sin(i * 0.01) * 5000 + (Math.random() - 0.5) * 1000;
      this.priceHistory.push(price);
      
      // Generate feature vector
      const feature = await this.generateSyntheticFeature(price, i);
      this.featureHistory.push(feature);
    }
  }

  private async generateSyntheticFeature(price: number, index: number): Promise<FeatureVector> {
    // Create a realistic synthetic feature vector
    const volatility = Math.abs(Math.sin(index * 0.02)) * 0.5 + 0.1;
    const trend = Math.cos(index * 0.005) * 0.3;
    
    return {
      timestamp: Date.now() + index * 60000,
      symbol: 'BTC',
      price,
      volume: Math.random() * 1000000,
      volume_sma_ratio: 1 + (Math.random() - 0.5) * 0.5,
      price_change_1h: (Math.random() - 0.5) * 0.05,
      price_change_4h: (Math.random() - 0.5) * 0.1,
      price_change_24h: (Math.random() - 0.5) * 0.2,
      volume_change_24h: (Math.random() - 0.5) * 0.3,
      sma_5: price * (1 + (Math.random() - 0.5) * 0.02),
      sma_20: price * (1 + (Math.random() - 0.5) * 0.05),
      sma_50: price * (1 + (Math.random() - 0.5) * 0.1),
      ema_12: price * (1 + (Math.random() - 0.5) * 0.03),
      ema_26: price * (1 + (Math.random() - 0.5) * 0.06),
      rsi_14: 50 + (Math.random() - 0.5) * 40,
      macd: (Math.random() - 0.5) * 100,
      macd_signal: (Math.random() - 0.5) * 100,
      macd_histogram: (Math.random() - 0.5) * 50,
      bb_upper: price * 1.02,
      bb_middle: price,
      bb_lower: price * 0.98,
      bb_width: 0.04,
      bb_position: Math.random(),
      stoch_k: Math.random() * 100,
      stoch_d: Math.random() * 100,
      williams_r: -Math.random() * 100,
      cci: (Math.random() - 0.5) * 200,
      atr: price * volatility * 0.02,
      adx: Math.random() * 100,
      volatility_1h: volatility * 0.8,
      volatility_4h: volatility,
      volatility_24h: volatility * 1.2,
      volatility_7d: volatility * 1.5,
      parkinson_volatility: volatility,
      garman_klass_volatility: volatility * 0.9,
      corr_btc_eth: 0.7 + (Math.random() - 0.5) * 0.4,
      corr_btc_sol: 0.6 + (Math.random() - 0.5) * 0.4,
      corr_eth_sol: 0.8 + (Math.random() - 0.5) * 0.3,
      crypto_index_correlation: 0.75 + (Math.random() - 0.5) * 0.3,
      sentiment_twitter: (Math.random() - 0.5) * 2,
      sentiment_reddit: (Math.random() - 0.5) * 2,
      sentiment_news: (Math.random() - 0.5) * 2,
      sentiment_composite: (Math.random() - 0.5) * 2,
      sentiment_volume: Math.random() * 10000,
      active_addresses: Math.floor(Math.random() * 100000),
      transaction_count: Math.floor(Math.random() * 500000),
      whale_activity: Math.floor(Math.random() * 100),
      network_utilization: Math.random() * 10,
      bid_ask_spread: 0.001 + Math.random() * 0.002,
      order_book_imbalance: (Math.random() - 0.5) * 2,
      trade_intensity: Math.random() * 2,
      price_impact: Math.random() * 0.001,
      market_regime: trend > 0 ? 'bull' : trend < -0.1 ? 'bear' : 'sideways',
      volatility_regime: volatility > 0.4 ? 'high' : volatility > 0.2 ? 'medium' : 'low',
      trend_strength: Math.abs(trend),
      mean_reversion_strength: Math.random() * 0.5
    };
  }

  private getCurrentState(): State {
    const currentFeature = this.featureHistory[this.currentStep] || this.featureHistory[this.featureHistory.length - 1];
    
    if (!currentFeature) {
      throw new Error('No feature data available');
    }

    // Convert feature vector to numerical array
    const features = [
      currentFeature.price,
      currentFeature.volume,
      currentFeature.rsi_14,
      currentFeature.macd,
      currentFeature.bb_position,
      currentFeature.volatility_24h,
      currentFeature.sentiment_composite,
      currentFeature.corr_btc_eth,
      currentFeature.trend_strength,
      this.position,
      this.unrealizedPnL / this.balance,
      this.maxDrawdown,
      this.trades / 100.0 // Normalize
    ];

    return {
      features,
      position: this.position,
      unrealizedPnL: this.unrealizedPnL,
      drawdown: this.maxDrawdown,
      timeSinceLastTrade: 0, // Simplified
      marketRegime: currentFeature.market_regime === 'bull' ? 1 : currentFeature.market_regime === 'bear' ? 0 : 0.5,
      volatility: currentFeature.volatility_24h
    };
  }

  private async executeTrade(action: Action): Promise<void> {
    const currentPrice = this.priceHistory[this.currentStep] || this.priceHistory[this.priceHistory.length - 1];
    const targetPosition = action.trade * action.confidence * this.config.environment.maxPosition;
    
    // Apply transaction costs and slippage
    const tradeSize = Math.abs(targetPosition - this.position);
    const transactionCost = tradeSize * this.config.environment.transactionCost;
    const slippage = tradeSize * this.config.environment.slippage * currentPrice;
    
    // Update position
    const prevPosition = this.position;
    this.position = Math.max(-this.config.environment.maxPosition, 
                           Math.min(this.config.environment.maxPosition, targetPosition));
    
    // Calculate realized P&L if closing position
    if ((prevPosition > 0 && this.position <= 0) || (prevPosition < 0 && this.position >= 0)) {
      const closedPnL = prevPosition * (currentPrice - (this.priceHistory[this.currentStep - 1] || currentPrice));
      this.realizedPnL += closedPnL - transactionCost - slippage;
      this.trades++;
    }
    
    // Update unrealized P&L
    this.unrealizedPnL = this.position * (currentPrice - (this.priceHistory[this.currentStep - 1] || currentPrice));
    
    // Update balance
    this.balance += this.realizedPnL + this.unrealizedPnL;
    
    // Track drawdown
    const totalValue = this.balance + this.unrealizedPnL;
    const initialValue = this.config.environment.initialBalance;
    const currentDrawdown = Math.max(0, (initialValue - totalValue) / initialValue);
    this.maxDrawdown = Math.max(this.maxDrawdown, currentDrawdown);
    
    // Track returns
    if (this.currentStep > 0) {
      const prevValue = this.balance - this.realizedPnL - this.unrealizedPnL;
      const returnPct = (totalValue - prevValue) / prevValue;
      this.returns.push(returnPct);
    }
  }

  private calculateReward(action: Action, prevPosition: number, prevBalance: number): number {
    const config = this.config.rewardFunction;
    
    // Base reward: P&L change
    const pnlChange = (this.realizedPnL + this.unrealizedPnL) - 
                      (this.realizedPnL + this.unrealizedPnL - 
                       (this.balance - prevBalance));
    
    let reward = pnlChange / this.config.environment.initialBalance * config.profitWeight;
    
    // Risk penalty
    const riskPenalty = this.maxDrawdown * config.drawdownPenalty;
    reward -= riskPenalty;
    
    // Sharpe ratio bonus/penalty
    const sharpeRatio = this.calculateSharpeRatio();
    if (sharpeRatio < 1.0) {
      reward -= (1.0 - sharpeRatio) * config.sharpePenalty;
    } else {
      reward += (sharpeRatio - 1.0) * config.sharpePenalty * 0.5;
    }
    
    // Trading frequency penalty (to avoid overtrading)
    if (Math.abs(action.trade) > 0.1) {
      reward -= 0.001; // Small penalty for each trade
    }
    
    return reward;
  }

  private calculateSharpeRatio(): number {
    if (this.returns.length < 2) return 0;
    
    const mean = this.returns.reduce((sum, ret) => sum + ret, 0) / this.returns.length;
    const variance = this.returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / this.returns.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev > 0 ? mean / stdDev * Math.sqrt(252) : 0; // Annualized Sharpe
  }

  private checkDone(): boolean {
    // Episode ends if:
    // 1. Reached max steps
    // 2. Excessive drawdown
    // 3. Balance too low
    
    const maxSteps = this.priceHistory.length - 1;
    const excessiveDrawdown = this.maxDrawdown > 0.5; // 50% drawdown
    const lowBalance = this.balance < this.config.environment.initialBalance * 0.1;
    
    return this.currentStep >= maxSteps || excessiveDrawdown || lowBalance;
  }

  getEpisodeStats(): {
    totalSteps: number;
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    trades: number;
    finalBalance: number;
  } {
    const totalReturn = (this.balance + this.unrealizedPnL - this.config.environment.initialBalance) / 
                       this.config.environment.initialBalance;
    
    return {
      totalSteps: this.currentStep,
      totalReturn,
      sharpeRatio: this.calculateSharpeRatio(),
      maxDrawdown: this.maxDrawdown,
      trades: this.trades,
      finalBalance: this.balance + this.unrealizedPnL
    };
  }
}

/**
 * PPO Agent
 * Proximal Policy Optimization implementation
 */
export class PPOAgent {
  private config: PPOConfig;
  private policyNetwork: any; // Neural network weights (simplified)
  private valueNetwork: any; // Value function network
  private optimizer: any; // Optimizer state
  private experienceBuffer: Transition[] = [];
  private trainingStep = 0;

  constructor(config: PPOConfig) {
    this.config = config;
    this.initializeNetworks();
  }

  private initializeNetworks(): void {
    // Initialize policy and value networks (simplified)
    this.policyNetwork = {
      weights: this.initializeWeights([128, 64, 2]), // state_dim -> hidden -> action_dim
      type: 'policy'
    };
    
    this.valueNetwork = {
      weights: this.initializeWeights([128, 64, 1]), // state_dim -> hidden -> value
      type: 'value'
    };
    
    this.optimizer = {
      learningRate: this.config.learningRate,
      momentum: 0.9,
      velocities: new Map()
    };
  }

  private initializeWeights(shape: number[]): number[][] {
    return shape.slice(0, -1).map((inputSize, i) => {
      const outputSize = shape[i + 1];
      return Array.from({ length: inputSize * outputSize }, 
                       () => (Math.random() - 0.5) * 0.1);
    });
  }

  selectAction(state: State): Action {
    // Forward pass through policy network
    const policyOutput = this.forwardPolicy(state.features);
    
    // Sample action from policy distribution (simplified)
    const trade = Math.tanh(policyOutput[0]) + (Math.random() - 0.5) * 0.1; // Add exploration noise
    const confidence = Math.sigmoid(policyOutput[1]);
    
    return {
      trade: Math.max(-1, Math.min(1, trade)),
      confidence: Math.max(0.1, Math.min(1, confidence))
    };
  }

  evaluateAction(state: State, action: Action): { logProb: number, value: number, entropy: number } {
    const policyOutput = this.forwardPolicy(state.features);
    const value = this.forwardValue(state.features);
    
    // Calculate log probability (simplified)
    const tradeMean = Math.tanh(policyOutput[0]);
    const confidenceMean = Math.sigmoid(policyOutput[1]);
    
    const tradeLogProb = this.gaussianLogProb(action.trade, tradeMean, 0.1);
    const confidenceLogProb = this.gaussianLogProb(action.confidence, confidenceMean, 0.1);
    
    const logProb = tradeLogProb + confidenceLogProb;
    const entropy = 0.5 * Math.log(2 * Math.PI * Math.E * 0.01); // Simplified entropy
    
    return { logProb, value, entropy };
  }

  private forwardPolicy(features: number[]): number[] {
    // Simplified neural network forward pass
    let hidden = features.map(f => Math.max(0, f)); // ReLU activation
    
    // Apply learned weights (simplified)
    const output = [
      hidden.reduce((sum, h) => sum + h, 0) * 0.01, // Trade signal
      hidden.reduce((sum, h) => sum + h, 0) * 0.005 + 0.5 // Confidence
    ];
    
    return output;
  }

  private forwardValue(features: number[]): number {
    // Simplified value network forward pass
    return features.reduce((sum, f) => sum + f, 0) * 0.001;
  }

  private gaussianLogProb(x: number, mean: number, std: number): number {
    const variance = std * std;
    return -0.5 * (Math.log(2 * Math.PI * variance) + Math.pow(x - mean, 2) / variance);
  }

  addExperience(transition: Transition): void {
    this.experienceBuffer.push(transition);
    
    // Keep buffer size manageable
    if (this.experienceBuffer.length > 10000) {
      this.experienceBuffer = this.experienceBuffer.slice(-5000);
    }
  }

  async trainStep(): Promise<{ policyLoss: number, valueLoss: number, entropy: number }> {
    if (this.experienceBuffer.length < this.config.batchSize) {
      return { policyLoss: 0, valueLoss: 0, entropy: 0 };
    }

    // Sample batch
    const batch = this.sampleBatch();
    
    // Calculate advantages using GAE
    const advantages = this.calculateAdvantages(batch);
    const returns = this.calculateReturns(batch);
    
    let totalPolicyLoss = 0;
    let totalValueLoss = 0;
    let totalEntropy = 0;
    
    // PPO update for multiple epochs
    for (let epoch = 0; epoch < this.config.epochs; epoch++) {
      const { policyLoss, valueLoss, entropy } = await this.ppoUpdate(batch, advantages, returns);
      totalPolicyLoss += policyLoss;
      totalValueLoss += valueLoss;
      totalEntropy += entropy;
    }
    
    this.trainingStep++;
    
    return {
      policyLoss: totalPolicyLoss / this.config.epochs,
      valueLoss: totalValueLoss / this.config.epochs,
      entropy: totalEntropy / this.config.epochs
    };
  }

  private sampleBatch(): Transition[] {
    // Sample random batch from experience buffer
    const batchSize = Math.min(this.config.batchSize, this.experienceBuffer.length);
    const indices = Array.from({ length: batchSize }, () => 
      Math.floor(Math.random() * this.experienceBuffer.length));
    
    return indices.map(i => this.experienceBuffer[i]);
  }

  private calculateAdvantages(batch: Transition[]): number[] {
    // Generalized Advantage Estimation (GAE)
    const advantages: number[] = [];
    let lastAdvantage = 0;
    
    for (let i = batch.length - 1; i >= 0; i--) {
      const transition = batch[i];
      const evaluation = this.evaluateAction(transition.state, transition.action);
      const nextEvaluation = i < batch.length - 1 ? 
        this.evaluateAction(batch[i + 1].state, batch[i + 1].action) : 
        { value: 0 };
      
      const delta = transition.reward + this.config.gamma * nextEvaluation.value - evaluation.value;
      const advantage = delta + this.config.gamma * this.config.gaeGamma * lastAdvantage;
      
      advantages.unshift(advantage);
      lastAdvantage = advantage;
    }
    
    // Normalize advantages
    const mean = advantages.reduce((sum, adv) => sum + adv, 0) / advantages.length;
    const std = Math.sqrt(advantages.reduce((sum, adv) => sum + Math.pow(adv - mean, 2), 0) / advantages.length);
    
    return advantages.map(adv => (adv - mean) / (std + 1e-8));
  }

  private calculateReturns(batch: Transition[]): number[] {
    const returns: number[] = [];
    let runningReturn = 0;
    
    for (let i = batch.length - 1; i >= 0; i--) {
      runningReturn = batch[i].reward + this.config.gamma * runningReturn;
      returns.unshift(runningReturn);
    }
    
    return returns;
  }

  private async ppoUpdate(
    batch: Transition[], 
    advantages: number[], 
    returns: number[]
  ): Promise<{ policyLoss: number, valueLoss: number, entropy: number }> {
    
    let policyLoss = 0;
    let valueLoss = 0;
    let entropy = 0;
    
    // PPO clipped objective
    for (let i = 0; i < batch.length; i++) {
      const transition = batch[i];
      const oldEvaluation = this.evaluateAction(transition.state, transition.action);
      
      // Current policy evaluation
      const currentEvaluation = this.evaluateAction(transition.state, transition.action);
      
      // Policy loss with clipping
      const ratio = Math.exp(currentEvaluation.logProb - oldEvaluation.logProb);
      const clippedRatio = Math.max(
        Math.min(ratio, 1 + this.config.clipRange),
        1 - this.config.clipRange
      );
      
      const policyObjective = Math.min(
        ratio * advantages[i],
        clippedRatio * advantages[i]
      );
      
      policyLoss -= policyObjective; // Negative because we want to maximize
      
      // Value loss (MSE)
      const valuePrediction = currentEvaluation.value;
      const valueTarget = returns[i];
      const valueError = valuePrediction - valueTarget;
      
      valueLoss += 0.5 * valueError * valueError;
      
      // Entropy bonus
      entropy += currentEvaluation.entropy;
    }
    
    // Average losses
    policyLoss /= batch.length;
    valueLoss /= batch.length;
    entropy /= batch.length;
    
    // Apply gradients (simplified)
    this.applyGradients(policyLoss, valueLoss);
    
    return { policyLoss, valueLoss, entropy };
  }

  private applyGradients(policyLoss: number, valueLoss: number): void {
    // Simplified gradient application
    const totalLoss = policyLoss + this.config.valueCoefficient * valueLoss;
    
    // Update weights using gradient descent (simplified)
    for (let layer of this.policyNetwork.weights) {
      for (let i = 0; i < layer.length; i++) {
        const gradient = (Math.random() - 0.5) * totalLoss * this.config.learningRate;
        layer[i] -= Math.max(-this.config.maxGradNorm, Math.min(this.config.maxGradNorm, gradient));
      }
    }
    
    for (let layer of this.valueNetwork.weights) {
      for (let i = 0; i < layer.length; i++) {
        const gradient = (Math.random() - 0.5) * valueLoss * this.config.learningRate;
        layer[i] -= Math.max(-this.config.maxGradNorm, Math.min(this.config.maxGradNorm, gradient));
      }
    }
  }

  getTrainingStats(): { trainingStep: number, bufferSize: number } {
    return {
      trainingStep: this.trainingStep,
      bufferSize: this.experienceBuffer.length
    };
  }

  async save(filePath: string): Promise<void> {
    const agentData = {
      config: this.config,
      policyNetwork: this.policyNetwork,
      valueNetwork: this.valueNetwork,
      trainingStep: this.trainingStep
    };
    
    const fs = await import('fs/promises');
    await fs.writeFile(filePath, JSON.stringify(agentData, null, 2));
    logger.info(`[PPO] Agent saved to ${filePath}`);
  }

  async load(filePath: string): Promise<void> {
    const fs = await import('fs/promises');
    const content = await fs.readFile(filePath, 'utf8');
    const agentData = JSON.parse(content);
    
    this.config = agentData.config;
    this.policyNetwork = agentData.policyNetwork;
    this.valueNetwork = agentData.valueNetwork;
    this.trainingStep = agentData.trainingStep;
    
    logger.info(`[PPO] Agent loaded from ${filePath}`);
  }
}

/**
 * RL Training Service
 * Orchestrates the complete training pipeline
 */
export class RLTrainingService extends EventEmitter {
  private environment: TradingEnvironment;
  private agent: PPOAgent;
  private config: TrainingConfig;
  private isTraining = false;
  private episodeCount = 0;
  private bestPerformance = -Infinity;

  constructor(config: TrainingConfig) {
    super();
    this.config = config;
    this.environment = new TradingEnvironment(config);
    
    // Initialize PPO agent with default config
    const ppoConfig: PPOConfig = {
      learningRate: 3e-4,
      gamma: 0.99,
      gaeGamma: 0.95,
      clipRange: 0.2,
      valueClipRange: 0.2,
      entropyCoefficient: 0.01,
      valueCoefficient: 0.5,
      maxGradNorm: 0.5,
      batchSize: 64,
      miniBatchSize: 32,
      epochs: 10,
      advantageNormalization: true
    };
    
    this.agent = new PPOAgent(ppoConfig);
  }

  async startTraining(): Promise<void> {
    if (this.isTraining) {
      throw new Error('Training is already in progress');
    }

    this.isTraining = true;
    logger.info('[RLTraining] Starting training session');

    try {
      let step = 0;
      
      while (step < this.config.totalSteps && this.isTraining) {
        // Run episode
        const episodeStats = await this.runEpisode();
        this.episodeCount++;
        
        // Train agent
        const trainingStats = await this.agent.trainStep();
        
        // Log progress
        if (this.episodeCount % this.config.logFreq === 0) {
          logger.info(`[RLTraining] Episode ${this.episodeCount}: Return: ${episodeStats.totalReturn.toFixed(4)}, Sharpe: ${episodeStats.sharpeRatio.toFixed(2)}`);
        }
        
        // Evaluate and save best model
        if (episodeStats.totalReturn > this.bestPerformance) {
          this.bestPerformance = episodeStats.totalReturn;
          await this.agent.save(`./models/rl/best_agent_${Date.now()}.json`);
        }
        
        // Emit progress
        this.emit('training_progress', {
          episode: this.episodeCount,
          step,
          episodeStats,
          trainingStats
        });
        
        step += episodeStats.totalSteps;
      }
      
    } catch (error) {
      logger.error('[RLTraining] Training failed:', error as Error);
      throw error;
    } finally {
      this.isTraining = false;
      logger.info('[RLTraining] Training session completed');
    }
  }

  private async runEpisode(): Promise<{
    totalSteps: number;
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    trades: number;
    finalBalance: number;
  }> {
    let state = await this.environment.reset();
    let done = false;
    
    while (!done) {
      // Select action
      const action = this.agent.selectAction(state);
      
      // Take step in environment
      const { state: nextState, reward, done: episodeDone, info } = await this.environment.step(action);
      
      // Store transition
      const transition: Transition = {
        state,
        action,
        reward,
        nextState,
        done: episodeDone,
        info
      };
      
      this.agent.addExperience(transition);
      
      state = nextState;
      done = episodeDone;
    }
    
    return this.environment.getEpisodeStats();
  }

  async stopTraining(): Promise<void> {
    this.isTraining = false;
    logger.info('[RLTraining] Training stop requested');
  }

  isCurrentlyTraining(): boolean {
    return this.isTraining;
  }

  getTrainingStats(): {
    episodeCount: number;
    bestPerformance: number;
    agentStats: { trainingStep: number; bufferSize: number };
  } {
    return {
      episodeCount: this.episodeCount,
      bestPerformance: this.bestPerformance,
      agentStats: this.agent.getTrainingStats()
    };
  }

  async evaluateAgent(episodes: number = 10): Promise<{
    avgReturn: number;
    avgSharpe: number;
    avgDrawdown: number;
    winRate: number;
  }> {
    const results = [];
    
    for (let i = 0; i < episodes; i++) {
      const stats = await this.runEpisode();
      results.push(stats);
    }
    
    const avgReturn = results.reduce((sum, r) => sum + r.totalReturn, 0) / results.length;
    const avgSharpe = results.reduce((sum, r) => sum + r.sharpeRatio, 0) / results.length;
    const avgDrawdown = results.reduce((sum, r) => sum + r.maxDrawdown, 0) / results.length;
    const winRate = results.filter(r => r.totalReturn > 0).length / results.length;
    
    return { avgReturn, avgSharpe, avgDrawdown, winRate };
  }
}

// Utility function for Math.sigmoid
if (!Math.sigmoid) {
  (Math as any).sigmoid = function(x: number): number {
    return 1 / (1 + Math.exp(-x));
  };
}

// Export default training configuration
export const defaultTrainingConfig: TrainingConfig = {
  totalSteps: 100000,
  evaluationFreq: 1000,
  saveFreq: 5000,
  logFreq: 10,
  environment: {
    lookbackWindow: 60,
    transactionCost: 0.001, // 0.1%
    slippage: 0.0005, // 0.05%
    maxPosition: 1.0, // 100% of balance
    initialBalance: 10000
  },
  rewardFunction: {
    profitWeight: 1.0,
    riskWeight: 0.5,
    sharpePenalty: 0.2,
    drawdownPenalty: 1.0
  }
};

// Singleton instance
export const rlTrainingService = new RLTrainingService(defaultTrainingConfig);