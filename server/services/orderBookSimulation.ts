/**
 * PHASE 6: LIMIT ORDER BOOK (LOB) SIMULATION 
 * Realistic order book simulation and Smart Order Routing
 * 
 * Features:
 * - Realistic LOB dynamics with depth and spread modeling
 * - Market impact simulation based on order size
 * - Latency modeling for execution timing
 * - Smart Order Routing (SOR) algorithms
 * - Partial fill simulation
 * - Slippage and transaction cost modeling
 * - Order priority and queue position tracking
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

// Order book interfaces
export interface OrderBookLevel {
  price: number;
  volume: number;
  orders: number; // Number of orders at this level
  timestamp: number;
}

export interface OrderBook {
  symbol: string;
  timestamp: number;
  bids: OrderBookLevel[]; // Best bid first (highest price)
  asks: OrderBookLevel[]; // Best ask first (lowest price)
  spread: number;
  midPrice: number;
  depth: {
    bid: number; // Total bid volume
    ask: number; // Total ask volume
  };
}

export interface Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  quantity: number;
  remainingQuantity: number;
  price?: number; // Limit price (undefined for market orders)
  stopPrice?: number; // Stop trigger price
  timeInForce: 'GTC' | 'IOC' | 'FOK' | 'GTD'; // Good Till Cancel, Immediate or Cancel, Fill or Kill, Good Till Date
  timestamp: number;
  status: 'pending' | 'partial' | 'filled' | 'cancelled' | 'rejected';
  fills: Fill[];
  priority: number; // Queue position
}

export interface Fill {
  id: string;
  orderId: string;
  price: number;
  quantity: number;
  timestamp: number;
  fees: number;
  counterpartyId?: string;
}

export interface MarketImpact {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  estimatedPrice: number;
  priceImpact: number; // Basis points
  slippage: number;
  liquidityRequired: number;
  confidence: number;
}

export interface SORResult {
  orderId: string;
  strategy: 'aggressive' | 'passive' | 'iceberg' | 'twap' | 'vwap';
  childOrders: {
    venue: string;
    quantity: number;
    price?: number;
    delay?: number;
  }[];
  estimatedFillTime: number;
  estimatedCost: number;
  reasoning: string;
}

/**
 * Order Book Simulator
 * Simulates realistic order book dynamics
 */
export class OrderBookSimulator extends EventEmitter {
  private orderBooks: Map<string, OrderBook> = new Map();
  private isInitialized = false;
  private updateInterval?: NodeJS.Timeout;
  private volatilityCache: Map<string, number> = new Map();
  private lastUpdateTime = Date.now();

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('[OrderBook] Initializing order book simulator');
      
      // Initialize order books for major symbols
      const symbols = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT'];
      
      for (const symbol of symbols) {
        await this.initializeOrderBook(symbol);
      }
      
      // Start real-time updates
      this.startUpdates();
      
      this.isInitialized = true;
      logger.info('[OrderBook] Order book simulator initialized');
      
    } catch (error) {
      logger.error('[OrderBook] Initialization failed:', error as Error);
      throw error;
    }
  }

  private async initializeOrderBook(symbol: string): Promise<void> {
    // Get current market price (would integrate with real data)
    const currentPrice = await this.getCurrentPrice(symbol);
    
    const orderBook: OrderBook = {
      symbol,
      timestamp: Date.now(),
      bids: this.generateOrderBookSide('buy', currentPrice, symbol),
      asks: this.generateOrderBookSide('sell', currentPrice, symbol),
      spread: 0,
      midPrice: currentPrice,
      depth: { bid: 0, ask: 0 }
    };
    
    this.updateOrderBookMetrics(orderBook);
    this.orderBooks.set(symbol, orderBook);
    
    logger.info(`[OrderBook] Initialized ${symbol} order book at $${currentPrice}`);
  }

  private generateOrderBookSide(
    side: 'buy' | 'sell', 
    midPrice: number, 
    symbol: string
  ): OrderBookLevel[] {
    
    const levels: OrderBookLevel[] = [];
    const volatility = this.getVolatility(symbol);
    const spread = this.calculateSpread(midPrice, volatility);
    
    // Generate 20 levels on each side
    for (let i = 0; i < 20; i++) {
      const priceOffset = (i + 1) * spread * (0.5 + Math.random() * 0.5);
      const price = side === 'buy' 
        ? midPrice - priceOffset
        : midPrice + priceOffset;
      
      // Volume decreases with distance from mid
      const baseVolume = this.getBaseVolume(symbol);
      const volumeDecay = Math.exp(-i * 0.1);
      const volume = baseVolume * volumeDecay * (0.5 + Math.random());
      
      levels.push({
        price: Math.round(price * 100) / 100,
        volume: Math.round(volume * 1000) / 1000,
        orders: Math.max(1, Math.floor(volume / (baseVolume * 0.1))),
        timestamp: Date.now()
      });
    }
    
    return levels;
  }

  private updateOrderBookMetrics(orderBook: OrderBook): void {
    // Calculate spread
    const bestBid = orderBook.bids[0]?.price || 0;
    const bestAsk = orderBook.asks[0]?.price || 0;
    orderBook.spread = bestAsk - bestBid;
    orderBook.midPrice = (bestBid + bestAsk) / 2;
    
    // Calculate depth
    orderBook.depth.bid = orderBook.bids.reduce((sum, level) => sum + level.volume, 0);
    orderBook.depth.ask = orderBook.asks.reduce((sum, level) => sum + level.volume, 0);
  }

  private startUpdates(): void {
    // Update order books every 100ms
    this.updateInterval = setInterval(() => {
      this.updateOrderBooks();
    }, 100);
  }

  private updateOrderBooks(): void {
    const now = Date.now();
    const deltaTime = now - this.lastUpdateTime;
    
    for (const [symbol, orderBook] of Array.from(this.orderBooks.entries())) {
      this.simulateOrderBookDynamics(orderBook, deltaTime);
      this.emit('orderBookUpdate', orderBook);
    }
    
    this.lastUpdateTime = now;
  }

  private simulateOrderBookDynamics(orderBook: OrderBook, deltaTime: number): void {
    const volatility = this.getVolatility(orderBook.symbol);
    
    // Simulate price movement
    const priceChange = (Math.random() - 0.5) * volatility * Math.sqrt(deltaTime / 1000);
    const newMidPrice = orderBook.midPrice * (1 + priceChange);
    
    // Update order book levels
    orderBook.bids = this.adjustOrderBookLevels(orderBook.bids, newMidPrice, 'buy', orderBook.symbol);
    orderBook.asks = this.adjustOrderBookLevels(orderBook.asks, newMidPrice, 'sell', orderBook.symbol);
    
    // Add/remove orders randomly
    this.simulateOrderFlow(orderBook);
    
    // Update metrics
    this.updateOrderBookMetrics(orderBook);
    orderBook.timestamp = Date.now();
  }

  private adjustOrderBookLevels(
    levels: OrderBookLevel[], 
    newMidPrice: number, 
    side: 'buy' | 'sell',
    symbol: string
  ): OrderBookLevel[] {
    
    const volatility = this.getVolatility(symbol);
    const spread = this.calculateSpread(newMidPrice, volatility);
    
    return levels.map((level, index) => {
      const priceOffset = (index + 1) * spread * (0.5 + Math.random() * 0.5);
      const newPrice = side === 'buy' 
        ? newMidPrice - priceOffset
        : newMidPrice + priceOffset;
      
      // Volume fluctuates ±20%
      const volumeChange = 1 + (Math.random() - 0.5) * 0.4;
      const newVolume = Math.max(0.001, level.volume * volumeChange);
      
      return {
        ...level,
        price: Math.round(newPrice * 100) / 100,
        volume: Math.round(newVolume * 1000) / 1000,
        timestamp: Date.now()
      };
    });
  }

  private simulateOrderFlow(orderBook: OrderBook): void {
    // 10% chance to add new order at each level
    if (Math.random() < 0.1) {
      const side = Math.random() < 0.5 ? 'bids' : 'asks';
      const levelIndex = Math.floor(Math.random() * 5); // Top 5 levels
      
      if (orderBook[side][levelIndex]) {
        const baseVolume = this.getBaseVolume(orderBook.symbol);
        const additionalVolume = baseVolume * 0.1 * Math.random();
        orderBook[side][levelIndex].volume += additionalVolume;
        orderBook[side][levelIndex].orders += 1;
      }
    }
    
    // 5% chance to remove volume
    if (Math.random() < 0.05) {
      const side = Math.random() < 0.5 ? 'bids' : 'asks';
      const levelIndex = Math.floor(Math.random() * 3); // Top 3 levels
      
      if (orderBook[side][levelIndex] && orderBook[side][levelIndex].volume > 0.001) {
        const removePercent = Math.random() * 0.3; // Remove up to 30%
        orderBook[side][levelIndex].volume *= (1 - removePercent);
        orderBook[side][levelIndex].orders = Math.max(1, orderBook[side][levelIndex].orders - 1);
      }
    }
  }

  calculateMarketImpact(symbol: string, side: 'buy' | 'sell', quantity: number): MarketImpact {
    const orderBook = this.orderBooks.get(symbol);
    if (!orderBook) {
      throw new Error(`Order book not found for ${symbol}`);
    }
    
    const levels = side === 'buy' ? orderBook.asks : orderBook.bids;
    let remainingQuantity = quantity;
    let totalCost = 0;
    let liquidityRequired = 0;
    
    for (const level of levels) {
      if (remainingQuantity <= 0) break;
      
      const quantityAtLevel = Math.min(remainingQuantity, level.volume);
      totalCost += quantityAtLevel * level.price;
      liquidityRequired += level.volume;
      remainingQuantity -= quantityAtLevel;
    }
    
    const averagePrice = totalCost / (quantity - remainingQuantity);
    const midPrice = orderBook.midPrice;
    const priceImpact = Math.abs(averagePrice - midPrice) / midPrice * 10000; // Basis points
    const slippage = priceImpact * 0.5; // Simplified slippage model
    
    return {
      symbol,
      side,
      quantity,
      estimatedPrice: averagePrice,
      priceImpact,
      slippage,
      liquidityRequired,
      confidence: remainingQuantity === 0 ? 1.0 : (quantity - remainingQuantity) / quantity
    };
  }

  getOrderBook(symbol: string): OrderBook | undefined {
    return this.orderBooks.get(symbol);
  }

  private async getCurrentPrice(symbol: string): Promise<number> {
    // Placeholder - would get from real market data
    const prices: Record<string, number> = {
      'BTC': 50000,
      'ETH': 3000,
      'SOL': 150,
      'ADA': 0.5,
      'DOT': 8.0
    };
    return prices[symbol] || 100;
  }

  private getVolatility(symbol: string): number {
    // Simplified volatility model
    const volatilities: Record<string, number> = {
      'BTC': 0.03,
      'ETH': 0.04,
      'SOL': 0.06,
      'ADA': 0.05,
      'DOT': 0.05
    };
    return volatilities[symbol] || 0.04;
  }

  private calculateSpread(price: number, volatility: number): number {
    // Spread increases with volatility
    const baseSpread = price * 0.0001; // 1 basis point
    return baseSpread * (1 + volatility * 10);
  }

  private getBaseVolume(symbol: string): number {
    // Base volume for order book levels
    const volumes: Record<string, number> = {
      'BTC': 1.0,
      'ETH': 10.0,
      'SOL': 100.0,
      'ADA': 1000.0,
      'DOT': 100.0
    };
    return volumes[symbol] || 10.0;
  }

  cleanup(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
    
    this.removeAllListeners();
    logger.info('[OrderBook] Simulator cleaned up');
  }
}

/**
 * Smart Order Routing (SOR) Engine
 * Intelligently routes orders for optimal execution
 */
export class SmartOrderRouter {
  private orderBookSim: OrderBookSimulator;
  private isInitialized = false;

  constructor(orderBookSim: OrderBookSimulator) {
    this.orderBookSim = orderBookSim;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    logger.info('[SOR] Initializing Smart Order Router');
    this.isInitialized = true;
    logger.info('[SOR] Smart Order Router initialized');
  }

  routeOrder(order: Omit<Order, 'id' | 'timestamp' | 'status' | 'fills' | 'priority'>): SORResult {
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Analyze market conditions
    const orderBook = this.orderBookSim.getOrderBook(order.symbol);
    if (!orderBook) {
      throw new Error(`No order book available for ${order.symbol}`);
    }
    
    const marketImpact = this.orderBookSim.calculateMarketImpact(
      order.symbol, 
      order.side, 
      order.quantity
    );
    
    // Choose routing strategy based on order characteristics
    const strategy = this.selectStrategy(order, marketImpact, orderBook);
    const childOrders = this.generateChildOrders(order, strategy, orderBook);
    
    return {
      orderId,
      strategy,
      childOrders,
      estimatedFillTime: this.estimateFillTime(strategy, order.quantity, orderBook),
      estimatedCost: this.estimateCost(order, marketImpact),
      reasoning: this.explainStrategy(strategy, marketImpact)
    };
  }

  private selectStrategy(
    order: Omit<Order, 'id' | 'timestamp' | 'status' | 'fills' | 'priority'>,
    marketImpact: MarketImpact,
    orderBook: OrderBook
  ): 'aggressive' | 'passive' | 'iceberg' | 'twap' | 'vwap' {
    
    const quantity = order.quantity;
    const availableLiquidity = order.side === 'buy' ? orderBook.depth.ask : orderBook.depth.bid;
    const sizePct = quantity / availableLiquidity;
    
    // Large orders (>20% of depth) use TWAP/Iceberg
    if (sizePct > 0.2) {
      return quantity > availableLiquidity * 0.5 ? 'twap' : 'iceberg';
    }
    
    // Medium orders (5-20% of depth)
    if (sizePct > 0.05) {
      return marketImpact.priceImpact > 10 ? 'vwap' : 'iceberg';
    }
    
    // Small orders - choose based on urgency and market conditions
    if (order.type === 'market' || order.timeInForce === 'IOC') {
      return 'aggressive';
    }
    
    // Default to passive for limit orders
    return 'passive';
  }

  private generateChildOrders(
    order: Omit<Order, 'id' | 'timestamp' | 'status' | 'fills' | 'priority'>,
    strategy: string,
    orderBook: OrderBook
  ): SORResult['childOrders'] {
    
    switch (strategy) {
      case 'aggressive':
        // Single market order
        return [{
          venue: 'primary',
          quantity: order.quantity,
          delay: 0
        }];
        
      case 'passive':
        // Single limit order at best price
        const bestPrice = order.side === 'buy' 
          ? orderBook.bids[0]?.price 
          : orderBook.asks[0]?.price;
        return [{
          venue: 'primary',
          quantity: order.quantity,
          price: bestPrice,
          delay: 0
        }];
        
      case 'iceberg':
        // Split into smaller chunks
        const chunkSize = Math.min(order.quantity * 0.1, orderBook.depth.bid * 0.05);
        const numChunks = Math.ceil(order.quantity / chunkSize);
        
        return Array.from({ length: numChunks }, (_, i) => ({
          venue: 'primary',
          quantity: i === numChunks - 1 ? order.quantity - (i * chunkSize) : chunkSize,
          price: order.price,
          delay: i * 5000 // 5 second intervals
        }));
        
      case 'twap':
        // Time-weighted average price over 15 minutes
        const duration = 15 * 60 * 1000; // 15 minutes
        const intervals = 30; // 30-second intervals
        const intervalSize = order.quantity / intervals;
        
        return Array.from({ length: intervals }, (_, i) => ({
          venue: 'primary',
          quantity: intervalSize,
          delay: i * (duration / intervals)
        }));
        
      case 'vwap':
        // Volume-weighted based on historical patterns
        const vwapChunks = this.calculateVWAPSchedule(order.quantity, orderBook);
        return vwapChunks.map((chunk, i) => ({
          venue: 'primary',
          quantity: chunk.quantity,
          delay: chunk.delay
        }));
        
      default:
        return [{
          venue: 'primary',
          quantity: order.quantity,
          delay: 0
        }];
    }
  }

  private calculateVWAPSchedule(
    totalQuantity: number,
    orderBook: OrderBook
  ): { quantity: number; delay: number }[] {
    
    // Simplified VWAP schedule based on typical volume patterns
    const hourlyVolume = [0.05, 0.07, 0.08, 0.12, 0.15, 0.18, 0.12, 0.08, 0.06, 0.04, 0.03, 0.02]; // 12 hours
    const totalWeight = hourlyVolume.reduce((sum, vol) => sum + vol, 0);
    
    return hourlyVolume.map((weight, i) => ({
      quantity: totalQuantity * (weight / totalWeight),
      delay: i * 5 * 60 * 1000 // 5-minute intervals
    }));
  }

  private estimateFillTime(
    strategy: string,
    quantity: number,
    orderBook: OrderBook
  ): number {
    
    switch (strategy) {
      case 'aggressive':
        return 100; // 100ms for market order
        
      case 'passive':
        // Estimate based on queue position and market activity
        const avgFillTime = 30000; // 30 seconds average
        return avgFillTime * (1 + Math.random());
        
      case 'iceberg':
        return 60000; // ~1 minute for iceberg
        
      case 'twap':
        return 15 * 60 * 1000; // 15 minutes
        
      case 'vwap':
        return 60 * 60 * 1000; // 1 hour
        
      default:
        return 30000;
    }
  }

  private estimateCost(
    order: Omit<Order, 'id' | 'timestamp' | 'status' | 'fills' | 'priority'>,
    marketImpact: MarketImpact
  ): number {
    
    const basePrice = marketImpact.estimatedPrice;
    const slippageCost = order.quantity * basePrice * (marketImpact.slippage / 10000);
    const transactionFee = order.quantity * basePrice * 0.001; // 0.1% fee
    
    return slippageCost + transactionFee;
  }

  private explainStrategy(
    strategy: string,
    marketImpact: MarketImpact
  ): string {
    
    const impactStr = `${marketImpact.priceImpact.toFixed(1)}bp impact`;
    
    switch (strategy) {
      case 'aggressive':
        return `Market execution for immediate fill (${impactStr})`;
        
      case 'passive':
        return `Limit order at best price to minimize costs (${impactStr})`;
        
      case 'iceberg':
        return `Iceberg strategy to hide size and reduce impact (${impactStr})`;
        
      case 'twap':
        return `TWAP over 15min to minimize timing risk (${impactStr})`;
        
      case 'vwap':
        return `VWAP schedule following volume patterns (${impactStr})`;
        
      default:
        return `Standard execution (${impactStr})`;
    }
  }
}

// Singleton instances
export const orderBookSimulator = new OrderBookSimulator();
export const smartOrderRouter = new SmartOrderRouter(orderBookSimulator);