import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';

interface BrokerConfig {
  id: string;
  name: string;
  type: 'binance' | 'coinbase' | 'kraken';
  apiKey: string;
  apiSecret: string;
  passphrase?: string; // For Coinbase Pro
  testnet: boolean;
  enabled: boolean;
}

interface Order {
  id: string;
  clientOrderId: string;
  brokerId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  quantity: number;
  price?: number;
  stopPrice?: number;
  status: 'pending' | 'open' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected';
  filledQuantity: number;
  averagePrice: number;
  fees: number;
  timestamp: Date;
  updateTime: Date;
}

interface Position {
  brokerId: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  averagePrice: number;
  marketValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
  timestamp: Date;
}

interface Balance {
  brokerId: string;
  asset: string;
  free: number;
  locked: number;
  total: number;
  usdValue: number;
  timestamp: Date;
}

interface BrokerStatus {
  brokerId: string;
  connected: boolean;
  lastHeartbeat: Date;
  apiLimits: {
    weight: number;
    maxWeight: number;
    orders: number;
    maxOrders: number;
  };
  latency: number;
}

export class BrokerManager extends EventEmitter {
  private brokers: Map<string, BrokerConfig>;
  private orders: Map<string, Order>;
  private positions: Map<string, Position>;
  private balances: Map<string, Balance[]>;
  private brokerStatus: Map<string, BrokerStatus>;
  private isLiveMode: boolean;

  constructor(isLiveMode = false) {
    super();
    this.brokers = new Map();
    this.orders = new Map();
    this.positions = new Map();
    this.balances = new Map();
    this.brokerStatus = new Map();
    this.isLiveMode = isLiveMode;
    logger.info(`[BrokerManager] Initialized in ${isLiveMode ? 'LIVE' : 'PAPER'} trading mode`);
  }

  async addBroker(config: BrokerConfig): Promise<void> {
    try {
      // Validate API credentials
      await this.validateBrokerCredentials(config);
      
      this.brokers.set(config.id, config);
      
      // Initialize broker connection
      await this.initializeBrokerConnection(config.id);
      
      logger.info('[BrokerManager] Broker added successfully:', { 
        brokerId: config.id, 
        name: config.name,
        testnet: config.testnet
      });
      
      this.emit('brokerAdded', { brokerId: config.id, config });

    } catch (error) {
      logger.error('[BrokerManager] Failed to add broker:', { 
        brokerId: config.id, 
        error: String(error) 
      });
      throw error;
    }
  }

  private async validateBrokerCredentials(config: BrokerConfig): Promise<boolean> {
    // Simulate API credential validation
    if (!config.apiKey || !config.apiSecret) {
      throw new Error('API key and secret are required');
    }

    // For Coinbase Pro, passphrase is required
    if (config.type === 'coinbase' && !config.passphrase) {
      throw new Error('Passphrase is required for Coinbase Pro');
    }

    // Simulate API validation call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return true;
  }

  private async initializeBrokerConnection(brokerId: string): Promise<void> {
    const config = this.brokers.get(brokerId);
    if (!config) throw new Error('Broker configuration not found');

    try {
      // Initialize broker-specific connection
      switch (config.type) {
        case 'binance':
          await this.initializeBinance(config);
          break;
        case 'coinbase':
          await this.initializeCoinbase(config);
          break;
        case 'kraken':
          await this.initializeKraken(config);
          break;
      }

      // Set initial broker status
      this.brokerStatus.set(brokerId, {
        brokerId,
        connected: true,
        lastHeartbeat: new Date(),
        apiLimits: {
          weight: 0,
          maxWeight: 1200,
          orders: 0,
          maxOrders: 100
        },
        latency: Math.random() * 50 + 10 // Simulate 10-60ms latency
      });

      // Start heartbeat monitoring
      this.startBrokerHeartbeat(brokerId);
      
    } catch (error) {
      logger.error('[BrokerManager] Failed to initialize broker connection:', {
        brokerId,
        error: String(error)
      });
      throw error;
    }
  }

  private async initializeBinance(config: BrokerConfig): Promise<void> {
    logger.info('[BrokerManager] Initializing Binance connection:', { 
      testnet: config.testnet,
      brokerId: config.id 
    });
    
    // Simulate Binance API initialization
    await this.simulateApiCall('binance', 'account');
    
    // Set up WebSocket connection for real-time updates
    this.setupBinanceWebSocket(config);
  }

  private async initializeCoinbase(config: BrokerConfig): Promise<void> {
    logger.info('[BrokerManager] Initializing Coinbase Pro connection:', { 
      testnet: config.testnet,
      brokerId: config.id 
    });
    
    // Simulate Coinbase Pro API initialization
    await this.simulateApiCall('coinbase', 'accounts');
    
    // Set up WebSocket connection for real-time updates
    this.setupCoinbaseWebSocket(config);
  }

  private async initializeKraken(config: BrokerConfig): Promise<void> {
    logger.info('[BrokerManager] Initializing Kraken connection:', { 
      testnet: config.testnet,
      brokerId: config.id 
    });
    
    // Simulate Kraken API initialization
    await this.simulateApiCall('kraken', 'Balance');
    
    // Set up WebSocket connection for real-time updates
    this.setupKrakenWebSocket(config);
  }

  private setupBinanceWebSocket(config: BrokerConfig): void {
    // Simulate WebSocket setup for Binance
    logger.info('[BrokerManager] Setting up Binance WebSocket:', { brokerId: config.id });
    
    // Simulate periodic updates
    setInterval(() => {
      this.simulateBalanceUpdate(config.id, 'binance');
      this.simulateOrderUpdates(config.id);
    }, 5000);
  }

  private setupCoinbaseWebSocket(config: BrokerConfig): void {
    // Simulate WebSocket setup for Coinbase
    logger.info('[BrokerManager] Setting up Coinbase WebSocket:', { brokerId: config.id });
    
    setInterval(() => {
      this.simulateBalanceUpdate(config.id, 'coinbase');
      this.simulateOrderUpdates(config.id);
    }, 5000);
  }

  private setupKrakenWebSocket(config: BrokerConfig): void {
    // Simulate WebSocket setup for Kraken
    logger.info('[BrokerManager] Setting up Kraken WebSocket:', { brokerId: config.id });
    
    setInterval(() => {
      this.simulateBalanceUpdate(config.id, 'kraken');
      this.simulateOrderUpdates(config.id);
    }, 5000);
  }

  private startBrokerHeartbeat(brokerId: string): void {
    setInterval(() => {
      const status = this.brokerStatus.get(brokerId);
      if (status) {
        status.lastHeartbeat = new Date();
        status.latency = Math.random() * 50 + 10; // Simulate latency variation
        this.brokerStatus.set(brokerId, status);
      }
    }, 10000); // Update every 10 seconds
  }

  async placeOrder(orderRequest: {
    brokerId: string;
    symbol: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop';
    quantity: number;
    price?: number;
    stopPrice?: number;
  }): Promise<string> {
    try {
      const broker = this.brokers.get(orderRequest.brokerId);
      if (!broker) {
        throw new Error('Broker not found');
      }

      if (!broker.enabled) {
        throw new Error('Broker is disabled');
      }

      // Generate order ID
      const orderId = `${orderRequest.brokerId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const order: Order = {
        id: orderId,
        clientOrderId: `client_${Date.now()}`,
        brokerId: orderRequest.brokerId,
        symbol: orderRequest.symbol,
        side: orderRequest.side,
        type: orderRequest.type,
        quantity: orderRequest.quantity,
        price: orderRequest.price,
        stopPrice: orderRequest.stopPrice,
        status: 'pending',
        filledQuantity: 0,
        averagePrice: 0,
        fees: 0,
        timestamp: new Date(),
        updateTime: new Date()
      };

      this.orders.set(orderId, order);

      // Simulate order placement
      await this.simulateOrderPlacement(order);

      logger.info('[BrokerManager] Order placed:', {
        orderId,
        brokerId: orderRequest.brokerId,
        symbol: orderRequest.symbol,
        side: orderRequest.side,
        quantity: orderRequest.quantity
      });

      this.emit('orderPlaced', { orderId, order });
      
      return orderId;

    } catch (error) {
      logger.error('[BrokerManager] Failed to place order:', {
        brokerId: orderRequest.brokerId,
        error: String(error)
      });
      throw error;
    }
  }

  private async simulateOrderPlacement(order: Order): Promise<void> {
    // Simulate API call delay
    await this.simulateApiCall(this.getBrokerType(order.brokerId), 'placeOrder');
    
    // Update order status to open
    order.status = 'open';
    order.updateTime = new Date();
    
    // Simulate order fill over time
    setTimeout(() => {
      this.simulateOrderFill(order.id);
    }, Math.random() * 10000 + 2000); // Fill between 2-12 seconds
  }

  private simulateOrderFill(orderId: string): void {
    const order = this.orders.get(orderId);
    if (!order || order.status !== 'open') return;

    // Simulate partial or full fill
    const fillPercentage = Math.random() * 0.5 + 0.5; // Fill 50-100%
    const filledQuantity = order.quantity * fillPercentage;
    
    // Simulate market price with slippage
    const marketPrice = this.getSimulatedMarketPrice(order.symbol);
    const slippage = (Math.random() - 0.5) * 0.002; // ±0.2% slippage
    const fillPrice = marketPrice * (1 + slippage);
    
    order.filledQuantity = filledQuantity;
    order.averagePrice = fillPrice;
    order.status = filledQuantity === order.quantity ? 'filled' : 'partially_filled';
    order.fees = filledQuantity * fillPrice * 0.001; // 0.1% fee
    order.updateTime = new Date();

    logger.info('[BrokerManager] Order filled:', {
      orderId,
      filledQuantity,
      averagePrice: fillPrice,
      status: order.status
    });

    this.emit('orderFilled', { orderId, order });

    // Update position
    this.updatePosition(order);
  }

  private updatePosition(order: Order): void {
    const positionKey = `${order.brokerId}_${order.symbol}`;
    let position = this.positions.get(positionKey);

    if (!position) {
      position = {
        brokerId: order.brokerId,
        symbol: order.symbol,
        side: order.side === 'buy' ? 'long' : 'short',
        quantity: 0,
        averagePrice: 0,
        marketValue: 0,
        unrealizedPnl: 0,
        realizedPnl: 0,
        timestamp: new Date()
      };
    }

    // Update position based on order
    if (order.side === 'buy') {
      const totalCost = position.quantity * position.averagePrice + order.filledQuantity * order.averagePrice;
      const totalQuantity = position.quantity + order.filledQuantity;
      position.averagePrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;
      position.quantity = totalQuantity;
    } else {
      position.quantity -= order.filledQuantity;
      if (position.quantity < 0) {
        position.side = 'short';
        position.quantity = Math.abs(position.quantity);
      }
    }

    // Calculate market value and P&L
    const marketPrice = this.getSimulatedMarketPrice(order.symbol);
    position.marketValue = position.quantity * marketPrice;
    position.unrealizedPnl = (marketPrice - position.averagePrice) * position.quantity;
    position.timestamp = new Date();

    this.positions.set(positionKey, position);
    this.emit('positionUpdated', { positionKey, position });
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      const order = this.orders.get(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status === 'filled' || order.status === 'cancelled') {
        throw new Error('Order cannot be cancelled');
      }

      // Simulate API call
      await this.simulateApiCall(this.getBrokerType(order.brokerId), 'cancelOrder');

      order.status = 'cancelled';
      order.updateTime = new Date();

      logger.info('[BrokerManager] Order cancelled:', { orderId });
      this.emit('orderCancelled', { orderId, order });

      return true;

    } catch (error) {
      logger.error('[BrokerManager] Failed to cancel order:', { orderId, error: String(error) });
      return false;
    }
  }

  async getBalances(brokerId: string): Promise<Balance[]> {
    const balances = this.balances.get(brokerId) || [];
    return balances;
  }

  async getPositions(brokerId?: string): Promise<Position[]> {
    const allPositions = Array.from(this.positions.values());
    return brokerId ? allPositions.filter(p => p.brokerId === brokerId) : allPositions;
  }

  async getOrders(brokerId?: string, status?: string): Promise<Order[]> {
    const allOrders = Array.from(this.orders.values());
    let filteredOrders = allOrders;
    
    if (brokerId) {
      filteredOrders = filteredOrders.filter(o => o.brokerId === brokerId);
    }
    
    if (status) {
      filteredOrders = filteredOrders.filter(o => o.status === status);
    }
    
    return filteredOrders.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getBrokerStatus(brokerId: string): BrokerStatus | null {
    return this.brokerStatus.get(brokerId) || null;
  }

  getAllBrokerStatuses(): BrokerStatus[] {
    return Array.from(this.brokerStatus.values());
  }

  // Emergency controls
  async emergencyStopTrading(brokerId?: string): Promise<void> {
    logger.warn('[BrokerManager] EMERGENCY STOP activated', { brokerId });
    
    const brokersToStop = brokerId ? [brokerId] : Array.from(this.brokers.keys());
    
    for (const id of brokersToStop) {
      const broker = this.brokers.get(id);
      if (broker) {
        broker.enabled = false;
        
        // Cancel all open orders
        const openOrders = await this.getOrders(id, 'open');
        for (const order of openOrders) {
          await this.cancelOrder(order.id);
        }
      }
    }
    
    this.emit('emergencyStop', { brokerId, timestamp: new Date() });
  }

  async liquidateAllPositions(brokerId?: string): Promise<void> {
    logger.warn('[BrokerManager] Position liquidation initiated', { brokerId });
    
    const positions = await this.getPositions(brokerId);
    
    for (const position of positions) {
      if (position.quantity > 0) {
        await this.placeOrder({
          brokerId: position.brokerId,
          symbol: position.symbol,
          side: position.side === 'long' ? 'sell' : 'buy',
          type: 'market',
          quantity: position.quantity
        });
      }
    }
    
    this.emit('positionsLiquidated', { brokerId, timestamp: new Date() });
  }

  // Utility methods
  private async simulateApiCall(brokerType: string, endpoint: string): Promise<void> {
    const latency = Math.random() * 200 + 50; // 50-250ms latency
    await new Promise(resolve => setTimeout(resolve, latency));
    
    // Update API limits
    for (const [brokerId, status] of this.brokerStatus.entries()) {
      if (this.getBrokerType(brokerId) === brokerType) {
        status.apiLimits.weight += 1;
        if (endpoint === 'placeOrder' || endpoint === 'cancelOrder') {
          status.apiLimits.orders += 1;
        }
      }
    }
  }

  private getBrokerType(brokerId: string): string {
    const broker = this.brokers.get(brokerId);
    return broker?.type || 'unknown';
  }

  private getSimulatedMarketPrice(symbol: string): number {
    // Return simulated market prices
    const basePrices: Record<string, number> = {
      'BTC/USD': 65000,
      'ETH/USD': 3500,
      'BTC/USDT': 65000,
      'ETH/USDT': 3500,
      'SOL/USD': 150,
      'ADA/USD': 0.8
    };
    
    const basePrice = basePrices[symbol] || 100;
    const volatility = 0.02; // 2% volatility
    const randomFactor = 1 + (Math.random() - 0.5) * volatility * 2;
    
    return basePrice * randomFactor;
  }

  private simulateBalanceUpdate(brokerId: string, brokerType: string): void {
    const balances: Balance[] = [
      {
        brokerId,
        asset: 'USD',
        free: 50000 + Math.random() * 100000,
        locked: Math.random() * 10000,
        total: 0,
        usdValue: 0,
        timestamp: new Date()
      },
      {
        brokerId,
        asset: 'BTC',
        free: Math.random() * 2,
        locked: Math.random() * 0.1,
        total: 0,
        usdValue: 0,
        timestamp: new Date()
      },
      {
        brokerId,
        asset: 'ETH',
        free: Math.random() * 10,
        locked: Math.random() * 1,
        total: 0,
        usdValue: 0,
        timestamp: new Date()
      }
    ];

    // Calculate totals and USD values
    for (const balance of balances) {
      balance.total = balance.free + balance.locked;
      if (balance.asset === 'USD') {
        balance.usdValue = balance.total;
      } else {
        const price = this.getSimulatedMarketPrice(`${balance.asset}/USD`);
        balance.usdValue = balance.total * price;
      }
    }

    this.balances.set(brokerId, balances);
    this.emit('balanceUpdated', { brokerId, balances });
  }

  private simulateOrderUpdates(brokerId: string): void {
    // Simulate random order status updates
    const brokerOrders = Array.from(this.orders.values()).filter(o => o.brokerId === brokerId);
    const openOrders = brokerOrders.filter(o => o.status === 'open');
    
    if (openOrders.length > 0 && Math.random() < 0.3) {
      const randomOrder = openOrders[Math.floor(Math.random() * openOrders.length)];
      this.simulateOrderFill(randomOrder.id);
    }
  }

  isLiveTradingMode(): boolean {
    return this.isLiveMode;
  }

  setLiveTradingMode(isLive: boolean): void {
    this.isLiveMode = isLive;
    logger.info(`[BrokerManager] Trading mode changed to: ${isLive ? 'LIVE' : 'PAPER'}`);
    this.emit('tradingModeChanged', { isLive });
  }
}