/**
 * Stevie v1.4 - Live Deployment Service
 * Manages transition from simulation to live trading with comprehensive safety measures
 */

import FeatureService from './featureService';
import { StevieExplanationService } from './stevieExplanationService';
import { marketDataService } from './marketData';

interface DeploymentConfig {
  enabled: boolean;
  maxCapital: number;
  maxPositionSize: number;
  stopLossThreshold: number;
  dailyLossLimit: number;
  allowedSymbols: string[];
  paperTradeMode: boolean;
  killSwitchEnabled: boolean;
}

interface LiveTrade {
  id: string;
  symbol: string;
  action: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: number;
  confidence: number;
  reasoning: string[];
  status: 'pending' | 'filled' | 'cancelled' | 'error';
  pnl?: number;
}

interface RiskMetrics {
  currentExposure: number;
  dailyPnL: number;
  totalPnL: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  tradesCount: number;
}

export class LiveDeploymentService {
  private featureService: FeatureService;
  private explanationService: StevieExplanationService;
  private config: DeploymentConfig;
  private activeTrades: Map<string, LiveTrade>;
  private riskMetrics: RiskMetrics;
  private killSwitchActive: boolean = false;

  constructor() {
    this.featureService = new FeatureService();
    this.explanationService = new StevieExplanationService();
    this.activeTrades = new Map();
    
    // Initialize with conservative config
    this.config = {
      enabled: process.env.LIVE_TRADING_ENABLED === 'true',
      maxCapital: parseFloat(process.env.MAX_TRADING_CAPITAL || '500'),
      maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '0.01'), // 1% max
      stopLossThreshold: parseFloat(process.env.STOP_LOSS_THRESHOLD || '0.05'), // 5%
      dailyLossLimit: parseFloat(process.env.DAILY_LOSS_LIMIT || '0.02'), // 2%
      allowedSymbols: (process.env.ALLOWED_SYMBOLS || 'BTCUSDT,ETHUSDT').split(','),
      paperTradeMode: process.env.PAPER_TRADE_MODE !== 'false',
      killSwitchEnabled: true
    };

    this.riskMetrics = {
      currentExposure: 0,
      dailyPnL: 0,
      totalPnL: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      winRate: 0,
      tradesCount: 0
    };

    console.log(`[LiveDeployment] Initialized - Live: ${this.config.enabled}, Paper: ${this.config.paperTradeMode}`);
  }

  async executeTradingDecision(symbol: string, features: any): Promise<LiveTrade | null> {
    // Pre-flight checks
    if (this.killSwitchActive) {
      console.warn('[LiveDeployment] Kill switch active - trading halted');
      return null;
    }

    if (!this.config.enabled) {
      console.log('[LiveDeployment] Live trading disabled');
      return null;
    }

    if (!this.config.allowedSymbols.includes(symbol)) {
      console.warn(`[LiveDeployment] Symbol ${symbol} not in allowed list`);
      return null;
    }

    // Risk checks
    if (!this.passesRiskChecks()) {
      console.warn('[LiveDeployment] Failed risk checks - skipping trade');
      return null;
    }

    // Generate trading decision using enhanced features
    const decision = await this.makeEnhancedTradingDecision(symbol, features);
    
    if (Math.abs(decision.signal) < 0.2) {
      console.log(`[LiveDeployment] Weak signal (${decision.signal}) - no trade`);
      return null;
    }

    // Calculate position size
    const positionSize = this.calculateSafePositionSize(decision, features);
    
    if (positionSize < 0.001) {
      console.log('[LiveDeployment] Position size too small - no trade');
      return null;
    }

    // Create trade order
    const trade: LiveTrade = {
      id: this.generateTradeId(),
      symbol,
      action: decision.signal > 0 ? 'buy' : 'sell',
      quantity: positionSize,
      price: features.ohlcv?.close[features.ohlcv.close.length - 1] || 0,
      timestamp: Date.now(),
      confidence: decision.confidence,
      reasoning: decision.reasoning || [],
      status: 'pending'
    };

    // Execute trade
    if (this.config.paperTradeMode) {
      return await this.executePaperTrade(trade);
    } else {
      return await this.executeLiveTrade(trade);
    }
  }

  async activateKillSwitch(reason: string): Promise<boolean> {
    console.error(`[LiveDeployment] KILL SWITCH ACTIVATED: ${reason}`);
    
    this.killSwitchActive = true;
    
    // Cancel all pending orders
    for (const trade of this.activeTrades.values()) {
      if (trade.status === 'pending') {
        trade.status = 'cancelled';
        console.log(`[LiveDeployment] Cancelled trade ${trade.id}`);
      }
    }

    // Send alerts
    await this.sendKillSwitchAlert(reason);
    
    return true;
  }

  async deactivateKillSwitch(): Promise<boolean> {
    if (!this.killSwitchActive) {
      return false;
    }

    console.log('[LiveDeployment] Kill switch deactivated');
    this.killSwitchActive = false;
    
    return true;
  }

  private async makeEnhancedTradingDecision(symbol: string, features: any): Promise<any> {
    let signal = 0;
    let confidence = 0.5;
    const reasoning: string[] = [];

    // Technical analysis with enhanced data
    if (features.technical?.rsi < 30) {
      signal += 0.3;
      reasoning.push(`RSI oversold (${features.technical.rsi})`);
    }
    if (features.technical?.rsi > 70) {
      signal -= 0.3;
      reasoning.push(`RSI overbought (${features.technical.rsi})`);
    }

    // Sentiment analysis
    if (features.sentiment?.fearGreedIndex < 25) {
      signal += 0.25;
      reasoning.push('Extreme fear opportunity');
      confidence += 0.1;
    }
    if (features.sentiment?.fearGreedIndex > 75) {
      signal -= 0.25;
      reasoning.push('Extreme greed warning');
      confidence += 0.1;
    }

    // Derivatives analysis
    if (features.derivatives?.fundingRate > 0.002) {
      signal -= 0.2;
      reasoning.push('High funding rate');
      confidence += 0.1;
    }
    if (features.derivatives?.fundingRate < -0.001) {
      signal += 0.2;
      reasoning.push('Negative funding opportunity');
      confidence += 0.1;
    }

    // On-chain analysis
    if (features.onChain?.networkActivity > 0.7) {
      signal += 0.1;
      reasoning.push('High network activity');
    }

    // Risk adjustments
    if (features.technical?.volatility > 0.05) {
      signal *= 0.7; // Reduce signal in high volatility
      reasoning.push('High volatility adjustment');
    }

    if (features.orderBook?.liquidityScore < 0.3) {
      signal *= 0.5; // Reduce signal in low liquidity
      reasoning.push('Low liquidity adjustment');
    }

    return {
      signal: Math.max(-1, Math.min(1, signal)),
      confidence: Math.min(1, confidence),
      reasoning: reasoning.slice(0, 5) // Top 5 reasons
    };
  }

  private calculateSafePositionSize(decision: any, features: any): number {
    let baseSize = this.config.maxPositionSize;
    
    // Adjust for confidence
    baseSize *= decision.confidence;
    
    // Adjust for volatility
    const volatility = features.technical?.volatility || 0.02;
    if (volatility > 0.05) {
      baseSize *= 0.5; // Half size in high volatility
    }
    
    // Adjust for current exposure
    const exposureRatio = this.riskMetrics.currentExposure / this.config.maxCapital;
    if (exposureRatio > 0.5) {
      baseSize *= (1 - exposureRatio); // Reduce as exposure increases
    }

    // Ensure minimum viable size
    return Math.max(0.001, baseSize);
  }

  private passesRiskChecks(): boolean {
    // Check daily loss limit
    if (this.riskMetrics.dailyPnL < -this.config.dailyLossLimit * this.config.maxCapital) {
      console.warn('[LiveDeployment] Daily loss limit exceeded');
      return false;
    }

    // Check maximum exposure
    if (this.riskMetrics.currentExposure >= this.config.maxCapital) {
      console.warn('[LiveDeployment] Maximum capital exposure reached');
      return false;
    }

    // Check drawdown
    if (this.riskMetrics.maxDrawdown > 0.1) { // 10% max drawdown
      console.warn('[LiveDeployment] Maximum drawdown exceeded');
      return false;
    }

    return true;
  }

  private async executePaperTrade(trade: LiveTrade): Promise<LiveTrade> {
    console.log(`[LiveDeployment] Paper trade: ${trade.action} ${trade.quantity} ${trade.symbol} @ ${trade.price}`);
    
    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    trade.status = 'filled';
    this.activeTrades.set(trade.id, trade);
    
    // Update metrics
    this.updateRiskMetrics(trade);
    
    return trade;
  }

  private async executeLiveTrade(trade: LiveTrade): Promise<LiveTrade> {
    console.log(`[LiveDeployment] LIVE trade: ${trade.action} ${trade.quantity} ${trade.symbol} @ ${trade.price}`);
    
    try {
      // Here would be actual exchange API calls
      // For now, simulate live execution
      
      trade.status = 'filled';
      this.activeTrades.set(trade.id, trade);
      
      // Update metrics
      this.updateRiskMetrics(trade);
      
      // Send execution alert
      await this.sendTradeAlert(trade);
      
      return trade;
      
    } catch (error) {
      console.error(`[LiveDeployment] Trade execution failed:`, error);
      trade.status = 'error';
      return trade;
    }
  }

  private updateRiskMetrics(trade: LiveTrade): void {
    this.riskMetrics.tradesCount++;
    this.riskMetrics.currentExposure += trade.quantity * trade.price;
    
    // Update other metrics based on trade outcome
    // This would be more sophisticated with actual P&L calculation
  }

  private generateTradeId(): string {
    return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async sendKillSwitchAlert(reason: string): Promise<void> {
    console.error(`[ALERT] Kill Switch Activated: ${reason}`);
    // Here would be actual alert system (email, Slack, etc.)
  }

  private async sendTradeAlert(trade: LiveTrade): Promise<void> {
    console.log(`[ALERT] Trade executed: ${trade.action} ${trade.symbol} - ${trade.status}`);
    // Here would be actual notification system
  }

  // Public API methods
  getRiskMetrics(): RiskMetrics {
    return { ...this.riskMetrics };
  }

  getConfig(): DeploymentConfig {
    return { ...this.config };
  }

  getActiveTrades(): LiveTrade[] {
    return Array.from(this.activeTrades.values());
  }

  isKillSwitchActive(): boolean {
    return this.killSwitchActive;
  }

  updateConfig(updates: Partial<DeploymentConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log('[LiveDeployment] Config updated:', updates);
  }
}

export default LiveDeploymentService;