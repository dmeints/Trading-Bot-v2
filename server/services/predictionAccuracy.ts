/**
 * PREDICTION ACCURACY TRACKER
 * Measures and improves prediction performance across different time horizons
 */

interface PredictionRecord {
  id: string;
  timestamp: Date;
  asset: string;
  timeframe: string;
  prediction: {
    direction: 'up' | 'down' | 'sideways';
    magnitude: number;
    probability: number;
    confidence: number;
  };
  reasoning: string;
  source: 'temporal' | 'causal' | 'multimodal' | 'stevie';
  actualOutcome?: {
    direction: 'up' | 'down' | 'sideways';
    magnitude: number;
    timestamp: Date;
  };
  accuracy?: {
    directionCorrect: boolean;
    magnitudeError: number; // percentage points
    overallScore: number; // 0-100
  };
}

interface AccuracyMetrics {
  timeframe: string;
  source: string;
  metrics: {
    totalPredictions: number;
    directionAccuracy: number; // 0-100
    magnitudeMAE: number; // Mean Absolute Error
    avgConfidence: number; // 0-100
    calibration: number; // How well confidence matches accuracy
    sharpeRatio: number; // Risk-adjusted returns from following predictions
  };
  recentPerformance: {
    last7Days: number;
    last24Hours: number;
    trend: 'improving' | 'declining' | 'stable';
  };
}

interface ModelCalibration {
  confidenceBucket: string; // "0-20%", "20-40%", etc.
  predictedAccuracy: number;
  actualAccuracy: number;
  sampleSize: number;
  calibrationError: number; // |predicted - actual|
}

export class PredictionAccuracy {
  private predictionHistory: PredictionRecord[] = [];
  private accuracyMetrics: Map<string, AccuracyMetrics> = new Map();
  private calibrationData: Map<string, ModelCalibration[]> = new Map();

  constructor() {
    this.initializeMockHistory();
  }

  private initializeMockHistory() {
    // Generate 30 days of prediction history for testing
    const sources = ['temporal', 'causal', 'multimodal', 'stevie'];
    const timeframes = ['15m', '1h', '4h', '1d'];
    const assets = ['BTC', 'ETH', 'SOL'];
    
    const now = new Date();
    
    // Generate about 5 predictions per day for last 30 days
    for (let day = 0; day < 30; day++) {
      const dayStart = new Date(now.getTime() - day * 24 * 60 * 60 * 1000);
      
      for (let i = 0; i < 5; i++) {
        const predictionTime = new Date(dayStart.getTime() + Math.random() * 24 * 60 * 60 * 1000);
        const source = sources[Math.floor(Math.random() * sources.length)];
        const timeframe = timeframes[Math.floor(Math.random() * timeframes.length)];
        const asset = assets[Math.floor(Math.random() * assets.length)];
        
        const prediction = this.generateMockPrediction(source, timeframe, asset);
        const record: PredictionRecord = {
          id: `pred_${day}_${i}`,
          timestamp: predictionTime,
          asset,
          timeframe,
          prediction,
          reasoning: `${source} analysis suggests ${prediction.direction} movement`,
          source: source as any
        };
        
        // Add actual outcome if enough time has passed
        const timeframeMs = this.getTimeframeMilliseconds(timeframe);
        if (now.getTime() - predictionTime.getTime() > timeframeMs) {
          record.actualOutcome = this.generateMockOutcome(prediction);
          record.accuracy = this.calculateAccuracy(prediction, record.actualOutcome);
        }
        
        this.predictionHistory.push(record);
      }
    }
    
    this.calculateAllMetrics();
  }

  private generateMockPrediction(source: string, timeframe: string, asset: string) {
    // Different sources have different accuracy characteristics
    const sourceModifiers = {
      temporal: { accuracy: 0.65, confidence: 0.72 },
      causal: { accuracy: 0.71, confidence: 0.68 },
      multimodal: { accuracy: 0.78, confidence: 0.75 },
      stevie: { accuracy: 0.74, confidence: 0.82 }
    };
    
    const modifier = sourceModifiers[source as keyof typeof sourceModifiers];
    const directions = ['up', 'down', 'sideways'];
    
    return {
      direction: directions[Math.floor(Math.random() * directions.length)] as any,
      magnitude: 1 + Math.random() * 8, // 1-9% predicted moves
      probability: 0.5 + Math.random() * 0.4, // 50-90%
      confidence: (modifier.confidence * 0.8 + Math.random() * modifier.confidence * 0.4) * 100
    };
  }

  private generateMockOutcome(prediction: any) {
    // Simulate realistic outcomes with some prediction accuracy
    const actualDirection = Math.random() < 0.68 ? prediction.direction : 
                           prediction.direction === 'up' ? 'down' : 
                           prediction.direction === 'down' ? 'up' : 'sideways';
    
    const baseAccuracy = 0.7; // 70% base magnitude accuracy
    const noise = (Math.random() - 0.5) * 4; // ±2% noise
    const actualMagnitude = Math.abs(prediction.magnitude * baseAccuracy + noise);
    
    return {
      direction: actualDirection,
      magnitude: actualMagnitude,
      timestamp: new Date(Date.now() - Math.random() * 60 * 60 * 1000) // Within last hour
    };
  }

  private calculateAccuracy(prediction: any, outcome: any) {
    const directionCorrect = prediction.direction === outcome.direction;
    const magnitudeError = Math.abs(prediction.magnitude - outcome.magnitude);
    
    // Overall score: 60% direction, 40% magnitude accuracy
    const directionScore = directionCorrect ? 100 : 0;
    const magnitudeScore = Math.max(0, 100 - magnitudeError * 10); // 10 points per percentage point error
    const overallScore = directionScore * 0.6 + magnitudeScore * 0.4;
    
    return {
      directionCorrect,
      magnitudeError,
      overallScore
    };
  }

  recordPrediction(
    asset: string,
    timeframe: string,
    prediction: PredictionRecord['prediction'],
    reasoning: string,
    source: PredictionRecord['source']
  ): string {
    const id = `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const record: PredictionRecord = {
      id,
      timestamp: new Date(),
      asset,
      timeframe,
      prediction,
      reasoning,
      source
    };
    
    this.predictionHistory.push(record);
    return id;
  }

  async updatePredictionOutcome(predictionId: string, actualPrice: number, previousPrice: number) {
    const record = this.predictionHistory.find(p => p.id === predictionId);
    if (!record || record.actualOutcome) return; // Already updated or not found
    
    const priceChange = (actualPrice - previousPrice) / previousPrice * 100;
    const direction = priceChange > 0.5 ? 'up' : priceChange < -0.5 ? 'down' : 'sideways';
    
    record.actualOutcome = {
      direction,
      magnitude: Math.abs(priceChange),
      timestamp: new Date()
    };
    
    record.accuracy = this.calculateAccuracy(record.prediction, record.actualOutcome);
    
    // Recalculate metrics for this source/timeframe combination
    this.updateMetrics(record.source, record.timeframe);
  }

  private calculateAllMetrics() {
    const groupKeys = new Set<string>();
    
    // Group by source and timeframe
    for (const record of this.predictionHistory) {
      if (record.actualOutcome && record.accuracy) {
        groupKeys.add(`${record.source}_${record.timeframe}`);
      }
    }
    
    for (const key of groupKeys) {
      const [source, timeframe] = key.split('_');
      this.updateMetrics(source, timeframe);
    }
  }

  private updateMetrics(source: string, timeframe: string) {
    const relevantPredictions = this.predictionHistory.filter(p => 
      p.source === source && 
      p.timeframe === timeframe && 
      p.actualOutcome && 
      p.accuracy
    );
    
    if (relevantPredictions.length === 0) return;
    
    const totalPredictions = relevantPredictions.length;
    const correctDirections = relevantPredictions.filter(p => p.accuracy!.directionCorrect).length;
    const directionAccuracy = (correctDirections / totalPredictions) * 100;
    
    const magnitudeErrors = relevantPredictions.map(p => p.accuracy!.magnitudeError);
    const magnitudeMAE = magnitudeErrors.reduce((sum, err) => sum + err, 0) / magnitudeErrors.length;
    
    const confidences = relevantPredictions.map(p => p.prediction.confidence);
    const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    
    // Calibration: how well does confidence predict accuracy
    const calibration = this.calculateCalibration(relevantPredictions);
    
    // Sharpe ratio simulation (simplified)
    const returns = relevantPredictions.map(p => {
      const correct = p.accuracy!.directionCorrect;
      const confidence = p.prediction.confidence / 100;
      return correct ? confidence * 0.02 : -confidence * 0.01; // 2% gain vs 1% loss
    });
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const returnStd = Math.sqrt(returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / returns.length);
    const sharpeRatio = returnStd > 0 ? avgReturn / returnStd : 0;
    
    // Recent performance
    const now = new Date();
    const last24h = relevantPredictions.filter(p => 
      now.getTime() - p.timestamp.getTime() < 24 * 60 * 60 * 1000
    );
    const last7d = relevantPredictions.filter(p => 
      now.getTime() - p.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000
    );
    
    const recent24hAccuracy = last24h.length > 0 ? 
      (last24h.filter(p => p.accuracy!.directionCorrect).length / last24h.length) * 100 : directionAccuracy;
    const recent7dAccuracy = last7d.length > 0 ? 
      (last7d.filter(p => p.accuracy!.directionCorrect).length / last7d.length) * 100 : directionAccuracy;
    
    const trend = recent24hAccuracy > directionAccuracy + 5 ? 'improving' :
                  recent24hAccuracy < directionAccuracy - 5 ? 'declining' : 'stable';
    
    const metrics: AccuracyMetrics = {
      timeframe,
      source,
      metrics: {
        totalPredictions,
        directionAccuracy: Math.round(directionAccuracy * 100) / 100,
        magnitudeMAE: Math.round(magnitudeMAE * 100) / 100,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        calibration: Math.round(calibration * 100) / 100,
        sharpeRatio: Math.round(sharpeRatio * 100) / 100
      },
      recentPerformance: {
        last7Days: Math.round(recent7dAccuracy * 100) / 100,
        last24Hours: Math.round(recent24hAccuracy * 100) / 100,
        trend
      }
    };
    
    this.accuracyMetrics.set(`${source}_${timeframe}`, metrics);
  }

  private calculateCalibration(predictions: PredictionRecord[]): number {
    const buckets = ['0-20', '20-40', '40-60', '60-80', '80-100'];
    let totalCalibrationError = 0;
    let totalSamples = 0;
    
    for (const bucket of buckets) {
      const [min, max] = bucket.split('-').map(Number);
      const bucketPredictions = predictions.filter(p => 
        p.prediction.confidence >= min && p.prediction.confidence < max
      );
      
      if (bucketPredictions.length < 5) continue; // Need at least 5 samples
      
      const predictedAccuracy = (min + max) / 2;
      const actualAccuracy = (bucketPredictions.filter(p => p.accuracy!.directionCorrect).length / bucketPredictions.length) * 100;
      const calibrationError = Math.abs(predictedAccuracy - actualAccuracy);
      
      totalCalibrationError += calibrationError * bucketPredictions.length;
      totalSamples += bucketPredictions.length;
    }
    
    return totalSamples > 0 ? 100 - (totalCalibrationError / totalSamples) : 50;
  }

  getAccuracyReport(): {
    overall: {
      totalPredictions: number;
      avgDirectionAccuracy: number;
      avgMagnitudeMAE: number;
      bestPerformingSource: string;
      bestPerformingTimeframe: string;
    };
    bySource: Record<string, AccuracyMetrics[]>;
    byTimeframe: Record<string, AccuracyMetrics[]>;
    topPerformers: AccuracyMetrics[];
  } {
    const allMetrics = Array.from(this.accuracyMetrics.values());
    
    if (allMetrics.length === 0) {
      return {
        overall: {
          totalPredictions: 0,
          avgDirectionAccuracy: 0,
          avgMagnitudeMAE: 0,
          bestPerformingSource: 'none',
          bestPerformingTimeframe: 'none'
        },
        bySource: {},
        byTimeframe: {},
        topPerformers: []
      };
    }
    
    const totalPredictions = allMetrics.reduce((sum, m) => sum + m.metrics.totalPredictions, 0);
    const avgDirectionAccuracy = allMetrics.reduce((sum, m) => sum + m.metrics.directionAccuracy, 0) / allMetrics.length;
    const avgMagnitudeMAE = allMetrics.reduce((sum, m) => sum + m.metrics.magnitudeMAE, 0) / allMetrics.length;
    
    const bestByAccuracy = allMetrics.sort((a, b) => b.metrics.directionAccuracy - a.metrics.directionAccuracy)[0];
    const bestPerformingSource = bestByAccuracy.source;
    const bestPerformingTimeframe = bestByAccuracy.timeframe;
    
    // Group by source
    const bySource: Record<string, AccuracyMetrics[]> = {};
    const byTimeframe: Record<string, AccuracyMetrics[]> = {};
    
    for (const metric of allMetrics) {
      if (!bySource[metric.source]) bySource[metric.source] = [];
      if (!byTimeframe[metric.timeframe]) byTimeframe[metric.timeframe] = [];
      
      bySource[metric.source].push(metric);
      byTimeframe[metric.timeframe].push(metric);
    }
    
    const topPerformers = allMetrics
      .sort((a, b) => b.metrics.directionAccuracy - a.metrics.directionAccuracy)
      .slice(0, 5);
    
    return {
      overall: {
        totalPredictions,
        avgDirectionAccuracy: Math.round(avgDirectionAccuracy * 100) / 100,
        avgMagnitudeMAE: Math.round(avgMagnitudeMAE * 100) / 100,
        bestPerformingSource,
        bestPerformingTimeframe
      },
      bySource,
      byTimeframe,
      topPerformers
    };
  }

  getPredictionConfidenceAdjustment(source: string, timeframe: string): number {
    const key = `${source}_${timeframe}`;
    const metrics = this.accuracyMetrics.get(key);
    
    if (!metrics || metrics.metrics.totalPredictions < 10) {
      return 1.0; // No adjustment if insufficient data
    }
    
    const calibration = metrics.metrics.calibration / 100;
    const directionAccuracy = metrics.metrics.directionAccuracy / 100;
    
    // Adjust confidence based on historical performance
    // If model is overconfident (low calibration), reduce confidence
    // If model is underperforming, reduce confidence
    const calibrationAdjust = Math.max(0.5, Math.min(1.5, calibration));
    const performanceAdjust = Math.max(0.5, Math.min(1.5, directionAccuracy / 0.6)); // 60% baseline
    
    return calibrationAdjust * performanceAdjust;
  }

  private getTimeframeMilliseconds(timeframe: string): number {
    const timeframes = {
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000
    };
    
    return timeframes[timeframe as keyof typeof timeframes] || 60 * 60 * 1000;
  }

  async getBestPredictionSource(timeframe: string): Promise<{
    source: string;
    accuracy: number;
    confidence: number;
    sampleSize: number;
    recommendation: string;
  }> {
    const candidates = Array.from(this.accuracyMetrics.values())
      .filter(m => m.timeframe === timeframe)
      .sort((a, b) => {
        // Score based on accuracy, calibration, and sample size
        const scoreA = a.metrics.directionAccuracy * 0.5 + 
                      a.metrics.calibration * 0.3 + 
                      Math.min(50, a.metrics.totalPredictions) * 0.2;
        const scoreB = b.metrics.directionAccuracy * 0.5 + 
                      b.metrics.calibration * 0.3 + 
                      Math.min(50, b.metrics.totalPredictions) * 0.2;
        return scoreB - scoreA;
      });
    
    if (candidates.length === 0) {
      return {
        source: 'multimodal',
        accuracy: 65,
        confidence: 70,
        sampleSize: 0,
        recommendation: 'No historical data available, using default multimodal approach'
      };
    }
    
    const best = candidates[0];
    let recommendation = `${best.source} shows highest accuracy for ${timeframe} predictions`;
    
    if (best.metrics.totalPredictions < 20) {
      recommendation += ' (limited sample size - monitor closely)';
    }
    
    if (best.recentPerformance.trend === 'declining') {
      recommendation += ' (recent performance declining - consider backup sources)';
    }
    
    return {
      source: best.source,
      accuracy: best.metrics.directionAccuracy,
      confidence: best.metrics.avgConfidence,
      sampleSize: best.metrics.totalPredictions,
      recommendation
    };
  }
}

export const predictionAccuracy = new PredictionAccuracy();