/**
 * Limit Order Book Simulator - Realistic Execution Modeling
 * Models latency, partial fills, slippage, and market impact
 */

import { logger } from '../../utils/logger';

export interface OrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  size: number;
  type: 'market' | 'limit';
  price?: number;
  timestamp: Date;
}

export interface ExecutionResult {
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  requestedSize: number;
  filledSize: number;
  avgFillPrice: number;
  slippage: number;
  latencyMs: number;
  fees: number;
  partialFill: boolean;
  timestamp: Date;
}

export interface MarketState {
  symbol: string;
  midPrice: number;
  spread: number;
  bidDepth: number;
  askDepth: number;
  volatility: number;
}

export class LimitOrderBookSimulator {
  private config: any;
  private orderCounter = 0;
  
  constructor(config: any) {
    this.config = config.execution || {
      latency_ms: [2, 8],
      slippage_curve: {
        small_size: 0.0005,
        medium_size: 0.0015,
        large_size: 0.0035
      },
      partial_fill_prob: 0.85,
      maker_fee: 0.0001,
      taker_fee: 0.0005
    };
  }
  
  async executeOrder(order: OrderRequest, marketState: MarketState): Promise<ExecutionResult> {
    const orderId = this.generateOrderId();
    const executionLatency = this.simulateLatency();
    
    // Simulate network latency delay
    await this.sleep(executionLatency);
    
    // Calculate execution details
    const slippage = this.calculateSlippage(order, marketState);
    const fillResult = this.simulateFill(order, marketState, slippage);
    const fees = this.calculateFees(order, fillResult.filledSize, fillResult.avgPrice);
    
    const result: ExecutionResult = {
      orderId,
      symbol: order.symbol,
      side: order.side,
      requestedSize: order.size,
      filledSize: fillResult.filledSize,
      avgFillPrice: fillResult.avgPrice,
      slippage: slippage,
      latencyMs: executionLatency,
      fees: fees,
      partialFill: fillResult.filledSize < order.size,
      timestamp: new Date()
    };
    
    logger.debug('[LOBSim] Order executed', {
      orderId,
      symbol: order.symbol,
      requestedSize: order.size,
      filledSize: fillResult.filledSize,
      slippage: (slippage * 100).toFixed(4) + '%',
      latency: executionLatency + 'ms'
    });
    
    return result;
  }
  
  private generateOrderId(): string {
    return `sim_${++this.orderCounter}_${Date.now()}`;
  }
  
  private simulateLatency(): number {
    const [minLatency, maxLatency] = this.config.latency_ms;
    return Math.round(minLatency + Math.random() * (maxLatency - minLatency));
  }
  
  private calculateSlippage(order: OrderRequest, marketState: MarketState): number {
    const orderValueUSD = order.size * marketState.midPrice;
    
    // Base slippage from configuration
    let baseSlippage: number;
    
    if (orderValueUSD < 1000) {
      baseSlippage = this.config.slippage_curve.small_size;
    } else if (orderValueUSD < 10000) {
      baseSlippage = this.config.slippage_curve.medium_size;
    } else {
      baseSlippage = this.config.slippage_curve.large_size;
    }
    
    // Adjust for market conditions
    let volatilityMultiplier = 1.0;
    if (marketState.volatility > 0.03) {
      volatilityMultiplier = 1.5; // Higher slippage in volatile conditions
    } else if (marketState.volatility > 0.05) {
      volatilityMultiplier = 2.0;
    }
    
    // Adjust for spread
    const spreadMultiplier = Math.max(1.0, marketState.spread / (marketState.midPrice * 0.001));
    
    // Market impact based on order size vs depth
    const relevantDepth = order.side === 'buy' ? marketState.askDepth : marketState.bidDepth;
    const impactMultiplier = Math.max(1.0, orderValueUSD / relevantDepth);
    
    const totalSlippage = baseSlippage * volatilityMultiplier * spreadMultiplier * impactMultiplier;
    
    // Add some randomness (±20% of calculated slippage)
    const randomFactor = 0.8 + Math.random() * 0.4;
    
    return totalSlippage * randomFactor;
  }
  
  private simulateFill(
    order: OrderRequest, 
    marketState: MarketState, 
    slippage: number
  ): { filledSize: number, avgPrice: number } {
    
    // Determine if partial fill occurs
    const isPartialFill = Math.random() > this.config.partial_fill_prob;
    
    let filledSize: number;
    if (isPartialFill && order.type === 'market') {
      // Partial fill: 70-95% of requested size
      const fillRatio = 0.7 + Math.random() * 0.25;
      filledSize = order.size * fillRatio;
    } else {
      filledSize = order.size;
    }
    
    // Calculate average fill price with slippage
    let avgPrice: number;
    
    if (order.side === 'buy') {
      // Buying: price moves up due to slippage
      avgPrice = marketState.midPrice * (1 + slippage);
    } else {
      // Selling: price moves down due to slippage
      avgPrice = marketState.midPrice * (1 - slippage);
    }
    
    // For limit orders, ensure we don't exceed the limit price
    if (order.type === 'limit' && order.price) {
      if (order.side === 'buy' && avgPrice > order.price) {
        avgPrice = order.price;
      } else if (order.side === 'sell' && avgPrice < order.price) {
        avgPrice = order.price;
      }
    }
    
    return { filledSize, avgPrice };
  }
  
  private calculateFees(order: OrderRequest, filledSize: number, avgPrice: number): number {
    const tradeValue = filledSize * avgPrice;
    
    // Assume market orders are taker, limit orders could be maker
    let feeRate: number;
    
    if (order.type === 'market') {
      feeRate = this.config.taker_fee;
    } else {
      // Simplified: 70% chance limit order is maker, 30% taker
      feeRate = Math.random() < 0.7 ? this.config.maker_fee : this.config.taker_fee;
    }
    
    return tradeValue * feeRate;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Enhanced execution simulation with queue position modeling
  async executeOrderWithQueue(
    order: OrderRequest, 
    marketState: MarketState,
    queuePosition?: number
  ): Promise<ExecutionResult> {
    
    if (order.type === 'limit' && queuePosition !== undefined) {
      // Model queue position for limit orders
      const queueDelay = this.calculateQueueDelay(queuePosition, marketState);
      await this.sleep(queueDelay);
    }
    
    return this.executeOrder(order, marketState);
  }
  
  private calculateQueueDelay(queuePosition: number, marketState: MarketState): number {
    // More queue position = longer delay
    // Higher volatility = faster queue movement
    const baseDelayMs = queuePosition * 100; // 100ms per position
    const volatilitySpeedup = Math.max(0.5, 1 - marketState.volatility * 10);
    
    return baseDelayMs * volatilitySpeedup;
  }
  
  // Batch execution for multiple orders
  async executeBatch(
    orders: OrderRequest[], 
    marketState: MarketState
  ): Promise<ExecutionResult[]> {
    
    const results: ExecutionResult[] = [];
    
    for (const order of orders) {
      const result = await this.executeOrder(order, marketState);
      results.push(result);
      
      // Update market state based on market impact
      marketState = this.updateMarketStateAfterTrade(marketState, result);
    }
    
    return results;
  }
  
  private updateMarketStateAfterTrade(
    currentState: MarketState, 
    execution: ExecutionResult
  ): MarketState {
    
    // Simplified market impact model
    const tradeValue = execution.filledSize * execution.avgFillPrice;
    const impactRatio = tradeValue / (currentState.bidDepth + currentState.askDepth);
    
    let priceImpact = 0;
    if (execution.side === 'buy') {
      priceImpact = impactRatio * 0.001; // Buying pushes price up
    } else {
      priceImpact = -impactRatio * 0.001; // Selling pushes price down
    }
    
    return {
      ...currentState,
      midPrice: currentState.midPrice * (1 + priceImpact),
      // Simplified: assume depth is partially consumed
      bidDepth: currentState.bidDepth * 0.95,
      askDepth: currentState.askDepth * 0.95
    };
  }
  
  // Transaction Cost Analysis
  generateTCA(executions: ExecutionResult[]): {
    avgSlippage: number;
    totalFees: number;
    fillRate: number;
    avgLatency: number;
    costBasisPoints: number;
  } {
    
    if (executions.length === 0) {
      return {
        avgSlippage: 0,
        totalFees: 0,
        fillRate: 0,
        avgLatency: 0,
        costBasisPoints: 0
      };
    }
    
    const totalRequestedSize = executions.reduce((sum, e) => sum + e.requestedSize, 0);
    const totalFilledSize = executions.reduce((sum, e) => sum + e.filledSize, 0);
    const totalSlippage = executions.reduce((sum, e) => sum + e.slippage, 0);
    const totalFees = executions.reduce((sum, e) => sum + e.fees, 0);
    const totalLatency = executions.reduce((sum, e) => sum + e.latencyMs, 0);
    const totalTradeValue = executions.reduce((sum, e) => sum + (e.filledSize * e.avgFillPrice), 0);
    
    return {
      avgSlippage: totalSlippage / executions.length,
      totalFees,
      fillRate: totalFilledSize / totalRequestedSize,
      avgLatency: totalLatency / executions.length,
      costBasisPoints: ((totalFees / totalTradeValue) * 10000) // Convert to basis points
    };
  }
}