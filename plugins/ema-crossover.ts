import { StrategyPlugin, MarketData, Portfolio, StrategySignal, PluginConfig, PluginContext } from './types';

/**
 * EMA Crossover Strategy Plugin
 * 
 * This plugin implements a simple Exponential Moving Average crossover strategy.
 * It generates buy signals when short EMA crosses above long EMA,
 * and sell signals when short EMA crosses below long EMA.
 */
export class EMACrossoverPlugin implements StrategyPlugin {
  name = 'ema-crossover';
  version = '1.0.0';
  description = 'Exponential Moving Average crossover strategy';
  author = 'Skippy Trading Platform';

  private context!: PluginContext;
  private config!: PluginConfig;
  private priceHistory: Map<string, number[]> = new Map();

  async initialize(config: PluginConfig, context: PluginContext): Promise<void> {
    this.config = config;
    this.context = context;
    
    this.context.logger.info('EMA Crossover plugin initialized', {
      shortPeriod: config.parameters.shortPeriod,
      longPeriod: config.parameters.longPeriod,
      symbols: config.riskLimits.allowedSymbols
    });
    
    // Initialize price history storage
    for (const symbol of config.riskLimits.allowedSymbols) {
      this.priceHistory.set(symbol, []);
    }
  }

  async execute(marketData: MarketData[], portfolio: Portfolio): Promise<StrategySignal[]> {
    const signals: StrategySignal[] = [];
    
    try {
      for (const data of marketData) {
        if (!this.config.riskLimits.allowedSymbols.includes(data.symbol)) {
          continue;
        }
        
        // Update price history
        const history = this.priceHistory.get(data.symbol) || [];
        history.push(data.price);
        
        // Keep only necessary history (2x long period)
        const maxHistory = this.config.parameters.longPeriod * 2;
        if (history.length > maxHistory) {
          history.splice(0, history.length - maxHistory);
        }
        
        this.priceHistory.set(data.symbol, history);
        
        // Check if we have enough data for analysis
        if (history.length < this.config.parameters.longPeriod) {
          continue;
        }
        
        // Calculate EMAs
        const shortEMA = this.calculateEMA(history, this.config.parameters.shortPeriod);
        const longEMA = this.calculateEMA(history, this.config.parameters.longPeriod);
        
        // Get previous EMAs for crossover detection
        const previousShortEMA = this.calculateEMA(
          history.slice(0, -1), 
          this.config.parameters.shortPeriod
        );
        const previousLongEMA = this.calculateEMA(
          history.slice(0, -1), 
          this.config.parameters.longPeriod
        );
        
        // Detect crossovers
        const signal = this.detectCrossover(
          data.symbol,
          data.price,
          shortEMA,
          longEMA,
          previousShortEMA,
          previousLongEMA,
          portfolio
        );
        
        if (signal) {
          signals.push(signal);
          this.context.metrics.counter('signals_generated');
          this.context.logger.info('Signal generated', {
            symbol: signal.symbol,
            action: signal.action,
            confidence: signal.confidence,
            reasoning: signal.reasoning
          });
        }
      }
      
      this.context.metrics.gauge('active_symbols', this.priceHistory.size);
      return signals;
      
    } catch (error) {
      this.context.logger.error('Error in EMA crossover execution', error);
      this.context.metrics.counter('execution_errors');
      return [];
    }
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) {
      return prices.reduce((sum, price) => sum + price, 0) / prices.length;
    }
    
    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
    
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  private detectCrossover(
    symbol: string,
    currentPrice: number,
    shortEMA: number,
    longEMA: number,
    previousShortEMA: number,
    previousLongEMA: number,
    portfolio: Portfolio
  ): StrategySignal | null {
    
    // Check for bullish crossover (short EMA crosses above long EMA)
    if (previousShortEMA <= previousLongEMA && shortEMA > longEMA) {
      const existingPosition = portfolio.positions.find(p => 
        p.symbol === symbol && p.status === 'open'
      );
      
      // Don't buy if we already have a long position
      if (existingPosition?.side === 'long') {
        return null;
      }
      
      const confidence = this.calculateConfidence(shortEMA, longEMA, currentPrice);
      const quantity = this.calculateQuantity(symbol, currentPrice, portfolio, 'buy');
      
      return {
        symbol,
        action: 'buy',
        confidence,
        quantity,
        price: currentPrice,
        stopLoss: currentPrice * (1 - this.config.parameters.stopLossPercent / 100),
        takeProfit: currentPrice * (1 + this.config.parameters.takeProfitPercent / 100),
        reasoning: `Bullish EMA crossover: Short EMA (${shortEMA.toFixed(2)}) crossed above Long EMA (${longEMA.toFixed(2)})`,
        metadata: {
          shortEMA,
          longEMA,
          crossoverType: 'bullish'
        }
      };
    }
    
    // Check for bearish crossover (short EMA crosses below long EMA)
    if (previousShortEMA >= previousLongEMA && shortEMA < longEMA) {
      const existingPosition = portfolio.positions.find(p => 
        p.symbol === symbol && p.status === 'open' && p.side === 'long'
      );
      
      // Only sell if we have a long position to close
      if (!existingPosition) {
        return null;
      }
      
      const confidence = this.calculateConfidence(shortEMA, longEMA, currentPrice);
      
      return {
        symbol,
        action: 'sell',
        confidence,
        quantity: existingPosition.quantity,
        price: currentPrice,
        reasoning: `Bearish EMA crossover: Short EMA (${shortEMA.toFixed(2)}) crossed below Long EMA (${longEMA.toFixed(2)})`,
        metadata: {
          shortEMA,
          longEMA,
          crossoverType: 'bearish'
        }
      };
    }
    
    return null;
  }

  private calculateConfidence(shortEMA: number, longEMA: number, currentPrice: number): number {
    // Confidence based on EMA separation and price position
    const emaSeparation = Math.abs(shortEMA - longEMA) / longEMA;
    const priceToEMADistance = Math.abs(currentPrice - shortEMA) / shortEMA;
    
    // Higher confidence when EMAs are well separated and price is close to short EMA
    const separationScore = Math.min(emaSeparation * 10, 0.5); // Max 0.5 from separation
    const priceScore = Math.max(0.3, 0.5 - priceToEMADistance * 5); // 0.3 to 0.5 from price position
    
    return Math.min(separationScore + priceScore, 0.95); // Cap at 95%
  }

  private calculateQuantity(
    symbol: string, 
    price: number, 
    portfolio: Portfolio, 
    action: 'buy' | 'sell'
  ): number {
    if (action === 'sell') {
      const position = portfolio.positions.find(p => 
        p.symbol === symbol && p.status === 'open' && p.side === 'long'
      );
      return position?.quantity || 0;
    }
    
    // For buy orders, calculate based on risk limits
    const maxPositionValue = portfolio.totalValue * (this.config.parameters.maxPositionPercent / 100);
    const maxQuantity = maxPositionValue / price;
    const riskLimitQuantity = this.config.riskLimits.maxPositionSize;
    
    return Math.min(maxQuantity, riskLimitQuantity);
  }

  async cleanup(): Promise<void> {
    this.priceHistory.clear();
    this.context.logger.info('EMA Crossover plugin cleaned up');
  }

  getDefaultConfig(): PluginConfig {
    return {
      enabled: true,
      parameters: {
        shortPeriod: 12,
        longPeriod: 26,
        stopLossPercent: 2.0,
        takeProfitPercent: 4.0,
        maxPositionPercent: 10.0 // Max 10% of portfolio per position
      },
      riskLimits: {
        maxPositionSize: 1.0,
        maxDailyLoss: 1000,
        allowedSymbols: ['BTC', 'ETH', 'SOL']
      },
      schedule: {
        enabled: true,
        cron: '*/5 * * * *' // Every 5 minutes
      }
    };
  }

  validateConfig(config: PluginConfig): boolean {
    try {
      const params = config.parameters;
      
      // Validate required parameters
      if (!params.shortPeriod || !params.longPeriod) {
        return false;
      }
      
      // Short period must be less than long period
      if (params.shortPeriod >= params.longPeriod) {
        return false;
      }
      
      // Validate percentages
      if (params.stopLossPercent < 0 || params.stopLossPercent > 50) {
        return false;
      }
      
      if (params.takeProfitPercent < 0 || params.takeProfitPercent > 100) {
        return false;
      }
      
      // Validate risk limits
      if (config.riskLimits.maxPositionSize <= 0) {
        return false;
      }
      
      if (!Array.isArray(config.riskLimits.allowedSymbols) || 
          config.riskLimits.allowedSymbols.length === 0) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  async onPriceUpdate(symbol: string, price: number): Promise<void> {
    // Optional: React to real-time price updates
    this.context.metrics.counter('price_updates', 1);
  }

  async onTradeExecuted(trade: any): Promise<void> {
    // Optional: React to trade executions
    this.context.logger.info('Trade executed by EMA strategy', {
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity,
      price: trade.price
    });
    
    this.context.metrics.counter('trades_executed', 1);
  }

  async onError(error: Error): Promise<void> {
    this.context.logger.error('Error in EMA crossover strategy', error);
    this.context.metrics.counter('strategy_errors', 1);
  }
}