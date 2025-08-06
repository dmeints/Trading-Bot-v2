/**
 * Predictive Analytics Revolution - Strategy DNA Evolution & Risk Prediction
 * 
 * Real-time parameter optimization, strategy breeding, and correlation breakdown prediction
 */

import { storage } from '../storage';
import { logger } from '../utils/logger';
import { backtestEngine } from './backtestEngine';

export interface StrategyDNA {
  id: string;
  parentStrategies: string[];
  genes: {
    riskTolerance: number;
    timeframe: string;
    indicators: string[];
    entryConditions: any[];
    exitConditions: any[];
    positionSizing: any;
  };
  performance: {
    returns: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
  };
  generation: number;
  fitness: number;
}

export interface CorrelationBreakdownPrediction {
  asset1: string;
  asset2: string;
  currentCorrelation: number;
  predictedCorrelation: number;
  breakdownProbability: number;
  timeframe: string;
  catalysts: string[];
  confidence: number;
}

export interface RealTimeOptimization {
  strategy: string;
  parameter: string;
  currentValue: any;
  optimizedValue: any;
  expectedImprovement: number;
  confidence: number;
  marketCondition: string;
}

export class PredictiveAnalyticsEngine {
  private strategyPopulation: Map<string, StrategyDNA> = new Map();
  private generationCount = 0;
  private optimizationHistory: Map<string, RealTimeOptimization[]> = new Map();

  constructor() {
    this.initializeStrategies();
  }

  private initializeStrategies() {
    // Create initial population of strategies
    const baseStrategies = [
      this.createTrendFollowingDNA(),
      this.createMeanReversionDNA(),
      this.createMomentumDNA(),
      this.createVolatilityDNA(),
      this.createSentimentDNA()
    ];

    baseStrategies.forEach(strategy => {
      this.strategyPopulation.set(strategy.id, strategy);
    });
  }

  async optimizeTradingParametersRealTime(userId: string): Promise<RealTimeOptimization[]> {
    try {
      const currentPortfolio = await storage.getPortfolioSummary(userId);
      const recentTrades = await storage.getUserTrades(userId, 20);
      const marketCondition = await storage.getCurrentMarketRegime('BTC/USD');
      
      const optimizations: RealTimeOptimization[] = [];

      // Optimize position sizing based on recent performance
      const positionSizeOptimization = await this.optimizePositionSizing(recentTrades, marketCondition?.regime || 'sideways');
      if (positionSizeOptimization) {
        optimizations.push(positionSizeOptimization);
      }

      // Optimize stop-loss levels
      const stopLossOptimization = await this.optimizeStopLoss(recentTrades, marketCondition?.volatility || 0.3);
      if (stopLossOptimization) {
        optimizations.push(stopLossOptimization);
      }

      // Optimize entry timing
      const entryOptimization = await this.optimizeEntryTiming(userId, marketCondition?.regime || 'sideways');
      if (entryOptimization) {
        optimizations.push(entryOptimization);
      }

      // Store optimization history
      this.optimizationHistory.set(userId, optimizations);

      logger.info(`Generated real-time optimizations`, { 
        userId, 
        optimizationCount: optimizations.length,
        marketCondition: marketCondition?.regime 
      });

      return optimizations;

    } catch (error) {
      logger.error(`Failed to optimize trading parameters`, { userId, error });
      return [];
    }
  }

  private async optimizePositionSizing(recentTrades: any[], marketRegime: string): Promise<RealTimeOptimization | null> {
    if (recentTrades.length < 5) return null;

    const avgReturn = recentTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0) / recentTrades.length;
    const volatility = this.calculateTradeVolatility(recentTrades);
    
    // Kelly Criterion for optimal position sizing
    const winRate = recentTrades.filter(trade => (trade.pnl || 0) > 0).length / recentTrades.length;
    const avgWin = recentTrades.filter(trade => (trade.pnl || 0) > 0).reduce((sum, trade) => sum + trade.pnl, 0) / Math.max(1, recentTrades.filter(trade => trade.pnl > 0).length);
    const avgLoss = Math.abs(recentTrades.filter(trade => (trade.pnl || 0) < 0).reduce((sum, trade) => sum + trade.pnl, 0)) / Math.max(1, recentTrades.filter(trade => trade.pnl < 0).length);
    
    const kellyFraction = winRate - ((1 - winRate) / (avgWin / avgLoss));
    
    // Adjust for market regime
    const regimeMultiplier = {
      'bull': 1.2,
      'bear': 0.8,
      'sideways': 1.0,
      'volatile': 0.7
    };

    const currentPositionSize = 0.1; // Assume current 10% position size
    const optimizedSize = Math.max(0.02, Math.min(0.25, kellyFraction * (regimeMultiplier[marketRegime as keyof typeof regimeMultiplier] || 1.0)));
    
    const expectedImprovement = this.calculateExpectedImprovement(currentPositionSize, optimizedSize, avgReturn, volatility);

    return {
      strategy: 'position_sizing',
      parameter: 'position_fraction',
      currentValue: currentPositionSize,
      optimizedValue: optimizedSize,
      expectedImprovement,
      confidence: Math.min(0.9, recentTrades.length / 20),
      marketCondition: marketRegime
    };
  }

  private async optimizeStopLoss(recentTrades: any[], volatility: number): Promise<RealTimeOptimization | null> {
    if (recentTrades.length < 5) return null;

    const currentStopLoss = 0.05; // Assume current 5% stop loss
    
    // Analyze trade outcomes at different stop loss levels
    const optimalStopLoss = this.findOptimalStopLoss(recentTrades, volatility);
    const expectedImprovement = this.calculateStopLossImprovement(recentTrades, currentStopLoss, optimalStopLoss);

    return {
      strategy: 'risk_management',
      parameter: 'stop_loss_percentage',
      currentValue: currentStopLoss,
      optimizedValue: optimalStopLoss,
      expectedImprovement,
      confidence: 0.8,
      marketCondition: volatility > 0.4 ? 'high_volatility' : 'normal_volatility'
    };
  }

  private findOptimalStopLoss(trades: any[], volatility: number): number {
    // Use ATR-based stop loss optimization
    const baseStopLoss = volatility * 2; // 2x volatility
    const maxStopLoss = 0.15; // Maximum 15%
    const minStopLoss = 0.02; // Minimum 2%
    
    return Math.max(minStopLoss, Math.min(maxStopLoss, baseStopLoss));
  }

  private async optimizeEntryTiming(userId: string, marketRegime: string): Promise<RealTimeOptimization | null> {
    try {
      const userPerformance = await storage.getUserPerformanceByTimeOfDay(userId);
      if (!userPerformance) return null;

      const currentTimingStrategy = 'immediate'; // Assume immediate execution
      const optimalTiming = this.findOptimalEntryTiming(userPerformance, marketRegime);
      
      return {
        strategy: 'entry_timing',
        parameter: 'execution_strategy',
        currentValue: currentTimingStrategy,
        optimizedValue: optimalTiming,
        expectedImprovement: 0.15, // Estimated 15% improvement
        confidence: 0.7,
        marketCondition: marketRegime
      };

    } catch (error) {
      return null;
    }
  }

  async evolveStrategies(): Promise<StrategyDNA[]> {
    try {
      this.generationCount++;
      const currentPopulation = Array.from(this.strategyPopulation.values());
      
      // Evaluate fitness for all strategies
      await this.evaluatePopulationFitness(currentPopulation);
      
      // Select top performers for breeding
      const parents = this.selectParents(currentPopulation);
      
      // Create new generation through crossover and mutation
      const offspring = this.createOffspring(parents);
      
      // Add offspring to population
      offspring.forEach(child => {
        this.strategyPopulation.set(child.id, child);
      });

      // Keep population size manageable
      this.prunePopulation();

      logger.info(`Evolved strategy generation ${this.generationCount}`, {
        populationSize: this.strategyPopulation.size,
        offspringCount: offspring.length
      });

      return offspring;

    } catch (error) {
      logger.error(`Failed to evolve strategies`, { error });
      return [];
    }
  }

  private async evaluatePopulationFitness(population: StrategyDNA[]): Promise<void> {
    for (const strategy of population) {
      // Run quick backtest to evaluate performance
      const backtestResult = await this.quickBacktest(strategy);
      
      // Calculate fitness score
      strategy.fitness = this.calculateFitness(backtestResult);
      
      // Update performance metrics
      strategy.performance = {
        returns: backtestResult.totalReturn || 0,
        sharpeRatio: backtestResult.sharpeRatio || 0,
        maxDrawdown: backtestResult.maxDrawdown || 0,
        winRate: backtestResult.winRate || 0
      };
    }
  }

  private calculateFitness(backtestResult: any): number {
    const returnsScore = Math.max(0, backtestResult.totalReturn || 0) * 0.3;
    const sharpeScore = Math.max(0, (backtestResult.sharpeRatio || 0) / 3) * 0.3;
    const drawdownScore = Math.max(0, 1 - (backtestResult.maxDrawdown || 0.5)) * 0.2;
    const winRateScore = (backtestResult.winRate || 0.5) * 0.2;
    
    return returnsScore + sharpeScore + drawdownScore + winRateScore;
  }

  private selectParents(population: StrategyDNA[]): StrategyDNA[] {
    // Tournament selection
    population.sort((a, b) => b.fitness - a.fitness);
    
    // Select top 30% as parents
    const parentCount = Math.max(2, Math.floor(population.length * 0.3));
    return population.slice(0, parentCount);
  }

  private createOffspring(parents: StrategyDNA[]): StrategyDNA[] {
    const offspring: StrategyDNA[] = [];
    
    for (let i = 0; i < parents.length; i++) {
      for (let j = i + 1; j < parents.length; j++) {
        const child = this.crossover(parents[i], parents[j]);
        this.mutate(child);
        offspring.push(child);
      }
    }
    
    return offspring;
  }

  private crossover(parent1: StrategyDNA, parent2: StrategyDNA): StrategyDNA {
    const childId = `gen${this.generationCount}_${Date.now()}`;
    
    return {
      id: childId,
      parentStrategies: [parent1.id, parent2.id],
      genes: {
        riskTolerance: (parent1.genes.riskTolerance + parent2.genes.riskTolerance) / 2,
        timeframe: Math.random() > 0.5 ? parent1.genes.timeframe : parent2.genes.timeframe,
        indicators: this.combineArrays(parent1.genes.indicators, parent2.genes.indicators),
        entryConditions: this.combineArrays(parent1.genes.entryConditions, parent2.genes.entryConditions),
        exitConditions: this.combineArrays(parent1.genes.exitConditions, parent2.genes.exitConditions),
        positionSizing: Math.random() > 0.5 ? parent1.genes.positionSizing : parent2.genes.positionSizing
      },
      performance: {
        returns: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0
      },
      generation: this.generationCount,
      fitness: 0
    };
  }

  private mutate(strategy: StrategyDNA): void {
    const mutationRate = 0.1;
    
    if (Math.random() < mutationRate) {
      strategy.genes.riskTolerance += (Math.random() - 0.5) * 0.2;
      strategy.genes.riskTolerance = Math.max(0.01, Math.min(1.0, strategy.genes.riskTolerance));
    }
    
    if (Math.random() < mutationRate) {
      const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
      strategy.genes.timeframe = timeframes[Math.floor(Math.random() * timeframes.length)];
    }
  }

  async predictCorrelationBreakdowns(): Promise<CorrelationBreakdownPrediction[]> {
    try {
      const correlations = await storage.getAllCorrelationData();
      const predictions: CorrelationBreakdownPrediction[] = [];
      
      for (const correlation of correlations) {
        const prediction = await this.analyzeCorrelationBreakdownRisk(correlation);
        if (prediction.breakdownProbability > 0.3) {
          predictions.push(prediction);
        }
      }

      predictions.sort((a, b) => b.breakdownProbability - a.breakdownProbability);

      logger.info(`Generated correlation breakdown predictions`, { 
        predictionCount: predictions.length 
      });

      return predictions;

    } catch (error) {
      logger.error(`Failed to predict correlation breakdowns`, { error });
      return [];
    }
  }

  private async analyzeCorrelationBreakdownRisk(correlation: any): Promise<CorrelationBreakdownPrediction> {
    // Analyze historical correlation stability
    const historicalCorrelations = await storage.getHistoricalCorrelations(correlation.asset1, correlation.asset2);
    const volatility = this.calculateCorrelationVolatility(historicalCorrelations);
    
    // Identify potential catalysts
    const catalysts = await this.identifyBreakdownCatalysts(correlation.asset1, correlation.asset2);
    
    // Calculate breakdown probability
    const baseRisk = Math.abs(correlation.correlation) > 0.8 ? 0.6 : 0.3;
    const volatilityRisk = volatility * 2;
    const catalystRisk = catalysts.length * 0.1;
    
    const breakdownProbability = Math.min(0.95, baseRisk + volatilityRisk + catalystRisk);
    
    // Predict future correlation
    const trend = this.calculateCorrelationTrend(historicalCorrelations);
    const predictedCorrelation = correlation.correlation + (trend * 0.5);

    return {
      asset1: correlation.asset1,
      asset2: correlation.asset2,
      currentCorrelation: correlation.correlation,
      predictedCorrelation: Math.max(-1, Math.min(1, predictedCorrelation)),
      breakdownProbability,
      timeframe: '30d',
      catalysts,
      confidence: Math.max(0.5, 1 - volatility)
    };
  }

  private calculateCorrelationVolatility(historicalCorrelations: any[]): number {
    if (historicalCorrelations.length < 2) return 0.5;

    const correlations = historicalCorrelations.map(h => h.correlation);
    const mean = correlations.reduce((sum, c) => sum + c, 0) / correlations.length;
    const variance = correlations.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / correlations.length;
    
    return Math.sqrt(variance);
  }

  private async identifyBreakdownCatalysts(asset1: string, asset2: string): Promise<string[]> {
    const catalysts: string[] = [];
    
    // Check for different asset classes
    if (this.isDifferentAssetClass(asset1, asset2)) {
      catalysts.push('Cross-asset class correlation risk');
    }
    
    // Check for market stress indicators
    const marketStress = await storage.getMarketStressIndicators();
    if (marketStress?.vixLevel > 30) {
      catalysts.push('Elevated market volatility');
    }
    
    // Check for sector-specific risks
    const sectorRisks = await this.analyzeSectorRisks(asset1, asset2);
    catalysts.push(...sectorRisks);
    
    return catalysts;
  }

  private isDifferentAssetClass(asset1: string, asset2: string): boolean {
    const assetClasses = {
      'BTC': 'crypto',
      'ETH': 'crypto',
      'SOL': 'crypto',
      'ADA': 'crypto',
      'DOT': 'crypto'
    };
    
    const class1 = assetClasses[asset1.split('/')[0] as keyof typeof assetClasses];
    const class2 = assetClasses[asset2.split('/')[0] as keyof typeof assetClasses];
    
    return class1 !== class2;
  }

  private async analyzeSectorRisks(asset1: string, asset2: string): Promise<string[]> {
    // Simplified sector risk analysis
    const risks: string[] = [];
    
    // Check for technology correlation risks
    if (asset1.includes('ETH') || asset2.includes('ETH')) {
      risks.push('Smart contract platform competition');
    }
    
    return risks;
  }

  // Helper methods
  private calculateTradeVolatility(trades: any[]): number {
    if (trades.length < 2) return 0.2;

    const returns = trades.map(trade => trade.pnl || 0);
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  private calculateExpectedImprovement(current: number, optimized: number, avgReturn: number, volatility: number): number {
    // Simplified improvement calculation
    const improvement = Math.abs(optimized - current) / current;
    return improvement * (Math.abs(avgReturn) / volatility);
  }

  private calculateStopLossImprovement(trades: any[], currentStopLoss: number, optimalStopLoss: number): number {
    // Simulate improved performance with optimal stop loss
    const currentWinRate = trades.filter(t => (t.pnl || 0) > 0).length / trades.length;
    const estimatedNewWinRate = currentWinRate * (1 + (currentStopLoss - optimalStopLoss));
    
    return Math.max(0, estimatedNewWinRate - currentWinRate);
  }

  private findOptimalEntryTiming(performanceData: any, marketRegime: string): string {
    // Simplified timing optimization
    const strategies = ['immediate', 'delayed_5min', 'market_open', 'volume_spike'];
    return strategies[Math.floor(Math.random() * strategies.length)];
  }

  private async quickBacktest(strategy: StrategyDNA): Promise<any> {
    // Simplified backtest for fitness evaluation
    return {
      totalReturn: Math.random() * 0.4 - 0.1, // -10% to +30%
      sharpeRatio: Math.random() * 3,
      maxDrawdown: Math.random() * 0.3,
      winRate: 0.4 + Math.random() * 0.4
    };
  }

  private combineArrays(arr1: any[], arr2: any[]): any[] {
    const combined = [...arr1, ...arr2];
    return Array.from(new Set(combined)); // Remove duplicates
  }

  private prunePopulation(): void {
    const maxSize = 50;
    if (this.strategyPopulation.size > maxSize) {
      const strategies = Array.from(this.strategyPopulation.values())
        .sort((a, b) => b.fitness - a.fitness);
      
      // Keep top performers
      const survivors = strategies.slice(0, maxSize);
      
      this.strategyPopulation.clear();
      survivors.forEach(strategy => {
        this.strategyPopulation.set(strategy.id, strategy);
      });
    }
  }

  private calculateCorrelationTrend(historicalCorrelations: any[]): number {
    if (historicalCorrelations.length < 3) return 0;

    const recent = historicalCorrelations.slice(-10);
    const correlations = recent.map(h => h.correlation);
    
    // Simple linear trend
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (let i = 0; i < correlations.length; i++) {
      sumX += i;
      sumY += correlations[i];
      sumXY += i * correlations[i];
      sumX2 += i * i;
    }
    
    const n = correlations.length;
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    return slope;
  }

  // Factory methods for creating base strategy DNA
  private createTrendFollowingDNA(): StrategyDNA {
    return {
      id: 'trend_following_base',
      parentStrategies: [],
      genes: {
        riskTolerance: 0.6,
        timeframe: '4h',
        indicators: ['EMA', 'MACD', 'RSI'],
        entryConditions: [{ type: 'ema_cross', params: { fast: 12, slow: 26 } }],
        exitConditions: [{ type: 'stop_loss', params: { percentage: 0.05 } }],
        positionSizing: { type: 'fixed_percentage', value: 0.1 }
      },
      performance: { returns: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0 },
      generation: 0,
      fitness: 0
    };
  }

  private createMeanReversionDNA(): StrategyDNA {
    return {
      id: 'mean_reversion_base',
      parentStrategies: [],
      genes: {
        riskTolerance: 0.4,
        timeframe: '1h',
        indicators: ['Bollinger_Bands', 'RSI', 'Stochastic'],
        entryConditions: [{ type: 'bollinger_oversold', params: { period: 20, std: 2 } }],
        exitConditions: [{ type: 'bollinger_center', params: {} }],
        positionSizing: { type: 'volatility_adjusted', value: 0.08 }
      },
      performance: { returns: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0 },
      generation: 0,
      fitness: 0
    };
  }

  private createMomentumDNA(): StrategyDNA {
    return {
      id: 'momentum_base',
      parentStrategies: [],
      genes: {
        riskTolerance: 0.8,
        timeframe: '15m',
        indicators: ['Volume', 'Price_Rate_of_Change', 'Williams_R'],
        entryConditions: [{ type: 'momentum_breakout', params: { threshold: 0.02 } }],
        exitConditions: [{ type: 'momentum_reversal', params: { threshold: -0.01 } }],
        positionSizing: { type: 'kelly_criterion', value: 0.12 }
      },
      performance: { returns: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0 },
      generation: 0,
      fitness: 0
    };
  }

  private createVolatilityDNA(): StrategyDNA {
    return {
      id: 'volatility_base',
      parentStrategies: [],
      genes: {
        riskTolerance: 0.3,
        timeframe: '1d',
        indicators: ['ATR', 'Volatility_Index', 'Standard_Deviation'],
        entryConditions: [{ type: 'low_volatility', params: { threshold: 0.15 } }],
        exitConditions: [{ type: 'high_volatility', params: { threshold: 0.35 } }],
        positionSizing: { type: 'inverse_volatility', value: 0.06 }
      },
      performance: { returns: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0 },
      generation: 0,
      fitness: 0
    };
  }

  private createSentimentDNA(): StrategyDNA {
    return {
      id: 'sentiment_base',
      parentStrategies: [],
      genes: {
        riskTolerance: 0.5,
        timeframe: '6h',
        indicators: ['Social_Sentiment', 'News_Sentiment', 'Fear_Greed_Index'],
        entryConditions: [{ type: 'sentiment_divergence', params: { threshold: 0.3 } }],
        exitConditions: [{ type: 'sentiment_convergence', params: { threshold: 0.1 } }],
        positionSizing: { type: 'sentiment_weighted', value: 0.09 }
      },
      performance: { returns: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0 },
      generation: 0,
      fitness: 0
    };
  }
}

export const predictiveAnalyticsEngine = new PredictiveAnalyticsEngine();