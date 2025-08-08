/**
 * ENSEMBLE WEIGHTER
 * Online Exp3/Hedge algorithm to weight {TCN, LSTM, Transformer} models per regime
 */

import { MarketRegime } from '../regimeClassifier';

export type ModelType = 'TCN' | 'LSTM' | 'Transformer';

interface ModelPerformance {
  totalReward: number;
  episodeCount: number;
  averageReward: number;
  winRate: number;
  sharpeRatio: number;
  lastUpdated: number;
}

interface WeightUpdate {
  modelType: ModelType;
  regime: MarketRegime;
  reward: number;
  confidence: number;
  timestamp: number;
}

interface EnsembleWeights {
  [regime: string]: {
    [model: string]: number;
  };
}

interface Exp3Config {
  gamma: number;           // Exploration parameter (0-1)
  learningRate: number;    // Weight update rate
  decayRate: number;       // Performance decay over time
  minWeight: number;       // Minimum weight to maintain exploration
  windowSize: number;      // Performance tracking window
}

export class EnsembleWeighter {
  private weights: EnsembleWeights = {};
  private performance: Map<string, ModelPerformance> = new Map();
  private updateHistory: WeightUpdate[] = [];
  private config: Exp3Config;
  
  private readonly models: ModelType[] = ['TCN', 'LSTM', 'Transformer'];
  private readonly regimes: MarketRegime[] = ['trend', 'mean-rev', 'chop'];

  constructor(config: Partial<Exp3Config> = {}) {
    this.config = {
      gamma: 0.1,           // 10% exploration
      learningRate: 0.01,   // Conservative learning
      decayRate: 0.995,     // Slow decay
      minWeight: 0.05,      // 5% minimum weight
      windowSize: 1000,     // Last 1000 updates
      ...config
    };
    
    this.initializeWeights();
  }

  /**
   * Initialize uniform weights for all model-regime combinations
   */
  private initializeWeights(): void {
    for (const regime of this.regimes) {
      this.weights[regime] = {};
      for (const model of this.models) {
        this.weights[regime][model] = 1.0 / this.models.length; // Uniform start
        
        // Initialize performance tracking
        const key = `${model}_${regime}`;
        this.performance.set(key, {
          totalReward: 0,
          episodeCount: 0,
          averageReward: 0,
          winRate: 0,
          sharpeRatio: 0,
          lastUpdated: Date.now()
        });
      }
    }
  }

  /**
   * Get current ensemble weights for a specific regime
   */
  getWeights(regime: MarketRegime): { [model: string]: number } {
    return { ...this.weights[regime] };
  }

  /**
   * Get weighted prediction from ensemble
   */
  getEnsemblePrediction(
    predictions: { [model in ModelType]: number },
    regime: MarketRegime,
    includeConfidence: boolean = true
  ): {
    prediction: number;
    confidence: number;
    weights: { [model: string]: number };
    contributors: Array<{ model: ModelType; weight: number; prediction: number }>;
  } {
    const regimeWeights = this.weights[regime];
    let weightedSum = 0;
    let totalWeight = 0;
    const contributors: Array<{ model: ModelType; weight: number; prediction: number }> = [];
    
    for (const model of this.models) {
      const weight = regimeWeights[model];
      const prediction = predictions[model];
      
      if (!isNaN(prediction) && weight > 0) {
        weightedSum += weight * prediction;
        totalWeight += weight;
        contributors.push({ model, weight, prediction });
      }
    }
    
    const finalPrediction = totalWeight > 0 ? weightedSum / totalWeight : 0;
    
    // Calculate confidence based on weight distribution entropy
    const confidence = includeConfidence 
      ? this.calculateEnsembleConfidence(regimeWeights, contributors)
      : 0.5;
    
    return {
      prediction: finalPrediction,
      confidence,
      weights: { ...regimeWeights },
      contributors
    };
  }

  /**
   * Update model weights based on episode reward using Exp3 algorithm
   */
  updateWeights(
    modelType: ModelType,
    regime: MarketRegime,
    reward: number,
    confidence: number = 1.0
  ): void {
    const key = `${modelType}_${regime}`;
    const updateTime = Date.now();
    
    // Store update for history
    const update: WeightUpdate = {
      modelType,
      regime,
      reward,
      confidence,
      timestamp: updateTime
    };
    this.updateHistory.push(update);
    
    // Update performance metrics
    this.updatePerformanceMetrics(key, reward, updateTime);
    
    // Apply Exp3 weight update
    this.applyExp3Update(modelType, regime, reward, confidence);
    
    // Maintain exploration with minimum weights
    this.enforceMinimumWeights(regime);
    
    // Cleanup old history
    this.maintainHistoryWindow();
  }

  /**
   * Apply Exp3 (Exponential-weight algorithm for Exploration and Exploitation) update
   */
  private applyExp3Update(
    modelType: ModelType,
    regime: MarketRegime,
    reward: number,
    confidence: number
  ): void {
    const regimeWeights = this.weights[regime];
    const currentWeight = regimeWeights[modelType];
    
    // Normalize reward to [0, 1] range for stability
    const normalizedReward = Math.max(0, Math.min(1, (reward + 1) / 2));
    
    // Confidence-weighted reward
    const weightedReward = normalizedReward * confidence;
    
    // Estimated reward for this model (inverse probability weighting)
    const estimatedReward = currentWeight > 0 ? weightedReward / currentWeight : 0;
    
    // Exp3 exponential update
    const gamma = this.config.gamma;
    const learningRate = this.config.learningRate;
    
    // Update weight using exponential gradient
    const newWeight = currentWeight * Math.exp(learningRate * estimatedReward / this.models.length);
    regimeWeights[modelType] = newWeight;
    
    // Normalize weights to sum to 1
    this.normalizeWeights(regime);
    
    // Apply exploration bonus (gamma)
    for (const model of this.models) {
      regimeWeights[model] = (1 - gamma) * regimeWeights[model] + gamma / this.models.length;
    }
  }

  /**
   * Apply Hedge algorithm update (alternative to Exp3)
   */
  private applyHedgeUpdate(
    modelType: ModelType,
    regime: MarketRegime,
    reward: number,
    confidence: number
  ): void {
    const regimeWeights = this.weights[regime];
    const beta = Math.exp(-this.config.learningRate);
    
    // Normalize reward to loss (0 = best, 1 = worst)
    const loss = Math.max(0, Math.min(1, (1 - reward) / 2));
    
    // Confidence-weighted loss
    const weightedLoss = loss * confidence;
    
    // Hedge multiplicative update
    if (modelType in regimeWeights) {
      regimeWeights[modelType] *= Math.pow(beta, weightedLoss);
    }
    
    // Normalize weights
    this.normalizeWeights(regime);
  }

  /**
   * Normalize weights for a regime to sum to 1
   */
  private normalizeWeights(regime: MarketRegime): void {
    const regimeWeights = this.weights[regime];
    const totalWeight = Object.values(regimeWeights).reduce((sum, w) => sum + w, 0);
    
    if (totalWeight > 0) {
      for (const model of this.models) {
        regimeWeights[model] /= totalWeight;
      }
    } else {
      // Fallback to uniform if all weights are zero
      for (const model of this.models) {
        regimeWeights[model] = 1.0 / this.models.length;
      }
    }
  }

  /**
   * Enforce minimum weights to maintain exploration
   */
  private enforceMinimumWeights(regime: MarketRegime): void {
    const regimeWeights = this.weights[regime];
    const minWeight = this.config.minWeight;
    
    // Check if any weight is below minimum
    let needsAdjustment = false;
    for (const model of this.models) {
      if (regimeWeights[model] < minWeight) {
        regimeWeights[model] = minWeight;
        needsAdjustment = true;
      }
    }
    
    if (needsAdjustment) {
      this.normalizeWeights(regime);
    }
  }

  /**
   * Update performance metrics for a model-regime combination
   */
  private updatePerformanceMetrics(key: string, reward: number, timestamp: number): void {
    const perf = this.performance.get(key);
    if (!perf) return;
    
    // Apply temporal decay to existing metrics
    const timeDiff = timestamp - perf.lastUpdated;
    const decayFactor = Math.pow(this.config.decayRate, timeDiff / (24 * 60 * 60 * 1000)); // Daily decay
    
    perf.totalReward = perf.totalReward * decayFactor + reward;
    perf.episodeCount = perf.episodeCount * decayFactor + 1;
    perf.averageReward = perf.totalReward / perf.episodeCount;
    
    // Update win rate (reward > 0 is a win)
    const isWin = reward > 0 ? 1 : 0;
    perf.winRate = (perf.winRate * (perf.episodeCount - 1) + isWin) / perf.episodeCount;
    
    // Simple Sharpe ratio approximation
    perf.sharpeRatio = perf.averageReward / Math.max(0.01, Math.abs(perf.averageReward));
    
    perf.lastUpdated = timestamp;
  }

  /**
   * Calculate ensemble confidence based on weight distribution
   */
  private calculateEnsembleConfidence(
    weights: { [model: string]: number },
    contributors: Array<{ model: ModelType; weight: number; prediction: number }>
  ): number {
    // Shannon entropy of weight distribution (lower entropy = higher confidence)
    let entropy = 0;
    for (const model of this.models) {
      const weight = weights[model];
      if (weight > 0) {
        entropy -= weight * Math.log2(weight);
      }
    }
    
    // Normalize entropy to [0, 1] confidence
    const maxEntropy = Math.log2(this.models.length);
    const entropyConfidence = 1 - (entropy / maxEntropy);
    
    // Agreement confidence (how close predictions are)
    let agreementConfidence = 1;
    if (contributors.length > 1) {
      const predictions = contributors.map(c => c.prediction);
      const mean = predictions.reduce((sum, p) => sum + p, 0) / predictions.length;
      const variance = predictions.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / predictions.length;
      agreementConfidence = Math.exp(-variance * 100); // High variance = low confidence
    }
    
    // Combined confidence
    return (entropyConfidence + agreementConfidence) / 2;
  }

  /**
   * Maintain rolling window of update history
   */
  private maintainHistoryWindow(): void {
    if (this.updateHistory.length > this.config.windowSize) {
      this.updateHistory = this.updateHistory.slice(-this.config.windowSize);
    }
  }

  /**
   * Get performance statistics for all models across regimes
   */
  getPerformanceStats(): {
    byModel: { [model: string]: ModelPerformance };
    byRegime: { [regime: string]: ModelPerformance };
    overall: ModelPerformance;
    weights: EnsembleWeights;
  } {
    const byModel: { [model: string]: ModelPerformance } = {};
    const byRegime: { [regime: string]: ModelPerformance } = {};
    
    // Aggregate by model
    for (const model of this.models) {
      const modelPerfs = Array.from(this.performance.entries())
        .filter(([key]) => key.startsWith(model))
        .map(([, perf]) => perf);
      
      byModel[model] = this.aggregatePerformance(modelPerfs);
    }
    
    // Aggregate by regime
    for (const regime of this.regimes) {
      const regimePerfs = Array.from(this.performance.entries())
        .filter(([key]) => key.endsWith(regime))
        .map(([, perf]) => perf);
      
      byRegime[regime] = this.aggregatePerformance(regimePerfs);
    }
    
    // Overall performance
    const allPerfs = Array.from(this.performance.values());
    const overall = this.aggregatePerformance(allPerfs);
    
    return {
      byModel,
      byRegime,
      overall,
      weights: { ...this.weights }
    };
  }

  /**
   * Aggregate multiple performance objects
   */
  private aggregatePerformance(performances: ModelPerformance[]): ModelPerformance {
    if (performances.length === 0) {
      return {
        totalReward: 0,
        episodeCount: 0,
        averageReward: 0,
        winRate: 0,
        sharpeRatio: 0,
        lastUpdated: Date.now()
      };
    }
    
    const totalReward = performances.reduce((sum, p) => sum + p.totalReward, 0);
    const episodeCount = performances.reduce((sum, p) => sum + p.episodeCount, 0);
    const winRate = performances.reduce((sum, p) => sum + p.winRate * p.episodeCount, 0) / episodeCount;
    
    return {
      totalReward,
      episodeCount,
      averageReward: episodeCount > 0 ? totalReward / episodeCount : 0,
      winRate: episodeCount > 0 ? winRate : 0,
      sharpeRatio: performances.reduce((sum, p) => sum + p.sharpeRatio, 0) / performances.length,
      lastUpdated: Math.max(...performances.map(p => p.lastUpdated))
    };
  }

  /**
   * Reset weights to uniform distribution
   */
  resetWeights(): void {
    this.initializeWeights();
    this.performance.clear();
    this.updateHistory = [];
  }

  /**
   * Export current state for persistence
   */
  exportState(): {
    weights: EnsembleWeights;
    performance: Array<[string, ModelPerformance]>;
    config: Exp3Config;
  } {
    return {
      weights: JSON.parse(JSON.stringify(this.weights)),
      performance: Array.from(this.performance.entries()),
      config: { ...this.config }
    };
  }

  /**
   * Import previously saved state
   */
  importState(state: {
    weights: EnsembleWeights;
    performance: Array<[string, ModelPerformance]>;
    config?: Partial<Exp3Config>;
  }): void {
    this.weights = state.weights;
    this.performance = new Map(state.performance);
    
    if (state.config) {
      this.config = { ...this.config, ...state.config };
    }
  }
}

export default EnsembleWeighter;