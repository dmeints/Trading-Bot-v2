
import { logger } from '../utils/logger.js';

export interface QualityMetrics {
  brierScore: number;
  regretVsHold: number;
  regretVsVWAP: number;
  excessCVaR: number;
  calibration: number;
  reliability: number;
  sharpness: number;
  lastUpdate: Date;
}

export interface Nudges {
  routerPriorDelta: number;
  sizingCapDelta: number;
  applied: boolean;
  timestamp: Date;
  reason: string;
}

interface PredictionRecord {
  timestamp: Date;
  prediction: number;
  confidence: number;
  actualOutcome: number;
  regime: string;
}

export class MetaMonitor {
  private predictions: PredictionRecord[] = [];
  private tradePnL: number[] = [];
  private benchmarkReturns: { hold: number[]; vwap: number[] } = { hold: [], vwap: [] };
  private lastNudges: Nudges | null = null;
  private maxNudgeMagnitude = 0.05; // 5% max adjustment

  recordPrediction(prediction: number, confidence: number, regime: string): void {
    this.predictions.push({
      timestamp: new Date(),
      prediction,
      confidence,
      actualOutcome: 0, // Will be updated when outcome is known
      regime
    });

    // Keep only recent predictions
    if (this.predictions.length > 1000) {
      this.predictions = this.predictions.slice(-500);
    }
  }

  updateOutcome(outcome: number): void {
    // Update the most recent prediction with actual outcome
    if (this.predictions.length > 0) {
      const lastPrediction = this.predictions[this.predictions.length - 1];
      lastPrediction.actualOutcome = outcome;
    }

    this.tradePnL.push(outcome);
    
    // Mock benchmark returns
    this.benchmarkReturns.hold.push(0.0001); // Modest positive return for hold
    this.benchmarkReturns.vwap.push(0.00005); // Small execution alpha for VWAP

    // Keep only recent data
    if (this.tradePnL.length > 1000) {
      this.tradePnL = this.tradePnL.slice(-500);
      this.benchmarkReturns.hold = this.benchmarkReturns.hold.slice(-500);
      this.benchmarkReturns.vwap = this.benchmarkReturns.vwap.slice(-500);
    }
  }

  getQuality(): QualityMetrics {
    const completePredictions = this.predictions.filter(p => p.actualOutcome !== 0);
    
    const brierScore = this.computeBrierScore(completePredictions);
    const regretVsHold = this.computeRegret(this.tradePnL, this.benchmarkReturns.hold);
    const regretVsVWAP = this.computeRegret(this.tradePnL, this.benchmarkReturns.vwap);
    const excessCVaR = this.computeExcessCVaR();
    const { calibration, reliability, sharpness } = this.computeCalibrationMetrics(completePredictions);

    return {
      brierScore,
      regretVsHold,
      regretVsVWAP,
      excessCVaR,
      calibration,
      reliability,
      sharpness,
      lastUpdate: new Date()
    };
  }

  generateNudges(): Nudges {
    const quality = this.getQuality();
    let routerPriorDelta = 0;
    let sizingCapDelta = 0;
    let reason = '';

    // Generate nudges based on quality metrics
    if (quality.brierScore > 0.3) {
      routerPriorDelta = -0.02; // Reduce confidence in predictions
      reason += 'Poor calibration; ';
    }

    if (quality.regretVsHold > 0.01) {
      sizingCapDelta = -0.03; // Reduce position sizes
      reason += 'High regret vs hold; ';
    }

    if (quality.excessCVaR > 0.02) {
      sizingCapDelta = Math.min(sizingCapDelta - 0.02, -0.05); // Further reduce sizes
      reason += 'Excess CVaR; ';
    }

    if (quality.calibration < 0.7) {
      routerPriorDelta = Math.min(routerPriorDelta - 0.01, -0.03);
      reason += 'Poor reliability; ';
    }

    // Bound nudges to prevent excessive adjustments
    routerPriorDelta = Math.max(-this.maxNudgeMagnitude, Math.min(this.maxNudgeMagnitude, routerPriorDelta));
    sizingCapDelta = Math.max(-this.maxNudgeMagnitude, Math.min(this.maxNudgeMagnitude, sizingCapDelta));

    const nudges: Nudges = {
      routerPriorDelta,
      sizingCapDelta,
      applied: false,
      timestamp: new Date(),
      reason: reason || 'No adjustments needed'
    };

    this.lastNudges = nudges;
    
    logger.info(`[MetaMonitor] Generated nudges: router=${routerPriorDelta.toFixed(4)}, sizing=${sizingCapDelta.toFixed(4)}, reason=${reason}`);

    return nudges;
  }

  applyNudges(nudges: Nudges): void {
    // Mock application of nudges
    if (this.lastNudges && this.lastNudges.timestamp === nudges.timestamp) {
      this.lastNudges.applied = true;
      logger.info(`[MetaMonitor] Applied nudges: router=${nudges.routerPriorDelta.toFixed(4)}, sizing=${nudges.sizingCapDelta.toFixed(4)}`);
    }
  }

  private computeBrierScore(predictions: PredictionRecord[]): number {
    if (predictions.length === 0) return 0.25; // Default middle score

    let sum = 0;
    for (const pred of predictions) {
      // Convert actual outcome to probability (1 if positive, 0 if negative)
      const actualProb = pred.actualOutcome > 0 ? 1 : 0;
      const forecastProb = Math.max(0, Math.min(1, pred.confidence));
      sum += Math.pow(forecastProb - actualProb, 2);
    }

    return sum / predictions.length;
  }

  private computeRegret(strategyReturns: number[], benchmarkReturns: number[]): number {
    const minLength = Math.min(strategyReturns.length, benchmarkReturns.length);
    if (minLength === 0) return 0;

    let regretSum = 0;
    for (let i = 0; i < minLength; i++) {
      regretSum += Math.max(0, benchmarkReturns[i] - strategyReturns[i]);
    }

    return regretSum / minLength;
  }

  private computeExcessCVaR(): number {
    if (this.tradePnL.length < 20) return 0;

    const returns = this.tradePnL.slice(-100); // Recent 100 trades
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const cvarCutoff = Math.floor(returns.length * 0.05); // 5% CVaR
    const cvar = sortedReturns.slice(0, cvarCutoff + 1).reduce((sum, r) => sum + r, 0) / (cvarCutoff + 1);

    // Compare to "expected" CVaR (mock threshold)
    const expectedCVaR = -0.01; // Expect max 1% loss in tail
    return Math.max(0, cvar - expectedCVaR);
  }

  private computeCalibrationMetrics(predictions: PredictionRecord[]): { calibration: number; reliability: number; sharpness: number } {
    if (predictions.length < 10) {
      return { calibration: 0.5, reliability: 0.5, sharpness: 0.5 };
    }

    // Reliability diagram: bin predictions by confidence and check actual frequency
    const bins = 5;
    const binSize = 1.0 / bins;
    const binCounts = new Array(bins).fill(0);
    const binCorrect = new Array(bins).fill(0);

    for (const pred of predictions) {
      const binIndex = Math.min(bins - 1, Math.floor(pred.confidence / binSize));
      binCounts[binIndex]++;
      if (pred.actualOutcome > 0) {
        binCorrect[binIndex]++;
      }
    }

    // Compute reliability (weighted average of |forecast_prob - observed_freq|)
    let reliabilitySum = 0;
    let totalWeight = 0;
    for (let i = 0; i < bins; i++) {
      if (binCounts[i] > 0) {
        const forecastProb = (i + 0.5) * binSize;
        const observedFreq = binCorrect[i] / binCounts[i];
        const weight = binCounts[i] / predictions.length;
        reliabilitySum += weight * Math.abs(forecastProb - observedFreq);
        totalWeight += weight;
      }
    }
    const reliability = totalWeight > 0 ? 1 - (reliabilitySum / totalWeight) : 0.5;

    // Sharpness: how often predictions are close to 0 or 1 (confident)
    const sharpnessSum = predictions.reduce((sum, pred) => {
      return sum + Math.max(Math.abs(pred.confidence - 0.5) - 0.3, 0);
    }, 0);
    const sharpness = sharpnessSum / predictions.length;

    // Overall calibration combines reliability and sharpness
    const calibration = 0.7 * reliability + 0.3 * sharpness;

    return { calibration, reliability, sharpness };
  }

  // Simulate some data for testing
  simulateData(): void {
    for (let i = 0; i < 100; i++) {
      const prediction = Math.random();
      const confidence = 0.3 + Math.random() * 0.4; // Between 0.3 and 0.7
      const regime = ['bull', 'bear', 'sideways'][Math.floor(Math.random() * 3)];
      
      this.recordPrediction(prediction, confidence, regime);
      
      // Mock outcome that's somewhat correlated with prediction
      const outcome = prediction > 0.5 ? 
        (0.001 + Math.random() * 0.005) : 
        (-0.005 + Math.random() * 0.005);
      
      this.updateOutcome(outcome);
    }
  }
}

export const metaMonitor = new MetaMonitor();
