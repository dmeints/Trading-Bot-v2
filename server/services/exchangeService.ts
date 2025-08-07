/**
 * PHASE 7: EXCHANGE SERVICE - REAL-TIME PAPER-RUN & CANARY DEPLOYMENT
 * Live/testnet trading with kill-switch and canary deployment capabilities
 */

import { featureService } from './featureService';
import { simulationEngine, SimulationConfig } from './simulationEngine';
import { taService } from './taService';
import { logger } from '../utils/logger';
import fs from 'fs/promises';

export interface ExchangeConfig {
  mode: 'paper' | 'live' | 'testnet';
  exchange: 'binance' | 'coinbase' | 'mock';
  apiKey?: string;
  apiSecret?: string;
  testnet: boolean;
  maxPositionSize: number;
  riskPerTrade: number;
  killSwitchEnabled: boolean;
  killSwitchConditions: {
    maxDailyLoss: number;
    maxDrawdown: number;
    minWinRate: number;
  };
}

export interface PaperRunConfig {
  duration: number; // days
  initialBalance: number;
  symbols: string[];
  warmupDays: number;
  canaryPercentage: number; // 0-100
  monitoringInterval: number; // milliseconds
}

export interface PaperRunResult {
  runId: string;
  startTime: number;
  endTime: number;
  duration: number;
  performance: {
    totalReturn: number;
    sharpeRatio: number;
    winRate: number;
    maxDrawdown: number;
    totalTrades: number;
    avgTradeReturn: number;
    finalBalance: number;
    dailyReturns: number[];
  };
  riskMetrics: {
    var95: number; // Value at Risk
    var99: number;
    expectedShortfall: number;
    calmarRatio: number;
    sortinoRatio: number;
  };
  canaryResults?: {
    canaryPerformance: number;
    fullDeploymentRecommended: boolean;
    riskAssessment: string;
  };
  status: 'warming_up' | 'running' | 'completed' | 'failed' | 'killed';
  killSwitchTriggered?: {
    timestamp: number;
    reason: string;
    conditions: any;
  };
}

export interface TradeOrder {
  id: string;
  symbol: string;
  type: 'market' | 'limit' | 'stop';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
  stopPrice?: number;
  timestamp: number;
  status: 'pending' | 'filled' | 'cancelled' | 'failed';
  fillPrice?: number;
  fillAmount?: number;
  commission?: number;
}

export class ExchangeService {
  private config: ExchangeConfig;
  private currentRun: PaperRunResult | null = null;
  private runTimer?: NodeJS.Timeout;
  private orders: Map<string, TradeOrder> = new Map();
  private positions: Map<string, { symbol: string; size: number; avgPrice: number }> = new Map();
  private isKillSwitchActive = false;

  constructor(config: ExchangeConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    logger.info('🚀 Initializing Exchange Service', {
      mode: this.config.mode,
      exchange: this.config.exchange,
      killSwitch: this.config.killSwitchEnabled
    });

    // Validate configuration
    await this.validateConfig();
    
    // Initialize connection (mock for now)
    await this.connectToExchange();
    
    logger.info('✅ Exchange Service initialized');
  }

  async startPaperRun(config: PaperRunConfig): Promise<string> {
    if (this.currentRun && this.currentRun.status === 'running') {
      throw new Error('Paper run already in progress');
    }

    const runId = `paper_run_${Date.now()}`;
    
    logger.info('📊 Starting paper run', {
      runId,
      duration: config.duration + ' days',
      symbols: config.symbols,
      initialBalance: config.initialBalance
    });

    // Initialize paper run
    this.currentRun = {
      runId,
      startTime: Date.now(),
      endTime: Date.now() + (config.duration * 24 * 60 * 60 * 1000),
      duration: config.duration,
      performance: {
        totalReturn: 0,
        sharpeRatio: 0,
        winRate: 0,
        maxDrawdown: 0,
        totalTrades: 0,
        avgTradeReturn: 0,
        finalBalance: config.initialBalance,
        dailyReturns: []
      },
      riskMetrics: {
        var95: 0,
        var99: 0,
        expectedShortfall: 0,
        calmarRatio: 0,
        sortinoRatio: 0
      },
      status: 'warming_up'
    };

    // Start warmup period
    await this.runWarmupPhase(config);
    
    // Begin main paper run
    await this.executeMainPaperRun(config);

    return runId;
  }

  private async runWarmupPhase(config: PaperRunConfig): Promise<void> {
    logger.info(`🔥 Starting ${config.warmupDays}-day warmup phase`);
    
    this.currentRun!.status = 'warming_up';
    
    // Simulate warmup period with data ingestion and model calibration
    const warmupConfig: SimulationConfig[] = config.symbols.map(symbol => ({
      symbol,
      startTime: Date.now() - (config.warmupDays * 24 * 60 * 60 * 1000),
      endTime: Date.now(),
      initialBalance: config.initialBalance / config.symbols.length,
      timeStep: 60 * 60 * 1000, // 1 hour
      riskPerTrade: this.config.riskPerTrade,
      maxPositionSize: this.config.maxPositionSize,
      commission: 0.001
    }));

    // Run warmup simulations
    const warmupResults = await simulationEngine.runBatchSimulation(warmupConfig);
    const warmupStats = await simulationEngine.getSimulationStatistics(warmupResults);
    
    logger.info('✅ Warmup completed', {
      avgReturn: warmupStats.avgReturn.toFixed(2) + '%',
      avgSharpe: warmupStats.avgSharpe.toFixed(2),
      consistency: warmupStats.consistency.toFixed(2)
    });
    
    // Proceed to main run if warmup successful
    if (warmupStats.avgSharpe > 0.5) {
      logger.info('🎯 Warmup successful, proceeding to main run');
    } else {
      logger.warn('⚠️ Warmup performance below target, adjusting parameters');
      // Adjust risk parameters
      this.config.riskPerTrade *= 0.8;
      this.config.maxPositionSize *= 0.9;
    }
  }

  private async executeMainPaperRun(config: PaperRunConfig): Promise<void> {
    this.currentRun!.status = 'running';
    logger.info('🏃 Main paper run started');

    // Set up monitoring interval
    this.runTimer = setInterval(async () => {
      try {
        await this.monitoringCycle(config);
      } catch (error) {
        logger.error('Monitoring cycle failed:', error as Record<string, any>);
      }
    }, config.monitoringInterval);

    // Canary deployment if configured
    if (config.canaryPercentage > 0 && config.canaryPercentage < 100) {
      await this.runCanaryDeployment(config);
    }
  }

  private async monitoringCycle(config: PaperRunConfig): Promise<void> {
    if (!this.currentRun || this.currentRun.status !== 'running') return;

    // Check kill switch conditions
    if (this.config.killSwitchEnabled) {
      const killSwitchTriggered = await this.checkKillSwitchConditions();
      if (killSwitchTriggered) {
        await this.triggerKillSwitch(killSwitchTriggered.reason, killSwitchTriggered.conditions);
        return;
      }
    }

    // Generate trading signals for each symbol
    for (const symbol of config.symbols) {
      try {
        await this.processSymbol(symbol);
      } catch (error) {
        logger.error(`Failed to process ${symbol}:`, error as Record<string, any>);
      }
    }

    // Update performance metrics
    await this.updatePerformanceMetrics();

    // Check if run is complete
    if (Date.now() >= this.currentRun.endTime) {
      await this.completePaperRun();
    }
  }

  private async processSymbol(symbol: string): Promise<void> {
    // Get current market features
    const features = await featureService.getFeatures(symbol);
    
    // Get TA recommendation
    const analysis = await taService.getFullAnalysis(symbol);
    
    // Generate trading decision
    const decision = this.generateTradingDecision(features, analysis);
    
    if (decision.action !== 'hold') {
      await this.executeTrade(symbol, decision);
    }
  }

  private generateTradingDecision(features: any, analysis: any): { action: 'buy' | 'sell' | 'hold'; confidence: number; size: number } {
    const technicalScore = this.scoreTechnicalAnalysis(analysis.technical);
    const sentimentScore = analysis.sentiment.sentiment.overall_score;
    const fusionScore = analysis.fusion.confidence;
    
    // Combined signal strength
    const signalStrength = (technicalScore * 0.6) + (sentimentScore * 0.3) + (fusionScore * 0.1);
    
    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = Math.abs(signalStrength);
    
    if (signalStrength > 0.3) {
      action = 'buy';
    } else if (signalStrength < -0.3) {
      action = 'sell';
    }
    
    // Risk-adjusted position sizing
    const volatilityAdjustment = Math.max(0.5, 1 - (features.volatility_24h / 100));
    const baseSize = this.config.riskPerTrade * confidence;
    const adjustedSize = Math.min(this.config.maxPositionSize, baseSize * volatilityAdjustment);
    
    return { action, confidence, size: adjustedSize };
  }

  private scoreTechnicalAnalysis(technical: any): number {
    let score = 0;
    
    if (technical.analysis.trend === 'bullish') score += 0.3;
    else if (technical.analysis.trend === 'bearish') score -= 0.3;
    
    if (technical.analysis.indicators.rsi_signal === 'oversold') score += 0.2;
    else if (technical.analysis.indicators.rsi_signal === 'overbought') score -= 0.2;
    
    if (technical.analysis.indicators.macd_signal === 'bullish') score += 0.2;
    else if (technical.analysis.indicators.macd_signal === 'bearish') score -= 0.2;
    
    return score * technical.analysis.confidence;
  }

  private async executeTrade(symbol: string, decision: any): Promise<void> {
    const order: TradeOrder = {
      id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol,
      type: 'market',
      side: decision.action,
      amount: decision.size,
      timestamp: Date.now(),
      status: 'pending'
    };

    logger.info(`📈 Executing ${decision.action} order for ${symbol}`, {
      size: decision.size.toFixed(4),
      confidence: (decision.confidence * 100).toFixed(1) + '%'
    });

    // Store order
    this.orders.set(order.id, order);
    
    // Simulate order execution (in real implementation, would call exchange API)
    await this.simulateOrderFill(order);
    
    // Update positions
    await this.updatePosition(symbol, order);
    
    // Record trade
    this.currentRun!.performance.totalTrades++;
  }

  private async simulateOrderFill(order: TradeOrder): Promise<void> {
    // Simulate market order fill with small slippage
    const slippage = (Math.random() - 0.5) * 0.002; // ±0.1% slippage
    const features = await featureService.getFeatures(order.symbol);
    
    order.fillPrice = features.price * (1 + slippage);
    order.fillAmount = order.amount;
    order.commission = order.amount * order.fillPrice! * 0.001; // 0.1% commission
    order.status = 'filled';
    
    logger.info(`✅ Order filled`, {
      id: order.id,
      symbol: order.symbol,
      side: order.side,
      price: order.fillPrice?.toFixed(2),
      amount: order.fillAmount?.toFixed(4)
    });
  }

  private async updatePosition(symbol: string, order: TradeOrder): Promise<void> {
    const currentPosition = this.positions.get(symbol) || { symbol, size: 0, avgPrice: 0 };
    
    if (order.side === 'buy') {
      const newSize = currentPosition.size + order.fillAmount!;
      const newAvgPrice = ((currentPosition.avgPrice * currentPosition.size) + 
                          (order.fillPrice! * order.fillAmount!)) / newSize;
      
      this.positions.set(symbol, { symbol, size: newSize, avgPrice: newAvgPrice });
    } else {
      // Sell order
      const newSize = Math.max(0, currentPosition.size - order.fillAmount!);
      this.positions.set(symbol, { symbol, size: newSize, avgPrice: currentPosition.avgPrice });
    }
  }

  private async checkKillSwitchConditions(): Promise<{ reason: string; conditions: any } | null> {
    if (!this.currentRun) return null;

    const conditions = this.config.killSwitchConditions;
    const performance = this.currentRun.performance;
    
    // Check daily loss limit
    if (performance.totalReturn < -conditions.maxDailyLoss) {
      return {
        reason: `Daily loss limit exceeded: ${performance.totalReturn.toFixed(2)}% < -${conditions.maxDailyLoss}%`,
        conditions: { dailyLoss: performance.totalReturn }
      };
    }
    
    // Check drawdown limit  
    if (performance.maxDrawdown > conditions.maxDrawdown) {
      return {
        reason: `Max drawdown exceeded: ${performance.maxDrawdown.toFixed(2)}% > ${conditions.maxDrawdown}%`,
        conditions: { drawdown: performance.maxDrawdown }
      };
    }
    
    // Check minimum win rate
    if (performance.totalTrades > 10 && performance.winRate < conditions.minWinRate) {
      return {
        reason: `Win rate below minimum: ${performance.winRate.toFixed(1)}% < ${conditions.minWinRate}%`,
        conditions: { winRate: performance.winRate, trades: performance.totalTrades }
      };
    }
    
    return null;
  }

  private async triggerKillSwitch(reason: string, conditions: any): Promise<void> {
    this.isKillSwitchActive = true;
    
    logger.error('🚨 KILL SWITCH TRIGGERED', { reason, conditions });
    
    // Close all positions immediately
    for (const position of this.positions.values()) {
      if (position.size > 0) {
        await this.executeTrade(position.symbol, { action: 'sell', confidence: 1.0, size: position.size });
      }
    }
    
    // Stop monitoring
    if (this.runTimer) {
      clearInterval(this.runTimer);
    }
    
    // Update run status
    this.currentRun!.status = 'killed';
    this.currentRun!.killSwitchTriggered = {
      timestamp: Date.now(),
      reason,
      conditions
    };
    
    await this.savePaperRunResults();
  }

  private async runCanaryDeployment(config: PaperRunConfig): Promise<void> {
    logger.info(`🐤 Running canary deployment at ${config.canaryPercentage}% capacity`);
    
    const canaryDuration = Math.min(7, config.duration * 0.3); // Max 7 days or 30% of total
    const canaryEndTime = Date.now() + (canaryDuration * 24 * 60 * 60 * 1000);
    
    // Reduce position sizes for canary
    const originalRiskPerTrade = this.config.riskPerTrade;
    const originalMaxPosition = this.config.maxPositionSize;
    
    this.config.riskPerTrade *= (config.canaryPercentage / 100);
    this.config.maxPositionSize *= (config.canaryPercentage / 100);
    
    // Monitor canary performance
    const canaryStartBalance = this.currentRun!.performance.finalBalance;
    
    // Wait for canary period
    while (Date.now() < canaryEndTime && this.currentRun!.status === 'running') {
      await this.sleep(60000); // Check every minute
    }
    
    const canaryEndBalance = this.currentRun!.performance.finalBalance;
    const canaryReturn = ((canaryEndBalance - canaryStartBalance) / canaryStartBalance) * 100;
    
    // Evaluate canary results
    const canaryResults = {
      canaryPerformance: canaryReturn,
      fullDeploymentRecommended: canaryReturn > 1.0 && this.currentRun!.performance.winRate > 60,
      riskAssessment: canaryReturn > 2 ? 'low' : canaryReturn > 0 ? 'medium' : 'high'
    };
    
    this.currentRun!.canaryResults = canaryResults;
    
    if (canaryResults.fullDeploymentRecommended) {
      logger.info('✅ Canary successful, scaling to full deployment');
      this.config.riskPerTrade = originalRiskPerTrade;
      this.config.maxPositionSize = originalMaxPosition;
    } else {
      logger.warn('⚠️ Canary performance below threshold, maintaining reduced capacity');
    }
  }

  private async updatePerformanceMetrics(): Promise<void> {
    if (!this.currentRun) return;

    // Calculate current portfolio value
    let totalValue = this.currentRun.performance.finalBalance;
    
    for (const position of this.positions.values()) {
      if (position.size > 0) {
        const features = await featureService.getFeatures(position.symbol);
        totalValue += position.size * features.price;
      }
    }
    
    const initialBalance = this.currentRun.performance.finalBalance; // Would be actual initial balance
    const totalReturn = ((totalValue - initialBalance) / initialBalance) * 100;
    
    this.currentRun.performance.totalReturn = totalReturn;
    this.currentRun.performance.finalBalance = totalValue;
    
    // Update other metrics (simplified)
    if (this.currentRun.performance.totalTrades > 0) {
      this.currentRun.performance.avgTradeReturn = totalReturn / this.currentRun.performance.totalTrades;
    }
    
    // Calculate Sharpe ratio (simplified)
    this.currentRun.performance.sharpeRatio = Math.max(0, totalReturn / 10); // Simplified calculation
  }

  private async completePaperRun(): Promise<void> {
    if (!this.currentRun) return;
    
    logger.info('🏁 Paper run completed');
    
    // Stop monitoring
    if (this.runTimer) {
      clearInterval(this.runTimer);
    }
    
    // Close all positions
    for (const position of this.positions.values()) {
      if (position.size > 0) {
        await this.executeTrade(position.symbol, { action: 'sell', confidence: 1.0, size: position.size });
      }
    }
    
    // Calculate final metrics
    await this.calculateFinalRiskMetrics();
    
    this.currentRun.status = 'completed';
    
    // Save results
    await this.savePaperRunResults();
    
    logger.info('📊 Paper run final results', {
      totalReturn: this.currentRun.performance.totalReturn.toFixed(2) + '%',
      sharpeRatio: this.currentRun.performance.sharpeRatio.toFixed(2),
      winRate: this.currentRun.performance.winRate.toFixed(1) + '%',
      totalTrades: this.currentRun.performance.totalTrades
    });
  }

  private async calculateFinalRiskMetrics(): Promise<void> {
    if (!this.currentRun) return;
    
    const dailyReturns = this.currentRun.performance.dailyReturns;
    
    if (dailyReturns.length > 1) {
      // Value at Risk calculations
      const sortedReturns = [...dailyReturns].sort((a, b) => a - b);
      this.currentRun.riskMetrics.var95 = sortedReturns[Math.floor(sortedReturns.length * 0.05)];
      this.currentRun.riskMetrics.var99 = sortedReturns[Math.floor(sortedReturns.length * 0.01)];
      
      // Expected shortfall
      const var95Index = Math.floor(sortedReturns.length * 0.05);
      this.currentRun.riskMetrics.expectedShortfall = sortedReturns
        .slice(0, var95Index)
        .reduce((sum, ret) => sum + ret, 0) / var95Index;
      
      // Calmar ratio
      if (this.currentRun.performance.maxDrawdown > 0) {
        this.currentRun.riskMetrics.calmarRatio = 
          this.currentRun.performance.totalReturn / this.currentRun.performance.maxDrawdown;
      }
    }
  }

  private async savePaperRunResults(): Promise<void> {
    if (!this.currentRun) return;
    
    const resultsPath = `./paper-runs/${this.currentRun.runId}_results.json`;
    await fs.mkdir('./paper-runs', { recursive: true });
    await fs.writeFile(resultsPath, JSON.stringify(this.currentRun, null, 2));
    
    logger.info(`💾 Paper run results saved: ${resultsPath}`);
  }

  private async validateConfig(): Promise<void> {
    if (this.config.mode === 'live' && !this.config.apiKey) {
      throw new Error('API key required for live trading');
    }
    
    if (this.config.riskPerTrade > 0.1) {
      logger.warn('Risk per trade is high: ' + (this.config.riskPerTrade * 100) + '%');
    }
  }

  private async connectToExchange(): Promise<void> {
    if (this.config.exchange === 'mock') {
      logger.info('✅ Connected to mock exchange');
      return;
    }
    
    // Would implement actual exchange connections here
    logger.info(`✅ Connected to ${this.config.exchange} (${this.config.testnet ? 'testnet' : 'live'})`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API methods
  
  async getCurrentRun(): Promise<PaperRunResult | null> {
    return this.currentRun;
  }

  async getRunHistory(): Promise<PaperRunResult[]> {
    try {
      const files = await fs.readdir('./paper-runs');
      const results: PaperRunResult[] = [];
      
      for (const file of files.filter(f => f.endsWith('_results.json'))) {
        const data = await fs.readFile(`./paper-runs/${file}`, 'utf8');
        results.push(JSON.parse(data));
      }
      
      return results.sort((a, b) => b.startTime - a.startTime);
    } catch {
      return [];
    }
  }

  async stopCurrentRun(reason: string = 'Manual stop'): Promise<void> {
    if (this.currentRun && this.currentRun.status === 'running') {
      await this.triggerKillSwitch(reason, { manual: true });
    }
  }

  async getPositions(): Promise<Map<string, { symbol: string; size: number; avgPrice: number }>> {
    return new Map(this.positions);
  }

  async getOrders(): Promise<TradeOrder[]> {
    return Array.from(this.orders.values());
  }

  async updateConfig(newConfig: Partial<ExchangeConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    logger.info('⚙️ Exchange configuration updated', newConfig);
  }
}

export default ExchangeService;