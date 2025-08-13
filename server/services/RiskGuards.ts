interface RiskLimits {
  globalNotionalCap: number;
  symbolNotionalCaps: Map<string, number>;
  ordersPerMinute: number;
  maxDrawdownPct: number;
  resetTimeoutMs: number;
}

interface RiskState {
  globalNotional: number;
  symbolNotionals: Map<string, number>;
  recentOrders: number[];
  peakEquity: number;
  currentEquity: number;
  isBlocked: boolean;
  blockReason?: string;
  lastReset: number;
  currentDrawdown?: number; // Added for clarity in state
  maxDrawdown?: number; // Added for clarity in state
}

class RiskGuards {
  private limits: RiskLimits;
  private state: RiskState;

  // Constants for risk limits
  private readonly GLOBAL_NOTIONAL_CAP: number = 250000;
  private readonly SYMBOL_NOTIONAL_CAPS: { [symbol: string]: number } = {
    BTCUSDT: 100000,
    ETHUSDT: 50000,
    DEFAULT: 25000
  };
  private readonly MAX_ORDERS_PER_MINUTE: number = 60;
  private readonly MAX_DRAWDOWN_PCT: number = 0.05; // 5%
  private readonly RESET_TIMEOUT_MS: number = 15 * 60 * 1000; // 15 minutes

  constructor() {
    this.limits = {
      globalNotionalCap: this.GLOBAL_NOTIONAL_CAP,
      symbolNotionalCaps: new Map(Object.entries(this.SYMBOL_NOTIONAL_CAPS)),
      ordersPerMinute: this.MAX_ORDERS_PER_MINUTE,
      maxDrawdownPct: this.MAX_DRAWDOWN_PCT,
      resetTimeoutMs: this.RESET_TIMEOUT_MS
    };

    this.state = {
      globalNotional: 0,
      symbolNotionals: new Map(),
      recentOrders: [],
      peakEquity: 100000, // Starting equity
      currentEquity: 100000,
      isBlocked: false,
      lastReset: Date.now()
    };
  }

  checkOrder(symbol: string, notional: number): { allowed: boolean; reason?: string } {
    // Check for timed reset first
    this.checkTimedReset();

    // Global notional check
    if (this.state.globalNotional + Math.abs(notional) > this.GLOBAL_NOTIONAL_CAP) {
      return {
        allowed: false,
        reason: `Global notional cap exceeded: ${(this.state.globalNotional + Math.abs(notional)).toLocaleString()} > ${this.GLOBAL_NOTIONAL_CAP.toLocaleString()}`
      };
    }

    // Per-symbol notional check
    const symbolNotional = (this.state.symbolNotionals.get(symbol) || 0) + Math.abs(notional);
    const symbolCap = this.limits.symbolNotionalCaps.get(symbol) || this.limits.symbolNotionalCaps.get('DEFAULT')!;

    if (symbolNotional > symbolCap) {
      return {
        allowed: false,
        reason: `Symbol ${symbol} notional cap exceeded: ${symbolNotional.toLocaleString()} > ${symbolCap.toLocaleString()}`
      };
    }

    // Order frequency check (throttling)
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const recentOrders = this.state.recentOrders.filter(ts => ts > oneMinuteAgo);

    if (recentOrders.length >= this.MAX_ORDERS_PER_MINUTE) {
      return {
        allowed: false,
        reason: `Order throttling limit exceeded: ${recentOrders.length} >= ${this.MAX_ORDERS_PER_MINUTE} orders/minute`
      };
    }

    // Drawdown breaker check
    if (this.state.isBlocked) {
      const timeSinceBreach = (Date.now() - this.state.lastReset) / (1000 * 60 * 60);
      return {
        allowed: false,
        reason: `Trading halted due to drawdown breach: ${((this.state.currentEquity / this.state.peakEquity) - 1) * 100).toFixed(2)}% (reset in ${(24 - timeSinceBreach).toFixed(1)}h)`
      };
    }

    // All checks passed
    return { allowed: true };
  }

  recordOrder(symbol: string, notional: number, pnl?: number): void {
    // Update notionals
    this.state.globalNotional += Math.abs(notional);
    const symbolNotional = this.state.symbolNotionals.get(symbol) || 0;
    this.state.symbolNotionals.set(symbol, symbolNotional + Math.abs(notional));

    // Update equity and drawdown tracking
    if (pnl !== undefined) {
      this.state.currentEquity += pnl;
      this.state.peakEquity = Math.max(this.state.peakEquity, this.state.currentEquity);

      // Calculate current drawdown
      const drawdown = (this.state.peakEquity - this.state.currentEquity) / this.state.peakEquity;
      this.state.currentDrawdown = Math.max(0, drawdown);

      // Update max drawdown
      this.state.maxDrawdown = Math.max(this.state.maxDrawdown ?? 0, this.state.currentDrawdown);

      // Check for drawdown breach
      if (this.state.currentDrawdown > this.MAX_DRAWDOWN_PCT && !this.state.isBlocked) {
        this.state.isBlocked = true;
        this.state.blockReason = `Drawdown limit triggered: ${(this.state.currentDrawdown * 100).toFixed(2)}% > ${(this.MAX_DRAWDOWN_PCT * 100).toFixed(2)}%`;
        this.state.lastReset = Date.now(); // Mark the time of breach for reset

        // Schedule automatic reset
        setTimeout(() => {
          this.reset();
        }, this.RESET_TIMEOUT_MS);

        console.error('Maximum drawdown breached!', {
          currentDrawdown: this.state.currentDrawdown,
          maxAllowed: this.MAX_DRAWDOWN_PCT
        });
      }
    }

    // Update order count with proper throttling
    const now = Date.now();
    this.state.recentOrders.push(now);

    // Clean old order timestamps
    const oneMinuteAgo = now - 60 * 1000;
    this.state.recentOrders = this.state.recentOrders.filter(ts => ts > oneMinuteAgo);

    // Log order details
    console.debug('Order recorded:', {
      symbol,
      notional,
      globalNotional: this.state.globalNotional,
      currentDrawdown: this.state.currentDrawdown,
      recentOrdersCount: this.state.recentOrders.length
    });
  }


  updateEquity(newEquity: number): void {
    this.state.currentEquity = newEquity;

    // Update peak
    if (newEquity > this.state.peakEquity) {
      this.state.peakEquity = newEquity;
    }

    // Calculate current drawdown
    const drawdown = (this.state.peakEquity - this.state.currentEquity) / this.state.peakEquity;
    this.state.currentDrawdown = Math.max(0, drawdown);


    // Check if drawdown breaker should be triggered
    if (this.state.currentDrawdown > this.MAX_DRAWDOWN_PCT && !this.state.isBlocked) {
      this.state.isBlocked = true;
      this.state.blockReason = `Drawdown limit triggered: ${(this.state.currentDrawdown * 100).toFixed(2)}% > ${(this.MAX_DRAWDOWN_PCT * 100).toFixed(2)}%`;
      this.state.lastReset = Date.now(); // Mark the time of breach for reset

      // Schedule automatic reset
      setTimeout(() => {
        this.reset();
      }, this.RESET_TIMEOUT_MS);

      console.error('Maximum drawdown breached!', {
        currentDrawdown: this.state.currentDrawdown,
        maxAllowed: this.MAX_DRAWDOWN_PCT
      });
    }
  }

  reset(): void {
    const wasBreached = this.state.isBlocked;

    this.state = {
      globalNotional: 0,
      symbolNotionals: new Map(),
      recentOrders: [],
      maxDrawdown: 0,
      currentDrawdown: 0,
      peakEquity: 100000, // Reset to initial capital
      currentEquity: 100000,
      isBlocked: false,
      blockReason: undefined,
      lastReset: Date.now()
    };

    console.info('Risk guards reset', {
      wasBreached,
      resetTime: new Date().toISOString()
    });
  }

  // Automatic timed reset for drawdown breaches
  checkTimedReset(): void {
    if (!this.state.isBlocked) return;

    const timeSinceBreach = Date.now() - this.state.lastReset;
    const resetInterval = 24 * 60 * 60 * 1000; // 24 hours

    if (timeSinceBreach > resetInterval) {
      console.info('Performing timed reset after drawdown breach');
      this.reset();
    }
  }

  getState(): RiskState {
    return { ...this.state };
  }

  updateLimits(newLimits: Partial<RiskLimits>): void {
    this.limits = { ...this.limits, ...newLimits };
  }
}

export const riskGuards = new RiskGuards();
export type { RiskLimits, RiskState };