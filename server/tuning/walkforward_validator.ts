
/**
 * Walk-Forward Validation with Stress Testing
 * Validates conformal prediction performance under various market conditions
 */

import { logger } from '../utils/logger';
import { ConformalPredictor } from '../brain/conformal';

export interface WalkForwardConfig {
  windowSize: number;
  stepSize: number;
  minTrainingPeriods: number;
  maxValidationPeriods: number;
  stressTestScenarios: StressScenario[];
  performanceThresholds: {
    minCoverage: number;
    maxCoverageGap: number;
    maxIntervalWidth: number;
    minSharpeRatio: number;
  };
}

export interface StressScenario {
  name: string;
  description: string;
  dataTransform: (data: any[]) => any[];
  expectedDegradation: number; // Expected performance drop (0-1)
}

export interface WalkForwardResult {
  overallMetrics: {
    avgCoverage: number;
    avgCoverageGap: number;
    avgIntervalWidth: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
  };
  periodResults: Array<{
    period: number;
    startDate: Date;
    endDate: Date;
    trainingSize: number;
    validationSize: number;
    metrics: {
      coverage: number;
      coverageGap: number;
      avgIntervalWidth: number;
      accuracy: number;
    };
    passedThresholds: boolean;
  }>;
  stressTestResults: Array<{
    scenario: string;
    degradation: number;
    passedTest: boolean;
    metrics: {
      coverage: number;
      coverageGap: number;
      avgIntervalWidth: number;
    };
  }>;
  recommendation: {
    approved: boolean;
    confidence: number;
    issues: string[];
    suggestions: string[];
  };
}

export class WalkForwardValidator {
  private config: WalkForwardConfig;

  constructor(config: Partial<WalkForwardConfig> = {}) {
    this.config = {
      windowSize: 1000,
      stepSize: 100,
      minTrainingPeriods: 500,
      maxValidationPeriods: 200,
      stressTestScenarios: this.getDefaultStressScenarios(),
      performanceThresholds: {
        minCoverage: 0.85,
        maxCoverageGap: 0.1,
        maxIntervalWidth: 0.05,
        minSharpeRatio: 0.5
      },
      ...config
    };
  }

  /**
   * Run walk-forward validation
   */
  async validate(
    conformalParams: {
      alpha: number;
      windowSize: number;
      kernelBandwidth: number;
      minSamples: number;
    },
    historicalData: Array<{
      features: number[];
      actualReturn: number;
      timestamp: Date;
    }>
  ): Promise<WalkForwardResult> {
    logger.info('[WalkForwardValidator] Starting walk-forward validation', {
      dataSize: historicalData.length,
      windowSize: this.config.windowSize,
      stepSize: this.config.stepSize
    });

    // Sort data by timestamp
    const sortedData = historicalData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Generate validation periods
    const periods = this.generateValidationPeriods(sortedData);
    const periodResults: Array<any> = [];
    
    // Run validation for each period
    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      
      try {
        const result = await this.validatePeriod(conformalParams, period, i);
        periodResults.push(result);
        
        logger.debug('[WalkForwardValidator] Period completed', {
          period: i,
          coverage: result.metrics.coverage,
          passedThresholds: result.passedThresholds
        });
        
      } catch (error) {
        logger.error('[WalkForwardValidator] Period validation failed', {
          period: i,
          error: error.message
        });
        continue;
      }
    }

    // Calculate overall metrics
    const overallMetrics = this.calculateOverallMetrics(periodResults);
    
    // Run stress tests
    const stressTestResults = await this.runStressTests(conformalParams, sortedData);
    
    // Generate recommendation
    const recommendation = this.generateRecommendation(
      overallMetrics,
      periodResults,
      stressTestResults
    );

    const result: WalkForwardResult = {
      overallMetrics,
      periodResults,
      stressTestResults,
      recommendation
    };

    logger.info('[WalkForwardValidator] Validation completed', {
      totalPeriods: periodResults.length,
      avgCoverage: overallMetrics.avgCoverage,
      sharpeRatio: overallMetrics.sharpeRatio,
      approved: recommendation.approved
    });

    return result;
  }

  /**
   * Generate validation periods for walk-forward analysis
   */
  private generateValidationPeriods(data: any[]): Array<{
    training: any[];
    validation: any[];
    startDate: Date;
    endDate: Date;
  }> {
    const periods: Array<any> = [];
    const totalSize = data.length;
    
    let start = 0;
    while (start + this.config.windowSize + this.config.stepSize < totalSize) {
      const trainingEnd = start + this.config.windowSize;
      const validationEnd = Math.min(trainingEnd + this.config.stepSize, totalSize);
      
      const training = data.slice(start, trainingEnd);
      const validation = data.slice(trainingEnd, validationEnd);
      
      if (training.length >= this.config.minTrainingPeriods &&
          validation.length > 0) {
        periods.push({
          training,
          validation,
          startDate: training[0].timestamp,
          endDate: validation[validation.length - 1].timestamp
        });
      }
      
      start += this.config.stepSize;
    }
    
    return periods;
  }

  /**
   * Validate single period
   */
  private async validatePeriod(
    conformalParams: any,
    period: any,
    periodIndex: number
  ): Promise<any> {
    // Create conformal predictor
    const conformal = new ConformalPredictor({
      alpha: conformalParams.alpha,
      windowSize: conformalParams.windowSize,
      kernelBandwidth: conformalParams.kernelBandwidth,
      minSamples: conformalParams.minSamples,
      adaptiveAlpha: true
    });

    // Calibrate on training data
    for (const sample of period.training) {
      conformal.addCalibrationSample({
        features: sample.features,
        actualReturn: sample.actualReturn,
        predictedReturn: this.mockPredict(sample.features),
        timestamp: sample.timestamp
      });
    }

    // Evaluate on validation data
    let totalCoverage = 0;
    let totalWidth = 0;
    let validPredictions = 0;
    let accurateCount = 0;

    for (const sample of period.validation) {
      const prediction = conformal.predict(
        sample.features,
        this.mockPredict(sample.features)
      );

      if (prediction) {
        const withinInterval = sample.actualReturn >= prediction.lowerBound && 
                              sample.actualReturn <= prediction.upperBound;
        totalCoverage += withinInterval ? 1 : 0;
        totalWidth += prediction.width;
        validPredictions++;
        
        // Simple accuracy check
        const predictedReturn = this.mockPredict(sample.features);
        const error = Math.abs(sample.actualReturn - predictedReturn);
        if (error < 0.01) accurateCount++;
      }
    }

    const coverage = validPredictions > 0 ? totalCoverage / validPredictions : 0;
    const avgIntervalWidth = validPredictions > 0 ? totalWidth / validPredictions : 0;
    const accuracy = validPredictions > 0 ? accurateCount / validPredictions : 0;
    const coverageGap = Math.abs(coverage - (1 - conformalParams.alpha));

    // Check if thresholds are met
    const passedThresholds = (
      coverage >= this.config.performanceThresholds.minCoverage &&
      coverageGap <= this.config.performanceThresholds.maxCoverageGap &&
      avgIntervalWidth <= this.config.performanceThresholds.maxIntervalWidth
    );

    return {
      period: periodIndex,
      startDate: period.startDate,
      endDate: period.endDate,
      trainingSize: period.training.length,
      validationSize: period.validation.length,
      metrics: {
        coverage,
        coverageGap,
        avgIntervalWidth,
        accuracy
      },
      passedThresholds
    };
  }

  /**
   * Calculate overall metrics across all periods
   */
  private calculateOverallMetrics(periodResults: any[]): any {
    if (periodResults.length === 0) {
      return {
        avgCoverage: 0,
        avgCoverageGap: 0,
        avgIntervalWidth: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0
      };
    }

    const avgCoverage = periodResults.reduce((sum, p) => sum + p.metrics.coverage, 0) / periodResults.length;
    const avgCoverageGap = periodResults.reduce((sum, p) => sum + p.metrics.coverageGap, 0) / periodResults.length;
    const avgIntervalWidth = periodResults.reduce((sum, p) => sum + p.metrics.avgIntervalWidth, 0) / periodResults.length;
    
    // Calculate Sharpe ratio from accuracy
    const accuracies = periodResults.map(p => p.metrics.accuracy);
    const avgAccuracy = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
    const accVariance = accuracies.reduce((sum, acc) => sum + Math.pow(acc - avgAccuracy, 2), 0) / accuracies.length;
    const sharpeRatio = accVariance > 0 ? avgAccuracy / Math.sqrt(accVariance) : 0;
    
    // Calculate max drawdown (simplified)
    let maxDrawdown = 0;
    let peak = 0;
    let cumulativeAccuracy = 0;
    
    for (const result of periodResults) {
      cumulativeAccuracy += result.metrics.accuracy;
      peak = Math.max(peak, cumulativeAccuracy);
      const drawdown = (peak - cumulativeAccuracy) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    
    const winRate = periodResults.filter(p => p.passedThresholds).length / periodResults.length;

    return {
      avgCoverage,
      avgCoverageGap,
      avgIntervalWidth,
      sharpeRatio,
      maxDrawdown,
      winRate
    };
  }

  /**
   * Run stress tests
   */
  private async runStressTests(
    conformalParams: any,
    data: any[]
  ): Promise<Array<any>> {
    const stressResults: Array<any> = [];
    
    for (const scenario of this.config.stressTestScenarios) {
      try {
        logger.debug('[WalkForwardValidator] Running stress test', {
          scenario: scenario.name
        });
        
        // Transform data according to scenario
        const stressedData = scenario.dataTransform(data);
        
        // Run simplified validation on stressed data
        const result = await this.runStressTestScenario(conformalParams, stressedData, scenario);
        stressResults.push(result);
        
      } catch (error) {
        logger.error('[WalkForwardValidator] Stress test failed', {
          scenario: scenario.name,
          error: error.message
        });
        
        stressResults.push({
          scenario: scenario.name,
          degradation: 1.0,
          passedTest: false,
          metrics: { coverage: 0, coverageGap: 1, avgIntervalWidth: 1 }
        });
      }
    }
    
    return stressResults;
  }

  /**
   * Run single stress test scenario
   */
  private async runStressTestScenario(
    conformalParams: any,
    stressedData: any[],
    scenario: StressScenario
  ): Promise<any> {
    // Split data for training/validation
    const splitPoint = Math.floor(stressedData.length * 0.8);
    const training = stressedData.slice(0, splitPoint);
    const validation = stressedData.slice(splitPoint);
    
    // Create and calibrate conformal predictor
    const conformal = new ConformalPredictor({
      alpha: conformalParams.alpha,
      windowSize: Math.min(conformalParams.windowSize, training.length),
      kernelBandwidth: conformalParams.kernelBandwidth,
      minSamples: conformalParams.minSamples,
      adaptiveAlpha: true
    });

    for (const sample of training.slice(-conformalParams.windowSize)) {
      conformal.addCalibrationSample({
        features: sample.features,
        actualReturn: sample.actualReturn,
        predictedReturn: this.mockPredict(sample.features),
        timestamp: sample.timestamp
      });
    }

    // Evaluate on validation data
    let totalCoverage = 0;
    let totalWidth = 0;
    let validPredictions = 0;

    for (const sample of validation) {
      const prediction = conformal.predict(
        sample.features,
        this.mockPredict(sample.features)
      );

      if (prediction) {
        const withinInterval = sample.actualReturn >= prediction.lowerBound && 
                              sample.actualReturn <= prediction.upperBound;
        totalCoverage += withinInterval ? 1 : 0;
        totalWidth += prediction.width;
        validPredictions++;
      }
    }

    const coverage = validPredictions > 0 ? totalCoverage / validPredictions : 0;
    const avgIntervalWidth = validPredictions > 0 ? totalWidth / validPredictions : 0;
    const coverageGap = Math.abs(coverage - (1 - conformalParams.alpha));
    
    // Calculate performance degradation
    const baselineCoverage = 1 - conformalParams.alpha;
    const degradation = Math.abs(coverage - baselineCoverage) / baselineCoverage;
    
    const passedTest = degradation <= scenario.expectedDegradation;

    return {
      scenario: scenario.name,
      degradation,
      passedTest,
      metrics: {
        coverage,
        coverageGap,
        avgIntervalWidth
      }
    };
  }

  /**
   * Generate recommendation based on validation results
   */
  private generateRecommendation(
    overallMetrics: any,
    periodResults: any[],
    stressTestResults: any[]
  ): any {
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    // Check overall metrics against thresholds
    if (overallMetrics.avgCoverage < this.config.performanceThresholds.minCoverage) {
      issues.push(`Low average coverage: ${(overallMetrics.avgCoverage * 100).toFixed(1)}%`);
      suggestions.push('Consider increasing alpha or window size');
    }
    
    if (overallMetrics.avgCoverageGap > this.config.performanceThresholds.maxCoverageGap) {
      issues.push(`High coverage gap: ${(overallMetrics.avgCoverageGap * 100).toFixed(1)}%`);
      suggestions.push('Enable adaptive alpha to improve calibration');
    }
    
    if (overallMetrics.avgIntervalWidth > this.config.performanceThresholds.maxIntervalWidth) {
      issues.push(`Wide prediction intervals: ${(overallMetrics.avgIntervalWidth * 100).toFixed(1)}%`);
      suggestions.push('Reduce kernel bandwidth or increase training data');
    }
    
    if (overallMetrics.sharpeRatio < this.config.performanceThresholds.minSharpeRatio) {
      issues.push(`Low Sharpe ratio: ${overallMetrics.sharpeRatio.toFixed(2)}`);
      suggestions.push('Improve feature engineering or model selection');
    }
    
    // Check stress test results
    const failedStressTests = stressTestResults.filter(s => !s.passedTest);
    if (failedStressTests.length > 0) {
      issues.push(`Failed ${failedStressTests.length} stress tests`);
      suggestions.push('Implement robust calibration methods');
    }
    
    // Calculate overall confidence
    const winRate = overallMetrics.winRate;
    const stressTestPassRate = stressTestResults.filter(s => s.passedTest).length / stressTestResults.length;
    const confidence = (winRate * 0.7 + stressTestPassRate * 0.3);
    
    const approved = (
      issues.length === 0 &&
      confidence >= 0.8 &&
      overallMetrics.winRate >= 0.8
    );

    return {
      approved,
      confidence,
      issues,
      suggestions
    };
  }

  /**
   * Mock prediction function (replace with actual model)
   */
  private mockPredict(features: number[]): number {
    // Simple mock prediction based on features
    return features.reduce((sum, f) => sum + f, 0) / features.length * 0.001;
  }

  /**
   * Get default stress test scenarios
   */
  private getDefaultStressScenarios(): StressScenario[] {
    return [
      {
        name: 'High Volatility',
        description: 'Increase return volatility by 200%',
        dataTransform: (data) => data.map(d => ({
          ...d,
          actualReturn: d.actualReturn * 3
        })),
        expectedDegradation: 0.2
      },
      {
        name: 'Market Crash',
        description: 'Simulate market crash with -20% returns',
        dataTransform: (data) => data.map((d, i) => ({
          ...d,
          actualReturn: i > data.length * 0.5 ? d.actualReturn - 0.2 : d.actualReturn
        })),
        expectedDegradation: 0.3
      },
      {
        name: 'Regime Change',
        description: 'Change correlation structure mid-period',
        dataTransform: (data) => data.map((d, i) => ({
          ...d,
          features: i > data.length * 0.5 
            ? d.features.map(f => -f) 
            : d.features
        })),
        expectedDegradation: 0.25
      },
      {
        name: 'Low Liquidity',
        description: 'Simulate reduced liquidity with wider spreads',
        dataTransform: (data) => data.map(d => ({
          ...d,
          actualReturn: d.actualReturn + (Math.random() - 0.5) * 0.02
        })),
        expectedDegradation: 0.15
      }
    ];
  }
}
