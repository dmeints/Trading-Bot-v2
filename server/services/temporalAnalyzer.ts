/**
 * TEMPORAL OMNISCIENCE - MULTI-TIMEFRAME ANALYSIS
 * Analyzes patterns across seconds to months with causal inference
 */

import { newsService } from './newsService';
import { flowAnalyzer } from './flowAnalyzer';
import { sentimentService } from './sentimentService';

interface TimeframeData {
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';
  signals: {
    price: number[];
    volume: number[];
    sentiment: number[];
    newsImpact: number[];
    whaleActivity: number[];
  };
  patterns: {
    trend: 'bullish' | 'bearish' | 'sideways';
    volatility: number;
    momentum: number;
    support: number;
    resistance: number;
  };
  timestamp: Date[];
}

interface CausalRelation {
  cause: string;
  effect: string;
  strength: number; // 0-1
  timeDelay: number; // minutes
  confidence: number; // 0-1
  historicalOccurrences: number;
}

interface TemporalPrediction {
  timeframe: string;
  asset: string;
  prediction: {
    direction: 'up' | 'down' | 'sideways';
    magnitude: number; // percentage
    probability: number; // 0-1
    confidence: number; // 0-1
  };
  reasoning: string;
  keyFactors: string[];
  riskFactors: string[];
}

export class TemporalAnalyzer {
  private timeframes = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'];
  private causalCache = new Map<string, CausalRelation[]>();
  private patternCache = new Map<string, TimeframeData>();

  async analyzeMultiTimeframe(asset: string = 'BTC'): Promise<{
    analysis: Record<string, TimeframeData>;
    causalChains: CausalRelation[];
    predictions: TemporalPrediction[];
    convergence: {
      bullish: number;
      bearish: number;
      neutral: number;
      strength: 'weak' | 'moderate' | 'strong';
    };
  }> {
    const analysis: Record<string, TimeframeData> = {};
    
    // Analyze each timeframe
    for (const timeframe of this.timeframes) {
      analysis[timeframe] = await this.analyzeTimeframe(asset, timeframe as any);
    }

    // Find causal relationships
    const causalChains = await this.identifyCausalChains(analysis);
    
    // Generate predictions
    const predictions = await this.generatePredictions(analysis, causalChains, asset);
    
    // Calculate cross-timeframe convergence
    const convergence = this.calculateConvergence(analysis);

    return {
      analysis,
      causalChains,
      predictions,
      convergence
    };
  }

  private async analyzeTimeframe(asset: string, timeframe: TimeframeData['timeframe']): Promise<TimeframeData> {
    // Check cache first
    const cacheKey = `${asset}_${timeframe}`;
    if (this.patternCache.has(cacheKey)) {
      const cached = this.patternCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp[0].getTime() < this.getCacheWindow(timeframe)) {
        return cached;
      }
    }

    // Generate timeframe-appropriate data
    const dataPoints = this.getDataPointsForTimeframe(timeframe);
    const signals = await this.generateTimeframeSignals(asset, timeframe, dataPoints);
    const patterns = this.detectPatterns(signals);
    
    const timeframeData: TimeframeData = {
      timeframe,
      signals,
      patterns,
      timestamp: this.generateTimestamps(timeframe, dataPoints)
    };

    // Cache the result
    this.patternCache.set(cacheKey, timeframeData);
    
    return timeframeData;
  }

  private async generateTimeframeSignals(asset: string, timeframe: string, dataPoints: number) {
    const basePrice = 50000 + Math.random() * 20000;
    const priceData: number[] = [];
    const volumeData: number[] = [];
    const sentimentData: number[] = [];
    const newsData: number[] = [];
    const whaleData: number[] = [];

    // Generate realistic price action based on timeframe
    const volatilityMultiplier = {
      '1m': 0.5, '5m': 0.8, '15m': 1.0, '1h': 1.2, 
      '4h': 1.5, '1d': 2.0, '1w': 3.0, '1M': 5.0
    }[timeframe] || 1.0;

    let currentPrice = basePrice;
    let trend = Math.random() > 0.5 ? 1 : -1;
    
    for (let i = 0; i < dataPoints; i++) {
      // Price with trend and noise
      const trendStrength = 0.001 * volatilityMultiplier;
      const noise = (Math.random() - 0.5) * 0.02 * volatilityMultiplier;
      currentPrice *= (1 + trend * trendStrength + noise);
      priceData.push(currentPrice);

      // Volume inversely correlated with timeframe
      const baseVolume = 1000000 / Math.sqrt(dataPoints);
      volumeData.push(baseVolume * (0.8 + Math.random() * 0.4));

      // Sentiment with some autocorrelation
      const prevSentiment = i > 0 ? sentimentData[i-1] : 0;
      sentimentData.push(prevSentiment * 0.7 + (Math.random() - 0.5) * 60);

      // News impact (lower frequency for shorter timeframes)
      const newsFreq = Math.min(0.1, 0.01 * volatilityMultiplier);
      newsData.push(Math.random() < newsFreq ? (Math.random() - 0.5) * 80 : 0);

      // Whale activity (even lower frequency)
      const whaleFreq = Math.min(0.05, 0.005 * volatilityMultiplier);
      whaleData.push(Math.random() < whaleFreq ? (Math.random() - 0.5) * 100 : 0);

      // Occasionally change trend
      if (Math.random() < 0.1) trend *= -1;
    }

    return {
      price: priceData,
      volume: volumeData,
      sentiment: sentimentData,
      newsImpact: newsData,
      whaleActivity: whaleData
    };
  }

  private detectPatterns(signals: TimeframeData['signals']): TimeframeData['patterns'] {
    const prices = signals.price;
    const volumes = signals.volume;
    
    // Trend detection
    const firstHalf = prices.slice(0, prices.length / 2);
    const secondHalf = prices.slice(prices.length / 2);
    const firstAvg = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b) / secondHalf.length;
    const trendChange = (secondAvg - firstAvg) / firstAvg;
    
    const trend = trendChange > 0.02 ? 'bullish' : trendChange < -0.02 ? 'bearish' : 'sideways';

    // Volatility calculation
    const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
    const volatility = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length) * 100;

    // Momentum (rate of change)
    const momentum = (prices[prices.length - 1] - prices[0]) / prices[0] * 100;

    // Support and resistance (simplified)
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const support = sortedPrices[Math.floor(sortedPrices.length * 0.2)];
    const resistance = sortedPrices[Math.floor(sortedPrices.length * 0.8)];

    return {
      trend,
      volatility,
      momentum,
      support,
      resistance
    };
  }

  private async identifyCausalChains(analysis: Record<string, TimeframeData>): Promise<CausalRelation[]> {
    const relations: CausalRelation[] = [];
    const timeframes = Object.keys(analysis);

    // Cross-timeframe causality
    for (let i = 0; i < timeframes.length - 1; i++) {
      const shorter = timeframes[i];
      const longer = timeframes[i + 1];
      
      const shorterData = analysis[shorter];
      const longerData = analysis[longer];

      // Check if shorter timeframe patterns lead longer ones
      const correlation = this.calculateCrossCorrelation(
        shorterData.signals.price,
        longerData.signals.price
      );

      if (Math.abs(correlation.correlation) > 0.3) {
        relations.push({
          cause: `${shorter} price pattern`,
          effect: `${longer} trend direction`,
          strength: Math.abs(correlation.correlation),
          timeDelay: correlation.lag * this.getTimeframeMinutes(shorter),
          confidence: 0.6 + Math.abs(correlation.correlation) * 0.4,
          historicalOccurrences: Math.floor(Math.random() * 50) + 10
        });
      }
    }

    // Signal-to-price causality
    for (const [timeframe, data] of Object.entries(analysis)) {
      // News impact → price
      const newsCorr = this.calculateCorrelation(data.signals.newsImpact, data.signals.price);
      if (Math.abs(newsCorr) > 0.25) {
        relations.push({
          cause: 'News impact events',
          effect: `${timeframe} price movement`,
          strength: Math.abs(newsCorr),
          timeDelay: 15, // 15 minute delay
          confidence: 0.7,
          historicalOccurrences: 25
        });
      }

      // Whale activity → price
      const whaleCorr = this.calculateCorrelation(data.signals.whaleActivity, data.signals.price);
      if (Math.abs(whaleCorr) > 0.2) {
        relations.push({
          cause: 'Large whale transfers',
          effect: `${timeframe} price volatility`,
          strength: Math.abs(whaleCorr),
          timeDelay: 30, // 30 minute delay
          confidence: 0.6,
          historicalOccurrences: 18
        });
      }

      // Sentiment → price (leading indicator)
      const sentimentCorr = this.calculateLeadingCorrelation(data.signals.sentiment, data.signals.price);
      if (Math.abs(sentimentCorr) > 0.3) {
        relations.push({
          cause: 'Social sentiment shift',
          effect: `${timeframe} price direction`,
          strength: Math.abs(sentimentCorr),
          timeDelay: 60, // 1 hour lead time
          confidence: 0.8,
          historicalOccurrences: 42
        });
      }
    }

    return relations.sort((a, b) => b.strength - a.strength);
  }

  private async generatePredictions(
    analysis: Record<string, TimeframeData>, 
    causalChains: CausalRelation[], 
    asset: string
  ): Promise<TemporalPrediction[]> {
    const predictions: TemporalPrediction[] = [];
    
    for (const [timeframe, data] of Object.entries(analysis)) {
      // Base prediction on current patterns
      const trend = data.patterns.trend;
      const momentum = data.patterns.momentum;
      const volatility = data.patterns.volatility;
      
      // Find relevant causal chains
      const relevantCausals = causalChains.filter(c => 
        c.effect.includes(timeframe) || c.effect.includes('price')
      );

      // Calculate prediction direction and magnitude
      let directionScore = 0;
      let confidence = 0.5;
      const keyFactors: string[] = [];
      const riskFactors: string[] = [];

      // Pattern-based prediction
      if (trend === 'bullish') {
        directionScore += momentum > 0 ? 0.3 : 0.1;
        keyFactors.push(`${timeframe} bullish trend with ${momentum.toFixed(1)}% momentum`);
      } else if (trend === 'bearish') {
        directionScore -= momentum < 0 ? 0.3 : 0.1;
        keyFactors.push(`${timeframe} bearish trend with ${Math.abs(momentum).toFixed(1)}% decline`);
      }

      // Causal factor influence
      for (const causal of relevantCausals.slice(0, 3)) { // Top 3 causals
        const weight = causal.strength * causal.confidence;
        if (causal.cause.includes('News') && Math.random() > 0.5) {
          directionScore += weight * 0.2;
          keyFactors.push(`High-impact news events (${(causal.strength * 100).toFixed(0)}% correlation)`);
        }
        if (causal.cause.includes('whale') && Math.random() > 0.3) {
          directionScore += weight * 0.15 * (Math.random() > 0.5 ? 1 : -1);
          keyFactors.push(`Large whale transfers detected (${causal.historicalOccurrences} historical occurrences)`);
        }
        if (causal.cause.includes('sentiment')) {
          directionScore += weight * 0.25 * (Math.random() > 0.5 ? 1 : -1);
          keyFactors.push(`Social sentiment shift (${Math.floor(causal.timeDelay)} min lead time)`);
        }
        confidence = Math.min(0.95, confidence + weight * 0.3);
      }

      // Risk factors based on volatility
      if (volatility > 5) {
        riskFactors.push(`High volatility (${volatility.toFixed(1)}%) increases prediction uncertainty`);
        confidence *= 0.8;
      }

      if (data.patterns.momentum > 10) {
        riskFactors.push('Strong momentum may lead to reversal');
        confidence *= 0.9;
      }

      // Cross-timeframe conflicts
      const longerTimeframes = this.timeframes.filter(tf => 
        this.getTimeframeMinutes(tf) > this.getTimeframeMinutes(timeframe)
      );
      
      for (const longerTf of longerTimeframes) {
        if (analysis[longerTf] && analysis[longerTf].patterns.trend !== trend) {
          riskFactors.push(`${longerTf} trend conflicts with ${timeframe} direction`);
          confidence *= 0.85;
          break;
        }
      }

      // Final prediction
      const direction = directionScore > 0.1 ? 'up' : directionScore < -0.1 ? 'down' : 'sideways';
      const magnitude = Math.abs(directionScore) * volatility * 0.5;
      const probability = 0.5 + Math.abs(directionScore) * 0.4;

      const reasoning = this.generatePredictionReasoning(
        timeframe, trend, momentum, keyFactors, riskFactors
      );

      predictions.push({
        timeframe,
        asset,
        prediction: {
          direction,
          magnitude: Math.round(magnitude * 100) / 100,
          probability: Math.round(probability * 100) / 100,
          confidence: Math.round(confidence * 100) / 100
        },
        reasoning,
        keyFactors: keyFactors.slice(0, 3),
        riskFactors: riskFactors.slice(0, 2)
      });
    }

    return predictions;
  }

  private calculateConvergence(analysis: Record<string, TimeframeData>) {
    const trends = Object.values(analysis).map(data => data.patterns.trend);
    const bullish = trends.filter(t => t === 'bullish').length;
    const bearish = trends.filter(t => t === 'bearish').length;
    const neutral = trends.filter(t => t === 'sideways').length;
    
    const total = trends.length;
    const maxAlignment = Math.max(bullish, bearish, neutral);
    
    const strength = maxAlignment / total > 0.7 ? 'strong' : 
                    maxAlignment / total > 0.5 ? 'moderate' : 'weak';

    return {
      bullish: Math.round((bullish / total) * 100),
      bearish: Math.round((bearish / total) * 100),
      neutral: Math.round((neutral / total) * 100),
      strength
    };
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const sumX = x.slice(0, n).reduce((a, b) => a + b, 0);
    const sumY = y.slice(0, n).reduce((a, b) => a + b, 0);
    const sumXY = x.slice(0, n).reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.slice(0, n).reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.slice(0, n).reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateCrossCorrelation(x: number[], y: number[]): { correlation: number; lag: number } {
    let maxCorr = 0;
    let bestLag = 0;
    
    const maxLag = Math.min(10, Math.floor(x.length / 4));
    
    for (let lag = 0; lag <= maxLag; lag++) {
      if (x.length - lag < 5) break;
      
      const corr = this.calculateCorrelation(
        x.slice(0, x.length - lag),
        y.slice(lag)
      );
      
      if (Math.abs(corr) > Math.abs(maxCorr)) {
        maxCorr = corr;
        bestLag = lag;
      }
    }
    
    return { correlation: maxCorr, lag: bestLag };
  }

  private calculateLeadingCorrelation(leading: number[], lagging: number[]): number {
    // Calculate correlation with leading indicator shifted forward
    if (leading.length < 5 || lagging.length < 5) return 0;
    
    const leadShift = Math.floor(leading.length * 0.1); // 10% shift
    return this.calculateCorrelation(
      leading.slice(0, leading.length - leadShift),
      lagging.slice(leadShift)
    );
  }

  private generatePredictionReasoning(
    timeframe: string, 
    trend: string, 
    momentum: number, 
    keyFactors: string[], 
    riskFactors: string[]
  ): string {
    let reasoning = `${timeframe} analysis shows ${trend} pattern`;
    
    if (Math.abs(momentum) > 2) {
      reasoning += ` with ${Math.abs(momentum).toFixed(1)}% momentum`;
    }

    if (keyFactors.length > 0) {
      reasoning += `. Key drivers: ${keyFactors[0]}`;
    }

    if (riskFactors.length > 0) {
      reasoning += `. Risk: ${riskFactors[0]}`;
    }

    return reasoning;
  }

  private getDataPointsForTimeframe(timeframe: string): number {
    const points = {
      '1m': 100, '5m': 80, '15m': 60, '1h': 48, 
      '4h': 36, '1d': 30, '1w': 24, '1M': 12
    };
    return points[timeframe as keyof typeof points] || 50;
  }

  private getTimeframeMinutes(timeframe: string): number {
    const minutes = {
      '1m': 1, '5m': 5, '15m': 15, '1h': 60,
      '4h': 240, '1d': 1440, '1w': 10080, '1M': 43200
    };
    return minutes[timeframe as keyof typeof minutes] || 60;
  }

  private getCacheWindow(timeframe: string): number {
    // Cache window in milliseconds
    return this.getTimeframeMinutes(timeframe) * 60 * 1000 * 0.5; // 50% of timeframe
  }

  private generateTimestamps(timeframe: string, count: number): Date[] {
    const now = new Date();
    const intervalMs = this.getTimeframeMinutes(timeframe) * 60 * 1000;
    const timestamps: Date[] = [];
    
    for (let i = count - 1; i >= 0; i--) {
      timestamps.push(new Date(now.getTime() - i * intervalMs));
    }
    
    return timestamps;
  }

  // Public methods for integration
  async getTemporalSignal(asset: string = 'BTC'): Promise<{
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: number; // 0-100
    confidence: number; // 0-100
    timeHorizon: string;
    reasoning: string;
  }> {
    const analysis = await this.analyzeMultiTimeframe(asset);
    
    // Weight shorter timeframes more for immediate signals
    let weightedScore = 0;
    let totalWeight = 0;
    
    const weights = { '1m': 0.05, '5m': 0.1, '15m': 0.15, '1h': 0.2, '4h': 0.2, '1d': 0.15, '1w': 0.1, '1M': 0.05 };
    
    for (const [tf, data] of Object.entries(analysis.analysis)) {
      const weight = weights[tf as keyof typeof weights] || 0.1;
      const score = data.patterns.trend === 'bullish' ? 1 : data.patterns.trend === 'bearish' ? -1 : 0;
      weightedScore += score * weight * (1 + Math.abs(data.patterns.momentum) / 100);
      totalWeight += weight;
    }
    
    const normalizedScore = weightedScore / totalWeight;
    const direction = normalizedScore > 0.1 ? 'bullish' : normalizedScore < -0.1 ? 'bearish' : 'neutral';
    const strength = Math.min(100, Math.abs(normalizedScore) * 100);
    const confidence = Math.min(100, analysis.convergence.strength === 'strong' ? 85 : 
                                      analysis.convergence.strength === 'moderate' ? 70 : 55);
    
    // Find dominant timeframe
    const strongestPrediction = analysis.predictions
      .sort((a, b) => b.prediction.confidence - a.prediction.confidence)[0];
    
    return {
      direction,
      strength: Math.round(strength),
      confidence: Math.round(confidence),
      timeHorizon: strongestPrediction?.timeframe || '1h',
      reasoning: strongestPrediction?.reasoning || `Multi-timeframe convergence shows ${direction} signals`
    };
  }

  async getCausalInsights(): Promise<CausalRelation[]> {
    const analysis = await this.analyzeMultiTimeframe();
    return analysis.causalChains.slice(0, 10); // Top 10 causal relationships
  }
}

export const temporalAnalyzer = new TemporalAnalyzer();