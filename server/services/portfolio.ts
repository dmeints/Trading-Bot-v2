import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

// --- Interfaces ---

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StrategyConfig {
  symbol: string;
  strategyName: string;
  parameters: Record<string, any>;
}

export interface StrategyResult {
  timestamp: number;
  signal: number; // -1 (sell), 0 (hold), 1 (buy)
  confidence: number;
  explanation: string;
}

export interface PortfolioAllocation {
  symbol: string;
  weight: number;
  expectedReturn: number;
  risk: number;
}

export interface OptimizationRequest {
  symbols: string[];
  cvarBudget: number;
  volTarget: number;
}

export interface OptimizationResult {
  weights: { [symbol: string]: number };
  achievedVol: number;
  cvarBudgetUsed: number;
  expectedReturn: number;
  success: boolean;
  iterations: number;
}

// --- Health Check ---
export async function checkHealth() {
  try {
    const response = await axios.get('/api/health');
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    return { status: 'unhealthy', error: error.message };
  }
}

// --- Data Persistence (Mock) ---
const mockDatabase: Record<string, OHLCV[]> = {};

export async function persistOHLCV(symbol: string, data: OHLCV[]) {
  if (!mockDatabase[symbol]) {
    mockDatabase[symbol] = [];
  }
  mockDatabase[symbol].push(...data);
  console.log(`Persisted ${data.length} OHLCV data points for ${symbol}`);
}

export async function getOHLCV(symbol: string, limit: number = 1000): Promise<OHLCV[]> {
  console.log(`Fetching last ${limit} OHLCV data points for ${symbol}`);
  return mockDatabase[symbol]?.slice(-limit) || [];
}

// --- WebSocket Data Stream (Mock) ---
let wsClients: Record<string, WebSocket | null> = {};

export function subscribeToOHLCV(symbol: string, onData: (data: OHLCV) => void) {
  if (wsClients[symbol]) {
    console.log(`Already subscribed to ${symbol}`);
    return;
  }

  console.log(`Subscribing to ${symbol} OHLCV stream...`);
  // In a real app, this would connect to a WebSocket server
  const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_1m'); // Example for BTCUSDT 1 minute

  ws.onopen = () => {
    console.log(`WebSocket connected for ${symbol}`);
    wsClients[symbol] = ws;
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data as string);
      if (message.e === 'kline') {
        const kline = message.k;
        const ohlcvData: OHLCV = {
          timestamp: kline.t,
          open: parseFloat(kline.o),
          high: parseFloat(kline.h),
          low: parseFloat(kline.l),
          close: parseFloat(kline.c),
          volume: parseFloat(kline.v),
        };
        onData(ohlcvData);
        // Persist data as it arrives
        persistOHLCV(symbol, [ohlcvData]);
      }
    } catch (error) {
      console.error(`Error processing WebSocket message for ${symbol}:`, error);
    }
  };

  ws.onerror = (error) => {
    console.error(`WebSocket error for ${symbol}:`, error);
    wsClients[symbol] = null;
    // Implement retry logic here
  };

  ws.onclose = () => {
    console.log(`WebSocket disconnected for ${symbol}`);
    wsClients[symbol] = null;
    // Implement retry logic here
  };
}

export function unsubscribeFromOHLCV(symbol: string) {
  if (wsClients[symbol]) {
    console.log(`Unsubscribing from ${symbol} OHLCV stream...`);
    wsClients[symbol]?.close();
    wsClients[symbol] = null;
  }
}

// --- Trading Strategies (Mock) ---

// Simple Moving Average Crossover Strategy
export function smaCrossoverStrategy(config: StrategyConfig): StrategyResult | null {
  const { symbol, parameters } = config;
  const shortPeriod = parameters.shortPeriod || 10;
  const longPeriod = parameters.longPeriod || 30;

  const historicalData = getOHLCV(symbol, longPeriod); // Need enough data for the longest SMA

  if (historicalData.length < longPeriod) {
    return null; // Not enough data
  }

  const calculateSMA = (period: number): number => {
    const relevantData = historicalData.slice(-period);
    const sum = relevantData.reduce((acc, data) => acc + data.close, 0);
    return sum / period;
  };

  const shortSMA = calculateSMA(shortPeriod);
  const longSMA = calculateSMA(longPeriod);

  const currentClose = historicalData[historicalData.length - 1].close;
  const previousShortSMA = calculateSMA(shortPeriod); // Recalculate for previous candle
  const previousLongSMA = calculateSMA(longPeriod); // Recalculate for previous candle

  let signal = 0;
  let confidence = 0;
  let explanation = '';

  if (previousShortSMA < previousLongSMA && shortSMA > longSMA) {
    signal = 1; // Buy signal
    confidence = Math.min(1, (shortSMA - longSMA) / longSMA);
    explanation = `Short SMA (${shortSMA.toFixed(2)}) crossed above Long SMA (${longSMA.toFixed(2)})`;
  } else if (previousShortSMA > previousLongSMA && shortSMA < longSMA) {
    signal = -1; // Sell signal
    confidence = Math.min(1, (longSMA - shortSMA) / longSMA);
    explanation = `Short SMA (${shortSMA.toFixed(2)}) crossed below Long SMA (${longSMA.toFixed(2)})`;
  } else {
    signal = 0; // Hold
    confidence = 0;
    explanation = 'No clear crossover signal';
  }

  return {
    timestamp: historicalData[historicalData.length - 1].timestamp,
    signal,
    confidence,
    explanation,
  };
}

// Simple RSI Strategy
export function rsiStrategy(config: StrategyConfig): StrategyResult | null {
  const { symbol, parameters } = config;
  const period = parameters.period || 14;
  const overbought = parameters.overbought || 70;
  const oversold = parameters.oversold || 30;

  const historicalData = getOHLCV(symbol, period + 1); // Need enough data to calculate RSI

  if (historicalData.length < period + 1) {
    return null; // Not enough data
  }

  const calculateRSI = (data: OHLCV[]): number => {
    let gains = 0;
    let losses = 0;
    for (let i = 0; i < period; i++) {
      const change = data[data.length - 1 - i].close - data[data.length - 2 - i].close;
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100; // Avoid division by zero if no losses
    if (avgGain === 0) return 0; // Avoid division by zero if no gains

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  };

  const rsi = calculateRSI(historicalData);

  let signal = 0;
  let confidence = 0;
  let explanation = '';

  if (rsi > overbought) {
    signal = -1; // Sell signal
    confidence = Math.min(1, (rsi - overbought) / (100 - overbought));
    explanation = `RSI (${rsi.toFixed(2)}) is overbought`;
  } else if (rsi < oversold) {
    signal = 1; // Buy signal
    confidence = Math.min(1, (oversold - rsi) / oversold);
    explanation = `RSI (${rsi.toFixed(2)}) is oversold`;
  } else {
    signal = 0; // Hold
    confidence = 0;
    explanation = 'RSI is neutral';
  }

  return {
    timestamp: historicalData[historicalData.length - 1].timestamp,
    signal,
    confidence,
    explanation,
  };
}

// --- Portfolio Management ---

class PortfolioManager {
  private strategies: Record<string, (config: StrategyConfig) => StrategyResult | null> = {
    smaCrossover: smaCrossoverStrategy,
    rsi: rsiStrategy,
  };
  private currentAllocations: PortfolioAllocation[] = [];
  private strategyResults: Record<string, StrategyResult | null> = {};

  // Placeholder for brain components
  private strategyRouter: any; // Contextual Bandit StrategyRouter
  private regimeDetector: any; // BOCPD Regime Switch
  private featureGater: any; // Feature Gating
  private sizingScaler: any; // Uncertainty-Scaled Sizing
  private ppoAgent: any; // Risk-Aware PPO
  private pbtManager: any; // PBT & Champion/Challenger
  private portfolioOptimizer: any; // CVaR Budgeter & Vol Targeting

  constructor() {
    // Initialize brain components (mock implementations for now)
    this.strategyRouter = {
      selectStrategy: (symbol: string, data: OHLCV[]) => {
        console.log('StrategyRouter: Selecting strategy for', symbol);
        // Mock: Randomly pick one or use a simple rule
        const availableStrategies = Object.keys(this.strategies);
        const randomIndex = Math.floor(Math.random() * availableStrategies.length);
        return availableStrategies[randomIndex];
      },
      update: (strategyName: string, reward: number) => {
        console.log(`StrategyRouter: Updating for ${strategyName} with reward ${reward}`);
      }
    };

    this.regimeDetector = {
      detectRegime: (data: OHLCV[]) => {
        console.log('RegimeDetector: Detecting regime');
        // Mock: Return a default regime
        return 'normal';
      },
      update: (regime: string) => {
        console.log(`RegimeDetector: Updating for regime ${regime}`);
      }
    };

    this.featureGater = {
      isEnabled: (featureName: string, context: any) => {
        console.log(`FeatureGater: Checking if ${featureName} is enabled`, context);
        // Mock: Enable all features for now
        return true;
      }
    };

    this.sizingScaler = {
      scaleSizing: (signal: number, confidence: number, risk: number, context: any) => {
        console.log(`SizingScaler: Scaling sizing for signal ${signal}, confidence ${confidence}, risk ${risk}`);
        // Mock: Simple scaling based on confidence
        return signal * confidence * 0.5; // Scale signal by confidence and a factor
      }
    };

    this.ppoAgent = {
      act: (state: any) => {
        console.log('PPOAgent: Acting');
        // Mock: Random action
        return { action: Math.random() > 0.5 ? 1 : -1, value: Math.random() };
      },
      train: (state: any, action: number, reward: number, nextState: any, done: boolean) => {
        console.log('PPOAgent: Training step');
      }
    };

    this.pbtManager = {
      getBestHyperparameters: () => {
        console.log('PBTManager: Getting best hyperparameters');
        // Mock: Return default hyperparameters
        return { learningRate: 0.001, discountFactor: 0.99 };
      },
      evaluateCandidate: (hyperparams: any, data: OHLCV[]) => {
        console.log('PBTManager: Evaluating candidate hyperparameters', hyperparams);
        // Mock: Return a random fitness score
        return Math.random();
      },
      updatePopulation: (results: any[]) => {
        console.log('PBTManager: Updating population');
      }
    };

    // Initialize Portfolio Optimizer
    this.portfolioOptimizer = new PortfolioOptimizer();
  }

  async managePortfolio(symbols: string[], config: StrategyConfig[]) {
    console.log('Managing portfolio for symbols:', symbols);

    // 1. Fetch latest data for all symbols
    const historicalDataPromises = symbols.map(symbol => getOHLCV(symbol, 100)); // Fetch last 100 data points
    const historicalDataMap = (await Promise.all(historicalDataPromises)).reduce((acc, data, index) => {
      acc[symbols[index]] = data;
      return acc;
    }, {} as Record<string, OHLCV[]>);

    // 2. Detect market regime
    const combinedData = symbols.flatMap(symbol => historicalDataMap[symbol]);
    const marketRegime = this.regimeDetector.detectRegime(combinedData);
    this.regimeDetector.update(marketRegime);

    const updatedAllocations: PortfolioAllocation[] = [];

    for (const symbol of symbols) {
      const symbolData = historicalDataMap[symbol];
      if (!symbolData || symbolData.length === 0) {
        console.warn(`No data found for ${symbol}, skipping.`);
        continue;
      }

      // 3. Select appropriate strategy using StrategyRouter
      const strategyName = this.strategyRouter.selectStrategy(symbol, symbolData);
      const strategyConfig = config.find(c => c.symbol === symbol) || { symbol, strategyName, parameters: {} };
      strategyConfig.strategyName = strategyName; // Ensure the selected strategy is used

      // 4. Execute the selected strategy
      const strategyExecutor = this.strategies[strategyName];
      let strategyResult: StrategyResult | null = null;
      if (strategyExecutor) {
        strategyResult = strategyExecutor(strategyConfig);
        this.strategyResults[`${symbol}-${strategyName}`] = strategyResult; // Store result
      } else {
        console.warn(`Strategy "${strategyName}" not found for ${symbol}.`);
        continue;
      }

      if (!strategyResult) {
        console.warn(`Strategy "${strategyName}" returned no result for ${symbol}.`);
        continue;
      }

      // Update strategy router with outcome (mock reward)
      const reward = strategyResult.signal * strategyResult.confidence; // Simple reward
      this.strategyRouter.update(strategyName, reward);

      // 5. Feature Gating
      const featureContext = { symbol, strategyResult, marketRegime };
      const useAdvancedFeatures = this.featureGater.isEnabled('advancedBrainFeatures', featureContext);

      let finalSignal = strategyResult.signal;
      let scaledConfidence = strategyResult.confidence;

      if (useAdvancedFeatures) {
        // 6. Uncertainty-Scaled Sizing
        const assetRisk = this.calculateAssetRisk(symbol, symbolData); // Calculate risk for the asset
        scaledConfidence = this.sizingScaler.scaleSizing(
          strategyResult.signal,
          strategyResult.confidence,
          assetRisk,
          featureContext
        );

        // 7. Risk-Aware PPO (for action selection/refinement if needed)
        const ppoState = { ...strategyResult, historicalData: symbolData, risk: assetRisk };
        const ppoAction = this.ppoAgent.act(ppoState);
        // Here you might combine PPO action with strategyResult. For simplicity, we'll just use the scaled signal.
        // Example: if PPO suggests a strong buy, boost the signal.
        finalSignal = scaledConfidence; // Use the scaled confidence as the final signal magnitude
        this.ppoAgent.train(ppoState, ppoAction.action, reward, { ...ppoState, signal: finalSignal }, false); // Train PPO

      }

      // 8. Portfolio Allocation (based on final signal/confidence)
      // This is a simplified allocation, later refined by optimization
      const allocation: PortfolioAllocation = {
        symbol: symbol,
        weight: 0, // Will be determined by optimization
        expectedReturn: finalSignal * 10, // Mock expected return based on signal strength
        risk: this.calculateAssetRisk(symbol, symbolData), // Calculate risk
      };
      updatedAllocations.push(allocation);
    }

    // 9. CVaR Budgeter & Vol Targeting Optimization
    const symbolsForOptimization = updatedAllocations.map(a => a.symbol);
    const optimizationRequest: OptimizationRequest = {
      symbols: symbolsForOptimization,
      cvarBudget: 0.02, // Example: 2% CVaR budget
      volTarget: 0.03,  // Example: 3% target volatility
    };

    const optimizationResult = this.portfolioOptimizer.optimizePortfolio(optimizationRequest);
    console.log('Portfolio Optimization Result:', optimizationResult);

    // Update weights based on optimization results
    this.currentAllocations = updatedAllocations.map(alloc => ({
      ...alloc,
      weight: optimizationResult.weights[alloc.symbol] || 0,
    }));

    // 10. Population-Based Training & Champion/Challenger (Conceptual)
    // This would typically run in a separate process or on a schedule
    // const pbtResults = this.pbtManager.evaluateCandidate({ /* current strategy params */ }, combinedData);
    // this.pbtManager.updatePopulation([{ hyperparameters: { /* ... */ }, fitness: pbtResults }]);

    console.log('Current Portfolio Allocations:', this.currentAllocations);
    return this.currentAllocations;
  }

  private calculateAssetRisk(symbol: string, data: OHLCV[]): number {
    if (data.length < 2) {
      return 0.05; // Default risk if not enough data
    }
    // Simple calculation: standard deviation of closing prices (or returns)
    const prices = data.map(d => d.close);
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (prices.length - 1);
    const stdDev = Math.sqrt(variance);
    // Convert to daily or appropriate frequency risk
    return stdDev / Math.sqrt(prices.length); // Very rough approximation
  }
}

class PortfolioOptimizer {
  // --- Portfolio Optimization Methods ---

  // Mock implementation for optimization logic
  optimizePortfolio(request: OptimizationRequest): OptimizationResult {
    const { symbols, cvarBudget, volTarget } = request;

    // Get historical data for each symbol
    const historicalData = this.getHistoricalReturns(symbols);
    const assetStats = this.computeAssetStatistics(historicalData);

    // Initialize equal weights
    let weights = symbols.reduce((acc, symbol) => {
      acc[symbol] = 1.0 / symbols.length;
      return acc;
    }, {} as { [symbol: string]: number });

    // Projected gradient descent optimization
    const result = this.projectedGradientOptimization(
      weights,
      assetStats,
      cvarBudget,
      volTarget
    );

    return result;
  }

  private getHistoricalReturns(symbols: string[]): { [symbol: string]: number[] } {
    // Mock historical returns for demonstration
    const data: { [symbol: string]: number[] } = {};

    for (const symbol of symbols) {
      const returns: number[] = [];
      let price = 100;

      // Generate 200 days of mock data
      for (let i = 0; i < 200; i++) {
        const volatility = this.getAssetVolatility(symbol);
        const return_ = (Math.random() - 0.5) * volatility * 2; // Random return within +/- volatility
        returns.push(return_);
        price *= (1 + return_);
      }

      data[symbol] = returns;
    }

    return data;
  }

  private getAssetVolatility(symbol: string): number {
    // Asset-specific volatilities (as daily percentage)
    if (symbol.includes('BTC')) return 0.04; // 4% daily vol
    if (symbol.includes('ETH')) return 0.05; // 5% daily vol
    if (symbol.includes('SOL')) return 0.07; // 7% daily vol
    return 0.03; // Default 3% daily vol
  }

  private computeAssetStatistics(historicalData: { [symbol: string]: number[] }) {
    const stats: { [symbol: string]: { mean: number; vol: number; cvar: number } } = {};

    for (const [symbol, returns] of Object.entries(historicalData)) {
      const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
      const vol = Math.sqrt(variance);
      const cvar = this.computeCVaR(returns, 0.05); // 5% CVaR

      stats[symbol] = { mean, vol, cvar };
    }

    return stats;
  }

  private computeCVaR(returns: number[], alpha: number): number {
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const cutoff = Math.floor(returns.length * alpha);
    // Ensure cutoff is within bounds and consider the elements up to and including cutoff index
    const validCutoff = Math.min(cutoff, sortedReturns.length - 1);
    const tailReturns = sortedReturns.slice(0, validCutoff + 1);

    if (tailReturns.length === 0) return 0; // Handle case where tail is empty

    return tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;
  }


  private projectedGradientOptimization(
    initialWeights: { [symbol: string]: number },
    assetStats: { [symbol: string]: { mean: number; vol: number; cvar: number } },
    cvarBudget: number,
    volTarget: number
  ): OptimizationResult {
    const symbols = Object.keys(initialWeights);
    let weights = { ...initialWeights };
    const maxIterations = 100;
    const learningRate = 0.01;
    const tolerance = 1e-6;

    let iteration = 0;
    let converged = false;

    while (iteration < maxIterations && !converged) {
      const gradient = this.computeGradient(weights, assetStats, cvarBudget, volTarget);
      const oldWeights = { ...weights };

      // Gradient step
      for (const symbol of symbols) {
        weights[symbol] -= learningRate * gradient[symbol];
      }

      // Project onto constraints
      weights = this.projectConstraints(weights);

      // Check convergence
      const change = Object.keys(weights).reduce((sum, symbol) => {
        return sum + Math.pow(weights[symbol] - oldWeights[symbol], 2);
      }, 0);

      converged = Math.sqrt(change) < tolerance;
      iteration++;
    }

    // Compute final metrics
    const achievedVol = this.computePortfolioVol(weights, assetStats);
    const cvarBudgetUsed = this.computePortfolioCVaR(weights, assetStats);
    const expectedReturn = this.computePortfolioReturn(weights, assetStats);

    return {
      weights,
      achievedVol,
      cvarBudgetUsed,
      expectedReturn,
      success: converged,
      iterations: iteration
    };
  }

  private computeGradient(
    weights: { [symbol: string]: number },
    assetStats: { [symbol: string]: { mean: number; vol: number; cvar: number } },
    cvarBudget: number,
    volTarget: number
  ): { [symbol: string]: number } {
    const gradient: { [symbol: string]: number } = {};
    const epsilon = 1e-6;

    for (const symbol of Object.keys(weights)) {
      // Finite difference approximation
      const weightsPlus = { ...weights };
      weightsPlus[symbol] += epsilon;
      const weightsPlus_proj = this.projectConstraints(weightsPlus);

      const weightsMinus = { ...weights };
      weightsMinus[symbol] -= epsilon;
      const weightsMinus_proj = this.projectConstraints(weightsMinus);

      const objectivePlus = this.objectiveFunction(weightsPlus_proj, assetStats, cvarBudget, volTarget);
      const objectiveMinus = this.objectiveFunction(weightsMinus_proj, assetStats, cvarBudget, volTarget);

      gradient[symbol] = (objectivePlus - objectiveMinus) / (2 * epsilon);
    }

    return gradient;
  }

  private objectiveFunction(
    weights: { [symbol: string]: number },
    assetStats: { [symbol: string]: { mean: number; vol: number; cvar: number } },
    cvarBudget: number,
    volTarget: number
  ): number {
    const portfolioVol = this.computePortfolioVol(weights, assetStats);
    const portfolioCVaR = this.computePortfolioCVaR(weights, assetStats);
    const portfolioReturn = this.computePortfolioReturn(weights, assetStats);

    // Objective: maximize return, penalize vol deviation, penalize CVaR violation
    const volPenalty = Math.pow(portfolioVol - volTarget, 2);
    const cvarPenalty = Math.max(0, portfolioCVaR - cvarBudget) * 1000; // Heavy penalty for CVaR violation

    return portfolioReturn - 10 * volPenalty - cvarPenalty;
  }

  private computePortfolioVol(
    weights: { [symbol: string]: number },
    assetStats: { [symbol: string]: { mean: number; vol: number; cvar: number } }
  ): number {
    // Simplified: assume zero correlation (diagonal covariance)
    let portfolioVariance = 0;

    for (const [symbol, weight] of Object.entries(weights)) {
      // Ensure assetStats[symbol] exists before accessing .vol
      if (assetStats[symbol]) {
        const vol = assetStats[symbol].vol;
        portfolioVariance += weight * weight * vol * vol;
      }
    }

    return Math.sqrt(portfolioVariance);
  }

  private computePortfolioCVaR(
    weights: { [symbol: string]: number },
    assetStats: { [symbol: string]: { mean: number; vol: number; cvar: number } }
  ): number {
    // Linear approximation: weighted sum of individual CVaRs
    let portfolioCVaR = 0;

    for (const [symbol, weight] of Object.entries(weights)) {
      // Ensure assetStats[symbol] exists before accessing .cvar
      if (assetStats[symbol]) {
        portfolioCVaR += weight * assetStats[symbol].cvar;
      }
    }

    return portfolioCVaR;
  }

  private computePortfolioReturn(
    weights: { [symbol: string]: number },
    assetStats: { [symbol: string]: { mean: number; vol: number; cvar: number } }
  ): number {
    let portfolioReturn = 0;

    for (const [symbol, weight] of Object.entries(weights)) {
      // Ensure assetStats[symbol] exists before accessing .mean
      if (assetStats[symbol]) {
        portfolioReturn += weight * assetStats[symbol].mean;
      }
    }

    return portfolioReturn;
  }

  private projectConstraints(weights: { [symbol: string]: number }): { [symbol: string]: number } {
    const symbols = Object.keys(weights);
    const projected = { ...weights };

    // Non-negativity constraints
    for (const symbol of symbols) {
      projected[symbol] = Math.max(0, projected[symbol]);
    }

    // Sum to 1 constraint (normalize)
    const sum = Object.values(projected).reduce((s, w) => s + w, 0);
    if (sum > 0) {
      for (const symbol of symbols) {
        projected[symbol] /= sum;
      }
    } else {
      // If all weights are zero, return equal weights
      const numSymbols = symbols.length;
      if (numSymbols > 0) {
        for (const symbol of symbols) {
          projected[symbol] = 1.0 / numSymbols;
        }
      }
    }

    return projected;
  }
}

export default PortfolioManager;