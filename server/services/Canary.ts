
import { logger } from '../utils/logger';

type CanaryState = 'disabled' | 'canary' | 'partial' | 'live';

interface CanaryConfig {
  weight: number;
  minFills: number;
  pnlThreshold: number;
  cvarCap: number;
  promotionCriteria: {
    minTrades: number;
    minWinRate: number;
    maxDrawdown: number;
  };
}

interface CanaryStatus {
  state: CanaryState;
  weight: number;
  config: CanaryConfig;
  metrics: {
    totalFills: number;
    totalPnL: number;
    cvar: number;
    winRate: number;
    maxDrawdown: number;
    breaksActive: boolean;
  };
  lastStateChange: Date;
  promotionEligible: boolean;
  nextStateRequirements: string[];
}

export class Canary {
  private static instance: Canary;
  private currentState: CanaryState = 'disabled';
  private config: Record<CanaryState, CanaryConfig>;
  private metrics: any = {
    totalFills: 0,
    totalPnL: 0,
    cvar: 0,
    winRate: 0,
    maxDrawdown: 0,
    breaksActive: false
  };
  private lastStateChange: Date = new Date();
  private tradeHistory: any[] = [];

  public static getInstance(): Canary {
    if (!Canary.instance) {
      Canary.instance = new Canary();
    }
    return Canary.instance;
  }

  constructor() {
    this.config = {
      disabled: {
        weight: 0,
        minFills: 0,
        pnlThreshold: 0,
        cvarCap: 0,
        promotionCriteria: { minTrades: 0, minWinRate: 0, maxDrawdown: 1 }
      },
      canary: {
        weight: 0.01, // 1%
        minFills: 10,
        pnlThreshold: 100,
        cvarCap: 0.02,
        promotionCriteria: { minTrades: 25, minWinRate: 0.6, maxDrawdown: 0.05 }
      },
      partial: {
        weight: 0.1, // 10%
        minFills: 50,
        pnlThreshold: 500,
        cvarCap: 0.03,
        promotionCriteria: { minTrades: 100, minWinRate: 0.65, maxDrawdown: 0.08 }
      },
      live: {
        weight: 1.0, // 100%
        minFills: 0,
        pnlThreshold: 0,
        cvarCap: 0.05,
        promotionCriteria: { minTrades: 0, minWinRate: 0, maxDrawdown: 1 }
      }
    };

    logger.info('[Canary] Initialized in disabled state');
  }

  getStatus(): CanaryStatus {
    const currentConfig = this.config[this.currentState];
    const promotionEligible = this.checkPromotionEligibility();
    const nextStateRequirements = this.getNextStateRequirements();

    return {
      state: this.currentState,
      weight: currentConfig.weight,
      config: currentConfig,
      metrics: { ...this.metrics },
      lastStateChange: this.lastStateChange,
      promotionEligible,
      nextStateRequirements
    };
  }

  setState(newState: CanaryState): boolean {
    try {
      const oldState = this.currentState;
      this.currentState = newState;
      this.lastStateChange = new Date();
      
      logger.info(`[Canary] State changed: ${oldState} → ${newState}`);
      return true;
    } catch (error) {
      logger.error('[Canary] Failed to set state:', error);
      return false;
    }
  }

  recordTrade(trade: any): void {
    this.tradeHistory.push({
      ...trade,
      timestamp: new Date()
    });

    // Keep only last 200 trades
    if (this.tradeHistory.length > 200) {
      this.tradeHistory = this.tradeHistory.slice(-200);
    }

    this.updateMetrics();
    this.checkAutoPromotion();
  }

  private updateMetrics(): void {
    if (this.tradeHistory.length === 0) {
      return;
    }

    // Calculate metrics from trade history
    this.metrics.totalFills = this.tradeHistory.length;
    this.metrics.totalPnL = this.tradeHistory.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    
    const winningTrades = this.tradeHistory.filter(trade => (trade.pnl || 0) > 0);
    this.metrics.winRate = winningTrades.length / this.tradeHistory.length;

    // Calculate max drawdown
    let peak = 0;
    let currentPnL = 0;
    let maxDrawdown = 0;

    for (const trade of this.tradeHistory) {
      currentPnL += trade.pnl || 0;
      if (currentPnL > peak) peak = currentPnL;
      const drawdown = (peak - currentPnL) / Math.max(peak, 1);
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    this.metrics.maxDrawdown = maxDrawdown;

    // Mock CVaR calculation (in real system, calculate properly)
    this.metrics.cvar = Math.max(0.01, maxDrawdown * 1.5);
  }

  private checkPromotionEligibility(): boolean {
    const currentConfig = this.config[this.currentState];
    const criteria = currentConfig.promotionCriteria;

    if (this.currentState === 'live') {
      return false; // Already at highest level
    }

    return (
      this.metrics.totalFills >= criteria.minTrades &&
      this.metrics.winRate >= criteria.minWinRate &&
      this.metrics.maxDrawdown <= criteria.maxDrawdown &&
      this.metrics.totalPnL >= currentConfig.pnlThreshold &&
      this.metrics.cvar <= currentConfig.cvarCap &&
      !this.metrics.breaksActive
    );
  }

  private getNextStateRequirements(): string[] {
    const requirements: string[] = [];
    
    if (this.currentState === 'live') {
      return ['Already at maximum deployment level'];
    }

    const nextState = this.getNextState();
    if (!nextState) {
      return ['No next state available'];
    }

    const criteria = this.config[this.currentState].promotionCriteria;
    const currentConfig = this.config[this.currentState];

    if (this.metrics.totalFills < criteria.minTrades) {
      requirements.push(`Need ${criteria.minTrades - this.metrics.totalFills} more trades`);
    }

    if (this.metrics.winRate < criteria.minWinRate) {
      requirements.push(`Win rate too low: ${(this.metrics.winRate * 100).toFixed(1)}% < ${(criteria.minWinRate * 100).toFixed(1)}%`);
    }

    if (this.metrics.maxDrawdown > criteria.maxDrawdown) {
      requirements.push(`Drawdown too high: ${(this.metrics.maxDrawdown * 100).toFixed(1)}% > ${(criteria.maxDrawdown * 100).toFixed(1)}%`);
    }

    if (this.metrics.totalPnL < currentConfig.pnlThreshold) {
      requirements.push(`PnL too low: $${this.metrics.totalPnL.toFixed(2)} < $${currentConfig.pnlThreshold}`);
    }

    if (this.metrics.cvar > currentConfig.cvarCap) {
      requirements.push(`CVaR too high: ${(this.metrics.cvar * 100).toFixed(1)}% > ${(currentConfig.cvarCap * 100).toFixed(1)}%`);
    }

    if (this.metrics.breaksActive) {
      requirements.push('Circuit breakers must be clear');
    }

    if (requirements.length === 0) {
      requirements.push('Ready for promotion!');
    }

    return requirements;
  }

  private getNextState(): CanaryState | null {
    switch (this.currentState) {
      case 'disabled': return 'canary';
      case 'canary': return 'partial';
      case 'partial': return 'live';
      case 'live': return null;
      default: return null;
    }
  }

  private checkAutoPromotion(): void {
    if (this.checkPromotionEligibility()) {
      const nextState = this.getNextState();
      if (nextState) {
        logger.info(`[Canary] Auto-promoting from ${this.currentState} to ${nextState}`);
        this.setState(nextState);
      }
    }
  }

  getCurrentWeight(): number {
    return this.config[this.currentState].weight;
  }

  isEnabled(): boolean {
    return this.currentState !== 'disabled';
  }
}
