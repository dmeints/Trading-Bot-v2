
import { logger } from '../../server/utils/logger.js';

interface FeatureMetrics {
  feature: string;
  ic: number; // Information Coefficient
  hsic: number; // HSIC-lite score
  score: number; // Combined score
  disabled: boolean;
  driftDetected: boolean;
  lastUpdate: number;
}

interface HSICBatch {
  X: number[][]; // Feature values
  y: number[]; // Target values
  timestamp: number;
}

interface DriftState {
  mean: number;
  variance: number;
  cumSum: number; // Page-Hinkley cumulative sum
  changePointScore: number; // BOCPD score
  threshold: number;
  detected: boolean;
}

class FeatureGating {
  private features: Map<string, FeatureMetrics> = new Map();
  private icHistory: Map<string, number[]> = new Map();
  private hsicBatches: Map<string, HSICBatch[]> = new Map();
  private driftStates: Map<string, DriftState> = new Map();
  
  private readonly IC_EWMA_ALPHA = 0.1;
  private readonly HSIC_BATCH_SIZE = 100;
  private readonly DRIFT_THRESHOLD = 0.05;
  private readonly DISABLE_THRESHOLD = 0.1; // Bottom 10%
  
  constructor() {
    this.initializeFeatures();
    
    // Auto-disable bottom decile weekly
    setInterval(() => {
      this.autoDisableBottomDecile();
    }, 7 * 24 * 60 * 60 * 1000); // 1 week
  }
  
  private initializeFeatures(): void {
    const defaultFeatures = [
      'rsi_14', 'macd_signal', 'bollinger_position', 'volume_sma_ratio',
      'price_sma_20', 'volatility_ewm', 'momentum_5d', 'support_resistance',
      'fibonacci_retracement', 'stochastic_k', 'williams_r', 'atr_normalized',
      'funding_rate', 'open_interest_delta', 'social_sentiment', 'news_sentiment'
    ];
    
    defaultFeatures.forEach(feature => {
      this.features.set(feature, {
        feature,
        ic: 0,
        hsic: 0,
        score: 0,
        disabled: false,
        driftDetected: false,
        lastUpdate: Date.now()
      });
      
      this.icHistory.set(feature, []);
      this.hsicBatches.set(feature, []);
      this.driftStates.set(feature, {
        mean: 0,
        variance: 1,
        cumSum: 0,
        changePointScore: 0,
        threshold: this.DRIFT_THRESHOLD,
        detected: false
      });
    });
  }
  
  updateFeatureIC(feature: string, returns: number[], featureValues: number[]): void {
    try {
      if (returns.length !== featureValues.length || returns.length < 10) {
        return;
      }
      
      // Calculate Information Coefficient (Spearman correlation)
      const ic = this.calculateSpearmanIC(featureValues, returns);
      
      // EWMA update
      const history = this.icHistory.get(feature) || [];
      const currentMetrics = this.features.get(feature);
      
      if (currentMetrics) {
        const newIC = history.length === 0 ? ic : 
          this.IC_EWMA_ALPHA * ic + (1 - this.IC_EWMA_ALPHA) * currentMetrics.ic;
        
        currentMetrics.ic = newIC;
        currentMetrics.lastUpdate = Date.now();
        
        history.push(ic);
        if (history.length > 252) { // Keep 1 year
          history.shift();
        }
        
        this.icHistory.set(feature, history);
        this.features.set(feature, currentMetrics);
        
        // Update drift detection
        this.updateDriftDetection(feature, ic);
      }
      
    } catch (error) {
      logger.error(`Error updating IC for feature ${feature}:`, error);
    }
  }
  
  private calculateSpearmanIC(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 3) return 0;
    
    // Rank the arrays
    const xRanked = this.rank(x);
    const yRanked = this.rank(y);
    
    // Calculate Pearson correlation on ranks
    return this.calculatePearsonCorrelation(xRanked, yRanked);
  }
  
  private rank(arr: number[]): number[] {
    const indexed = arr.map((val, idx) => ({ val, idx }));
    indexed.sort((a, b) => a.val - b.val);
    
    const ranks = new Array(arr.length);
    indexed.forEach((item, rank) => {
      ranks[item.idx] = rank + 1;
    });
    
    return ranks;
  }
  
  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n < 2) return 0;
    
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;
    
    let numerator = 0;
    let sumXSq = 0;
    let sumYSq = 0;
    
    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      
      numerator += dx * dy;
      sumXSq += dx * dx;
      sumYSq += dy * dy;
    }
    
    const denominator = Math.sqrt(sumXSq * sumYSq);
    return denominator === 0 ? 0 : numerator / denominator;
  }
  
  updateFeatureHSIC(feature: string, featureValues: number[], targetValues: number[]): void {
    try {
      if (featureValues.length !== targetValues.length) return;
      
      const batches = this.hsicBatches.get(feature) || [];
      
      // Add new batch
      batches.push({
        X: featureValues.map(v => [v]), // Single feature
        y: targetValues,
        timestamp: Date.now()
      });
      
      // Keep only recent batches
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days
      const recentBatches = batches.filter(b => b.timestamp > cutoff);
      
      if (recentBatches.length > 0) {
        // Calculate HSIC-lite on recent batches
        const hsic = this.calculateHSICLite(recentBatches);
        
        const currentMetrics = this.features.get(feature);
        if (currentMetrics) {
          currentMetrics.hsic = hsic;
          currentMetrics.lastUpdate = Date.now();
          this.features.set(feature, currentMetrics);
        }
      }
      
      this.hsicBatches.set(feature, recentBatches);
      
    } catch (error) {
      logger.error(`Error updating HSIC for feature ${feature}:`, error);
    }
  }
  
  private calculateHSICLite(batches: HSICBatch[]): number {
    try {
      // Simplified HSIC calculation using RBF kernel
      let hsicSum = 0;
      let count = 0;
      
      for (const batch of batches.slice(-5)) { // Use last 5 batches
        if (batch.X.length !== batch.y.length || batch.X.length < 10) continue;
        
        const n = batch.X.length;
        const sigma = 1.0; // RBF kernel bandwidth
        
        // RBF kernel matrices
        const Kx = this.rbfKernel(batch.X, sigma);
        const Ky = this.rbfKernel(batch.y.map(v => [v]), sigma);
        
        // Centered kernel matrices
        const HKxH = this.centerKernel(Kx);
        const HKyH = this.centerKernel(Ky);
        
        // HSIC = (1/n²) * trace(HKxH * HKyH)
        let trace = 0;
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            trace += HKxH[i][j] * HKyH[i][j];
          }
        }
        
        hsicSum += trace / (n * n);
        count++;
      }
      
      return count > 0 ? hsicSum / count : 0;
      
    } catch (error) {
      logger.error('Error calculating HSIC-lite:', error);
      return 0;
    }
  }
  
  private rbfKernel(X: number[][], sigma: number): number[][] {
    const n = X.length;
    const K = Array(n).fill(0).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const dist = this.euclideanDistance(X[i], X[j]);
        K[i][j] = Math.exp(-dist * dist / (2 * sigma * sigma));
      }
    }
    
    return K;
  }
  
  private euclideanDistance(x1: number[], x2: number[]): number {
    let sum = 0;
    for (let i = 0; i < x1.length; i++) {
      sum += (x1[i] - x2[i]) ** 2;
    }
    return Math.sqrt(sum);
  }
  
  private centerKernel(K: number[][]): number[][] {
    const n = K.length;
    const HKH = Array(n).fill(0).map(() => Array(n).fill(0));
    
    // Calculate row and column means
    const rowMeans = K.map(row => row.reduce((a, b) => a + b, 0) / n);
    const colMeans = Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        colMeans[j] += K[i][j];
      }
      colMeans[j] /= n;
    }
    
    const grandMean = rowMeans.reduce((a, b) => a + b, 0) / n;
    
    // Center the kernel matrix
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        HKH[i][j] = K[i][j] - rowMeans[i] - colMeans[j] + grandMean;
      }
    }
    
    return HKH;
  }
  
  private updateDriftDetection(feature: string, newValue: number): void {
    const driftState = this.driftStates.get(feature);
    if (!driftState) return;
    
    try {
      // Update statistics
      const alpha = 0.01; // Learning rate
      const oldMean = driftState.mean;
      driftState.mean = (1 - alpha) * oldMean + alpha * newValue;
      driftState.variance = (1 - alpha) * driftState.variance + alpha * (newValue - driftState.mean) ** 2;
      
      // Page-Hinkley test
      const standardizedValue = (newValue - oldMean) / Math.sqrt(Math.max(0.001, driftState.variance));
      driftState.cumSum = Math.max(0, driftState.cumSum + standardizedValue - 0.5);
      
      // BOCPD change point score (simplified)
      const changePointProb = Math.exp(-driftState.cumSum);
      driftState.changePointScore = 1 - changePointProb;
      
      // Drift detection
      const driftDetected = driftState.cumSum > driftState.threshold || 
                           driftState.changePointScore > 0.9;
      
      if (driftDetected && !driftState.detected) {
        driftState.detected = true;
        
        const featureMetrics = this.features.get(feature);
        if (featureMetrics) {
          featureMetrics.driftDetected = true;
          this.features.set(feature, featureMetrics);
          
          logger.warn(`Drift detected for feature ${feature}`, {
            cumSum: driftState.cumSum,
            changePointScore: driftState.changePointScore
          });
        }
      }
      
      // Reset drift detection after some time
      if (driftState.detected && Math.random() < 0.1) { // 10% chance per update
        driftState.detected = false;
        driftState.cumSum = 0;
        
        const featureMetrics = this.features.get(feature);
        if (featureMetrics) {
          featureMetrics.driftDetected = false;
          this.features.set(feature, featureMetrics);
        }
      }
      
      this.driftStates.set(feature, driftState);
      
    } catch (error) {
      logger.error(`Error in drift detection for feature ${feature}:`, error);
    }
  }
  
  private autoDisableBottomDecile(): void {
    try {
      const allFeatures = Array.from(this.features.values());
      
      // Calculate combined scores
      allFeatures.forEach(feature => {
        // Combine IC and HSIC with drift penalty
        const icScore = Math.abs(feature.ic);
        const hsicScore = feature.hsic;
        const driftPenalty = feature.driftDetected ? 0.5 : 1.0;
        
        feature.score = (icScore + hsicScore) * driftPenalty;
        this.features.set(feature.feature, feature);
      });
      
      // Sort by score
      allFeatures.sort((a, b) => a.score - b.score);
      
      // Disable bottom 10%
      const disableCount = Math.floor(allFeatures.length * this.DISABLE_THRESHOLD);
      
      for (let i = 0; i < disableCount; i++) {
        const feature = allFeatures[i];
        if (!feature.disabled) {
          feature.disabled = true;
          this.features.set(feature.feature, feature);
          
          logger.info(`Auto-disabled feature ${feature.feature}`, {
            score: feature.score,
            ic: feature.ic,
            hsic: feature.hsic
          });
        }
      }
      
      // Re-enable top performers that were disabled
      for (let i = disableCount; i < allFeatures.length; i++) {
        const feature = allFeatures[i];
        if (feature.disabled && feature.score > 0.1) {
          feature.disabled = false;
          this.features.set(feature.feature, feature);
          
          logger.info(`Re-enabled feature ${feature.feature}`, {
            score: feature.score
          });
        }
      }
      
    } catch (error) {
      logger.error('Error in auto-disable bottom decile:', error);
    }
  }
  
  getFeatureRanking(): FeatureMetrics[] {
    return Array.from(this.features.values())
      .sort((a, b) => b.score - a.score);
  }
  
  isFeatureEnabled(feature: string): boolean {
    const metrics = this.features.get(feature);
    return metrics ? !metrics.disabled : true;
  }
  
  // Simulate feature updates for demo
  simulateFeatureUpdates(): void {
    const features = Array.from(this.features.keys());
    
    features.forEach(feature => {
      // Generate synthetic returns and feature values
      const returns = Array.from({ length: 50 }, () => (Math.random() - 0.5) * 0.04);
      const featureValues = Array.from({ length: 50 }, () => Math.random() * 100);
      
      this.updateFeatureIC(feature, returns, featureValues);
      this.updateFeatureHSIC(feature, featureValues, returns);
    });
  }
}

export const featureGating = new FeatureGating();
export type { FeatureMetrics };
