
import { logger } from '../utils/logger.js';

interface GuardConfig {
  maxNotional: number;
  symbolNotionalCap: number;
  maxDrawdown: number;
  ordersPerMinuteLimit: number;
  breakerCooldownMs: number;
}

interface GuardState {
  totalNotional: number;
  symbolNotionals: Record<string, number>;
  recentTrades: any[];
  drawdownBreaker: {
    active: boolean;
    activatedAt?: Date;
    reason?: string;
  };
  orderCounts: Record<string, { count: number; windowStart: Date }>;
  lastCheck: Date;
}

interface GuardResult {
  allowed: boolean;
  blocked?: boolean;
  reason?: string;
  limits?: {
    notionalUsed: number;
    notionalLimit: number;
    symbolNotionalUsed: number;
    symbolNotionalLimit: number;
  };
}

export class RiskGuards {
  private static instance: RiskGuards;
  private config: GuardConfig;
  private state: GuardState;

  public static getInstance(): RiskGuards {
    if (!RiskGuards.instance) {
      RiskGuards.instance = new RiskGuards();
    }
    return RiskGuards.instance;
  }

  constructor() {
    this.config = {
      maxNotional: parseFloat(process.env.MAX_NOTIONAL || '250000'), // $250k default
      symbolNotionalCap: parseFloat(process.env.SYMBOL_NOTIONAL_CAP || '50000'), // $50k per symbol
      maxDrawdown: parseFloat(process.env.MAX_DRAWDOWN || '0.05'), // 5% max drawdown
      ordersPerMinuteLimit: parseInt(process.env.ORDERS_PER_MINUTE_LIMIT || '10'),
      breakerCooldownMs: 15 * 60 * 1000 // 15 minutes
    };

    this.state = {
      totalNotional: 0,
      symbolNotionals: {},
      recentTrades: [],
      drawdownBreaker: { active: false },
      orderCounts: {},
      lastCheck: new Date()
    };

    logger.info('[RiskGuards] Initialized with config:', this.config);
  }

  checkExecution(symbol: string, side: 'buy' | 'sell', notionalSize: number): GuardResult {
    try {
      this.updateState();

      // Check global notional cap
      if (side === 'buy' && this.state.totalNotional + notionalSize > this.config.maxNotional) {
        return {
          allowed: false,
          blocked: true,
          reason: `Global notional limit exceeded (${this.state.totalNotional + notionalSize} > ${this.config.maxNotional})`,
          limits: {
            notionalUsed: this.state.totalNotional,
            notionalLimit: this.config.maxNotional,
            symbolNotionalUsed: this.state.symbolNotionals[symbol] || 0,
            symbolNotionalLimit: this.config.symbolNotionalCap
          }
        };
      }

      // Check symbol notional cap
      const symbolNotional = this.state.symbolNotionals[symbol] || 0;
      if (side === 'buy' && symbolNotional + notionalSize > this.config.symbolNotionalCap) {
        return {
          allowed: false,
          blocked: true,
          reason: `Symbol ${symbol} notional limit exceeded (${symbolNotional + notionalSize} > ${this.config.symbolNotionalCap})`,
          limits: {
            notionalUsed: this.state.totalNotional,
            notionalLimit: this.config.maxNotional,
            symbolNotionalUsed: symbolNotional,
            symbolNotionalLimit: this.config.symbolNotionalCap
          }
        };
      }

      // Check drawdown breaker
      if (this.state.drawdownBreaker.active) {
        const cooldownRemaining = this.state.drawdownBreaker.activatedAt 
          ? (this.state.drawdownBreaker.activatedAt.getTime() + this.config.breakerCooldownMs) - Date.now()
          : 0;
        
        if (cooldownRemaining > 0) {
          return {
            allowed: false,
            blocked: true,
            reason: `Drawdown breaker active. Cooldown remaining: ${Math.ceil(cooldownRemaining / 1000)}s`
          };
        } else {
          // Reset breaker after cooldown
          this.state.drawdownBreaker.active = false;
          this.state.drawdownBreaker.activatedAt = undefined;
          this.state.drawdownBreaker.reason = undefined;
        }
      }

      // Check order rate limit
      const now = new Date();
      const orderCount = this.state.orderCounts[symbol];
      if (orderCount) {
        const windowElapsed = now.getTime() - orderCount.windowStart.getTime();
        if (windowElapsed < 60000) { // Within 1 minute window
          if (orderCount.count >= this.config.ordersPerMinuteLimit) {
            return {
              allowed: false,
              blocked: true,
              reason: `Order rate limit exceeded for ${symbol} (${orderCount.count}/${this.config.ordersPerMinuteLimit} per minute)`
            };
          }
        } else {
          // Reset window
          this.state.orderCounts[symbol] = { count: 0, windowStart: now };
        }
      } else {
        this.state.orderCounts[symbol] = { count: 0, windowStart: now };
      }

      return {
        allowed: true,
        limits: {
          notionalUsed: this.state.totalNotional,
          notionalLimit: this.config.maxNotional,
          symbolNotionalUsed: symbolNotional,
          symbolNotionalLimit: this.config.symbolNotionalCap
        }
      };

    } catch (error) {
      logger.error('[RiskGuards] Check execution error:', error);
      return {
        allowed: false,
        blocked: true,
        reason: 'Risk guard system error'
      };
    }
  }

  recordExecution(execution: any): void {
    try {
      // Add to recent trades
      this.state.recentTrades.push(execution);
      
      // Keep only last 100 trades for performance
      if (this.state.recentTrades.length > 100) {
        this.state.recentTrades = this.state.recentTrades.slice(-100);
      }

      // Update notional tracking
      const notionalAmount = execution.finalSize * execution.fillPrice;
      
      if (execution.side === 'buy') {
        this.state.totalNotional += notionalAmount;
        this.state.symbolNotionals[execution.symbol] = (this.state.symbolNotionals[execution.symbol] || 0) + notionalAmount;
      } else if (execution.side === 'sell') {
        this.state.totalNotional = Math.max(0, this.state.totalNotional - notionalAmount);
        this.state.symbolNotionals[execution.symbol] = Math.max(0, (this.state.symbolNotionals[execution.symbol] || 0) - notionalAmount);
      }

      // Update order count
      const symbol = execution.symbol;
      if (this.state.orderCounts[symbol]) {
        this.state.orderCounts[symbol].count++;
      } else {
        this.state.orderCounts[symbol] = { count: 1, windowStart: new Date() };
      }

      // Check for drawdown breaker
      this.checkDrawdownBreaker();

      logger.info(`[RiskGuards] Recorded execution: ${execution.symbol} ${execution.side} ${execution.finalSize}. Total notional: ${this.state.totalNotional}`);

    } catch (error) {
      logger.error('[RiskGuards] Record execution error:', error);
    }
  }

  private updateState(): void {
    this.state.lastCheck = new Date();
    
    // Clean up old order counts
    const now = Date.now();
    for (const symbol in this.state.orderCounts) {
      const orderCount = this.state.orderCounts[symbol];
      if (now - orderCount.windowStart.getTime() > 60000) {
        delete this.state.orderCounts[symbol];
      }
    }
  }

  private checkDrawdownBreaker(): void {
    if (this.state.recentTrades.length < 10) return; // Need minimum trades

    // Calculate rolling max drawdown over last 20 trades
    const recentTrades = this.state.recentTrades.slice(-20);
    let peak = 0;
    let currentPnL = 0;
    let maxDrawdown = 0;

    for (const trade of recentTrades) {
      // Simple PnL calculation (buy = negative, sell = positive for this calculation)
      const tradePnL = trade.side === 'buy' ? -trade.finalSize * trade.fillPrice : trade.finalSize * trade.fillPrice;
      currentPnL += tradePnL;
      
      if (currentPnL > peak) {
        peak = currentPnL;
      }
      
      const drawdown = (peak - currentPnL) / Math.max(peak, 1);
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    if (maxDrawdown > this.config.maxDrawdown && !this.state.drawdownBreaker.active) {
      this.state.drawdownBreaker.active = true;
      this.state.drawdownBreaker.activatedAt = new Date();
      this.state.drawdownBreaker.reason = `Max drawdown exceeded: ${(maxDrawdown * 100).toFixed(2)}%`;
      
      logger.warn(`[RiskGuards] Drawdown breaker activated: ${this.state.drawdownBreaker.reason}`);
    }
  }

  getState(): GuardState & { config: GuardConfig } {
    this.updateState();
    return {
      ...this.state,
      config: this.config
    };
  }

  reset(): void {
    this.state = {
      totalNotional: 0,
      symbolNotionals: {},
      recentTrades: [],
      drawdownBreaker: { active: false },
      orderCounts: {},
      lastCheck: new Date()
    };
    logger.info('[RiskGuards] State reset');
  }
}

export const riskGuards = RiskGuards.getInstance();
