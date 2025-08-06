/**
 * Intelligent Automation Layers - Revolutionary Trading Automation
 * 
 * Auto-rebalancing, dynamic position sizing, and automatic strategy switching
 */

import { storage } from '../storage';
import { logger } from '../utils/logger';
import { tradingEngine } from './tradingEngine';
import { dataFusionEngine } from './dataFusionEngine';
import { adaptiveLearningEngine } from './adaptiveLearning';

export interface AutoRebalanceConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'threshold_based';
  maxDeviation: number;
  minTradeSize: number;
  correlationThreshold: number;
}

export interface DynamicPositionSizing {
  baseSize: number;
  volatilityAdjustment: number;
  regimeMultiplier: number;
  riskBudget: number;
  maxPositionSize: number;
}

export interface StrategySwitch {
  fromStrategy: string;
  toStrategy: string;
  reason: string;
  confidence: number;
  expectedImprovement: number;
  timestamp: Date;
}

export class IntelligentAutomationEngine {
  private rebalanceConfigs: Map<string, AutoRebalanceConfig> = new Map();
  private positionSizingRules: Map<string, DynamicPositionSizing> = new Map();
  private strategySwitchHistory: StrategySwitch[] = [];
  private automationActive = false;

  constructor() {
    this.initializeDefaultConfigs();
  }

  private initializeDefaultConfigs() {
    const defaultRebalanceConfig: AutoRebalanceConfig = {
      enabled: true,
      frequency: 'threshold_based',
      maxDeviation: 0.1, // 10% deviation triggers rebalance
      minTradeSize: 0.01, // Minimum 1% trade size
      correlationThreshold: 0.85 // Rebalance if correlations exceed 85%
    };

    const defaultPositionSizing: DynamicPositionSizing = {
      baseSize: 0.1, // 10% base position
      volatilityAdjustment: 0.5,
      regimeMultiplier: 1.0,
      riskBudget: 0.02, // 2% daily risk budget
      maxPositionSize: 0.25 // Maximum 25% position
    };

    // Set defaults for all users (will be overridden by user preferences)
    this.rebalanceConfigs.set('default', defaultRebalanceConfig);
    this.positionSizingRules.set('default', defaultPositionSizing);
  }

  async enableAutomation(userId: string): Promise<void> {
    try {
      this.automationActive = true;
      
      // Start automation loops
      this.startRebalanceLoop(userId);
      this.startPositionSizingLoop(userId);
      this.startStrategyMonitoringLoop(userId);

      logger.info(`Enabled intelligent automation`, { userId });

    } catch (error) {
      logger.error(`Failed to enable automation`, { userId, error });
    }
  }

  private startRebalanceLoop(userId: string): void {
    setInterval(async () => {
      if (!this.automationActive) return;
      
      try {
        await this.performAutoRebalancing(userId);
      } catch (error) {
        logger.error(`Auto-rebalancing failed`, { userId, error });
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private startPositionSizingLoop(userId: string): void {
    setInterval(async () => {
      if (!this.automationActive) return;
      
      try {
        await this.adjustPositionSizing(userId);
      } catch (error) {
        logger.error(`Position sizing adjustment failed`, { userId, error });
      }
    }, 2 * 60 * 1000); // Every 2 minutes
  }

  private startStrategyMonitoringLoop(userId: string): void {
    setInterval(async () => {
      if (!this.automationActive) return;
      
      try {
        await this.monitorStrategyPerformance(userId);
      } catch (error) {
        logger.error(`Strategy monitoring failed`, { userId, error });
      }
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  async performAutoRebalancing(userId: string): Promise<void> {
    try {
      const config = this.rebalanceConfigs.get(userId) || this.rebalanceConfigs.get('default')!;
      if (!config.enabled) return;

      const portfolio = await storage.getPortfolioSummary(userId);
      if (!portfolio?.positions) return;

      // Get target weights from data fusion engine
      const symbols = portfolio.positions.map((p: any) => p.symbol);
      const targetWeights = await dataFusionEngine.optimizePortfolioWeights(symbols);

      // Calculate current weights
      const totalValue = portfolio.positions.reduce((sum: number, p: any) => sum + (p.value || 0), 0);
      const currentWeights = portfolio.positions.reduce((weights: Record<string, number>, p: any) => {
        weights[p.symbol] = (p.value || 0) / totalValue;
        return weights;
      }, {});

      // Check if rebalancing is needed
      const rebalanceNeeded = this.shouldRebalance(currentWeights, targetWeights, config);
      if (!rebalanceNeeded) return;

      // Calculate correlation alerts
      const correlationAlerts = await dataFusionEngine.analyzeCorrelationAlerts();
      const criticalAlerts = correlationAlerts.filter(alert => alert.riskLevel === 'critical');

      // Perform rebalancing trades
      const rebalanceTrades = this.calculateRebalanceTrades(
        currentWeights, 
        targetWeights, 
        totalValue, 
        config,
        criticalAlerts
      );

      for (const trade of rebalanceTrades) {
        await this.executeRebalanceTrade(userId, trade);
      }

      logger.info(`Performed auto-rebalancing`, { 
        userId, 
        tradeCount: rebalanceTrades.length,
        criticalAlerts: criticalAlerts.length 
      });

    } catch (error) {
      logger.error(`Auto-rebalancing failed`, { userId, error });
    }
  }

  private shouldRebalance(
    currentWeights: Record<string, number>, 
    targetWeights: Record<string, number>, 
    config: AutoRebalanceConfig
  ): boolean {
    for (const symbol in targetWeights) {
      const currentWeight = currentWeights[symbol] || 0;
      const targetWeight = targetWeights[symbol] || 0;
      const deviation = Math.abs(currentWeight - targetWeight);
      
      if (deviation > config.maxDeviation) {
        return true;
      }
    }
    return false;
  }

  private calculateRebalanceTrades(
    currentWeights: Record<string, number>,
    targetWeights: Record<string, number>,
    totalValue: number,
    config: AutoRebalanceConfig,
    correlationAlerts: any[]
  ): any[] {
    const trades: any[] = [];

    for (const symbol in targetWeights) {
      const currentWeight = currentWeights[symbol] || 0;
      const targetWeight = targetWeights[symbol] || 0;
      
      // Adjust target weight based on correlation alerts
      let adjustedTargetWeight = targetWeight;
      const isInCriticalAlert = correlationAlerts.some(alert => 
        alert.asset1.includes(symbol.split('/')[0]) || alert.asset2.includes(symbol.split('/')[0])
      );
      
      if (isInCriticalAlert) {
        adjustedTargetWeight *= 0.5; // Reduce position by 50% if in critical correlation
      }

      const weightDifference = adjustedTargetWeight - currentWeight;
      const dollarAmount = Math.abs(weightDifference * totalValue);
      
      // Only trade if above minimum size
      if (dollarAmount >= config.minTradeSize * totalValue) {
        trades.push({
          symbol,
          side: weightDifference > 0 ? 'buy' : 'sell',
          amount: dollarAmount,
          type: 'rebalance',
          reason: isInCriticalAlert ? 'correlation_risk_reduction' : 'weight_deviation'
        });
      }
    }

    return trades;
  }

  private async executeRebalanceTrade(userId: string, trade: any): Promise<void> {
    try {
      // Convert to trading engine format
      const tradeParams = {
        userId,
        symbol: trade.symbol,
        side: trade.side,
        amount: trade.amount,
        type: 'market',
        metadata: {
          automationType: 'rebalance',
          reason: trade.reason
        }
      };

      await tradingEngine.executeTrade(tradeParams);

      logger.info(`Executed rebalance trade`, { userId, trade: tradeParams });

    } catch (error) {
      logger.error(`Failed to execute rebalance trade`, { userId, trade, error });
    }
  }

  async adjustPositionSizing(userId: string): Promise<void> {
    try {
      const rules = this.positionSizingRules.get(userId) || this.positionSizingRules.get('default')!;
      const openPositions = await storage.getUserOpenPositions(userId);
      
      if (!openPositions?.length) return;

      for (const position of openPositions) {
        const newSize = await this.calculateDynamicPositionSize(position, rules);
        
        if (Math.abs(newSize - position.size) > 0.01) { // 1% minimum change
          await this.adjustPositionSize(userId, position, newSize);
        }
      }

    } catch (error) {
      logger.error(`Position sizing adjustment failed`, { userId, error });
    }
  }

  private async calculateDynamicPositionSize(position: any, rules: DynamicPositionSizing): Promise<number> {
    try {
      // Get current market conditions
      const marketRegime = await storage.getCurrentMarketRegime(position.symbol);
      const volatility = await this.calculateAssetVolatility(position.symbol);
      
      // Base position size
      let adjustedSize = rules.baseSize;
      
      // Volatility adjustment (inverse relationship)
      const volatilityAdjustment = 1 / (1 + volatility * rules.volatilityAdjustment);
      adjustedSize *= volatilityAdjustment;
      
      // Market regime adjustment
      const regimeMultipliers = {
        'bull': 1.2,
        'bear': 0.8,
        'sideways': 1.0,
        'volatile': 0.7
      };
      
      const regimeMultiplier = regimeMultipliers[marketRegime?.regime as keyof typeof regimeMultipliers] || 1.0;
      adjustedSize *= regimeMultiplier;
      
      // Risk budget constraint
      const dailyRisk = volatility * adjustedSize;
      if (dailyRisk > rules.riskBudget) {
        adjustedSize = rules.riskBudget / volatility;
      }
      
      // Apply maximum position size limit
      adjustedSize = Math.min(adjustedSize, rules.maxPositionSize);
      
      return Math.max(0.01, adjustedSize); // Minimum 1% position

    } catch (error) {
      logger.error(`Failed to calculate dynamic position size`, { position, error });
      return position.size; // Return current size as fallback
    }
  }

  private async calculateAssetVolatility(symbol: string): Promise<number> {
    try {
      const priceHistory = await storage.getPriceHistory(symbol, 30); // 30 days
      if (priceHistory.length < 2) return 0.2; // Default volatility

      const returns = [];
      for (let i = 1; i < priceHistory.length; i++) {
        const dailyReturn = (priceHistory[i].price - priceHistory[i-1].price) / priceHistory[i-1].price;
        returns.push(dailyReturn);
      }

      const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
      
      return Math.sqrt(variance * 365); // Annualized volatility

    } catch (error) {
      logger.error(`Failed to calculate volatility`, { symbol, error });
      return 0.2;
    }
  }

  private async adjustPositionSize(userId: string, position: any, newSize: number): Promise<void> {
    try {
      const sizeDifference = newSize - position.size;
      const side = sizeDifference > 0 ? 'buy' : 'sell';
      const amount = Math.abs(sizeDifference * position.price);

      const tradeParams = {
        userId,
        symbol: position.symbol,
        side,
        amount,
        type: 'market',
        metadata: {
          automationType: 'position_sizing',
          reason: 'dynamic_risk_adjustment'
        }
      };

      await tradingEngine.executeTrade(tradeParams);

      logger.info(`Adjusted position size`, { userId, position: position.symbol, newSize });

    } catch (error) {
      logger.error(`Failed to adjust position size`, { userId, position, error });
    }
  }

  async monitorStrategyPerformance(userId: string): Promise<void> {
    try {
      const currentStrategy = await storage.getUserCurrentStrategy(userId);
      if (!currentStrategy) return;

      const performance = await this.evaluateStrategyPerformance(userId, currentStrategy);
      
      // Check if strategy switch is needed
      if (performance.needsSwitch) {
        const newStrategy = await this.selectOptimalStrategy(userId, performance);
        
        if (newStrategy && newStrategy !== currentStrategy.name) {
          await this.executeStrategySwitch(userId, currentStrategy.name, newStrategy, performance);
        }
      }

    } catch (error) {
      logger.error(`Strategy monitoring failed`, { userId, error });
    }
  }

  private async evaluateStrategyPerformance(userId: string, strategy: any): Promise<any> {
    try {
      const recentTrades = await storage.getUserTrades(userId, 20);
      const timeframeStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
      
      const relevantTrades = recentTrades.filter((trade: any) => 
        new Date(trade.createdAt) >= timeframeStart && trade.strategy === strategy.name
      );

      if (relevantTrades.length < 5) {
        return { needsSwitch: false, reason: 'insufficient_data' };
      }

      // Calculate performance metrics
      const totalReturn = relevantTrades.reduce((sum: number, trade: any) => sum + (trade.pnl || 0), 0);
      const winRate = relevantTrades.filter((trade: any) => (trade.pnl || 0) > 0).length / relevantTrades.length;
      const avgReturn = totalReturn / relevantTrades.length;
      
      // Performance thresholds
      const minWinRate = 0.4;
      const minAvgReturn = -0.02; // -2%
      const maxConsecutiveLosses = 5;

      // Check consecutive losses
      let consecutiveLosses = 0;
      for (let i = relevantTrades.length - 1; i >= 0; i--) {
        if ((relevantTrades[i].pnl || 0) < 0) {
          consecutiveLosses++;
        } else {
          break;
        }
      }

      const needsSwitch = winRate < minWinRate || avgReturn < minAvgReturn || consecutiveLosses >= maxConsecutiveLosses;

      return {
        needsSwitch,
        winRate,
        avgReturn,
        consecutiveLosses,
        totalReturn,
        tradeCount: relevantTrades.length,
        reason: needsSwitch ? this.determineSwitchReason(winRate, avgReturn, consecutiveLosses) : null
      };

    } catch (error) {
      logger.error(`Failed to evaluate strategy performance`, { userId, strategy, error });
      return { needsSwitch: false, reason: 'evaluation_error' };
    }
  }

  private determineSwitchReason(winRate: number, avgReturn: number, consecutiveLosses: number): string {
    if (consecutiveLosses >= 5) return 'excessive_consecutive_losses';
    if (winRate < 0.3) return 'low_win_rate';
    if (avgReturn < -0.05) return 'poor_average_returns';
    return 'underperformance';
  }

  private async selectOptimalStrategy(userId: string, performance: any): Promise<string | null> {
    try {
      // Get market regime to select appropriate strategy
      const marketRegime = await storage.getCurrentMarketRegime('BTC/USD');
      
      // Use adaptive learning engine to select optimal strategy
      const optimalAgent = await adaptiveLearningEngine.selectOptimalAgent(
        marketRegime?.regime || 'sideways',
        'trading'
      );

      // Map agent types to strategy names
      const strategyMapping = {
        'market_analyst': 'trend_following',
        'sentiment_analyst': 'sentiment_based',
        'trading_agent': 'balanced_momentum',
        'risk_assessor': 'conservative_value',
        'news_analyst': 'news_driven'
      };

      return strategyMapping[optimalAgent as keyof typeof strategyMapping] || 'balanced_momentum';

    } catch (error) {
      logger.error(`Failed to select optimal strategy`, { userId, error });
      return null;
    }
  }

  private async executeStrategySwitch(
    userId: string, 
    fromStrategy: string, 
    toStrategy: string, 
    performance: any
  ): Promise<void> {
    try {
      // Close current positions if necessary
      await this.closePositionsForStrategySwitch(userId, fromStrategy);
      
      // Update user's current strategy
      await storage.updateUserStrategy(userId, toStrategy);
      
      // Record the switch
      const strategySwitch: StrategySwitch = {
        fromStrategy,
        toStrategy,
        reason: performance.reason,
        confidence: 0.8, // Confidence in the switch decision
        expectedImprovement: 0.15, // Expected 15% improvement
        timestamp: new Date()
      };

      this.strategySwitchHistory.push(strategySwitch);
      await storage.recordStrategySwitch(userId, strategySwitch);

      logger.info(`Executed strategy switch`, { 
        userId, 
        fromStrategy, 
        toStrategy, 
        reason: performance.reason 
      });

    } catch (error) {
      logger.error(`Failed to execute strategy switch`, { userId, fromStrategy, toStrategy, error });
    }
  }

  private async closePositionsForStrategySwitch(userId: string, strategy: string): Promise<void> {
    try {
      const openPositions = await storage.getUserOpenPositions(userId);
      const strategyPositions = openPositions.filter((p: any) => p.strategy === strategy);

      for (const position of strategyPositions) {
        const tradeParams = {
          userId,
          symbol: position.symbol,
          side: position.side === 'long' ? 'sell' : 'buy',
          amount: position.amount,
          type: 'market',
          metadata: {
            automationType: 'strategy_switch',
            reason: 'closing_for_strategy_change'
          }
        };

        await tradingEngine.executeTrade(tradeParams);
      }

      logger.info(`Closed positions for strategy switch`, { 
        userId, 
        strategy, 
        positionCount: strategyPositions.length 
      });

    } catch (error) {
      logger.error(`Failed to close positions for strategy switch`, { userId, strategy, error });
    }
  }

  // Configuration management
  async updateRebalanceConfig(userId: string, config: Partial<AutoRebalanceConfig>): Promise<void> {
    const currentConfig = this.rebalanceConfigs.get(userId) || this.rebalanceConfigs.get('default')!;
    const updatedConfig = { ...currentConfig, ...config };
    
    this.rebalanceConfigs.set(userId, updatedConfig);
    await storage.updateUserAutomationConfig(userId, 'rebalance', updatedConfig);
    
    logger.info(`Updated rebalance config`, { userId, config: updatedConfig });
  }

  async updatePositionSizingRules(userId: string, rules: Partial<DynamicPositionSizing>): Promise<void> {
    const currentRules = this.positionSizingRules.get(userId) || this.positionSizingRules.get('default')!;
    const updatedRules = { ...currentRules, ...rules };
    
    this.positionSizingRules.set(userId, updatedRules);
    await storage.updateUserAutomationConfig(userId, 'position_sizing', updatedRules);
    
    logger.info(`Updated position sizing rules`, { userId, rules: updatedRules });
  }

  async disableAutomation(): Promise<void> {
    this.automationActive = false;
    logger.info(`Disabled intelligent automation`);
  }

  // Status and reporting
  getAutomationStatus(): any {
    return {
      active: this.automationActive,
      rebalanceConfigs: Object.fromEntries(this.rebalanceConfigs),
      positionSizingRules: Object.fromEntries(this.positionSizingRules),
      recentStrategySwitches: this.strategySwitchHistory.slice(-10)
    };
  }

  getStrategySwitchHistory(): StrategySwitch[] {
    return [...this.strategySwitchHistory];
  }
}

export const intelligentAutomationEngine = new IntelligentAutomationEngine();