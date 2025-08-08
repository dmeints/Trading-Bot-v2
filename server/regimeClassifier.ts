/**
 * REGIME CLASSIFIER
 * Lightweight classifier to identify market regimes: trend, mean-reversion, chop
 */

interface MarketFeatures {
  prices: number[];
  volumes: number[];
  volatility: number;
  rsi: number;
  macd: number;
  atr: number; // Average True Range
  adx: number; // Average Directional Index
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
  };
}

export type MarketRegime = 'trend' | 'mean-rev' | 'chop';

interface RegimeMetrics {
  regime: MarketRegime;
  confidence: number;
  features: {
    trendStrength: number;
    meanReversionSignal: number;
    choppiness: number;
  };
  duration: number; // How long in current regime
}

interface RegimeHistory {
  timestamp: number;
  regime: MarketRegime;
  confidence: number;
  duration: number;
}

export class RegimeClassifier {
  private currentRegime: MarketRegime = 'chop';
  private regimeStartTime: number = Date.now();
  private regimeHistory: RegimeHistory[] = [];
  private confidenceThreshold: number = 0.6;
  
  // Regime detection parameters
  private readonly thresholds = {
    trend: {
      adxMin: 25,        // Strong trend above 25
      rsiExtreme: 20,    // RSI < 20 or > 80 for trends
      priceDeviation: 0.02 // 2% from Bollinger middle
    },
    meanRev: {
      rsiOversold: 30,   // RSI oversold/overbought levels
      rsiOverbought: 70,
      bollingerTouch: 0.95, // Price touching bands
      volatilitySpike: 1.5  // Volatility spike factor
    },
    chop: {
      adxMax: 20,        // Weak trend below 20
      atrMin: 0.005,     // Low volatility threshold
      rangebound: 0.015  // Price within 1.5% range
    }
  };

  constructor(config?: {
    confidenceThreshold?: number;
    customThresholds?: Partial<typeof RegimeClassifier.prototype.thresholds>;
  }) {
    if (config?.confidenceThreshold) {
      this.confidenceThreshold = config.confidenceThreshold;
    }
    if (config?.customThresholds) {
      Object.assign(this.thresholds, config.customThresholds);
    }
  }

  /**
   * Main regime classification function
   */
  classifyRegime(features: MarketFeatures): RegimeMetrics {
    const trendScore = this.calculateTrendScore(features);
    const meanRevScore = this.calculateMeanReversionScore(features);
    const choppinessScore = this.calculateChoppinessScore(features);
    
    // Normalize scores to probabilities
    const total = trendScore + meanRevScore + choppinessScore;
    const probabilities = {
      trend: total > 0 ? trendScore / total : 0.33,
      meanRev: total > 0 ? meanRevScore / total : 0.33,
      chop: total > 0 ? choppinessScore / total : 0.34
    };
    
    // Select regime with highest probability
    let newRegime: MarketRegime = 'chop';
    let maxProb = probabilities.chop;
    
    if (probabilities.trend > maxProb) {
      newRegime = 'trend';
      maxProb = probabilities.trend;
    }
    if (probabilities.meanRev > maxProb) {
      newRegime = 'mean-rev';
      maxProb = probabilities.meanRev;
    }
    
    // Only change regime if confidence is above threshold
    const confidence = maxProb;
    const duration = this.updateRegimeState(newRegime, confidence);
    
    return {
      regime: this.currentRegime,
      confidence,
      features: {
        trendStrength: trendScore,
        meanReversionSignal: meanRevScore,
        choppiness: choppinessScore
      },
      duration
    };
  }

  private calculateTrendScore(features: MarketFeatures): number {
    let score = 0;
    
    // ADX indicates trend strength
    if (features.adx > this.thresholds.trend.adxMin) {
      score += (features.adx - this.thresholds.trend.adxMin) / 50; // Normalize
    }
    
    // MACD momentum
    if (Math.abs(features.macd) > 0.001) {
      score += Math.min(Math.abs(features.macd) * 100, 0.5);
    }
    
    // Price momentum from recent history
    if (features.prices.length >= 10) {
      const recentPrices = features.prices.slice(-10);
      const momentum = (recentPrices[9] - recentPrices[0]) / recentPrices[0];
      if (Math.abs(momentum) > 0.01) { // 1% momentum
        score += Math.min(Math.abs(momentum) * 20, 0.3);
      }
    }
    
    // RSI extremes indicate strong trends
    if (features.rsi < this.thresholds.trend.rsiExtreme || 
        features.rsi > (100 - this.thresholds.trend.rsiExtreme)) {
      score += 0.2;
    }
    
    // High volume confirms trends
    if (features.volumes.length >= 5) {
      const avgVolume = features.volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
      const currentVolume = features.volumes[features.volumes.length - 1];
      if (currentVolume > avgVolume * 1.2) {
        score += 0.15;
      }
    }
    
    return Math.min(score, 1.0);
  }

  private calculateMeanReversionScore(features: MarketFeatures): number {
    let score = 0;
    
    // RSI overbought/oversold
    if (features.rsi < this.thresholds.meanRev.rsiOversold) {
      score += (this.thresholds.meanRev.rsiOversold - features.rsi) / 30;
    } else if (features.rsi > this.thresholds.meanRev.rsiOverbought) {
      score += (features.rsi - this.thresholds.meanRev.rsiOverbought) / 30;
    }
    
    // Bollinger Band touches
    const currentPrice = features.prices[features.prices.length - 1];
    const bandWidth = features.bollinger.upper - features.bollinger.lower;
    const distanceFromMiddle = Math.abs(currentPrice - features.bollinger.middle);
    
    if (distanceFromMiddle > bandWidth * 0.4) { // Near bands
      score += 0.3;
    }
    
    // Volatility spikes often lead to mean reversion
    if (features.volatility > 0.02) { // 2% daily volatility
      score += Math.min(features.volatility * 10, 0.4);
    }
    
    // Low ADX suggests lack of trend (favors mean reversion)
    if (features.adx < 20) {
      score += (20 - features.adx) / 40;
    }
    
    // Price oscillation around moving average
    if (features.prices.length >= 20) {
      const sma20 = features.prices.slice(-20).reduce((a, b) => a + b, 0) / 20;
      const deviation = Math.abs(currentPrice - sma20) / sma20;
      if (deviation > 0.02 && deviation < 0.05) { // 2-5% deviation
        score += 0.2;
      }
    }
    
    return Math.min(score, 1.0);
  }

  private calculateChoppinessScore(features: MarketFeatures): number {
    let score = 0;
    
    // Low ADX indicates choppy market
    if (features.adx < this.thresholds.chop.adxMax) {
      score += (this.thresholds.chop.adxMax - features.adx) / 20;
    }
    
    // Low ATR indicates low volatility/chop
    if (features.atr < this.thresholds.chop.atrMin) {
      score += 0.3;
    }
    
    // RSI in middle range (40-60)
    if (features.rsi >= 40 && features.rsi <= 60) {
      score += 0.25;
    }
    
    // MACD near zero
    if (Math.abs(features.macd) < 0.0005) {
      score += 0.2;
    }
    
    // Price within Bollinger middle range
    const currentPrice = features.prices[features.prices.length - 1];
    const bandWidth = features.bollinger.upper - features.bollinger.lower;
    const distanceFromMiddle = Math.abs(currentPrice - features.bollinger.middle);
    
    if (distanceFromMiddle < bandWidth * 0.25) { // Within 25% of middle
      score += 0.3;
    }
    
    // Low volume indicates lack of conviction
    if (features.volumes.length >= 5) {
      const avgVolume = features.volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
      const currentVolume = features.volumes[features.volumes.length - 1];
      if (currentVolume < avgVolume * 0.8) {
        score += 0.15;
      }
    }
    
    return Math.min(score, 1.0);
  }

  private updateRegimeState(newRegime: MarketRegime, confidence: number): number {
    const now = Date.now();
    const currentDuration = now - this.regimeStartTime;
    
    // Only change regime if confidence is high enough and has been stable
    if (confidence > this.confidenceThreshold && 
        (newRegime !== this.currentRegime || currentDuration > 300000)) { // 5 minutes minimum
      
      // Store previous regime in history
      if (this.currentRegime) {
        this.regimeHistory.push({
          timestamp: this.regimeStartTime,
          regime: this.currentRegime,
          confidence,
          duration: currentDuration
        });
      }
      
      // Update to new regime
      this.currentRegime = newRegime;
      this.regimeStartTime = now;
      
      // Keep only last 100 regime changes
      if (this.regimeHistory.length > 100) {
        this.regimeHistory.shift();
      }
      
      return 0; // New regime
    }
    
    return currentDuration;
  }

  /**
   * Get current regime state
   */
  getCurrentRegime(): {
    regime: MarketRegime;
    duration: number;
    confidence: number;
  } {
    return {
      regime: this.currentRegime,
      duration: Date.now() - this.regimeStartTime,
      confidence: this.confidenceThreshold
    };
  }

  /**
   * Get regime transition statistics
   */
  getRegimeStats(): {
    currentRegime: MarketRegime;
    avgDuration: Record<MarketRegime, number>;
    transitionMatrix: Record<MarketRegime, Record<MarketRegime, number>>;
    regimeDistribution: Record<MarketRegime, number>;
  } {
    if (this.regimeHistory.length === 0) {
      return {
        currentRegime: this.currentRegime,
        avgDuration: { trend: 0, 'mean-rev': 0, chop: 0 },
        transitionMatrix: {
          trend: { trend: 0, 'mean-rev': 0, chop: 0 },
          'mean-rev': { trend: 0, 'mean-rev': 0, chop: 0 },
          chop: { trend: 0, 'mean-rev': 0, chop: 0 }
        },
        regimeDistribution: { trend: 0, 'mean-rev': 0, chop: 0 }
      };
    }

    // Calculate average durations
    const durations: Record<MarketRegime, number[]> = {
      trend: [],
      'mean-rev': [],
      chop: []
    };
    
    this.regimeHistory.forEach(entry => {
      durations[entry.regime].push(entry.duration);
    });
    
    const avgDuration: Record<MarketRegime, number> = {
      trend: durations.trend.length > 0 ? durations.trend.reduce((a, b) => a + b, 0) / durations.trend.length : 0,
      'mean-rev': durations['mean-rev'].length > 0 ? durations['mean-rev'].reduce((a, b) => a + b, 0) / durations['mean-rev'].length : 0,
      chop: durations.chop.length > 0 ? durations.chop.reduce((a, b) => a + b, 0) / durations.chop.length : 0
    };
    
    // Calculate transition matrix
    const transitions: Record<MarketRegime, Record<MarketRegime, number>> = {
      trend: { trend: 0, 'mean-rev': 0, chop: 0 },
      'mean-rev': { trend: 0, 'mean-rev': 0, chop: 0 },
      chop: { trend: 0, 'mean-rev': 0, chop: 0 }
    };
    
    for (let i = 1; i < this.regimeHistory.length; i++) {
      const from = this.regimeHistory[i - 1].regime;
      const to = this.regimeHistory[i].regime;
      transitions[from][to]++;
    }
    
    // Normalize transition matrix
    Object.keys(transitions).forEach(from => {
      const total = Object.values(transitions[from as MarketRegime]).reduce((a, b) => a + b, 0);
      if (total > 0) {
        Object.keys(transitions[from as MarketRegime]).forEach(to => {
          transitions[from as MarketRegime][to as MarketRegime] /= total;
        });
      }
    });
    
    // Calculate regime distribution
    const regimeDistribution: Record<MarketRegime, number> = {
      trend: durations.trend.length / this.regimeHistory.length,
      'mean-rev': durations['mean-rev'].length / this.regimeHistory.length,
      chop: durations.chop.length / this.regimeHistory.length
    };
    
    return {
      currentRegime: this.currentRegime,
      avgDuration,
      transitionMatrix: transitions,
      regimeDistribution
    };
  }

  /**
   * Generate mock market features for testing
   */
  static generateMockFeatures(regime: MarketRegime): MarketFeatures {
    const basePrice = 50000;
    const prices: number[] = [];
    
    // Generate price series based on regime
    for (let i = 0; i < 20; i++) {
      let price = basePrice;
      
      switch (regime) {
        case 'trend':
          price = basePrice * (1 + i * 0.002 + (Math.random() - 0.5) * 0.005); // Uptrend with noise
          break;
        case 'mean-rev':
          price = basePrice * (1 + Math.sin(i * 0.5) * 0.02 + (Math.random() - 0.5) * 0.01); // Oscillation
          break;
        case 'chop':
          price = basePrice * (1 + (Math.random() - 0.5) * 0.003); // Random walk
          break;
      }
      
      prices.push(price);
    }
    
    const currentPrice = prices[prices.length - 1];
    const sma20 = prices.reduce((a, b) => a + b, 0) / prices.length;
    const std = Math.sqrt(prices.reduce((sum, p) => sum + Math.pow(p - sma20, 2), 0) / prices.length);
    
    return {
      prices,
      volumes: Array(20).fill(0).map(() => 1000000 + Math.random() * 500000),
      volatility: regime === 'chop' ? 0.005 : regime === 'mean-rev' ? 0.025 : 0.015,
      rsi: regime === 'mean-rev' ? (Math.random() > 0.5 ? 25 : 75) : regime === 'trend' ? 65 : 50,
      macd: regime === 'trend' ? 0.002 : regime === 'mean-rev' ? -0.001 : 0,
      atr: regime === 'chop' ? 0.003 : 0.01,
      adx: regime === 'trend' ? 35 : regime === 'chop' ? 15 : 22,
      bollinger: {
        upper: sma20 + 2 * std,
        middle: sma20,
        lower: sma20 - 2 * std
      }
    };
  }
}

export default RegimeClassifier;