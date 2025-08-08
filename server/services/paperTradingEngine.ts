/**
 * PHASE 7: REAL-TIME PAPER TRADING ENGINE
 * Live trading simulation with real market data
 * 
 * Features:
 * - Real-time signal generation and execution
 * - Live data integration with market feeds
 * - Automated trading decisions using AI models
 * - Real-time portfolio tracking and P&L
 * - Performance analytics and reporting
 * - Risk management integration
 * - Trading session management
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { executionEngine, type ExecutionResult } from './executionEngine.js';
import { riskManagementService } from './riskManagement.js';
import { riskAlertService } from './riskAlertService.js';
import { modelZoo, type ModelPrediction } from './modelZoo.js';
import { featureEngineeringService } from './featureEngineering.js';
import { orderBookSimulator } from './orderBookSimulation.js';

export interface TradingSignal {
  id: string;
  timestamp: number;
  symbol: string;
  signal: 'buy' | 'sell' | 'hold';
  strength: number; // 0 to 1
  confidence: number; // 0 to 1
  targetPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  timeHorizon: string; // e.g., '4h', '1d'
  reasoning: string;
  modelPredictions: ModelPrediction[];
  features: {
    technicalScore: number;
    sentimentScore: number;
    momentumScore: number;
    volatilityScore: number;
  };
}

export interface TradingDecision {
  signalId: string;
  action: 'execute' | 'skip' | 'defer';
  reasoning: string;
  orderParams?: {
    symbol: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit';
    quantity: number;
    price?: number;
  };
  riskAssessment: {
    approved: boolean;
    riskScore: number;
    alerts: string[];
  };
}

export interface TradingSession {
  id: string;
  startTime: number;
  endTime?: number;
  status: 'active' | 'paused' | 'stopped';
  strategy: string;
  symbols: string[];
  initialCapital: number;
  currentValue: number;
  totalPnL: number;
  totalTrades: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  tradingSignals: TradingSignal[];
  executedTrades: ExecutionResult[];
}

export interface PaperTradingConfig {
  symbols: string[];
  strategy: string;
  initialCapital: number;
  maxPositionSize: number;
  dailyLossLimit: number;
  signalUpdateInterval: number; // milliseconds
  enableAutoExecution: boolean;
  riskThreshold: number; // 0 to 1
  modelEnsemble: string[]; // Model IDs to use
}

/**
 * Signal Generator
 * Generates trading signals using AI models and technical analysis
 */
class SignalGenerator extends EventEmitter {
  private config: PaperTradingConfig;
  private isRunning = false;
  private updateInterval?: NodeJS.Timeout;

  constructor(config: PaperTradingConfig) {
    super();
    this.config = config;
  }

  start(): void {
    if (this.isRunning) return;

    logger.info('[SignalGen] Starting signal generation');
    this.isRunning = true;

    // Generate signals immediately
    this.generateSignals();

    // Set up periodic updates
    this.updateInterval = setInterval(() => {
      this.generateSignals();
    }, this.config.signalUpdateInterval);
  }

  stop(): void {
    if (!this.isRunning) return;

    logger.info('[SignalGen] Stopping signal generation');
    this.isRunning = false;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }

  private async generateSignals(): Promise<void> {
    try {
      for (const symbol of this.config.symbols) {
        const signal = await this.generateSignalForSymbol(symbol);
        if (signal) {
          this.emit('signal', signal);
        }
      }
    } catch (error) {
      logger.error('[SignalGen] Error generating signals:', error as Error);
    }
  }

  private async generateSignalForSymbol(symbol: string): Promise<TradingSignal | null> {
    try {
      // Generate features
      const features = await featureEngineeringService.generateFeatureVector(
        symbol, 
        Date.now(), 
        '4h'
      );

      // Get model predictions
      const modelPredictions: ModelPrediction[] = [];
      
      for (const modelId of this.config.modelEnsemble) {
        try {
          const predictions = await modelZoo.predict(modelId, [features]);
          modelPredictions.push(...predictions);
        } catch (error) {
          logger.warn(`[SignalGen] Model ${modelId} prediction failed:`, error as Error);
        }
      }

      if (modelPredictions.length === 0) {
        return null;
      }

      // Ensemble prediction
      const ensemblePrediction = this.calculateEnsemblePrediction(modelPredictions);
      
      // Calculate signal strength and confidence
      const { signal, strength, confidence } = this.interpretPrediction(ensemblePrediction, features);
      
      if (signal === 'hold') {
        return null; // Skip hold signals
      }

      // Calculate target prices
      const currentPrice = features.price;
      const volatility = features.volatility_24h;
      
      const targetPrice = signal === 'buy' 
        ? currentPrice * (1 + volatility * strength * 0.5)
        : currentPrice * (1 - volatility * strength * 0.5);
      
      const stopLoss = signal === 'buy'
        ? currentPrice * (1 - volatility * 0.3)
        : currentPrice * (1 + volatility * 0.3);
      
      const takeProfit = signal === 'buy'
        ? currentPrice * (1 + volatility * strength)
        : currentPrice * (1 - volatility * strength);

      // Generate reasoning
      const reasoning = this.generateReasoning(features, modelPredictions, ensemblePrediction);

      return {
        id: `signal_${Date.now()}_${symbol}`,
        timestamp: Date.now(),
        symbol,
        signal,
        strength,
        confidence,
        targetPrice,
        stopLoss,
        takeProfit,
        timeHorizon: '4h',
        reasoning,
        modelPredictions,
        features: {
          technicalScore: this.calculateTechnicalScore(features),
          sentimentScore: features.sentiment_composite,
          momentumScore: features.price_change_24h,
          volatilityScore: features.volatility_24h
        }
      };

    } catch (error) {
      logger.error(`[SignalGen] Error generating signal for ${symbol}:`, error as Error);
      return null;
    }
  }

  private calculateEnsemblePrediction(predictions: ModelPrediction[]): ModelPrediction {
    if (predictions.length === 0) {
      throw new Error('No predictions available for ensemble');
    }

    // Weight predictions by confidence
    let weightedPrediction = 0;
    let totalWeight = 0;
    let avgConfidence = 0;
    
    for (const pred of predictions) {
      const weight = pred.confidence;
      weightedPrediction += pred.prediction * weight;
      totalWeight += weight;
      avgConfidence += pred.confidence;
    }
    
    return {
      ...predictions[0],
      prediction: weightedPrediction / totalWeight,
      confidence: avgConfidence / predictions.length,
      modelVersion: 'ensemble'
    };
  }

  private interpretPrediction(
    prediction: ModelPrediction, 
    features: any
  ): { signal: 'buy' | 'sell' | 'hold', strength: number, confidence: number } {
    
    const threshold = 0.1; // Minimum prediction threshold
    const predValue = prediction.prediction;
    const confidence = prediction.confidence;
    
    // Consider volatility in threshold
    const volatilityAdjustment = Math.min(1.5, 1 + features.volatility_24h);
    const adjustedThreshold = threshold * volatilityAdjustment;
    
    if (predValue > adjustedThreshold) {
      return {
        signal: 'buy',
        strength: Math.min(1, Math.abs(predValue) / 0.5),
        confidence: confidence
      };
    } else if (predValue < -adjustedThreshold) {
      return {
        signal: 'sell',
        strength: Math.min(1, Math.abs(predValue) / 0.5),
        confidence: confidence
      };
    } else {
      return {
        signal: 'hold',
        strength: 0,
        confidence: 0
      };
    }
  }

  private calculateTechnicalScore(features: any): number {
    // Combine multiple technical indicators
    const rsiScore = features.rsi_14 > 70 ? -0.5 : features.rsi_14 < 30 ? 0.5 : 0;
    const macdScore = features.macd > 0 ? 0.3 : -0.3;
    const bbScore = features.bb_position > 0.8 ? -0.3 : features.bb_position < 0.2 ? 0.3 : 0;
    
    return Math.max(-1, Math.min(1, rsiScore + macdScore + bbScore));
  }

  private generateReasoning(
    features: any, 
    predictions: ModelPrediction[], 
    ensemble: ModelPrediction
  ): string {
    const reasons = [];
    
    // Technical indicators
    if (features.rsi_14 > 70) reasons.push('RSI overbought');
    if (features.rsi_14 < 30) reasons.push('RSI oversold');
    if (features.macd > 0) reasons.push('MACD bullish');
    if (features.macd < 0) reasons.push('MACD bearish');
    
    // Model confidence
    if (ensemble.confidence > 0.8) reasons.push('high model confidence');
    if (ensemble.confidence < 0.5) reasons.push('low model confidence');
    
    // Volatility
    if (features.volatility_24h > 0.05) reasons.push('high volatility');
    
    // Sentiment
    if (features.sentiment_composite > 0.5) reasons.push('positive sentiment');
    if (features.sentiment_composite < -0.5) reasons.push('negative sentiment');
    
    return reasons.join(', ') || 'mixed signals';
  }
}

/**
 * Decision Engine
 * Makes trading decisions based on signals and risk management
 */
class DecisionEngine extends EventEmitter {
  private config: PaperTradingConfig;

  constructor(config: PaperTradingConfig) {
    super();
    this.config = config;
  }

  async evaluateSignal(signal: TradingSignal): Promise<TradingDecision> {
    try {
      // Risk assessment
      const riskAssessment = await this.assessRisk(signal);
      
      if (!riskAssessment.approved) {
        return {
          signalId: signal.id,
          action: 'skip',
          reasoning: `Risk rejected: ${riskAssessment.alerts.join(', ')}`,
          riskAssessment
        };
      }
      
      // Signal quality check
      if (signal.confidence < this.config.riskThreshold) {
        return {
          signalId: signal.id,
          action: 'skip',
          reasoning: `Low confidence: ${(signal.confidence * 100).toFixed(1)}%`,
          riskAssessment
        };
      }
      
      // Calculate position size
      const orderBook = orderBookSimulator.getOrderBook(signal.symbol);
      if (!orderBook) {
        return {
          signalId: signal.id,
          action: 'skip',
          reasoning: 'No market data available',
          riskAssessment
        };
      }
      
      const currentPrice = orderBook.midPrice;
      const sizeResult = riskManagementService.calculatePositionSize(
        signal.symbol,
        {
          symbol: signal.symbol,
          timestamp: signal.timestamp,
          timeframe: '4h',
          prediction: signal.signal === 'buy' ? signal.strength : -signal.strength,
          confidence: signal.confidence,
          probability: { up: 0.6, down: 0.4, sideways: 0 },
          features: [],
          modelVersion: 'ensemble'
        },
        currentPrice,
        await featureEngineeringService.generateFeatureVector(signal.symbol, Date.now(), '4h')
      );
      
      if (sizeResult.recommendedSize <= 0) {
        return {
          signalId: signal.id,
          action: 'skip',
          reasoning: 'Zero position size recommended',
          riskAssessment
        };
      }
      
      // Create order parameters
      const orderParams = {
        symbol: signal.symbol,
        side: signal.signal as 'buy' | 'sell',
        type: 'limit' as const,
        quantity: sizeResult.recommendedSize,
        price: signal.targetPrice || currentPrice
      };
      
      return {
        signalId: signal.id,
        action: 'execute',
        reasoning: `Signal strength: ${(signal.strength * 100).toFixed(1)}%, confidence: ${(signal.confidence * 100).toFixed(1)}%`,
        orderParams,
        riskAssessment
      };
      
    } catch (error) {
      logger.error(`[DecisionEngine] Error evaluating signal ${signal.id}:`, error as Error);
      
      return {
        signalId: signal.id,
        action: 'skip',
        reasoning: `Evaluation error: ${(error as Error).message}`,
        riskAssessment: {
          approved: false,
          riskScore: 1.0,
          alerts: ['Evaluation failed']
        }
      };
    }
  }

  private async assessRisk(signal: TradingSignal): Promise<{
    approved: boolean;
    riskScore: number;
    alerts: string[];
  }> {
    
    const alerts: string[] = [];
    let riskScore = 0;
    
    // Check portfolio risk
    const portfolioRisk = riskManagementService.getPortfolioRisk();
    const riskParams = riskManagementService.getRiskParameters();
    
    // Daily loss limit check
    const dailyLossPercent = portfolioRisk.dailyPnL / portfolioRisk.totalValue;
    if (dailyLossPercent <= -riskParams.dailyLossLimit) {
      alerts.push('Daily loss limit exceeded');
      riskScore += 0.5;
    }
    
    // Drawdown check
    if (portfolioRisk.maxDrawdown > 0.1) {
      alerts.push('High drawdown detected');
      riskScore += 0.3;
    }
    
    // Volatility check
    if (signal.features.volatilityScore > 0.05) {
      alerts.push('High volatility');
      riskScore += 0.2;
    }
    
    // Correlation check (simplified)
    const positions = riskManagementService.getPositions();
    const existingSymbol = positions.find(p => p.symbol === signal.symbol);
    if (existingSymbol) {
      alerts.push('Existing position in symbol');
      riskScore += 0.1;
    }
    
    // Check active alerts
    const activeAlerts = riskAlertService.getActiveAlerts();
    const emergencyAlerts = activeAlerts.filter(a => a.level === 'emergency');
    if (emergencyAlerts.length > 0) {
      alerts.push('Emergency alerts active');
      riskScore += 0.8;
    }
    
    return {
      approved: riskScore < 0.8,
      riskScore,
      alerts
    };
  }
}

/**
 * Paper Trading Engine
 * Main orchestrator for real-time paper trading
 */
export class PaperTradingEngine extends EventEmitter {
  private isInitialized = false;
  private currentSession?: TradingSession;
  private signalGenerator?: SignalGenerator;
  private decisionEngine?: DecisionEngine;
  private config: PaperTradingConfig;

  constructor(config: PaperTradingConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('[PaperTrading] Initializing paper trading engine');
      
      // Initialize dependencies
      await executionEngine.initialize();
      await riskManagementService.initialize();
      await riskAlertService.initialize();
      await orderBookSimulator.initialize();
      
      // Initialize components
      this.signalGenerator = new SignalGenerator(this.config);
      this.decisionEngine = new DecisionEngine(this.config);
      
      // Set up event handlers
      this.setupEventHandlers();
      
      this.isInitialized = true;
      logger.info('[PaperTrading] Paper trading engine initialized');
      
    } catch (error) {
      logger.error('[PaperTrading] Initialization failed:', error as Error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.signalGenerator || !this.decisionEngine) return;

    // Handle signals
    this.signalGenerator.on('signal', async (signal: TradingSignal) => {
      await this.handleSignal(signal);
    });

    // Handle order executions
    executionEngine.on('orderFilled', (order, result) => {
      this.handleOrderFilled(order, result);
    });

    // Handle risk alerts
    riskAlertService.on('riskAlert', (alert) => {
      this.handleRiskAlert(alert);
    });

    riskAlertService.on('emergencyStop', () => {
      this.handleEmergencyStop();
    });
  }

  async startTrading(sessionConfig?: Partial<TradingSession>): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Paper trading engine not initialized');
    }

    if (this.currentSession && this.currentSession.status === 'active') {
      throw new Error('Trading session already active');
    }

    const sessionId = `session_${Date.now()}`;
    
    this.currentSession = {
      id: sessionId,
      startTime: Date.now(),
      status: 'active',
      strategy: this.config.strategy,
      symbols: this.config.symbols,
      initialCapital: this.config.initialCapital,
      currentValue: this.config.initialCapital,
      totalPnL: 0,
      totalTrades: 0,
      winRate: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      tradingSignals: [],
      executedTrades: [],
      ...sessionConfig
    };

    // Update risk management with initial capital
    riskManagementService.updatePortfolioValue(this.config.initialCapital);

    // Start signal generation
    this.signalGenerator?.start();

    logger.info(`[PaperTrading] Trading session started: ${sessionId}`);
    this.emit('sessionStarted', this.currentSession);

    return sessionId;
  }

  stopTrading(): void {
    if (!this.currentSession || this.currentSession.status !== 'active') {
      return;
    }

    this.currentSession.status = 'stopped';
    this.currentSession.endTime = Date.now();

    // Stop signal generation
    this.signalGenerator?.stop();

    // Calculate final metrics
    this.updateSessionMetrics();

    logger.info(`[PaperTrading] Trading session stopped: ${this.currentSession.id}`);
    this.emit('sessionStopped', this.currentSession);
  }

  pauseTrading(): void {
    if (!this.currentSession || this.currentSession.status !== 'active') {
      return;
    }

    this.currentSession.status = 'paused';
    this.signalGenerator?.stop();

    logger.info(`[PaperTrading] Trading session paused: ${this.currentSession.id}`);
    this.emit('sessionPaused', this.currentSession);
  }

  resumeTrading(): void {
    if (!this.currentSession || this.currentSession.status !== 'paused') {
      return;
    }

    this.currentSession.status = 'active';
    this.signalGenerator?.start();

    logger.info(`[PaperTrading] Trading session resumed: ${this.currentSession.id}`);
    this.emit('sessionResumed', this.currentSession);
  }

  private async handleSignal(signal: TradingSignal): Promise<void> {
    if (!this.currentSession || this.currentSession.status !== 'active') {
      return;
    }

    logger.info(`[PaperTrading] Signal received: ${signal.symbol} ${signal.signal} (${(signal.confidence * 100).toFixed(1)}%)`);

    // Add to session
    this.currentSession.tradingSignals.push(signal);

    // Make decision
    const decision = await this.decisionEngine!.evaluateSignal(signal);
    
    logger.info(`[PaperTrading] Decision: ${decision.action} - ${decision.reasoning}`);
    this.emit('tradingDecision', decision);

    // Execute if approved
    if (decision.action === 'execute' && decision.orderParams && this.config.enableAutoExecution) {
      await this.executeOrder(decision.orderParams);
    }
  }

  private async executeOrder(orderParams: {
    symbol: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit';
    quantity: number;
    price?: number;
  }): Promise<void> {
    
    try {
      const { orderId, sorResult } = await executionEngine.submitOrder(orderParams);
      
      logger.info(`[PaperTrading] Order submitted: ${orderId} - ${orderParams.side} ${orderParams.quantity} ${orderParams.symbol}`);
      this.emit('orderSubmitted', { orderId, orderParams, sorResult });
      
    } catch (error) {
      logger.error('[PaperTrading] Order execution failed:', error as Error);
      this.emit('orderRejected', { orderParams, error: (error as Error).message });
    }
  }

  private handleOrderFilled(order: any, result: ExecutionResult): void {
    if (!this.currentSession) return;

    // Add to session history
    this.currentSession.executedTrades.push(result);
    this.currentSession.totalTrades++;

    // Update session metrics
    this.updateSessionMetrics();

    logger.info(`[PaperTrading] Order filled: ${result.orderId} - P&L: ${result.totalQuantity * (result.averagePrice - (order.entryPrice || result.averagePrice))}`);
    this.emit('orderFilled', result);
  }

  private handleRiskAlert(alert: any): void {
    logger.warn(`[PaperTrading] Risk alert: ${alert.level} - ${alert.message}`);
    
    if (alert.level === 'emergency') {
      this.pauseTrading();
    }
    
    this.emit('riskAlert', alert);
  }

  private handleEmergencyStop(): void {
    logger.error('[PaperTrading] Emergency stop triggered');
    this.stopTrading();
    this.emit('emergencyStop');
  }

  private updateSessionMetrics(): void {
    if (!this.currentSession) return;

    const portfolioRisk = riskManagementService.getPortfolioRisk();
    const trades = this.currentSession.executedTrades;
    
    // Update current value and P&L
    this.currentSession.currentValue = portfolioRisk.totalValue;
    this.currentSession.totalPnL = portfolioRisk.totalValue - this.currentSession.initialCapital;
    
    // Calculate win rate
    const profitableTrades = trades.filter(t => t.totalQuantity > 0); // Simplified
    this.currentSession.winRate = trades.length > 0 ? profitableTrades.length / trades.length : 0;
    
    // Update risk metrics
    this.currentSession.sharpeRatio = portfolioRisk.sharpeRatio;
    this.currentSession.maxDrawdown = portfolioRisk.maxDrawdown;
  }

  getCurrentSession(): TradingSession | undefined {
    return this.currentSession;
  }

  getSessionMetrics(): {
    session?: TradingSession;
    portfolio: any;
    positions: any[];
    signals: TradingSignal[];
    recentTrades: ExecutionResult[];
  } {
    
    const portfolioRisk = riskManagementService.getPortfolioRisk();
    const positions = riskManagementService.getPositions();
    const recentTrades = executionEngine.getExecutionHistory(10);
    const signals = this.currentSession?.tradingSignals.slice(-20) || [];
    
    return {
      session: this.currentSession,
      portfolio: portfolioRisk,
      positions,
      signals,
      recentTrades
    };
  }

  updateConfig(newConfig: Partial<PaperTradingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('[PaperTrading] Configuration updated');
  }

  cleanup(): void {
    this.stopTrading();
    this.signalGenerator?.stop();
    this.removeAllListeners();
    logger.info('[PaperTrading] Engine cleaned up');
  }
}

// Default configuration
export const defaultPaperTradingConfig: PaperTradingConfig = {
  symbols: ['BTC', 'ETH', 'SOL'],
  strategy: 'ensemble_ml',
  initialCapital: 100000,
  maxPositionSize: 0.05,
  dailyLossLimit: 0.02,
  signalUpdateInterval: 60000, // 1 minute
  enableAutoExecution: true,
  riskThreshold: 0.6,
  modelEnsemble: ['tcn_4h', 'lstm_4h', 'transformer_4h']
};

// Singleton instance
export const paperTradingEngine = new PaperTradingEngine(defaultPaperTradingConfig);