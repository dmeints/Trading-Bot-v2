
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
}

class RiskGuards {
  private limits: RiskLimits;
  private state: RiskState;
  
  constructor() {
    this.limits = {
      globalNotionalCap: 250000,
      symbolNotionalCaps: new Map([
        ['BTCUSDT', 100000],
        ['ETHUSDT', 50000],
        ['DEFAULT', 25000]
      ]),
      ordersPerMinute: 60,
      maxDrawdownPct: 0.05, // 5%
      resetTimeoutMs: 15 * 60 * 1000 // 15 minutes
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
    // Check if blocked by drawdown breaker
    if (this.state.isBlocked) {
      return { allowed: false, reason: this.state.blockReason || 'Risk limits breached' };
    }
    
    // Check global notional cap
    if (this.state.globalNotional + notional > this.limits.globalNotionalCap) {
      return { 
        allowed: false, 
        reason: `Global notional cap exceeded: ${this.state.globalNotional + notional} > ${this.limits.globalNotionalCap}` 
      };
    }
    
    // Check symbol-specific cap
    const symbolCap = this.limits.symbolNotionalCaps.get(symbol) || 
                     this.limits.symbolNotionalCaps.get('DEFAULT')!;
    const symbolNotional = this.state.symbolNotionals.get(symbol) || 0;
    
    if (symbolNotional + notional > symbolCap) {
      return { 
        allowed: false, 
        reason: `${symbol} notional cap exceeded: ${symbolNotional + notional} > ${symbolCap}` 
      };
    }
    
    // Check rate limiting
    const now = Date.now();
    const recentOrders = this.state.recentOrders.filter(ts => now - ts < 60000); // Last minute
    
    if (recentOrders.length >= this.limits.ordersPerMinute) {
      return { 
        allowed: false, 
        reason: `Order rate limit exceeded: ${recentOrders.length} orders/min >= ${this.limits.ordersPerMinute}` 
      };
    }
    
    return { allowed: true };
  }
  
  recordOrder(symbol: string, notional: number): void {
    // Update notionals
    this.state.globalNotional += notional;
    const symbolNotional = this.state.symbolNotionals.get(symbol) || 0;
    this.state.symbolNotionals.set(symbol, symbolNotional + notional);
    
    // Add to recent orders
    this.state.recentOrders.push(Date.now());
    
    // Clean old order timestamps
    const cutoff = Date.now() - 60000;
    this.state.recentOrders = this.state.recentOrders.filter(ts => ts > cutoff);
  }
  
  updateEquity(newEquity: number): void {
    this.state.currentEquity = newEquity;
    
    // Update peak
    if (newEquity > this.state.peakEquity) {
      this.state.peakEquity = newEquity;
    }
    
    // Check drawdown
    const drawdown = (this.state.peakEquity - this.state.currentEquity) / this.state.peakEquity;
    
    if (drawdown > this.limits.maxDrawdownPct && !this.state.isBlocked) {
      this.state.isBlocked = true;
      this.state.blockReason = `Drawdown breaker triggered: ${(drawdown * 100).toFixed(2)}% > ${(this.limits.maxDrawdownPct * 100).toFixed(2)}%`;
      this.state.lastReset = Date.now();
      
      // Schedule automatic reset
      setTimeout(() => {
        this.reset();
      }, this.limits.resetTimeoutMs);
    }
  }
  
  reset(): void {
    this.state.isBlocked = false;
    this.state.blockReason = undefined;
    this.state.lastReset = Date.now();
    
    // Reset notionals (conservative reset)
    this.state.globalNotional *= 0.5;
    for (const [symbol, notional] of this.state.symbolNotionals) {
      this.state.symbolNotionals.set(symbol, notional * 0.5);
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
