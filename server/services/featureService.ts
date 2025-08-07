/**
 * PHASE 1: FEATURE SERVICE - UNIFIED FEATURE VECTOR GENERATION
 * Combines all data streams into comprehensive feature vectors with Redis caching
 */

import { historicalDataService, HistoricalBar, OnChainEvent, SentimentPoint, FundingRate, EconomicEvent } from './dataService';
import { marketDataService } from './marketData';
import { logger } from '../utils/logger';

export interface FeatureVector {
  timestamp: number;
  symbol: string;
  
  // Price features
  price: number;
  price_change_1h: number;
  price_change_24h: number;
  price_change_7d: number;
  volatility_1h: number;
  volatility_24h: number;
  
  // Volume features
  volume: number;
  volume_sma_24h: number;
  volume_ratio: number;
  
  // Technical indicators
  rsi_14: number;
  macd: number;
  macd_signal: number;
  bb_upper: number;
  bb_lower: number;
  bb_position: number;
  
  // On-chain features
  whale_transfers: number;
  large_tx_count: number;
  exchange_flows: number;
  active_addresses: number;
  
  // Sentiment features  
  sentiment_score: number;
  sentiment_confidence: number;
  sentiment_change_24h: number;
  
  // Funding features
  funding_rate: number;
  predicted_funding: number;
  open_interest: number;
  oi_change_24h: number;
  
  // Macro features
  macro_impact_score: number;
  upcoming_events_count: number;
  
  // Cross-asset features
  btc_correlation: number;
  market_regime: 'bull' | 'bear' | 'sideways';
  fear_greed_index: number;
}

export class FeatureService {
  private cache: Map<string, FeatureVector> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();
  private readonly cacheExpiry = 60 * 1000; // 1 minute cache

  private isCacheValid(key: string): boolean {
    const timestamp = this.cacheTimestamps.get(key);
    return timestamp ? (Date.now() - timestamp) < this.cacheExpiry : false;
  }

  async getFeatures(symbol: string, timestamp?: number): Promise<FeatureVector> {
    const targetTime = timestamp || Date.now();
    const cacheKey = `${symbol}_${Math.floor(targetTime / 60000)}`;
    
    if (this.cache.has(cacheKey) && this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      // Parallel data fetching
      const [
        priceData,
        onChainData, 
        sentimentData,
        fundingData,
        macroEvents
      ] = await Promise.all([
        this.getPriceFeatures(symbol, targetTime),
        this.getOnChainFeatures(symbol, targetTime),
        this.getSentimentFeatures(symbol, targetTime),
        this.getFundingFeatures(symbol, targetTime),
        this.getMacroFeatures(targetTime)
      ]);

      const features: FeatureVector = {
        timestamp: targetTime,
        symbol,
        ...priceData,
        ...onChainData,
        ...sentimentData,
        ...fundingData,
        ...macroEvents,
        // Cross-asset features
        btc_correlation: await this.calculateBTCCorrelation(symbol, targetTime),
        market_regime: await this.determineMarketRegime(symbol, targetTime),
        fear_greed_index: await this.calculateFearGreedIndex(targetTime)
      };

      // Cache the result
      this.cache.set(cacheKey, features);
      this.cacheTimestamps.set(cacheKey, Date.now());

      return features;
    } catch (error) {
      logger.error(`Failed to generate features for ${symbol}:`, error);
      throw error;
    }
  }

  private async getPriceFeatures(symbol: string, timestamp: number) {
    const endTime = timestamp;
    const startTime = timestamp - (7 * 24 * 60 * 60 * 1000); // 7 days back
    
    const bars = await historicalDataService.getHistoricalBars(symbol, startTime, endTime);
    
    if (bars.length === 0) {
      throw new Error(`No price data found for ${symbol}`);
    }

    const currentBar = bars[bars.length - 1];
    const bars1h = bars.slice(-1);
    const bars24h = bars.slice(-24);
    const bars7d = bars.slice(-168);

    return {
      price: currentBar.close,
      price_change_1h: this.calculatePriceChange(bars, 1),
      price_change_24h: this.calculatePriceChange(bars, 24),
      price_change_7d: this.calculatePriceChange(bars, 168),
      volatility_1h: this.calculateVolatility(bars1h),
      volatility_24h: this.calculateVolatility(bars24h),
      volume: currentBar.volume,
      volume_sma_24h: this.calculateSMA(bars24h.map(b => b.volume)),
      volume_ratio: this.calculateVolumeRatio(bars24h),
      rsi_14: this.calculateRSI(bars.slice(-14)),
      macd: this.calculateMACD(bars).macd,
      macd_signal: this.calculateMACD(bars).signal,
      bb_upper: this.calculateBollingerBands(bars).upper,
      bb_lower: this.calculateBollingerBands(bars).lower,
      bb_position: this.calculateBollingerPosition(bars)
    };
  }

  private async getOnChainFeatures(symbol: string, timestamp: number) {
    const endTime = timestamp;
    const startTime = timestamp - (24 * 60 * 60 * 1000);
    
    const events = await historicalDataService.getOnChainEvents(symbol, startTime, endTime);
    
    if (events.length === 0) {
      return {
        whale_transfers: 0,
        large_tx_count: 0,
        exchange_flows: 0,
        active_addresses: 0
      };
    }

    const latest = events[events.length - 1];
    return {
      whale_transfers: latest.whale_transfers,
      large_tx_count: latest.large_tx_count,
      exchange_flows: latest.exchange_flows,
      active_addresses: latest.active_addresses
    };
  }

  private async getSentimentFeatures(symbol: string, timestamp: number) {
    const endTime = timestamp;
    const startTime = timestamp - (24 * 60 * 60 * 1000);
    
    const sentiments = await historicalDataService.getSentimentSeries(symbol, startTime, endTime);
    
    if (sentiments.length === 0) {
      return {
        sentiment_score: 0,
        sentiment_confidence: 0,
        sentiment_change_24h: 0
      };
    }

    const latest = sentiments[sentiments.length - 1];
    const dayAgo = sentiments[0];
    
    return {
      sentiment_score: latest.sentiment,
      sentiment_confidence: latest.confidence,
      sentiment_change_24h: latest.sentiment - dayAgo.sentiment
    };
  }

  private async getFundingFeatures(symbol: string, timestamp: number) {
    const endTime = timestamp;
    const startTime = timestamp - (24 * 60 * 60 * 1000);
    
    const rates = await historicalDataService.getFundingRates(symbol, startTime, endTime);
    
    if (rates.length === 0) {
      return {
        funding_rate: 0,
        predicted_funding: 0,
        open_interest: 0,
        oi_change_24h: 0
      };
    }

    const latest = rates[rates.length - 1];
    const dayAgo = rates[0];
    
    return {
      funding_rate: latest.funding_rate,
      predicted_funding: latest.predicted_rate,
      open_interest: latest.open_interest,
      oi_change_24h: ((latest.open_interest - dayAgo.open_interest) / dayAgo.open_interest) * 100
    };
  }

  private async getMacroFeatures(timestamp: number) {
    const endTime = timestamp;
    const startTime = timestamp - (7 * 24 * 60 * 60 * 1000);
    
    const events = await historicalDataService.getEconomicEvents(startTime, endTime + (7 * 24 * 60 * 60 * 1000));
    
    const recentEvents = events.filter(e => e.timestamp <= timestamp);
    const upcomingEvents = events.filter(e => e.timestamp > timestamp);
    
    const impactScore = recentEvents.reduce((sum, event) => {
      const weight = event.impact === 'high' ? 3 : event.impact === 'medium' ? 2 : 1;
      return sum + weight;
    }, 0);

    return {
      macro_impact_score: impactScore,
      upcoming_events_count: upcomingEvents.length
    };
  }

  // Technical indicator calculations
  private calculatePriceChange(bars: HistoricalBar[], periods: number): number {
    if (bars.length < periods + 1) return 0;
    
    const current = bars[bars.length - 1].close;
    const previous = bars[bars.length - 1 - periods].close;
    
    return ((current - previous) / previous) * 100;
  }

  private calculateVolatility(bars: HistoricalBar[]): number {
    if (bars.length < 2) return 0;
    
    const returns = bars.slice(1).map((bar, i) => 
      Math.log(bar.close / bars[i].close)
    );
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * Math.sqrt(24 * 365) * 100; // Annualized volatility %
  }

  private calculateSMA(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateVolumeRatio(bars: HistoricalBar[]): number {
    if (bars.length < 2) return 1;
    
    const current = bars[bars.length - 1].volume;
    const avgVolume = this.calculateSMA(bars.slice(-24).map(b => b.volume));
    
    return current / avgVolume;
  }

  private calculateRSI(bars: HistoricalBar[]): number {
    if (bars.length < 14) return 50;
    
    const gains = [];
    const losses = [];
    
    for (let i = 1; i < bars.length; i++) {
      const change = bars[i].close - bars[i - 1].close;
      if (change > 0) {
        gains.push(change);
        losses.push(0);
      } else {
        gains.push(0);
        losses.push(Math.abs(change));
      }
    }
    
    const avgGain = this.calculateSMA(gains);
    const avgLoss = this.calculateSMA(losses);
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(bars: HistoricalBar[]): { macd: number; signal: number } {
    if (bars.length < 26) return { macd: 0, signal: 0 };
    
    const prices = bars.map(b => b.close);
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    
    // For simplicity, approximate signal line
    const signal = macd * 0.9; // Approximation
    
    return { macd, signal };
  }

  private calculateEMA(prices: number[], period: number): number {
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  private calculateBollingerBands(bars: HistoricalBar[]): { upper: number; lower: number } {
    if (bars.length < 20) return { upper: 0, lower: 0 };
    
    const prices = bars.slice(-20).map(b => b.close);
    const sma = this.calculateSMA(prices);
    
    const squaredDiffs = prices.map(price => Math.pow(price - sma, 2));
    const avgSquaredDiff = this.calculateSMA(squaredDiffs);
    const stdDev = Math.sqrt(avgSquaredDiff);
    
    return {
      upper: sma + (stdDev * 2),
      lower: sma - (stdDev * 2)
    };
  }

  private calculateBollingerPosition(bars: HistoricalBar[]): number {
    const bands = this.calculateBollingerBands(bars);
    if (bands.upper === bands.lower) return 0.5;
    
    const currentPrice = bars[bars.length - 1].close;
    return (currentPrice - bands.lower) / (bands.upper - bands.lower);
  }

  private async calculateBTCCorrelation(symbol: string, timestamp: number): Promise<number> {
    if (symbol === 'BTC') return 1;
    
    const days = 30;
    const startTime = timestamp - (days * 24 * 60 * 60 * 1000);
    
    const [symbolBars, btcBars] = await Promise.all([
      historicalDataService.getHistoricalBars(symbol, startTime, timestamp),
      historicalDataService.getHistoricalBars('BTC', startTime, timestamp)
    ]);
    
    if (symbolBars.length < 30 || btcBars.length < 30) return 0;
    
    const symbolReturns = symbolBars.slice(1).map((bar, i) => 
      Math.log(bar.close / symbolBars[i].close)
    );
    const btcReturns = btcBars.slice(1).map((bar, i) => 
      Math.log(bar.close / btcBars[i].close)
    );
    
    return this.pearsonCorrelation(symbolReturns, btcReturns);
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n === 0) return 0;
    
    const meanX = x.slice(0, n).reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.slice(0, n).reduce((sum, val) => sum + val, 0) / n;
    
    let numerator = 0;
    let denomX = 0;
    let denomY = 0;
    
    for (let i = 0; i < n; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      numerator += diffX * diffY;
      denomX += diffX * diffX;
      denomY += diffY * diffY;
    }
    
    const denominator = Math.sqrt(denomX * denomY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private async determineMarketRegime(symbol: string, timestamp: number): Promise<'bull' | 'bear' | 'sideways'> {
    const bars = await historicalDataService.getHistoricalBars(
      symbol, 
      timestamp - (30 * 24 * 60 * 60 * 1000), 
      timestamp
    );
    
    if (bars.length < 30) return 'sideways';
    
    const priceChange30d = this.calculatePriceChange(bars, 30);
    const volatility = this.calculateVolatility(bars.slice(-7));
    
    if (priceChange30d > 20 && volatility < 50) return 'bull';
    if (priceChange30d < -20 && volatility < 50) return 'bear';
    return 'sideways';
  }

  private async calculateFearGreedIndex(timestamp: number): Promise<number> {
    // Simplified fear & greed calculation based on multiple market factors
    const btcBars = await historicalDataService.getHistoricalBars(
      'BTC',
      timestamp - (7 * 24 * 60 * 60 * 1000),
      timestamp
    );
    
    if (btcBars.length < 7) return 50; // Neutral
    
    const priceChange = this.calculatePriceChange(btcBars, 7);
    const volatility = this.calculateVolatility(btcBars);
    const volume = btcBars[btcBars.length - 1].volume;
    const avgVolume = this.calculateSMA(btcBars.slice(-7).map(b => b.volume));
    
    // Combine factors (0-100 scale)
    let fearGreed = 50; // Start neutral
    
    // Price momentum component
    fearGreed += Math.min(25, Math.max(-25, priceChange));
    
    // Volatility component (high volatility = fear)
    fearGreed -= Math.min(15, volatility / 10);
    
    // Volume component (high volume = interest/greed)
    fearGreed += Math.min(10, (volume / avgVolume - 1) * 20);
    
    return Math.max(0, Math.min(100, fearGreed));
  }

  // Batch processing for multiple symbols
  async getBatchFeatures(symbols: string[], timestamp?: number): Promise<Map<string, FeatureVector>> {
    const results = new Map<string, FeatureVector>();
    
    const promises = symbols.map(async (symbol) => {
      try {
        const features = await this.getFeatures(symbol, timestamp);
        results.set(symbol, features);
      } catch (error) {
        logger.error(`Failed to get features for ${symbol}:`, error);
      }
    });
    
    await Promise.all(promises);
    return results;
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
    logger.info('Feature service cache cleared');
  }
}

export const featureService = new FeatureService();