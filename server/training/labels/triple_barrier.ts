/**
 * Triple-Barrier Labeling with Meta-Labeling
 * Implements volatility-scaled targets and timeout barriers
 */

import { logger } from '../../utils/logger';
import { BarData } from '../data/qc';
import { FeatureVector } from '../features/switches';

export interface TripleBarrierConfig {
  volatility_target_multiplier: number;
  max_holding_periods: number[];
  min_return_threshold: number;
  enable_meta_labeling: boolean;
  stop_loss_multiplier: number;
  take_profit_multiplier: number;
}

export interface Label {
  timestamp: Date;
  symbol: string;
  entry_price: number;
  
  // Primary labels
  y_primary: number;        // -1, 0, 1 (sell, hold, buy)
  barrier_hit: string;      // 'stop', 'take_profit', 'timeout'
  holding_period: number;   // bars held
  return_achieved: number;  // actual return
  
  // Meta-labels (for filtering)
  y_meta: number;          // 0 or 1 (skip trade, take trade)
  meta_confidence: number;  // confidence in meta-label
  
  // Risk metrics
  volatility_at_entry: number;
  target_return: number;
  stop_loss: number;
  take_profit: number;
}

export class TripleBarrierLabeler {
  private config: TripleBarrierConfig;
  
  constructor(config: TripleBarrierConfig) {
    this.config = config;
  }
  
  async generateLabels(
    data: BarData[], 
    features: FeatureVector[], 
    symbol: string
  ): Promise<{ labels: Label[], class_weights: { [key: number]: number } }> {
    
    logger.info('[TripleBarrier] Generating labels', { 
      symbol, 
      bars: data.length,
      config: this.config 
    });
    
    const labels: Label[] = [];
    const maxHoldingPeriod = Math.max(...this.config.max_holding_periods);
    
    // Generate labels for each valid entry point
    for (let i = 0; i < data.length - maxHoldingPeriod; i++) {
      const currentBar = data[i];
      const currentFeature = features.find(f => 
        f.timestamp.getTime() === currentBar.timestamp.getTime()
      );
      
      if (!currentFeature || !currentFeature.volatility) {
        continue; // Skip if no features or volatility
      }
      
      // Calculate barriers based on volatility
      const barriers = this.calculateBarriers(currentBar, currentFeature);
      
      // Find which barrier is hit first
      const result = this.findFirstBarrierHit(data, i, barriers, maxHoldingPeriod);
      
      // Generate primary label
      const primaryLabel = this.generatePrimaryLabel(result, barriers);
      
      // Generate meta-label (if enabled)
      const metaLabel = this.config.enable_meta_labeling ? 
        this.generateMetaLabel(result, barriers, currentFeature) : 
        { y_meta: 1, meta_confidence: 1.0 };
      
      const label: Label = {
        timestamp: currentBar.timestamp,
        symbol: symbol,
        entry_price: currentBar.close,
        y_primary: primaryLabel,
        barrier_hit: result.barrier,
        holding_period: result.periods,
        return_achieved: result.return,
        ...metaLabel,
        volatility_at_entry: currentFeature.volatility,
        target_return: barriers.target,
        stop_loss: barriers.stop,
        take_profit: barriers.profit
      };
      
      labels.push(label);
    }
    
    // Calculate class weights for imbalanced data
    const classWeights = this.calculateClassWeights(labels);
    
    logger.info('[TripleBarrier] Label generation complete', {
      symbol,
      total_labels: labels.length,
      class_distribution: this.getClassDistribution(labels),
      class_weights: classWeights
    });
    
    return { labels, class_weights: classWeights };
  }
  
  private calculateBarriers(bar: BarData, feature: FeatureVector): {
    stop: number;
    profit: number;
    target: number;
  } {
    const volatility = feature.volatility || 0.02; // Default 2% if missing
    const price = bar.close;
    
    // Volatility-scaled barriers
    const target = volatility * this.config.volatility_target_multiplier;
    const stopMultiplier = this.config.stop_loss_multiplier ?? 1.0;
    const profitMultiplier = this.config.take_profit_multiplier ?? 2.0;
    
    return {
      stop: -target * stopMultiplier,     // Negative for loss
      profit: target * profitMultiplier,  // Positive for profit
      target: target
    };
  }
  
  private findFirstBarrierHit(
    data: BarData[], 
    startIndex: number, 
    barriers: { stop: number, profit: number, target: number },
    maxPeriods: number
  ): { barrier: string, periods: number, return: number } {
    
    const entryPrice = data[startIndex].close;
    
    for (let periods = 1; periods <= maxPeriods && startIndex + periods < data.length; periods++) {
      const currentPrice = data[startIndex + periods].close;
      const currentReturn = (currentPrice - entryPrice) / entryPrice;
      
      // Check barriers in order of priority
      if (currentReturn <= barriers.stop) {
        return { barrier: 'stop', periods, return: currentReturn };
      }
      
      if (currentReturn >= barriers.profit) {
        return { barrier: 'take_profit', periods, return: currentReturn };
      }
    }
    
    // Timeout - no barrier hit
    const finalPrice = data[Math.min(startIndex + maxPeriods, data.length - 1)].close;
    const finalReturn = (finalPrice - entryPrice) / entryPrice;
    
    return { barrier: 'timeout', periods: maxPeriods, return: finalReturn };
  }
  
  private generatePrimaryLabel(
    result: { barrier: string, periods: number, return: number },
    barriers: { stop: number, profit: number, target: number }
  ): number {
    
    // Only generate strong signals for significant moves
    if (Math.abs(result.return) < this.config.min_return_threshold) {
      return 0; // Hold/neutral
    }
    
    switch (result.barrier) {
      case 'take_profit':
        return result.return > 0 ? 1 : -1;
      
      case 'stop':
        return result.return > 0 ? 1 : -1;
      
      case 'timeout':
        // For timeout, use the actual return direction if significant
        if (result.return > barriers.target * 0.5) return 1;
        if (result.return < -barriers.target * 0.5) return -1;
        return 0;
      
      default:
        return 0;
    }
  }
  
  private generateMetaLabel(
    result: { barrier: string, periods: number, return: number },
    barriers: { stop: number, profit: number, target: number },
    feature: FeatureVector
  ): { y_meta: number, meta_confidence: number } {
    
    // Meta-labeling: should we take this trade at all?
    // Based on probability of hitting target before stop
    
    let confidence = 0.5; // Base confidence
    
    // Increase confidence for clear directional signals
    if (feature.momentum_10 && Math.abs(feature.momentum_10) > 0.02) {
      confidence += 0.2;
    }
    
    if (feature.rsi_14) {
      if (feature.rsi_14 > 70 || feature.rsi_14 < 30) {
        confidence += 0.1; // Overbought/oversold
      }
    }
    
    if (feature.volatility && feature.volatility > 0.03) {
      confidence -= 0.1; // Reduce confidence in high vol
    }
    
    // Meta-label decision
    const takeTradeThreshold = 0.6;
    const y_meta = confidence > takeTradeThreshold ? 1 : 0;
    
    return { 
      y_meta, 
      meta_confidence: Math.max(0.1, Math.min(0.9, confidence))
    };
  }
  
  private calculateClassWeights(labels: Label[]): { [key: number]: number } {
    const classCounts = { [-1]: 0, [0]: 0, [1]: 0 };
    
    labels.forEach(label => {
      classCounts[label.y_primary]++;
    });
    
    const totalSamples = labels.length;
    const weights: { [key: number]: number } = {};
    
    // Inverse frequency weighting
    Object.keys(classCounts).forEach(cls => {
      const classKey = parseInt(cls);
      const count = classCounts[classKey];
      weights[classKey] = count > 0 ? totalSamples / (3 * count) : 1.0;
    });
    
    return weights;
  }
  
  private getClassDistribution(labels: Label[]): { [key: number]: number } {
    const distribution = { [-1]: 0, [0]: 0, [1]: 0 };
    
    labels.forEach(label => {
      distribution[label.y_primary]++;
    });
    
    return distribution;
  }
  
  // Analysis methods
  
  async analyzeLabelQuality(labels: Label[]): Promise<{
    hit_rates: { [key: string]: number },
    avg_holding_periods: { [key: string]: number },
    return_stats: { [key: string]: { mean: number, std: number } }
  }> {
    
    const analysis = {
      hit_rates: {} as { [key: string]: number },
      avg_holding_periods: {} as { [key: string]: number },
      return_stats: {} as { [key: string]: { mean: number, std: number } }
    };
    
    // Group by barrier type
    const groupedLabels = this.groupBy(labels, 'barrier_hit');
    
    Object.keys(groupedLabels).forEach(barrier => {
      const barrierLabels = groupedLabels[barrier];
      
      // Hit rates
      analysis.hit_rates[barrier] = barrierLabels.length / labels.length;
      
      // Average holding periods
      analysis.avg_holding_periods[barrier] = 
        barrierLabels.reduce((sum, l) => sum + l.holding_period, 0) / barrierLabels.length;
      
      // Return statistics
      const returns = barrierLabels.map(l => l.return_achieved);
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
      
      analysis.return_stats[barrier] = {
        mean: mean,
        std: Math.sqrt(variance)
      };
    });
    
    return analysis;
  }
  
  private groupBy<T>(array: T[], key: keyof T): { [key: string]: T[] } {
    return array.reduce((groups, item) => {
      const groupKey = String(item[key]);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    }, {} as { [key: string]: T[] });
  }
}