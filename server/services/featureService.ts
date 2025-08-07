/**
 * Stevie v1.3 - Unified Feature Service
 * Aggregates all data sources into ML-ready feature vectors
 */

import fs from 'fs';
import path from 'path';
// import csv from 'csv-parser';
// import Redis from 'ioredis';

export interface FeatureVector {
  // Core price features
  ohlcv: {
    open: number[];
    high: number[];
    low: number[];
    close: number[];
    volume: number[];
  };
  
  // Order book features
  orderBook: {
    bidDepth: number[];
    askDepth: number[];
    spread: number;
    imbalance: number;
    liquidityScore: number;
  };
  
  // On-chain metrics
  onChain: {
    difficulty?: number;
    hashrate?: number;
    mempoolSize?: number;
    gasPrice?: number;
    totalSupply?: number;
    networkActivity: number;
  };
  
  // Social sentiment
  sentiment: {
    fearGreedIndex: number;
    sentimentScore: number;
    socialMentions: number;
    trendingRank: number;
  };
  
  // Macro events
  macroEvents: {
    eventProximity: number;
    impactScore: number;
    marketRegime: string;
  };
  
  // Derivatives
  derivatives: {
    fundingRate: number;
    openInterest: number;
    fundingTrend: number;
    leverageRatio: number;
  };
  
  // Technical indicators
  technical: {
    rsi: number;
    macd: number;
    bollingerBands: {
      upper: number;
      middle: number;
      lower: number;
      position: number;
    };
    volatility: number;
    momentum: number[];
  };
  
  // Meta features
  meta: {
    timestamp: number;
    symbol: string;
    marketHours: boolean;
    volumeProfile: number;
    priceChange24h: number;
  };
}

export interface CachedFeature {
  features: FeatureVector;
  timestamp: number;
  ttl: number;
}

export class FeatureService {
  private redis: any | null = null;
  private dataPath: string;
  private cache: Map<string, CachedFeature> = new Map();

  constructor(dataPath = 'data/historical', redisUrl?: string) {
    this.dataPath = dataPath;
    
    // Redis support disabled for now
    console.log('[FeatureService] Using in-memory cache');
  }

  async getFeatures(symbol: string, timestamp?: number): Promise<FeatureVector> {
    const ts = timestamp || Date.now();
    const cacheKey = `features:${symbol}:${ts}`;
    
    // Check cache first
    const cached = await this.getCachedFeatures(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
      return cached.features;
    }
    
    // Generate new features
    const features = await this.generateFeatureVector(symbol, ts);
    
    // Cache for 30 seconds
    await this.setCachedFeatures(cacheKey, features, 30000);
    
    return features;
  }

  private async generateFeatureVector(symbol: string, timestamp: number): Promise<FeatureVector> {
    const [
      ohlcv,
      orderBook,
      onChain,
      sentiment,
      macroEvents,
      derivatives
    ] = await Promise.all([
      this.getOHLCVFeatures(symbol, timestamp),
      this.getOrderBookFeatures(symbol, timestamp),
      this.getOnChainFeatures(symbol, timestamp),
      this.getSentimentFeatures(symbol, timestamp),
      this.getMacroEventFeatures(timestamp),
      this.getDerivativesFeatures(symbol, timestamp)
    ]);

    const technical = this.calculateTechnicalIndicators(ohlcv);
    const meta = this.generateMetaFeatures(symbol, timestamp, ohlcv);

    return {
      ohlcv,
      orderBook,
      onChain,
      sentiment,
      macroEvents,
      derivatives,
      technical,
      meta
    };
  }

  private async getOHLCVFeatures(symbol: string, timestamp: number): Promise<FeatureVector['ohlcv']> {
    try {
      const data = await this.readRecentCSVData(`${symbol}_price.csv`, timestamp, 50);
      
      return {
        open: data.map(row => parseFloat(row.open || '0')),
        high: data.map(row => parseFloat(row.high || '0')),
        low: data.map(row => parseFloat(row.low || '0')),
        close: data.map(row => parseFloat(row.close || '0')),
        volume: data.map(row => parseFloat(row.volume || '0'))
      };
    } catch (error) {
      console.error('[FeatureService] Error loading OHLCV:', error);
      return this.getEmptyOHLCV();
    }
  }

  private async getOrderBookFeatures(symbol: string, timestamp: number): Promise<FeatureVector['orderBook']> {
    try {
      const data = await this.readRecentCSVData(`${symbol}_binance_depth.csv`, timestamp, 10);
      
      if (data.length === 0) {
        return this.getEmptyOrderBook();
      }

      const latest = data[data.length - 1];
      const bids = JSON.parse(latest.bids || '[]');
      const asks = JSON.parse(latest.asks || '[]');
      
      const bidDepth = bids.slice(0, 5).map((b: any) => parseFloat(b[1] || '0'));
      const askDepth = asks.slice(0, 5).map((a: any) => parseFloat(a[1] || '0'));
      
      const bestBid = parseFloat(bids[0]?.[0] || '0');
      const bestAsk = parseFloat(asks[0]?.[0] || '0');
      const spread = bestAsk - bestBid;
      
      const totalBidVolume = bidDepth.reduce((sum, vol) => sum + vol, 0);
      const totalAskVolume = askDepth.reduce((sum, vol) => sum + vol, 0);
      const imbalance = totalBidVolume / (totalBidVolume + totalAskVolume) - 0.5;
      
      const liquidityScore = (totalBidVolume + totalAskVolume) / Math.max(bestAsk, 1);
      
      return {
        bidDepth,
        askDepth,
        spread,
        imbalance,
        liquidityScore
      };
    } catch (error) {
      console.error('[FeatureService] Error loading order book:', error);
      return this.getEmptyOrderBook();
    }
  }

  private async getOnChainFeatures(symbol: string, timestamp: number): Promise<FeatureVector['onChain']> {
    try {
      const data = await this.readRecentCSVData(`${symbol}_onchain.csv`, timestamp, 5);
      
      if (data.length === 0) {
        return { networkActivity: 0 };
      }

      const latest = data[data.length - 1];
      
      if (symbol.includes('BTC')) {
        return {
          difficulty: parseFloat(latest.difficulty || '0'),
          hashrate: parseFloat(latest.hashrate || '0'),
          mempoolSize: parseFloat(latest.mempool_size || '0'),
          networkActivity: this.calculateBitcoinActivity(latest)
        };
      } else if (symbol.includes('ETH')) {
        return {
          gasPrice: parseFloat(latest.gas_standard || '0'),
          totalSupply: parseFloat(latest.total_supply || '0'),
          networkActivity: this.calculateEthereumActivity(latest)
        };
      }
      
      return { networkActivity: 0 };
    } catch (error) {
      console.error('[FeatureService] Error loading on-chain:', error);
      return { networkActivity: 0 };
    }
  }

  private async getSentimentFeatures(symbol: string, timestamp: number): Promise<FeatureVector['sentiment']> {
    try {
      const data = await this.readRecentCSVData(`${symbol}_sentiment.csv`, timestamp, 10);
      
      if (data.length === 0) {
        return this.getEmptySentiment();
      }

      const latest = data[data.length - 1];
      
      return {
        fearGreedIndex: parseFloat(latest.fear_greed_index || '50'),
        sentimentScore: parseFloat(latest.sentiment_score || '0'),
        socialMentions: data.length, // Recent mention count
        trendingRank: latest.is_trending === 'true' ? 1 : 0
      };
    } catch (error) {
      console.error('[FeatureService] Error loading sentiment:', error);
      return this.getEmptySentiment();
    }
  }

  private async getMacroEventFeatures(timestamp: number): Promise<FeatureVector['macroEvents']> {
    try {
      const data = await this.readRecentCSVData('events.csv', timestamp, 20);
      
      const now = new Date(timestamp);
      const upcomingEvents = data.filter(event => {
        const eventDate = new Date(event.event_date);
        const timeDiff = eventDate.getTime() - now.getTime();
        return timeDiff > 0 && timeDiff < 7 * 24 * 60 * 60 * 1000; // Next 7 days
      });
      
      const highImpactEvents = upcomingEvents.filter(event => 
        parseFloat(event.impact_score || '0') > 0.7
      );
      
      const eventProximity = upcomingEvents.length > 0 ? 
        Math.min(...upcomingEvents.map(event => {
          const eventDate = new Date(event.event_date);
          return Math.abs(eventDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
        })) : 7;
      
      const impactScore = highImpactEvents.reduce((sum, event) => 
        sum + parseFloat(event.impact_score || '0'), 0
      );
      
      const marketRegime = this.determineMarketRegime(eventProximity, impactScore);
      
      return {
        eventProximity: Math.max(0, 1 - eventProximity / 7), // Normalize to 0-1
        impactScore,
        marketRegime
      };
    } catch (error) {
      console.error('[FeatureService] Error loading macro events:', error);
      return {
        eventProximity: 0,
        impactScore: 0,
        marketRegime: 'normal'
      };
    }
  }

  private async getDerivativesFeatures(symbol: string, timestamp: number): Promise<FeatureVector['derivatives']> {
    try {
      const [fundingData, oiData] = await Promise.all([
        this.readRecentCSVData(`${symbol}_funding.csv`, timestamp, 24), // Last 24 hours
        this.readRecentCSVData(`${symbol}_oi.csv`, timestamp, 10)
      ]);
      
      const latestFunding = fundingData[fundingData.length - 1];
      const latestOI = oiData[oiData.length - 1];
      
      const fundingRate = parseFloat(latestFunding?.funding_rate || '0');
      const openInterest = parseFloat(latestOI?.open_interest || '0');
      
      // Calculate funding trend (8-hour rolling average)
      const recentFunding = fundingData.slice(-8);
      const avgFunding = recentFunding.length > 0 ?
        recentFunding.reduce((sum, row) => sum + parseFloat(row.funding_rate || '0'), 0) / recentFunding.length :
        0;
      
      const fundingTrend = fundingRate - avgFunding;
      
      // Estimate leverage ratio from funding rate
      const leverageRatio = Math.abs(fundingRate) > 0.001 ? 
        Math.min(10, Math.abs(fundingRate) * 10000) : 1;
      
      return {
        fundingRate,
        openInterest,
        fundingTrend,
        leverageRatio
      };
    } catch (error) {
      console.error('[FeatureService] Error loading derivatives:', error);
      return {
        fundingRate: 0,
        openInterest: 0,
        fundingTrend: 0,
        leverageRatio: 1
      };
    }
  }

  private calculateTechnicalIndicators(ohlcv: FeatureVector['ohlcv']): FeatureVector['technical'] {
    const closes = ohlcv.close;
    const highs = ohlcv.high;
    const lows = ohlcv.low;
    const volumes = ohlcv.volume;
    
    if (closes.length === 0) {
      return this.getEmptyTechnical();
    }
    
    // RSI calculation (14 periods)
    const rsi = this.calculateRSI(closes, 14);
    
    // MACD calculation
    const macd = this.calculateMACD(closes);
    
    // Bollinger Bands
    const bollingerBands = this.calculateBollingerBands(closes, 20, 2);
    
    // Volatility (20-period rolling std)
    const volatility = this.calculateVolatility(closes, 20);
    
    // Momentum (price changes over different periods)
    const momentum = [1, 3, 7, 14].map(period => 
      closes.length > period ? 
        (closes[closes.length - 1] - closes[closes.length - 1 - period]) / closes[closes.length - 1 - period] :
        0
    );
    
    return {
      rsi,
      macd,
      bollingerBands,
      volatility,
      momentum
    };
  }

  private generateMetaFeatures(symbol: string, timestamp: number, ohlcv: FeatureVector['ohlcv']): FeatureVector['meta'] {
    const now = new Date(timestamp);
    const marketHours = this.isMarketHours(now); // Crypto is 24/7, but useful for traditional market correlation
    
    const closes = ohlcv.close;
    const volumes = ohlcv.volume;
    
    const priceChange24h = closes.length >= 24 ? 
      (closes[closes.length - 1] - closes[closes.length - 24]) / closes[closes.length - 24] :
      0;
    
    const avgVolume = volumes.length > 0 ? 
      volumes.reduce((sum: number, vol: number) => sum + vol, 0) / volumes.length :
      0;
    
    const currentVolume = volumes[volumes.length - 1] || 0;
    const volumeProfile = avgVolume > 0 ? currentVolume / avgVolume : 1;
    
    return {
      timestamp,
      symbol,
      marketHours,
      volumeProfile,
      priceChange24h
    };
  }

  // Utility methods
  private async readRecentCSVData(filename: string, timestamp: number, limit: number): Promise<any[]> {
    const filepath = path.join(this.dataPath, filename);
    
    if (!fs.existsSync(filepath)) {
      return [];
    }
    
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const cutoffTime = new Date(timestamp - 24 * 60 * 60 * 1000); // Last 24 hours
      
      const content = fs.readFileSync(filepath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        resolve([]);
        return;
      }
      
      const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.replace(/"/g, ''));
        const data: any = {};
        
        headers.forEach((header, index) => {
          data[header] = values[index] || '';
        });
        
        if (data.timestamp) {
          const rowTime = new Date(data.timestamp);
          if (rowTime >= cutoffTime) {
            results.push(data);
          }
        }
      }
      
      resolve(results.slice(-limit)); // Take most recent N records
    });
  }

  private async getCachedFeatures(key: string): Promise<CachedFeature | null> {
    try {
      if (this.redis) {
        const cached = await this.redis.get(key);
        return cached ? JSON.parse(cached) : null;
      } else {
        return this.cache.get(key) || null;
      }
    } catch (error) {
      console.error('[FeatureService] Cache read error:', error);
      return null;
    }
  }

  private async setCachedFeatures(key: string, features: FeatureVector, ttl: number): Promise<void> {
    try {
      const cached: CachedFeature = {
        features,
        timestamp: Date.now(),
        ttl
      };
      
      if (this.redis) {
        await this.redis.setex(key, Math.floor(ttl / 1000), JSON.stringify(cached));
      } else {
        this.cache.set(key, cached);
        // Clean up old cache entries
        setTimeout(() => this.cache.delete(key), ttl);
      }
    } catch (error) {
      console.error('[FeatureService] Cache write error:', error);
    }
  }

  // Helper calculation methods
  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(prices: number[]): number {
    if (prices.length < 26) return 0;
    
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    
    return ema12 - ema26;
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  private calculateBollingerBands(prices: number[], period: number, multiplier: number) {
    if (prices.length < period) {
      const price = prices[prices.length - 1] || 0;
      return { upper: price, middle: price, lower: price, position: 0.5 };
    }
    
    const recentPrices = prices.slice(-period);
    const sma = recentPrices.reduce((sum, price) => sum + price, 0) / period;
    
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    const upper = sma + (stdDev * multiplier);
    const lower = sma - (stdDev * multiplier);
    const middle = sma;
    
    const currentPrice = prices[prices.length - 1];
    const position = (currentPrice - lower) / (upper - lower);
    
    return { upper, middle, lower, position };
  }

  private calculateVolatility(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    
    const returns = [];
    for (let i = prices.length - period; i < prices.length - 1; i++) {
      returns.push((prices[i + 1] - prices[i]) / prices[i]);
    }
    
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance * 252); // Annualized volatility
  }

  private calculateBitcoinActivity(data: any): number {
    const hashrate = parseFloat(data.hashrate || '0');
    const mempoolSize = parseFloat(data.mempool_size || '0');
    const blocks24h = parseFloat(data.blocks_24h || '0');
    
    // Normalize and combine metrics
    const hashrateScore = Math.min(1, hashrate / 1e18); // Normalize to ~current levels
    const mempoolScore = Math.min(1, mempoolSize / 100e6); // 100MB as high activity
    const blocksScore = Math.min(1, blocks24h / 150); // 150 blocks as normal
    
    return (hashrateScore + mempoolScore + blocksScore) / 3;
  }

  private calculateEthereumActivity(data: any): number {
    const gasPrice = parseFloat(data.gas_standard || '0');
    const totalSupply = parseFloat(data.total_supply || '0');
    
    // Higher gas price = higher activity
    const gasScore = Math.min(1, gasPrice / 100); // 100 gwei as high activity
    const supplyScore = totalSupply > 0 ? 1 : 0; // Basic supply check
    
    return (gasScore + supplyScore) / 2;
  }

  private determineMarketRegime(eventProximity: number, impactScore: number): string {
    if (eventProximity > 0.7 && impactScore > 2) return 'high-impact-event';
    if (eventProximity > 0.5 && impactScore > 1) return 'event-driven';
    if (impactScore > 3) return 'high-volatility';
    return 'normal';
  }

  private isMarketHours(date: Date): boolean {
    const hour = date.getUTCHours();
    const day = date.getUTCDay();
    
    // Traditional market hours (9:30 AM - 4:00 PM ET) for correlation
    return day >= 1 && day <= 5 && hour >= 14 && hour <= 21;
  }

  // Empty feature generators
  private getEmptyOHLCV(): FeatureVector['ohlcv'] {
    return { open: [], high: [], low: [], close: [], volume: [] };
  }

  private getEmptyOrderBook(): FeatureVector['orderBook'] {
    return { bidDepth: [], askDepth: [], spread: 0, imbalance: 0, liquidityScore: 0 };
  }

  private getEmptySentiment(): FeatureVector['sentiment'] {
    return { fearGreedIndex: 50, sentimentScore: 0, socialMentions: 0, trendingRank: 0 };
  }

  private getEmptyTechnical(): FeatureVector['technical'] {
    return {
      rsi: 50,
      macd: 0,
      bollingerBands: { upper: 0, middle: 0, lower: 0, position: 0.5 },
      volatility: 0,
      momentum: [0, 0, 0, 0]
    };
  }
}

export default FeatureService;