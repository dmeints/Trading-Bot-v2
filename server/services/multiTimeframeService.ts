/**
 * Multi-Timeframe Strategy Orchestration
 * Coordinated strategies across multiple timeframes
 */

import { db } from '../db';
import {
  timeframeStrategies,
  strategyAllocations,
  timeframeSignals,
  type TimeframeStrategy,
  type StrategyAllocation,
  type TimeframeSignal
} from '../../shared/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import { featureService } from './featureService';

interface StrategySignal {
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  strategy: 'scalping' | 'swing' | 'position' | 'arbitrage';
  signal: number; // -1 to 1
  confidence: number;
  reasoning: string[];
  allocation: number; // 0 to 1
}

interface OrchestrationResult {
  signals: StrategySignal[];
  totalAllocation: number;
  recommendedAction: 'buy' | 'sell' | 'hold';
  overallConfidence: number;
  reasoning: string;
}

interface TimeframeAnalysis {
  shortTerm: { trend: number; strength: number; signals: string[] };
  mediumTerm: { trend: number; strength: number; signals: string[] };
  longTerm: { trend: number; strength: number; signals: string[] };
}

export class MultiTimeframeService {
  private featureService = featureService;
  
  private strategyConfigs = {
    scalping: {
      timeframes: ['1m', '5m'],
      maxAllocation: 0.3,
      riskTolerance: 0.1,
      signalThreshold: 0.6
    },
    swing: {
      timeframes: ['15m', '1h', '4h'],
      maxAllocation: 0.5,
      riskTolerance: 0.3,
      signalThreshold: 0.5
    },
    position: {
      timeframes: ['4h', '1d'],
      maxAllocation: 0.4,
      riskTolerance: 0.5,
      signalThreshold: 0.4
    },
    arbitrage: {
      timeframes: ['1m', '5m'],
      maxAllocation: 0.2,
      riskTolerance: 0.05,
      signalThreshold: 0.8
    }
  };

  constructor() {
    // featureService already assigned as class property
  }

  async orchestrateStrategies(
    symbol: string,
    userRiskTolerance: number = 0.5,
    availableCapital: number = 1.0
  ): Promise<OrchestrationResult> {
    // Get multi-timeframe analysis
    const timeframeAnalysis = await this.analyzeMultipleTimeframes(symbol);
    
    // Generate signals for each strategy
    const signals = await Promise.all([
      this.generateScalpingSignal(symbol, timeframeAnalysis),
      this.generateSwingSignal(symbol, timeframeAnalysis),
      this.generatePositionSignal(symbol, timeframeAnalysis),
      this.generateArbitrageSignal(symbol, timeframeAnalysis)
    ]);

    // Calculate allocations based on signals and risk tolerance
    const allocatedSignals = this.calculateAllocations(signals, userRiskTolerance, availableCapital);
    
    // Determine overall action
    const overallAction = this.determineOverallAction(allocatedSignals);
    
    // Record strategy allocations
    await this.recordAllocations(symbol, allocatedSignals);

    return {
      signals: allocatedSignals,
      totalAllocation: allocatedSignals.reduce((sum, s) => sum + s.allocation, 0),
      recommendedAction: overallAction.action,
      overallConfidence: overallAction.confidence,
      reasoning: overallAction.reasoning
    };
  }

  async analyzeMultipleTimeframes(symbol: string): Promise<TimeframeAnalysis> {
    const [shortTerm, mediumTerm, longTerm] = await Promise.all([
      this.analyzeTimeframe(symbol, ['1m', '5m', '15m']),
      this.analyzeTimeframe(symbol, ['15m', '1h', '4h']),
      this.analyzeTimeframe(symbol, ['4h', '1d'])
    ]);

    return { shortTerm, mediumTerm, longTerm };
  }

  async updateStrategyPerformance(
    strategy: string,
    timeframe: string,
    profit: number,
    confidence: number
  ): Promise<void> {
    // Record performance for strategy optimization
    const [existing] = await db
      .select()
      .from(timeframeStrategies)
      .where(and(
        eq(timeframeStrategies.strategy, strategy),
        eq(timeframeStrategies.timeframe, timeframe)
      ));

    const currentPerformance = existing?.performance || { trades: 0, totalProfit: 0, winRate: 0 };
    const newTrades = currentPerformance.trades + 1;
    const newTotalProfit = currentPerformance.totalProfit + profit;
    const newWinRate = ((currentPerformance.winRate * currentPerformance.trades) + (profit > 0 ? 1 : 0)) / newTrades;

    await db
      .insert(timeframeStrategies)
      .values({
        strategy,
        timeframe,
        performance: {
          trades: newTrades,
          totalProfit: newTotalProfit,
          winRate: newWinRate,
          averageProfit: newTotalProfit / newTrades,
          lastUpdated: Date.now()
        },
        isActive: true
      })
      .onConflictDoUpdate({
        target: [timeframeStrategies.strategy, timeframeStrategies.timeframe],
        set: {
          performance: {
            trades: newTrades,
            totalProfit: newTotalProfit,
            winRate: newWinRate,
            averageProfit: newTotalProfit / newTrades,
            lastUpdated: Date.now()
          }
        }
      });
  }

  async getOptimalAllocation(
    availableCapital: number,
    riskTolerance: number
  ): Promise<{ [strategy: string]: number }> {
    const strategies = await db
      .select()
      .from(timeframeStrategies)
      .where(eq(timeframeStrategies.isActive, true));

    const allocations: { [strategy: string]: number } = {};
    let totalAllocation = 0;

    // Sort by risk-adjusted return
    const sortedStrategies = strategies.sort((a, b) => {
      const aRiskAdjusted = (a.performance?.winRate || 0) / Math.max(0.1, a.performance?.averageProfit || 0.1);
      const bRiskAdjusted = (b.performance?.winRate || 0) / Math.max(0.1, b.performance?.averageProfit || 0.1);
      return bRiskAdjusted - aRiskAdjusted;
    });

    for (const strategy of sortedStrategies) {
      const config = this.strategyConfigs[strategy.strategy as keyof typeof this.strategyConfigs];
      if (!config) continue;

      const maxAllocation = config.maxAllocation * riskTolerance;
      const performanceScore = (strategy.performance?.winRate || 0.5) * (strategy.performance?.averageProfit || 0.01);
      const allocation = Math.min(maxAllocation, maxAllocation * performanceScore * 2);

      if (totalAllocation + allocation <= 0.9) { // Max 90% allocation
        allocations[strategy.strategy] = allocation;
        totalAllocation += allocation;
      }
    }

    return allocations;
  }

  private async analyzeTimeframe(
    symbol: string, 
    timeframes: string[]
  ): Promise<{ trend: number; strength: number; signals: string[] }> {
    const features = await this.featureService.getFeatures(symbol);
    const signals: string[] = [];
    let trend = 0;
    let strength = 0;

    // Technical analysis across timeframes
    const rsi = features.technical?.rsi || 50;
    const macd = features.technical?.macd || 0;
    const bollinger = features.technical?.bollinger || 0.5;

    // RSI analysis
    if (rsi > 70) {
      trend -= 0.3;
      signals.push('RSI overbought');
    } else if (rsi < 30) {
      trend += 0.3;
      signals.push('RSI oversold');
    }

    // MACD analysis
    if (macd > 0) {
      trend += 0.4;
      strength += 0.3;
      signals.push('MACD bullish');
    } else if (macd < -0.01) {
      trend -= 0.4;
      strength += 0.3;
      signals.push('MACD bearish');
    }

    // Bollinger Bands analysis
    if (bollinger > 0.8) {
      signals.push('Near upper Bollinger band');
      strength += 0.2;
    } else if (bollinger < 0.2) {
      signals.push('Near lower Bollinger band');
      strength += 0.2;
    }

    // Volume analysis
    const volume = features.technical?.volume || 1;
    if (volume > 1.5) {
      strength += 0.3;
      signals.push('High volume confirmation');
    }

    return {
      trend: Math.max(-1, Math.min(1, trend)),
      strength: Math.max(0, Math.min(1, strength)),
      signals
    };
  }

  private async generateScalpingSignal(
    symbol: string, 
    analysis: TimeframeAnalysis
  ): Promise<StrategySignal> {
    const shortTermTrend = analysis.shortTerm.trend;
    const strength = analysis.shortTerm.strength;
    
    let signal = 0;
    let confidence = 0;
    const reasoning: string[] = [];

    // Scalping looks for quick directional moves with high strength
    if (Math.abs(shortTermTrend) > 0.3 && strength > 0.6) {
      signal = shortTermTrend * strength;
      confidence = strength;
      reasoning.push(`Strong ${shortTermTrend > 0 ? 'bullish' : 'bearish'} momentum detected`);
      reasoning.push(...analysis.shortTerm.signals);
    }

    await this.recordTimeframeSignal(symbol, '5m', 'scalping', signal, confidence);

    return {
      timeframe: '5m',
      strategy: 'scalping',
      signal,
      confidence,
      reasoning,
      allocation: 0 // Will be calculated later
    };
  }

  private async generateSwingSignal(
    symbol: string, 
    analysis: TimeframeAnalysis
  ): Promise<StrategySignal> {
    const mediumTrend = analysis.mediumTerm.trend;
    const shortTrend = analysis.shortTerm.trend;
    
    let signal = 0;
    let confidence = 0;
    const reasoning: string[] = [];

    // Swing trading looks for medium-term trends with short-term confirmation
    if (Math.sign(mediumTrend) === Math.sign(shortTrend) && Math.abs(mediumTrend) > 0.2) {
      signal = (mediumTrend * 0.7) + (shortTrend * 0.3);
      confidence = (analysis.mediumTerm.strength + analysis.shortTerm.strength) / 2;
      reasoning.push(`Medium-term trend aligned with short-term momentum`);
      reasoning.push(...analysis.mediumTerm.signals);
    }

    await this.recordTimeframeSignal(symbol, '1h', 'swing', signal, confidence);

    return {
      timeframe: '1h',
      strategy: 'swing',
      signal,
      confidence,
      reasoning,
      allocation: 0
    };
  }

  private async generatePositionSignal(
    symbol: string, 
    analysis: TimeframeAnalysis
  ): Promise<StrategySignal> {
    const longTrend = analysis.longTerm.trend;
    const mediumTrend = analysis.mediumTerm.trend;
    
    let signal = 0;
    let confidence = 0;
    const reasoning: string[] = [];

    // Position trading looks for strong long-term trends
    if (Math.abs(longTrend) > 0.3) {
      signal = longTrend;
      confidence = analysis.longTerm.strength;
      
      // Bonus if medium-term agrees
      if (Math.sign(longTrend) === Math.sign(mediumTrend)) {
        signal *= 1.2;
        confidence *= 1.1;
        reasoning.push(`Long-term trend confirmed by medium-term analysis`);
      }
      
      reasoning.push(`Strong ${longTrend > 0 ? 'bullish' : 'bearish'} long-term trend`);
      reasoning.push(...analysis.longTerm.signals);
    }

    await this.recordTimeframeSignal(symbol, '1d', 'position', signal, confidence);

    return {
      timeframe: '1d',
      strategy: 'position',
      signal,
      confidence,
      reasoning,
      allocation: 0
    };
  }

  private async generateArbitrageSignal(
    symbol: string, 
    analysis: TimeframeAnalysis
  ): Promise<StrategySignal> {
    // Arbitrage looks for price discrepancies - simplified for demo
    let signal = 0;
    let confidence = 0;
    const reasoning: string[] = [];

    // In a real implementation, this would check multiple exchanges
    // For now, we'll generate occasional arbitrage opportunities
    if (Math.random() > 0.9) { // 10% chance of arbitrage opportunity
      signal = (Math.random() - 0.5) * 0.4; // Small but certain profit
      confidence = 0.9;
      reasoning.push('Cross-exchange price discrepancy detected');
    }

    await this.recordTimeframeSignal(symbol, '1m', 'arbitrage', signal, confidence);

    return {
      timeframe: '1m',
      strategy: 'arbitrage',
      signal,
      confidence,
      reasoning,
      allocation: 0
    };
  }

  private calculateAllocations(
    signals: StrategySignal[],
    riskTolerance: number,
    availableCapital: number
  ): StrategySignal[] {
    const totalSignalStrength = signals.reduce((sum, s) => sum + Math.abs(s.signal) * s.confidence, 0);
    
    return signals.map(signal => {
      if (totalSignalStrength === 0) {
        return { ...signal, allocation: 0 };
      }

      const config = this.strategyConfigs[signal.strategy as keyof typeof this.strategyConfigs];
      const maxAllocation = config.maxAllocation * riskTolerance * availableCapital;
      const signalStrength = Math.abs(signal.signal) * signal.confidence;
      const proportionalAllocation = (signalStrength / totalSignalStrength) * 0.8; // Max 80% total allocation
      
      const allocation = Math.min(maxAllocation, proportionalAllocation);
      
      return { ...signal, allocation };
    });
  }

  private determineOverallAction(signals: StrategySignal[]): { action: 'buy' | 'sell' | 'hold'; confidence: number; reasoning: string } {
    const weightedSignal = signals.reduce((sum, s) => sum + (s.signal * s.allocation * s.confidence), 0);
    const totalWeight = signals.reduce((sum, s) => sum + s.allocation * s.confidence, 0);
    
    if (totalWeight === 0) {
      return { action: 'hold', confidence: 0, reasoning: 'No strong signals detected across timeframes' };
    }

    const normalizedSignal = weightedSignal / totalWeight;
    const overallConfidence = Math.min(1, totalWeight / 0.5);
    
    let action: 'buy' | 'sell' | 'hold';
    if (normalizedSignal > 0.1) {
      action = 'buy';
    } else if (normalizedSignal < -0.1) {
      action = 'sell';
    } else {
      action = 'hold';
    }

    const activeStrategies = signals.filter(s => s.allocation > 0).map(s => s.strategy);
    const reasoning = `${action.toUpperCase()} signal from ${activeStrategies.join(', ')} strategies across multiple timeframes`;

    return { action, confidence: overallConfidence, reasoning };
  }

  private async recordAllocations(symbol: string, signals: StrategySignal[]): Promise<void> {
    for (const signal of signals) {
      if (signal.allocation > 0) {
        await db.insert(strategyAllocations).values({
          symbol,
          strategy: signal.strategy,
          timeframe: signal.timeframe,
          allocation: signal.allocation,
          confidence: signal.confidence,
          reasoning: signal.reasoning.join('; '),
          timestamp: new Date()
        });
      }
    }
  }

  private async recordTimeframeSignal(
    symbol: string,
    timeframe: string,
    strategy: string,
    signal: number,
    confidence: number
  ): Promise<void> {
    await db.insert(timeframeSignals).values({
      symbol,
      timeframe,
      strategy,
      signal,
      confidence,
      timestamp: new Date()
    });
  }
}

export default MultiTimeframeService;