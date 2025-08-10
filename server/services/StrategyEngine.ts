import { logger } from '../utils/logger.js';
import { ExchangeService } from './ExchangeService.js';
import { RiskManager } from './RiskManager.js';
import { PortfolioOptimizer } from './PortfolioOptimizer.js';

interface Signal {
  type: 'BUY' | 'SELL' | 'HOLD';
  strength: number; // 0-1
  confidence: number; // 0-1
  source: string;
  reasoning: string;
  timeframe: string;
}

interface Strategy {
  id: string;
  name: string;
  description: string;
  active: boolean;
  weight: number; // Portfolio allocation weight
  performance: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    avgReturn: number;
  };
}

interface Position {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  strategy: string;
}

export class StrategyEngine {
  private strategies: Map<string, Strategy>;
  private signals: Map<string, Signal[]>;
  private positions: Map<string, Position>;
  private exchangeService: ExchangeService;
  private riskManager: RiskManager;
  private portfolioOptimizer: PortfolioOptimizer;

  constructor(exchangeService: ExchangeService) {
    this.strategies = new Map();
    this.signals = new Map();
    this.positions = new Map();
    this.exchangeService = exchangeService;
    this.riskManager = new RiskManager();
    this.portfolioOptimizer = new PortfolioOptimizer();
    
    this.initializeStrategies();
    logger.info('[StrategyEngine] Initialized with advanced trading strategies');
  }

  private initializeStrategies() {
    const defaultStrategies: Strategy[] = [
      {
        id: 'momentum_breakout',
        name: 'Momentum Breakout',
        description: 'Identifies and trades momentum breakouts with volume confirmation',
        active: true,
        weight: 0.3,
        performance: {
          totalReturn: 0.15,
          sharpeRatio: 1.8,
          maxDrawdown: -0.08,
          winRate: 0.62,
          avgReturn: 0.02
        }
      },
      {
        id: 'mean_reversion',
        name: 'Mean Reversion',
        description: 'Trades oversold/overbought conditions with statistical analysis',
        active: true,
        weight: 0.25,
        performance: {
          totalReturn: 0.12,
          sharpeRatio: 1.5,
          maxDrawdown: -0.06,
          winRate: 0.68,
          avgReturn: 0.015
        }
      },
      {
        id: 'sentiment_momentum',
        name: 'Sentiment Momentum',
        description: 'Trades based on news sentiment and social media analysis',
        active: true,
        weight: 0.2,
        performance: {
          totalReturn: 0.18,
          sharpeRatio: 1.2,
          maxDrawdown: -0.12,
          winRate: 0.55,
          avgReturn: 0.025
        }
      },
      {
        id: 'volatility_scalping',
        name: 'Volatility Scalping',
        description: 'High-frequency trades during volatile market conditions',
        active: false,
        weight: 0.15,
        performance: {
          totalReturn: 0.08,
          sharpeRatio: 0.9,
          maxDrawdown: -0.05,
          winRate: 0.72,
          avgReturn: 0.008
        }
      },
      {
        id: 'cross_asset_arbitrage',
        name: 'Cross-Asset Arbitrage',
        description: 'Exploits price differences across different exchanges and assets',
        active: false,
        weight: 0.1,
        performance: {
          totalReturn: 0.06,
          sharpeRatio: 2.1,
          maxDrawdown: -0.03,
          winRate: 0.78,
          avgReturn: 0.005
        }
      }
    ];

    defaultStrategies.forEach(strategy => {
      this.strategies.set(strategy.id, strategy);
    });
  }

  async processMarketData(marketData: any): Promise<Signal[]> {
    const generatedSignals: Signal[] = [];

    try {
      // Process signals for each active strategy
      for (const [strategyId, strategy] of this.strategies) {
        if (!strategy.active) continue;

        const signals = await this.generateSignalsForStrategy(strategyId, marketData);
        generatedSignals.push(...signals);
      }

      // Store signals for analysis
      this.signals.set(new Date().toISOString(), generatedSignals);

      // Execute trades based on signals
      await this.executeStrategies(generatedSignals);

      return generatedSignals;

    } catch (error) {
      logger.error('[StrategyEngine] Error processing market data:', error);
      return [];
    }
  }

  private async generateSignalsForStrategy(strategyId: string, marketData: any): Promise<Signal[]> {
    const signals: Signal[] = [];
    
    switch (strategyId) {
      case 'momentum_breakout':
        signals.push(...await this.generateMomentumSignals(marketData));
        break;
      case 'mean_reversion':
        signals.push(...await this.generateMeanReversionSignals(marketData));
        break;
      case 'sentiment_momentum':
        signals.push(...await this.generateSentimentSignals(marketData));
        break;
      case 'volatility_scalping':
        signals.push(...await this.generateVolatilitySignals(marketData));
        break;
      case 'cross_asset_arbitrage':
        signals.push(...await this.generateArbitrageSignals(marketData));
        break;
    }

    return signals;
  }

  private async generateMomentumSignals(marketData: any): Promise<Signal[]> {
    // Momentum breakout logic
    const price = marketData.price || 0;
    const volume = marketData.volume || 0;
    const volatility = marketData.volatility || 0;
    
    // Simple momentum calculation (would be more sophisticated in production)
    const momentum = (price - marketData.previousPrice) / marketData.previousPrice;
    const volumeConfirmation = volume > marketData.averageVolume * 1.5;
    
    if (momentum > 0.02 && volumeConfirmation) {
      return [{
        type: 'BUY',
        strength: Math.min(momentum * 10, 1),
        confidence: volumeConfirmation ? 0.8 : 0.6,
        source: 'momentum_breakout',
        reasoning: `Strong upward momentum (${(momentum * 100).toFixed(2)}%) with volume confirmation`,
        timeframe: '15m'
      }];
    } else if (momentum < -0.02 && volumeConfirmation) {
      return [{
        type: 'SELL',
        strength: Math.min(Math.abs(momentum) * 10, 1),
        confidence: volumeConfirmation ? 0.8 : 0.6,
        source: 'momentum_breakout',
        reasoning: `Strong downward momentum (${(momentum * 100).toFixed(2)}%) with volume confirmation`,
        timeframe: '15m'
      }];
    }

    return [];
  }

  private async generateMeanReversionSignals(marketData: any): Promise<Signal[]> {
    // Mean reversion logic
    const price = marketData.price || 0;
    const sma = marketData.sma20 || price;
    const deviation = (price - sma) / sma;
    const rsi = marketData.rsi || 50;
    
    if (deviation < -0.03 && rsi < 30) {
      return [{
        type: 'BUY',
        strength: Math.min(Math.abs(deviation) * 15, 1),
        confidence: rsi < 25 ? 0.85 : 0.7,
        source: 'mean_reversion',
        reasoning: `Oversold condition: ${deviation.toFixed(3)} below SMA, RSI: ${rsi.toFixed(1)}`,
        timeframe: '1h'
      }];
    } else if (deviation > 0.03 && rsi > 70) {
      return [{
        type: 'SELL',
        strength: Math.min(deviation * 15, 1),
        confidence: rsi > 75 ? 0.85 : 0.7,
        source: 'mean_reversion',
        reasoning: `Overbought condition: ${deviation.toFixed(3)} above SMA, RSI: ${rsi.toFixed(1)}`,
        timeframe: '1h'
      }];
    }

    return [];
  }

  private async generateSentimentSignals(marketData: any): Promise<Signal[]> {
    // Sentiment-based signals
    const sentimentScore = marketData.sentimentScore || 0;
    const newsVolume = marketData.newsVolume || 0;
    const socialMention = marketData.socialMention || 0;
    
    if (sentimentScore > 0.7 && newsVolume > 10) {
      return [{
        type: 'BUY',
        strength: sentimentScore,
        confidence: newsVolume > 20 ? 0.75 : 0.6,
        source: 'sentiment_momentum',
        reasoning: `Positive sentiment surge: ${sentimentScore.toFixed(2)} with ${newsVolume} news items`,
        timeframe: '4h'
      }];
    } else if (sentimentScore < -0.7 && newsVolume > 10) {
      return [{
        type: 'SELL',
        strength: Math.abs(sentimentScore),
        confidence: newsVolume > 20 ? 0.75 : 0.6,
        source: 'sentiment_momentum',
        reasoning: `Negative sentiment surge: ${sentimentScore.toFixed(2)} with ${newsVolume} news items`,
        timeframe: '4h'
      }];
    }

    return [];
  }

  private async generateVolatilitySignals(marketData: any): Promise<Signal[]> {
    // Volatility scalping signals (disabled by default)
    return [];
  }

  private async generateArbitrageSignals(marketData: any): Promise<Signal[]> {
    // Arbitrage opportunity signals (disabled by default)
    return [];
  }

  private async executeStrategies(signals: Signal[]): Promise<void> {
    if (signals.length === 0) return;

    // Aggregate signals by type and strength
    const aggregatedSignals = this.aggregateSignals(signals);
    
    for (const signal of aggregatedSignals) {
      if (signal.confidence > 0.6 && signal.strength > 0.3) {
        await this.executeSignal(signal);
      }
    }
  }

  private aggregateSignals(signals: Signal[]): Signal[] {
    // Simple aggregation - in production would be more sophisticated
    const buySignals = signals.filter(s => s.type === 'BUY');
    const sellSignals = signals.filter(s => s.type === 'SELL');
    
    const aggregated: Signal[] = [];
    
    if (buySignals.length > 0) {
      const avgStrength = buySignals.reduce((sum, s) => sum + s.strength, 0) / buySignals.length;
      const avgConfidence = buySignals.reduce((sum, s) => sum + s.confidence, 0) / buySignals.length;
      
      aggregated.push({
        type: 'BUY',
        strength: avgStrength,
        confidence: avgConfidence,
        source: 'aggregated',
        reasoning: `Aggregated from ${buySignals.length} buy signals`,
        timeframe: 'mixed'
      });
    }
    
    if (sellSignals.length > 0) {
      const avgStrength = sellSignals.reduce((sum, s) => sum + s.strength, 0) / sellSignals.length;
      const avgConfidence = sellSignals.reduce((sum, s) => sum + s.confidence, 0) / sellSignals.length;
      
      aggregated.push({
        type: 'SELL',
        strength: avgStrength,
        confidence: avgConfidence,
        source: 'aggregated',
        reasoning: `Aggregated from ${sellSignals.length} sell signals`,
        timeframe: 'mixed'
      });
    }
    
    return aggregated;
  }

  private async executeSignal(signal: Signal): Promise<void> {
    try {
      // Risk check before execution
      const riskApproval = await this.riskManager.checkTradeRisk(signal);
      if (!riskApproval.approved) {
        logger.warn('[StrategyEngine] Trade rejected by risk manager:', riskApproval.reason);
        return;
      }

      // Calculate position size
      const positionSize = await this.portfolioOptimizer.calculateOptimalSize(signal, riskApproval.maxSize);

      // Execute trade through exchange service
      const tradeResult = await this.exchangeService.executeTrade({
        symbol: 'BTC/USD', // Default symbol for now
        side: signal.type === 'BUY' ? 'buy' : 'sell',
        amount: positionSize,
        type: 'market',
        metadata: {
          strategy: signal.source,
          confidence: signal.confidence,
          reasoning: signal.reasoning
        }
      });

      logger.info('[StrategyEngine] Trade executed:', {
        signal: signal.type,
        size: positionSize,
        confidence: signal.confidence,
        strategy: signal.source,
        tradeId: tradeResult.id
      });

    } catch (error) {
      logger.error('[StrategyEngine] Error executing signal:', error);
    }
  }

  async getActiveStrategies(): Promise<Strategy[]> {
    return Array.from(this.strategies.values()).filter(s => s.active);
  }

  async getAllStrategies(): Promise<Strategy[]> {
    return Array.from(this.strategies.values());
  }

  async getStrategyPerformance(strategyId: string): Promise<Strategy | null> {
    return this.strategies.get(strategyId) || null;
  }

  async updateStrategyWeight(strategyId: string, weight: number): Promise<boolean> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return false;

    strategy.weight = weight;
    this.strategies.set(strategyId, strategy);
    logger.info('[StrategyEngine] Updated strategy weight:', { strategyId, weight });
    return true;
  }

  async toggleStrategy(strategyId: string, active: boolean): Promise<boolean> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return false;

    strategy.active = active;
    this.strategies.set(strategyId, strategy);
    logger.info('[StrategyEngine] Toggled strategy:', { strategyId, active });
    return true;
  }

  async getCurrentSignals(limit: number = 10): Promise<Signal[]> {
    const allSignals = Array.from(this.signals.values()).flat();
    return allSignals.slice(-limit);
  }
}