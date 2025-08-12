
/**
 * Coarse Grid Search for Conformal Prediction Parameters
 * Safe bounds hyperparameter optimization with systematic search
 */

import { logger } from '../utils/logger';
import { ConformalPredictor } from '../brain/conformal';
import { MetaBrain } from '../brain/meta_brain';

export interface GridSearchConfig {
  alphaRange: number[];
  windowSizeRange: number[];
  kernelBandwidthRange: number[];
  minSamplesRange: number[];
  maxIterations: number;
  convergenceThreshold: number;
  safetyBounds: {
    minAlpha: number;
    maxAlpha: number;
    minWindowSize: number;
    maxWindowSize: number;
  };
}

export interface GridSearchResult {
  bestParams: {
    alpha: number;
    windowSize: number;
    kernelBandwidth: number;
    minSamples: number;
  };
  bestScore: number;
  convergenceHistory: number[];
  exploredParams: Array<{
    params: any;
    score: number;
    coverage: number;
    sharpness: number;
  }>;
  searchDuration: number;
  iterationsCompleted: number;
}

export class CoarseGridSearch {
  private config: GridSearchConfig;
  private metaBrain: MetaBrain;
  private searchHistory: Array<{ params: any; score: number }> = [];

  constructor(config: Partial<GridSearchConfig> = {}) {
    this.config = {
      alphaRange: [0.01, 0.05, 0.1, 0.15, 0.2],
      windowSizeRange: [100, 250, 500, 750, 1000],
      kernelBandwidthRange: [0.01, 0.05, 0.1, 0.2, 0.3],
      minSamplesRange: [20, 50, 100, 150, 200],
      maxIterations: 500,
      convergenceThreshold: 0.001,
      safetyBounds: {
        minAlpha: 0.01,
        maxAlpha: 0.3,
        minWindowSize: 50,
        maxWindowSize: 2000,
      },
      ...config
    };
    
    this.metaBrain = new MetaBrain();
  }

  /**
   * Run coarse grid search optimization
   */
  async runSearch(
    trainingData: Array<{
      features: number[];
      actualReturn: number;
      timestamp: Date;
    }>,
    validationData: Array<{
      features: number[];
      actualReturn: number;
      timestamp: Date;
    }>
  ): Promise<GridSearchResult> {
    const startTime = Date.now();
    logger.info('[CoarseGridSearch] Starting hyperparameter optimization', {
      trainingSize: trainingData.length,
      validationSize: validationData.length,
      searchSpace: this.calculateSearchSpace()
    });

    let bestScore = -Infinity;
    let bestParams: any = null;
    const exploredParams: Array<any> = [];
    const convergenceHistory: number[] = [];
    let iterationsCompleted = 0;

    // Generate parameter combinations
    const paramCombinations = this.generateParameterGrid();
    
    for (const params of paramCombinations) {
      if (iterationsCompleted >= this.config.maxIterations) {
        logger.warn('[CoarseGridSearch] Maximum iterations reached');
        break;
      }

      // Safety bounds check
      if (!this.isWithinSafetyBounds(params)) {
        logger.debug('[CoarseGridSearch] Skipping params outside safety bounds', params);
        continue;
      }

      try {
        const score = await this.evaluateParameters(params, trainingData, validationData);
        
        this.searchHistory.push({ params, score });
        exploredParams.push({
          params,
          score,
          coverage: score.coverage || 0,
          sharpness: score.sharpness || 0
        });

        if (score.composite > bestScore) {
          bestScore = score.composite;
          bestParams = { ...params };
          
          logger.info('[CoarseGridSearch] New best parameters found', {
            params: bestParams,
            score: bestScore,
            iteration: iterationsCompleted
          });
        }

        convergenceHistory.push(bestScore);
        
        // Check for convergence
        if (this.hasConverged(convergenceHistory)) {
          logger.info('[CoarseGridSearch] Search converged early', {
            iteration: iterationsCompleted,
            finalScore: bestScore
          });
          break;
        }

        iterationsCompleted++;

      } catch (error) {
        logger.error('[CoarseGridSearch] Error evaluating parameters', {
          params,
          error: error.message
        });
        continue;
      }
    }

    const searchDuration = Date.now() - startTime;
    
    const result: GridSearchResult = {
      bestParams: bestParams || this.getDefaultParams(),
      bestScore,
      convergenceHistory,
      exploredParams,
      searchDuration,
      iterationsCompleted
    };

    logger.info('[CoarseGridSearch] Search completed', {
      bestScore,
      iterationsCompleted,
      durationMs: searchDuration,
      exploredCombinations: exploredParams.length
    });

    return result;
  }

  /**
   * Generate all parameter combinations for grid search
   */
  private generateParameterGrid(): Array<{
    alpha: number;
    windowSize: number;
    kernelBandwidth: number;
    minSamples: number;
  }> {
    const combinations: Array<any> = [];

    for (const alpha of this.config.alphaRange) {
      for (const windowSize of this.config.windowSizeRange) {
        for (const kernelBandwidth of this.config.kernelBandwidthRange) {
          for (const minSamples of this.config.minSamplesRange) {
            combinations.push({
              alpha,
              windowSize,
              kernelBandwidth,
              minSamples
            });
          }
        }
      }
    }

    // Shuffle for better exploration
    return this.shuffleArray(combinations);
  }

  /**
   * Evaluate parameter combination
   */
  private async evaluateParameters(
    params: any,
    trainingData: Array<any>,
    validationData: Array<any>
  ): Promise<{
    composite: number;
    coverage: number;
    sharpness: number;
    calibrationTime: number;
  }> {
    const startTime = Date.now();
    
    // Create conformal predictor with these parameters
    const conformal = new ConformalPredictor({
      alpha: params.alpha,
      windowSize: params.windowSize,
      kernelBandwidth: params.kernelBandwidth,
      minSamples: params.minSamples,
      adaptiveAlpha: true
    });

    // Calibrate on training data
    for (const sample of trainingData) {
      conformal.addCalibrationSample({
        features: sample.features,
        actualReturn: sample.actualReturn,
        predictedReturn: sample.actualReturn + (Math.random() - 0.5) * 0.01, // Mock prediction
        timestamp: sample.timestamp
      });
    }

    // Evaluate on validation data
    let totalCoverage = 0;
    let totalSharpness = 0;
    let validPredictions = 0;

    for (const sample of validationData) {
      const prediction = conformal.predict(
        sample.features,
        sample.actualReturn + (Math.random() - 0.5) * 0.01 // Mock prediction
      );

      if (prediction) {
        const withinInterval = sample.actualReturn >= prediction.lowerBound && 
                              sample.actualReturn <= prediction.upperBound;
        totalCoverage += withinInterval ? 1 : 0;
        totalSharpness += 1 / prediction.width;
        validPredictions++;
      }
    }

    const coverage = validPredictions > 0 ? totalCoverage / validPredictions : 0;
    const sharpness = validPredictions > 0 ? totalSharpness / validPredictions : 0;
    const calibrationTime = Date.now() - startTime;

    // Composite score balancing coverage and sharpness
    const targetCoverage = 1 - params.alpha;
    const coverageError = Math.abs(coverage - targetCoverage);
    const composite = coverage * 0.6 + sharpness * 0.3 - coverageError * 0.1;

    return {
      composite,
      coverage,
      sharpness,
      calibrationTime
    };
  }

  /**
   * Check if parameters are within safety bounds
   */
  private isWithinSafetyBounds(params: any): boolean {
    const { safetyBounds } = this.config;
    
    return (
      params.alpha >= safetyBounds.minAlpha &&
      params.alpha <= safetyBounds.maxAlpha &&
      params.windowSize >= safetyBounds.minWindowSize &&
      params.windowSize <= safetyBounds.maxWindowSize
    );
  }

  /**
   * Check if search has converged
   */
  private hasConverged(history: number[]): boolean {
    if (history.length < 10) return false;
    
    const recentHistory = history.slice(-10);
    const variance = this.calculateVariance(recentHistory);
    
    return variance < this.config.convergenceThreshold;
  }

  /**
   * Calculate variance of array
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  /**
   * Calculate total search space size
   */
  private calculateSearchSpace(): number {
    return (
      this.config.alphaRange.length *
      this.config.windowSizeRange.length *
      this.config.kernelBandwidthRange.length *
      this.config.minSamplesRange.length
    );
  }

  /**
   * Get default parameters as fallback
   */
  private getDefaultParams(): any {
    return {
      alpha: 0.1,
      windowSize: 500,
      kernelBandwidth: 0.1,
      minSamples: 100
    };
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get search statistics
   */
  getSearchStatistics(): {
    totalEvaluations: number;
    bestScore: number;
    averageScore: number;
    searchSpace: number;
    explorationRate: number;
  } {
    if (this.searchHistory.length === 0) {
      return {
        totalEvaluations: 0,
        bestScore: 0,
        averageScore: 0,
        searchSpace: this.calculateSearchSpace(),
        explorationRate: 0
      };
    }

    const scores = this.searchHistory.map(item => item.score);
    const bestScore = Math.max(...scores);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const searchSpace = this.calculateSearchSpace();
    const explorationRate = this.searchHistory.length / searchSpace;

    return {
      totalEvaluations: this.searchHistory.length,
      bestScore,
      averageScore,
      searchSpace,
      explorationRate
    };
  }
}
