/**
 * EXECUTION ENGINE
 * Advanced order execution with realistic simulation
 * Part of Phase 6: LOB Simulation and Smart Order Routing
 * 
 * Features:
 * - Real-time order execution with latency modeling
 * - Partial fills and queue position tracking
 * - Transaction cost analysis
 * - Execution quality metrics
 * - Integration with risk management
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { orderBookSimulator, smartOrderRouter, type Order, type Fill, type OrderBook, type SORResult } from './orderBookSimulation.js';
import { riskManagementService } from './riskManagement.js';

export interface ExecutionResult {
  orderId: string;
  status: 'filled' | 'partial' | 'rejected' | 'cancelled';
  fills: Fill[];
  averagePrice: number;
  totalQuantity: number;
  remainingQuantity: number;
  totalFees: number;
  executionTime: number;
  slippage: number;
  marketImpact: number;
  vwapComparison: number;
  executionQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface ExecutionMetrics {
  totalOrders: number;
  fillRate: number; // Percentage of orders filled
  averageSlippage: number;
  averageExecutionTime: number;
  totalFees: number;
  vwapPerformance: number; // How close to VWAP
  marketImpactAvg: number;
  qualityScores: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
}

/**
 * Execution Engine
 * Handles order execution with realistic simulation
 */
export class ExecutionEngine extends EventEmitter {
  private isInitialized = false;
  private activeOrders: Map<string, Order> = new Map();
  private executionHistory: ExecutionResult[] = [];
  private latencyModel: LatencyModel;
  private executionProcessor?: NodeJS.Timeout;

  constructor() {
    super();
    this.latencyModel = new LatencyModel();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('[Execution] Initializing execution engine');
      
      // Initialize dependencies
      await orderBookSimulator.initialize();
      await smartOrderRouter.initialize();
      
      // Start order processing
      this.startOrderProcessing();
      
      this.isInitialized = true;
      logger.info('[Execution] Execution engine initialized');
      
    } catch (error) {
      logger.error('[Execution] Initialization failed:', error as Error);
      throw error;
    }
  }

  async submitOrder(orderParams: {
    symbol: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit';
    quantity: number;
    price?: number;
    timeInForce?: 'GTC' | 'IOC' | 'FOK';
  }): Promise<{ orderId: string; sorResult: SORResult }> {
    
    if (!this.isInitialized) {
      throw new Error('Execution engine not initialized');
    }

    // Risk check
    const riskCheck = await this.performRiskCheck(orderParams);
    if (!riskCheck.approved) {
      throw new Error(`Order rejected: ${riskCheck.reason}`);
    }

    // Create order
    const order: Order = {
      id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol: orderParams.symbol,
      side: orderParams.side,
      type: orderParams.type,
      quantity: orderParams.quantity,
      remainingQuantity: orderParams.quantity,
      price: orderParams.price,
      timeInForce: orderParams.timeInForce || 'GTC',
      timestamp: Date.now(),
      status: 'pending',
      fills: [],
      priority: this.calculatePriority(orderParams)
    };

    // Route order through SOR
    const sorResult = smartOrderRouter.routeOrder(order);
    
    // Add to active orders
    this.activeOrders.set(order.id, order);
    
    logger.info(`[Execution] Order submitted: ${order.id} - ${order.side} ${order.quantity} ${order.symbol}`);
    this.emit('orderSubmitted', order, sorResult);
    
    return { orderId: order.id, sorResult };
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.activeOrders.get(orderId);
    if (!order) return false;
    
    order.status = 'cancelled';
    this.activeOrders.delete(orderId);
    
    logger.info(`[Execution] Order cancelled: ${orderId}`);
    this.emit('orderCancelled', order);
    
    return true;
  }

  private async performRiskCheck(orderParams: {
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    price?: number;
  }): Promise<{ approved: boolean; reason?: string }> {
    
    try {
      // Get current market price
      const orderBook = orderBookSimulator.getOrderBook(orderParams.symbol);
      if (!orderBook) {
        return { approved: false, reason: 'No market data available' };
      }
      
      const currentPrice = orderParams.price || orderBook.midPrice;
      
      // Check risk management limits
      const portfolioRisk = riskManagementService.getPortfolioRisk();
      const riskParams = riskManagementService.getRiskParameters();
      
      // Check daily loss limit
      const dailyLossPercent = portfolioRisk.dailyPnL / portfolioRisk.totalValue;
      if (dailyLossPercent <= -riskParams.dailyLossLimit) {
        return { approved: false, reason: 'Daily loss limit exceeded' };
      }
      
      // Check position size
      const positionValue = orderParams.quantity * currentPrice;
      const positionPercent = positionValue / portfolioRisk.totalValue;
      if (positionPercent > riskParams.maxPositionSize) {
        return { approved: false, reason: 'Position size exceeds limit' };
      }
      
      // Check total exposure
      const newExposure = portfolioRisk.totalExposure + positionValue;
      if (newExposure / portfolioRisk.totalValue > riskParams.portfolioHeatLimit) {
        return { approved: false, reason: 'Portfolio heat limit exceeded' };
      }
      
      return { approved: true };
      
    } catch (error) {
      logger.error('[Execution] Risk check failed:', error as Error);
      return { approved: false, reason: 'Risk check error' };
    }
  }

  private calculatePriority(orderParams: {
    type: 'market' | 'limit';
    timeInForce?: 'GTC' | 'IOC' | 'FOK';
  }): number {
    
    // Market orders get highest priority
    if (orderParams.type === 'market') return 1;
    
    // IOC/FOK orders get high priority
    if (orderParams.timeInForce === 'IOC' || orderParams.timeInForce === 'FOK') return 2;
    
    // GTC orders get standard priority
    return 3;
  }

  private startOrderProcessing(): void {
    // Process orders every 10ms for realistic execution
    this.executionProcessor = setInterval(() => {
      this.processActiveOrders();
    }, 10);
  }

  private processActiveOrders(): void {
    for (const [orderId, order] of Array.from(this.activeOrders.entries())) {
      if (order.status === 'pending') {
        this.processOrder(order);
      }
    }
  }

  private async processOrder(order: Order): Promise<void> {
    try {
      const orderBook = orderBookSimulator.getOrderBook(order.symbol);
      if (!orderBook) return;
      
      // Simulate network latency
      const latency = this.latencyModel.getLatency();
      if (Date.now() - order.timestamp < latency) return;
      
      // Process based on order type
      switch (order.type) {
        case 'market':
          await this.processMarketOrder(order, orderBook);
          break;
        case 'limit':
          await this.processLimitOrder(order, orderBook);
          break;
      }
      
    } catch (error) {
      logger.error(`[Execution] Error processing order ${order.id}:`, error as Error);
      order.status = 'rejected';
      this.activeOrders.delete(order.id);
    }
  }

  private async processMarketOrder(order: Order, orderBook: OrderBook): Promise<void> {
    const levels = order.side === 'buy' ? orderBook.asks : orderBook.bids;
    let remainingQuantity = order.remainingQuantity;
    
    for (const level of levels) {
      if (remainingQuantity <= 0) break;
      
      // Calculate available quantity at this level
      const availableQuantity = Math.min(remainingQuantity, level.volume);
      
      // Create fill
      const fill: Fill = {
        id: `fill_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        orderId: order.id,
        price: level.price,
        quantity: availableQuantity,
        timestamp: Date.now(),
        fees: this.calculateFees(availableQuantity, level.price)
      };
      
      order.fills.push(fill);
      remainingQuantity -= availableQuantity;
      
      // Update level volume (simulate consumption)
      level.volume = Math.max(0, level.volume - availableQuantity);
    }
    
    // Update order status
    order.remainingQuantity = remainingQuantity;
    
    if (remainingQuantity === 0) {
      order.status = 'filled';
      this.completeOrder(order);
    } else if (order.fills.length > 0) {
      order.status = 'partial';
      this.emit('orderPartialFill', order);
    }
  }

  private async processLimitOrder(order: Order, orderBook: OrderBook): Promise<void> {
    if (!order.price) return;
    
    const bestPrice = order.side === 'buy' ? orderBook.asks[0]?.price : orderBook.bids[0]?.price;
    
    // Check if limit order can be filled
    const canFill = order.side === 'buy' 
      ? bestPrice <= order.price
      : bestPrice >= order.price;
    
    if (!canFill) return; // Wait for better price
    
    // Find matching levels
    const levels = order.side === 'buy' ? orderBook.asks : orderBook.bids;
    let remainingQuantity = order.remainingQuantity;
    
    for (const level of levels) {
      if (remainingQuantity <= 0) break;
      
      // Check price compatibility
      const priceMatches = order.side === 'buy' 
        ? level.price <= order.price
        : level.price >= order.price;
      
      if (!priceMatches) break;
      
      // Calculate fill quantity
      const fillQuantity = Math.min(remainingQuantity, level.volume);
      
      // Create fill at limit price or better
      const fillPrice = order.side === 'buy' 
        ? Math.min(level.price, order.price)
        : Math.max(level.price, order.price);
      
      const fill: Fill = {
        id: `fill_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        orderId: order.id,
        price: fillPrice,
        quantity: fillQuantity,
        timestamp: Date.now(),
        fees: this.calculateFees(fillQuantity, fillPrice)
      };
      
      order.fills.push(fill);
      remainingQuantity -= fillQuantity;
      level.volume = Math.max(0, level.volume - fillQuantity);
    }
    
    // Update order status
    order.remainingQuantity = remainingQuantity;
    
    if (remainingQuantity === 0) {
      order.status = 'filled';
      this.completeOrder(order);
    } else if (order.fills.length > 0) {
      order.status = 'partial';
      this.emit('orderPartialFill', order);
    }
    
    // Handle IOC/FOK orders
    if (order.timeInForce === 'IOC' && remainingQuantity > 0) {
      order.status = 'cancelled';
      this.activeOrders.delete(order.id);
      this.emit('orderCancelled', order);
    }
    
    if (order.timeInForce === 'FOK' && remainingQuantity > 0) {
      // Cancel all fills for FOK
      order.fills = [];
      order.status = 'cancelled';
      order.remainingQuantity = order.quantity;
      this.activeOrders.delete(order.id);
      this.emit('orderCancelled', order);
    }
  }

  private completeOrder(order: Order): void {
    this.activeOrders.delete(order.id);
    
    // Calculate execution metrics
    const result = this.calculateExecutionResult(order);
    this.executionHistory.push(result);
    
    // Update risk management
    this.updateRiskManagement(order, result);
    
    logger.info(`[Execution] Order completed: ${order.id} - ${result.status} ${result.totalQuantity} @ avg ${result.averagePrice.toFixed(2)}`);
    this.emit('orderFilled', order, result);
  }

  private calculateExecutionResult(order: Order): ExecutionResult {
    const fills = order.fills;
    const totalQuantity = fills.reduce((sum, fill) => sum + fill.quantity, 0);
    const totalValue = fills.reduce((sum, fill) => sum + fill.quantity * fill.price, 0);
    const totalFees = fills.reduce((sum, fill) => sum + fill.fees, 0);
    const averagePrice = totalValue / totalQuantity;
    
    // Get reference prices for comparison
    const orderBook = orderBookSimulator.getOrderBook(order.symbol);
    const referencePrice = orderBook?.midPrice || averagePrice;
    const vwapPrice = this.calculateVWAP(order.symbol, order.timestamp);
    
    // Calculate slippage and market impact
    const slippage = Math.abs(averagePrice - referencePrice) / referencePrice;
    const marketImpact = this.calculateMarketImpact(order, averagePrice, referencePrice);
    const vwapComparison = (averagePrice - vwapPrice) / vwapPrice;
    
    // Determine execution quality
    const quality = this.assessExecutionQuality(slippage, marketImpact, order.type);
    
    return {
      orderId: order.id,
      status: order.status as 'filled',
      fills,
      averagePrice,
      totalQuantity,
      remainingQuantity: order.remainingQuantity,
      totalFees,
      executionTime: fills[fills.length - 1]?.timestamp - order.timestamp,
      slippage,
      marketImpact,
      vwapComparison,
      executionQuality: quality
    };
  }

  private calculateVWAP(symbol: string, timestamp: number): number {
    // Simplified VWAP calculation over last 1 hour
    // In production, would use actual volume data
    const orderBook = orderBookSimulator.getOrderBook(symbol);
    return orderBook?.midPrice || 0;
  }

  private calculateMarketImpact(order: Order, averagePrice: number, referencePrice: number): number {
    const impact = Math.abs(averagePrice - referencePrice) / referencePrice;
    
    // Adjust based on order size
    const orderBook = orderBookSimulator.getOrderBook(order.symbol);
    if (orderBook) {
      const depth = order.side === 'buy' ? orderBook.depth.ask : orderBook.depth.bid;
      const sizeRatio = order.quantity / depth;
      return impact * (1 + sizeRatio);
    }
    
    return impact;
  }

  private assessExecutionQuality(
    slippage: number, 
    marketImpact: number, 
    orderType: string
  ): 'excellent' | 'good' | 'fair' | 'poor' {
    
    const totalImpact = slippage + marketImpact;
    
    if (orderType === 'market') {
      if (totalImpact < 0.0005) return 'excellent';
      if (totalImpact < 0.001) return 'good';
      if (totalImpact < 0.002) return 'fair';
      return 'poor';
    } else {
      if (totalImpact < 0.0002) return 'excellent';
      if (totalImpact < 0.0005) return 'good';
      if (totalImpact < 0.001) return 'fair';
      return 'poor';
    }
  }

  private updateRiskManagement(order: Order, result: ExecutionResult): void {
    // Add position to risk management if filled
    if (result.status === 'filled' && result.totalQuantity > 0) {
      riskManagementService.addPosition(
        order.symbol,
        order.side === 'buy' ? 'long' : 'short',
        result.totalQuantity,
        result.averagePrice,
        0.8 // Default confidence
      );
    }
  }

  private calculateFees(quantity: number, price: number): number {
    // 0.1% fee rate
    return quantity * price * 0.001;
  }

  getExecutionMetrics(): ExecutionMetrics {
    const history = this.executionHistory;
    
    if (history.length === 0) {
      return {
        totalOrders: 0,
        fillRate: 0,
        averageSlippage: 0,
        averageExecutionTime: 0,
        totalFees: 0,
        vwapPerformance: 0,
        marketImpactAvg: 0,
        qualityScores: { excellent: 0, good: 0, fair: 0, poor: 0 }
      };
    }
    
    const fillRate = history.filter(r => r.status === 'filled').length / history.length;
    const averageSlippage = history.reduce((sum, r) => sum + r.slippage, 0) / history.length;
    const averageExecutionTime = history.reduce((sum, r) => sum + r.executionTime, 0) / history.length;
    const totalFees = history.reduce((sum, r) => sum + r.totalFees, 0);
    const vwapPerformance = history.reduce((sum, r) => sum + Math.abs(r.vwapComparison), 0) / history.length;
    const marketImpactAvg = history.reduce((sum, r) => sum + r.marketImpact, 0) / history.length;
    
    const qualityScores = {
      excellent: history.filter(r => r.executionQuality === 'excellent').length / history.length,
      good: history.filter(r => r.executionQuality === 'good').length / history.length,
      fair: history.filter(r => r.executionQuality === 'fair').length / history.length,
      poor: history.filter(r => r.executionQuality === 'poor').length / history.length
    };
    
    return {
      totalOrders: history.length,
      fillRate,
      averageSlippage,
      averageExecutionTime,
      totalFees,
      vwapPerformance,
      marketImpactAvg,
      qualityScores
    };
  }

  getActiveOrders(): Order[] {
    return Array.from(this.activeOrders.values());
  }

  getExecutionHistory(limit: number = 100): ExecutionResult[] {
    return this.executionHistory.slice(-limit);
  }

  cleanup(): void {
    if (this.executionProcessor) {
      clearInterval(this.executionProcessor);
      this.executionProcessor = undefined;
    }
    
    this.removeAllListeners();
    logger.info('[Execution] Engine cleaned up');
  }
}

/**
 * Latency Model
 * Simulates realistic network and exchange latency
 */
class LatencyModel {
  private baseLatency = 2; // 2ms base
  private varianceLatency = 3; // ±3ms variance
  
  getLatency(): number {
    // Simulate realistic latency distribution
    const random1 = Math.random();
    const random2 = Math.random();
    
    // Box-Muller transform for normal distribution
    const normalRandom = Math.sqrt(-2 * Math.log(random1)) * Math.cos(2 * Math.PI * random2);
    
    const latency = this.baseLatency + (normalRandom * this.varianceLatency);
    
    // Ensure positive latency with minimum 1ms
    return Math.max(1, latency);
  }
}

// Singleton instance
export const executionEngine = new ExecutionEngine();