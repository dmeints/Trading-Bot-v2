export interface MarketData {
  symbol: string;
  price: number;
  volume24h: number;
  change24h: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface Portfolio {
  totalValue: number;
  totalPnl: number;
  positions: Position[];
  availableBalance: number;
  riskScore: 'low' | 'medium' | 'high';
}

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  stopLoss?: number;
  takeProfit?: number;
  status: 'open' | 'closed';
}

export interface StrategySignal {
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  confidence: number; // 0-1
  quantity: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  reasoning: string;
  metadata?: Record<string, any>;
}

export interface PluginConfig {
  enabled: boolean;
  parameters: Record<string, any>;
  riskLimits: {
    maxPositionSize: number;
    maxDailyLoss: number;
    allowedSymbols: string[];
  };
  schedule?: {
    enabled: boolean;
    cron: string;
  };
}

export interface PluginContext {
  logger: PluginLogger;
  metrics: PluginMetrics;
  storage: PluginStorage;
  api: PluginAPI;
}

export interface PluginLogger {
  info(message: string, data?: any): void;
  error(message: string, error?: Error): void;
  warn(message: string, data?: any): void;
  debug(message: string, data?: any): void;
}

export interface PluginMetrics {
  counter(name: string, value?: number): void;
  gauge(name: string, value: number): void;
  histogram(name: string, value: number): void;
}

export interface PluginStorage {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface PluginAPI {
  getHistoricalData(symbol: string, days: number): Promise<MarketData[]>;
  getMarketData(symbols: string[]): Promise<MarketData[]>;
  executeTrade(signal: StrategySignal): Promise<boolean>;
  getPortfolio(): Promise<Portfolio>;
}

export interface StrategyPlugin {
  name: string;
  version: string;
  description: string;
  author: string;
  
  // Plugin lifecycle
  initialize(config: PluginConfig, context: PluginContext): Promise<void>;
  execute(marketData: MarketData[], portfolio: Portfolio): Promise<StrategySignal[]>;
  cleanup(): Promise<void>;
  
  // Configuration
  getDefaultConfig(): PluginConfig;
  validateConfig(config: PluginConfig): boolean;
  
  // Optional hooks
  onMarketOpen?(): Promise<void>;
  onMarketClose?(): Promise<void>;
  onPriceUpdate?(symbol: string, price: number): Promise<void>;
  onTradeExecuted?(trade: any): Promise<void>;
  onError?(error: Error): Promise<void>;
}

export interface PluginMetadata {
  name: string;
  version: string;
  enabled: boolean;
  config: PluginConfig;
  performance: {
    totalSignals: number;
    successfulTrades: number;
    totalReturn: number;
    winRate: number;
    sharpeRatio: number;
  };
  lastExecution: Date;
  errors: Array<{
    timestamp: Date;
    message: string;
    stack?: string;
  }>;
}