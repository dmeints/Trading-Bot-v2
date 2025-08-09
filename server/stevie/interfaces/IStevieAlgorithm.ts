/**
 * Stevie Algorithm Interface
 * Contracts for safe experimentation with different trading algorithms
 */

export interface MarketData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: Date;
  technicalIndicators?: Record<string, number>;
  sentiment?: SentimentData;
}

export interface SentimentData {
  social: number;    // -1 to 1
  news: number;      // -1 to 1
  onchain: number;   // -1 to 1
  confidence: number; // 0 to 1
}

export interface TradingSuggestion {
  action: 'buy' | 'sell' | 'hold';
  symbol: string;
  confidence: number;
  reasoning: string;
  positionSize?: number;
  stopLoss?: number;
  takeProfit?: number;
  timeframe?: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface MarketAnalysis {
  symbol: string;
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 0 to 1
  keyLevels: {
    support: number[];
    resistance: number[];
  };
  sentiment: SentimentData;
  technicalSignals: TechnicalSignal[];
  confidence: number;
  timeframe: string;
}

export interface TechnicalSignal {
  indicator: string;
  signal: 'buy' | 'sell' | 'neutral';
  strength: number;
  value: number;
}

export interface AlgorithmPerformance {
  sharpeRatio: number;
  totalReturn: number;
  winRate: number;
  maxDrawdown: number;
  trades: number;
  accuracy: number;
  lastUpdated: Date;
}

export interface AlgorithmConfig {
  version: string;
  type: string;
  parameters: Record<string, any>;
  riskSettings: Record<string, any>;
  enabled: boolean;
}

/**
 * Main interface that all Stevie algorithms must implement
 */
export interface IStevieAlgorithm {
  // Core algorithm identification
  getName(): string;
  getVersion(): string;
  getDescription(): string;
  
  // Configuration management
  getConfig(): AlgorithmConfig;
  updateConfig(config: Partial<AlgorithmConfig>): Promise<void>;
  validateConfig(config: AlgorithmConfig): boolean;
  
  // Market analysis capabilities
  analyzeMarket(data: MarketData): Promise<MarketAnalysis>;
  generateTradingSuggestion(
    userId: string, 
    marketData: MarketData, 
    userContext: any
  ): Promise<TradingSuggestion>;
  
  // Learning and training
  train(historicalData: MarketData[]): Promise<void>;
  evaluatePerformance(testData: MarketData[]): Promise<AlgorithmPerformance>;
  saveModel(path: string): Promise<void>;
  loadModel(path: string): Promise<void>;
  
  // Real-time operations
  processRealtimeData(data: MarketData): Promise<void>;
  shouldRetrain(): Promise<boolean>;
  getHealthStatus(): AlgorithmHealthStatus;
  
  // Lifecycle management
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  reset(): Promise<void>;
}

export interface AlgorithmHealthStatus {
  status: 'healthy' | 'degraded' | 'failed';
  performance: AlgorithmPerformance;
  lastError?: string;
  uptime: number;
  memoryUsage: number;
  lastUpdate: Date;
}

/**
 * Factory interface for creating different algorithm implementations
 */
export interface IStevieAlgorithmFactory {
  createAlgorithm(type: string, config: AlgorithmConfig): Promise<IStevieAlgorithm>;
  getAvailableAlgorithms(): string[];
  validateAlgorithmType(type: string): boolean;
}

/**
 * Plugin interface for extending algorithm capabilities
 */
export interface IAlgorithmPlugin {
  getName(): string;
  getVersion(): string;
  install(algorithm: IStevieAlgorithm): Promise<void>;
  uninstall(algorithm: IStevieAlgorithm): Promise<void>;
  isCompatible(algorithmVersion: string): boolean;
}

/**
 * Ensemble algorithm interface for combining multiple models
 */
export interface IEnsembleAlgorithm extends IStevieAlgorithm {
  addModel(algorithm: IStevieAlgorithm, weight: number): Promise<void>;
  removeModel(algorithmId: string): Promise<void>;
  updateWeights(weights: Record<string, number>): Promise<void>;
  getModelPerformance(): Promise<Record<string, AlgorithmPerformance>>;
}

/**
 * Algorithm comparison and A/B testing interface
 */
export interface IAlgorithmComparator {
  compareAlgorithms(
    algorithms: IStevieAlgorithm[], 
    testData: MarketData[]
  ): Promise<AlgorithmComparisonResult>;
  
  runABTest(
    algorithmA: IStevieAlgorithm,
    algorithmB: IStevieAlgorithm,
    duration: number
  ): Promise<ABTestResult>;
}

export interface AlgorithmComparisonResult {
  winner: string;
  results: Record<string, AlgorithmPerformance>;
  statisticalSignificance: number;
  recommendation: string;
}

export interface ABTestResult {
  algorithmAPerformance: AlgorithmPerformance;
  algorithmBPerformance: AlgorithmPerformance;
  winnerConfidence: number;
  sampleSize: number;
  testDuration: number;
  recommendation: 'A' | 'B' | 'inconclusive';
}