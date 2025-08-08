/**
 * UNCERTAINTY-AWARE POSITION SIZING
 * Scales position size based on model confidence and outcome uncertainty
 */

interface UncertaintyMetrics {
  variance: number;
  confidenceInterval: [number, number];
  probabilityOfLoss: number;
  expectedValue: number;
  uncertainty: number; // 0-1 scale
}

interface PositionSizeConfig {
  maxPositionPct: number;      // Max position as % of portfolio
  basePositionPct: number;     // Base position size
  minConfidence: number;       // Minimum confidence threshold
  kellyFraction: number;       // Kelly criterion multiplier
  uncertaintyPenalty: number;  // Penalty factor for high uncertainty
  varThreshold: number;        // Variance threshold for sizing
}

interface ConformalPrediction {
  pointPrediction: number;
  lowerBound: number;
  upperBound: number;
  calibrationScore: number;
}

export class UncertaintySizer {
  private config: PositionSizeConfig;
  private historicalPredictions: Array<{
    prediction: number;
    actual: number;
    timestamp: number;
    confidence: number;
  }> = [];

  constructor(config: Partial<PositionSizeConfig> = {}) {
    this.config = {
      maxPositionPct: 0.05,      // 5% max position
      basePositionPct: 0.02,     // 2% base position
      minConfidence: 0.3,        // 30% min confidence
      kellyFraction: 0.25,       // Conservative Kelly
      uncertaintyPenalty: 0.5,   // 50% penalty for max uncertainty
      varThreshold: 0.01,        // 1% variance threshold
      ...config
    };
  }

  /**
   * Calculate optimal position size based on uncertainty metrics
   */
  calculatePositionSize(
    prediction: number,
    confidence: number,
    portfolioValue: number,
    uncertaintyMetrics: UncertaintyMetrics,
    riskConfig?: Partial<PositionSizeConfig>
  ): {
    positionSize: number;
    reasoning: string;
    metrics: {
      baseSize: number;
      confidenceAdjustment: number;
      uncertaintyPenalty: number;
      kellyOptimal: number;
      finalSize: number;
    };
  } {
    const config = riskConfig ? { ...this.config, ...riskConfig } : this.config;
    
    // Base position size
    const baseSize = portfolioValue * config.basePositionPct;
    
    // Confidence-based scaling
    const confidenceMultiplier = this.calculateConfidenceMultiplier(confidence, config.minConfidence);
    
    // Uncertainty penalty
    const uncertaintyPenalty = this.calculateUncertaintyPenalty(uncertaintyMetrics, config);
    
    // Kelly criterion optimal size
    const kellyOptimal = this.calculateKellySize(prediction, uncertaintyMetrics, portfolioValue, config);
    
    // Combine all factors
    let finalSize = baseSize * confidenceMultiplier * uncertaintyPenalty;
    
    // Cap at Kelly optimal (conservative)
    finalSize = Math.min(finalSize, kellyOptimal);
    
    // Hard cap at max position
    const maxSize = portfolioValue * config.maxPositionPct;
    finalSize = Math.min(finalSize, maxSize);
    
    // Ensure minimum threshold
    if (confidence < config.minConfidence) {
      finalSize = 0;
    }
    
    const reasoning = this.generateSizingReasoning({
      confidence,
      uncertaintyMetrics,
      baseSize,
      confidenceMultiplier,
      uncertaintyPenalty,
      kellyOptimal,
      finalSize,
      maxSize
    });
    
    return {
      positionSize: finalSize,
      reasoning,
      metrics: {
        baseSize,
        confidenceAdjustment: confidenceMultiplier,
        uncertaintyPenalty,
        kellyOptimal,
        finalSize
      }
    };
  }

  /**
   * Generate conformal prediction intervals for uncertainty estimation
   */
  generateConformalPrediction(
    pointPrediction: number,
    historicalResiduals: number[],
    alpha: number = 0.1 // 90% confidence interval
  ): ConformalPrediction {
    if (historicalResiduals.length === 0) {
      // Fallback to naive bounds
      const fallbackRange = Math.abs(pointPrediction) * 0.2;
      return {
        pointPrediction,
        lowerBound: pointPrediction - fallbackRange,
        upperBound: pointPrediction + fallbackRange,
        calibrationScore: 0.5
      };
    }
    
    // Sort residuals and calculate quantile
    const sortedResiduals = [...historicalResiduals].sort((a, b) => a - b);
    const quantileIndex = Math.ceil((1 - alpha) * sortedResiduals.length) - 1;
    const quantile = sortedResiduals[Math.max(0, quantileIndex)];
    
    // Calculate calibration score (coverage accuracy)
    const calibrationScore = this.calculateCalibrationScore(alpha);
    
    return {
      pointPrediction,
      lowerBound: pointPrediction - Math.abs(quantile),
      upperBound: pointPrediction + Math.abs(quantile),
      calibrationScore
    };
  }

  /**
   * Estimate prediction uncertainty using ensemble variance
   */
  estimateUncertainty(
    ensemblePredictions: number[],
    conformalPrediction?: ConformalPrediction
  ): UncertaintyMetrics {
    if (ensemblePredictions.length === 0) {
      throw new Error('No ensemble predictions provided');
    }
    
    const mean = ensemblePredictions.reduce((sum, p) => sum + p, 0) / ensemblePredictions.length;
    const variance = ensemblePredictions.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / ensemblePredictions.length;
    
    // Confidence interval from ensemble spread
    const std = Math.sqrt(variance);
    const confidenceInterval: [number, number] = [mean - 1.96 * std, mean + 1.96 * std];
    
    // Use conformal prediction if available
    if (conformalPrediction) {
      confidenceInterval[0] = conformalPrediction.lowerBound;
      confidenceInterval[1] = conformalPrediction.upperBound;
    }
    
    // Probability of loss (assuming normal distribution)
    const probabilityOfLoss = this.calculateProbabilityOfLoss(mean, std);
    
    // Normalized uncertainty (0-1 scale)
    const uncertainty = Math.min(1, variance / this.config.varThreshold);
    
    return {
      variance,
      confidenceInterval,
      probabilityOfLoss,
      expectedValue: mean,
      uncertainty
    };
  }

  private calculateConfidenceMultiplier(confidence: number, minConfidence: number): number {
    if (confidence < minConfidence) return 0;
    
    // Sigmoid scaling for confidence
    const normalized = (confidence - minConfidence) / (1 - minConfidence);
    return Math.tanh(normalized * 2); // Smooth scaling 0-1
  }

  private calculateUncertaintyPenalty(
    uncertaintyMetrics: UncertaintyMetrics,
    config: PositionSizeConfig
  ): number {
    // Penalty increases with uncertainty
    const penalty = 1 - (uncertaintyMetrics.uncertainty * config.uncertaintyPenalty);
    return Math.max(0.1, penalty); // Min 10% of base size
  }

  private calculateKellySize(
    prediction: number,
    uncertaintyMetrics: UncertaintyMetrics,
    portfolioValue: number,
    config: PositionSizeConfig
  ): number {
    // Kelly criterion: f = (bp - q) / b
    // where b = odds, p = win probability, q = loss probability
    
    const expectedReturn = uncertaintyMetrics.expectedValue;
    const variance = uncertaintyMetrics.variance;
    
    if (variance === 0 || expectedReturn <= 0) return 0;
    
    // Simplified Kelly: f = μ / σ²
    const kellyFraction = expectedReturn / variance;
    const conservativeKelly = kellyFraction * config.kellyFraction;
    
    return Math.max(0, conservativeKelly * portfolioValue);
  }

  private calculateProbabilityOfLoss(mean: number, std: number): number {
    if (std === 0) return mean <= 0 ? 1 : 0;
    
    // P(X <= 0) for normal distribution
    const zScore = -mean / std;
    return this.normalCDF(zScore);
  }

  private normalCDF(z: number): number {
    // Approximation of standard normal CDF
    return 0.5 * (1 + this.erf(z / Math.sqrt(2)));
  }

  private erf(x: number): number {
    // Approximation of error function
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  private calculateCalibrationScore(alpha: number): number {
    // Calculate how well the confidence intervals match actual coverage
    if (this.historicalPredictions.length < 10) return 0.5;
    
    let withinInterval = 0;
    const targetCoverage = 1 - alpha;
    
    for (const pred of this.historicalPredictions) {
      // Simplified coverage check (would need actual interval bounds)
      const error = Math.abs(pred.actual - pred.prediction);
      const expectedError = pred.prediction * 0.1; // 10% tolerance
      
      if (error <= expectedError) withinInterval++;
    }
    
    const actualCoverage = withinInterval / this.historicalPredictions.length;
    return 1 - Math.abs(actualCoverage - targetCoverage);
  }

  private generateSizingReasoning(params: {
    confidence: number;
    uncertaintyMetrics: UncertaintyMetrics;
    baseSize: number;
    confidenceMultiplier: number;
    uncertaintyPenalty: number;
    kellyOptimal: number;
    finalSize: number;
    maxSize: number;
  }): string {
    const {
      confidence,
      uncertaintyMetrics,
      baseSize,
      confidenceMultiplier,
      uncertaintyPenalty,
      kellyOptimal,
      finalSize,
      maxSize
    } = params;
    
    const confPct = (confidence * 100).toFixed(1);
    const uncPct = (uncertaintyMetrics.uncertainty * 100).toFixed(1);
    const probLoss = (uncertaintyMetrics.probabilityOfLoss * 100).toFixed(1);
    
    let reasoning = `Confidence: ${confPct}%, Uncertainty: ${uncPct}%, P(Loss): ${probLoss}%. `;
    
    if (confidence < this.config.minConfidence) {
      reasoning += `Below min confidence threshold (${(this.config.minConfidence * 100).toFixed(0)}%), position = 0.`;
    } else {
      reasoning += `Base: $${baseSize.toFixed(0)} × Conf: ${confidenceMultiplier.toFixed(2)} × Unc: ${uncertaintyPenalty.toFixed(2)} = $${finalSize.toFixed(0)}. `;
      
      if (finalSize >= kellyOptimal) {
        reasoning += `Capped by Kelly optimal ($${kellyOptimal.toFixed(0)}).`;
      }
      
      if (finalSize >= maxSize) {
        reasoning += `Hit max position limit ($${maxSize.toFixed(0)}).`;
      }
    }
    
    return reasoning;
  }

  /**
   * Update historical predictions for calibration
   */
  addPredictionResult(prediction: number, actual: number, confidence: number): void {
    this.historicalPredictions.push({
      prediction,
      actual,
      timestamp: Date.now(),
      confidence
    });
    
    // Keep only last 1000 predictions
    if (this.historicalPredictions.length > 1000) {
      this.historicalPredictions.shift();
    }
  }

  /**
   * Get uncertainty sizing statistics
   */
  getStats(): {
    avgConfidence: number;
    avgUncertainty: number;
    calibrationAccuracy: number;
    positionSizeStats: {
      avgSize: number;
      maxSize: number;
      utilizationRate: number;
    };
  } {
    if (this.historicalPredictions.length === 0) {
      return {
        avgConfidence: 0,
        avgUncertainty: 0,
        calibrationAccuracy: 0,
        positionSizeStats: {
          avgSize: 0,
          maxSize: 0,
          utilizationRate: 0
        }
      };
    }
    
    const avgConfidence = this.historicalPredictions.reduce((sum, p) => sum + p.confidence, 0) / this.historicalPredictions.length;
    const calibrationAccuracy = this.calculateCalibrationScore(0.1);
    
    return {
      avgConfidence,
      avgUncertainty: 0.5, // Would calculate from actual uncertainty metrics
      calibrationAccuracy,
      positionSizeStats: {
        avgSize: this.config.basePositionPct,
        maxSize: this.config.maxPositionPct,
        utilizationRate: avgConfidence
      }
    };
  }
}

export default UncertaintySizer;