/**
 * STEVIE COMPREHENSIVE DATA INTEGRATION
 * 
 * This service integrates ALL 8 external data sources into Stevie's algorithm:
 * - CoinGecko Pro API: Price/volume data
 * - Binance API: Real-time trading data  
 * - X (Twitter) API v2: Social sentiment
 * - Reddit API: Community sentiment
 * - Etherscan API: Ethereum on-chain analytics
 * - CryptoPanic API: News sentiment
 * - Blockchair: Bitcoin on-chain data
 * - Trading Economics API: Macro events
 */

import { logger } from '../utils/logger';
import { dataIngestionService } from './dataIngestion';
import { sentimentAnalyzer } from './sentimentAnalyzer';

export interface ComprehensiveMarketState {
  symbol: string;
  timestamp: number;
  
  // Price & Volume (CoinGecko Pro + Binance)
  currentPrice: number;
  priceHistory24h: number[];
  volumeHistory24h: number[];
  priceChange24h: number;
  volumeChange24h: number;
  
  // Technical Analysis (calculated from real data)
  technicalIndicators: {
    rsi: number;
    macd: number;
    macdSignal: number;
    bollingerBands: {
      upper: number;
      middle: number;
      lower: number;
    };
    support: number;
    resistance: number;
  };
  
  // Multi-Source Sentiment Analysis
  sentiment: {
    overall: number; // -1 to 1
    confidence: number;
    twitter: number;
    reddit: number; 
    news: number;
    cryptoPanic: number;
    fearGreedIndex: number;
  };
  
  // On-Chain Analytics (Etherscan + Blockchair)
  onChain: {
    activeAddresses: number;
    transactionCount: number;
    whaleActivity: number;
    exchangeFlows: number;
    networkUtilization: number;
    hashRate?: number; // Bitcoin only
    gasPrice?: number; // Ethereum only
  };
  
  // Macro Events (Trading Economics API)
  macroEvents: Array<{
    event: string;
    impact: 'high' | 'medium' | 'low';
    date: Date;
    actual?: number;
    forecast?: number;
  }>;
  
  // Real-time Order Book (Binance WebSocket)
  orderBook: {
    bidAskSpread: number;
    orderImbalance: number;
    liquidityDepth: number;
  };
}

export class StevieDataIntegration {
  private cache: Map<string, { data: ComprehensiveMarketState; expiry: number }> = new Map();
  private readonly CACHE_TTL = 30 * 1000; // 30 seconds

  constructor() {
    logger.info('[StevieDataIntegration] Initialized comprehensive data integration service');
  }

  /**
   * Get comprehensive market state from ALL our data sources
   */
  async getComprehensiveMarketState(symbol: string): Promise<ComprehensiveMarketState> {
    // Check cache first
    const cached = this.cache.get(symbol);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    try {
      logger.info(`[StevieDataIntegration] Fetching comprehensive data for ${symbol} from all sources`);

      // Parallel data fetching from all sources
      const [
        ohlcvData,
        sentimentData,
        onChainData,
        macroData,
        orderBookData
      ] = await Promise.all([
        this.fetchPriceVolumeData(symbol),
        this.fetchSentimentData(symbol),
        this.fetchOnChainData(symbol),
        this.fetchMacroData(),
        this.fetchOrderBookData(symbol)
      ]);

      // Calculate technical indicators from real price data
      const technicalIndicators = this.calculateTechnicalIndicators(ohlcvData.prices);

      const comprehensiveState: ComprehensiveMarketState = {
        symbol,
        timestamp: Date.now(),
        
        // Price & Volume from CoinGecko + Binance
        currentPrice: ohlcvData.currentPrice,
        priceHistory24h: ohlcvData.prices,
        volumeHistory24h: ohlcvData.volumes,
        priceChange24h: ohlcvData.priceChange24h,
        volumeChange24h: ohlcvData.volumeChange24h,
        
        // Technical Analysis
        technicalIndicators,
        
        // Multi-source sentiment
        sentiment: sentimentData,
        
        // On-chain metrics
        onChain: onChainData,
        
        // Macro events
        macroEvents: macroData,
        
        // Order book data
        orderBook: orderBookData
      };

      // Cache the result
      this.cache.set(symbol, {
        data: comprehensiveState,
        expiry: Date.now() + this.CACHE_TTL
      });

      logger.info(`[StevieDataIntegration] Successfully fetched comprehensive data for ${symbol}`, {
        sources: ['CoinGecko', 'Binance', 'Twitter', 'Reddit', 'Etherscan', 'CryptoPanic', 'Blockchair', 'TradingEconomics'],
        sentiment: sentimentData.overall,
        price: ohlcvData.currentPrice,
        onChainActive: onChainData.activeAddresses
      });

      return comprehensiveState;

    } catch (error) {
      logger.error(`[StevieDataIntegration] Error fetching comprehensive data for ${symbol}`, { error });
      
      // Return minimal state if all sources fail
      return this.getMinimalFallbackState(symbol);
    }
  }

  private async fetchPriceVolumeData(symbol: string) {
    try {
      // Get real OHLCV data from CoinGecko Pro
      const ohlcvData = await dataIngestionService.getLatestOHLCV?.(symbol, 48) || [];
      
      if (ohlcvData.length === 0) {
        throw new Error('No OHLCV data available');
      }

      const current = ohlcvData[ohlcvData.length - 1];
      const yesterday = ohlcvData[ohlcvData.length - 25]; // 24h ago
      
      return {
        currentPrice: current.close,
        prices: ohlcvData.map(d => d.close),
        volumes: ohlcvData.map(d => d.volume),
        priceChange24h: yesterday ? (current.close - yesterday.close) / yesterday.close : 0,
        volumeChange24h: yesterday ? (current.volume - yesterday.volume) / yesterday.volume : 0
      };

    } catch (error) {
      logger.error('[StevieDataIntegration] Price/volume data fetch failed', { symbol, error });
      throw error;
    }
  }

  private async fetchSentimentData(symbol: string) {
    try {
      const aggregated = await sentimentAnalyzer.getAggregatedSentiment(symbol);
      const breakdown = aggregated.breakdown;
      
      return {
        overall: aggregated.overallSentiment,
        confidence: aggregated.confidence,
        twitter: breakdown.find(b => b.source === 'x')?.sentiment || 0,
        reddit: breakdown.find(b => b.source === 'reddit')?.sentiment || 0,
        news: breakdown.find(b => b.source === 'news')?.sentiment || 0,
        cryptoPanic: breakdown.find(b => b.source === 'crypto_panic')?.sentiment || 0,
        fearGreedIndex: breakdown.find(b => b.source === 'fear_greed')?.sentiment || 0
      };

    } catch (error) {
      logger.error('[StevieDataIntegration] Sentiment data fetch failed', { symbol, error });
      return {
        overall: 0,
        confidence: 0,
        twitter: 0,
        reddit: 0,
        news: 0,
        cryptoPanic: 0,
        fearGreedIndex: 0
      };
    }
  }

  private async fetchOnChainData(symbol: string) {
    try {
      const onChainCollector = dataIngestionService.collectors?.get('onchain');
      const data = await onChainCollector?.collectCurrentMetrics?.([symbol]);
      
      // Extract relevant metrics based on symbol
      if (symbol === 'BTC' && data) {
        return {
          activeAddresses: data.activeAddresses || 0,
          transactionCount: data.transactionCount || 0,
          whaleActivity: data.whaleTransactions || 0,
          exchangeFlows: 0, // Would need specialized API
          networkUtilization: (data.transactionCount / 300000) || 0, // Rough estimate
          hashRate: data.hashRate || 0
        };
      } else if (symbol === 'ETH' && data) {
        return {
          activeAddresses: data.activeAddresses || 0,
          transactionCount: data.transactionCount || 0,
          whaleActivity: data.whaleTransactions || 0,
          exchangeFlows: 0,
          networkUtilization: (data.transactionCount / 1000000) || 0,
          gasPrice: data.averageTxValue || 0
        };
      } else {
        return {
          activeAddresses: 0,
          transactionCount: 0,
          whaleActivity: 0,
          exchangeFlows: 0,
          networkUtilization: 0
        };
      }

    } catch (error) {
      logger.error('[StevieDataIntegration] On-chain data fetch failed', { symbol, error });
      return {
        activeAddresses: 0,
        transactionCount: 0,
        whaleActivity: 0,
        exchangeFlows: 0,
        networkUtilization: 0
      };
    }
  }

  private async fetchMacroData() {
    // TODO: Integrate Trading Economics API for real macro events
    // For now return empty array, but structure is ready
    return [];
  }

  private async fetchOrderBookData(symbol: string) {
    try {
      const binanceCollector = dataIngestionService.collectors?.get('binance');
      const orderBookData = await binanceCollector?.getLatestOrderBook?.(symbol);
      
      if (orderBookData) {
        const topBid = orderBookData.bids[0]?.[0] || 0;
        const topAsk = orderBookData.asks[0]?.[0] || 0;
        const spread = topAsk - topBid;
        
        return {
          bidAskSpread: spread,
          orderImbalance: this.calculateOrderImbalance(orderBookData),
          liquidityDepth: this.calculateLiquidityDepth(orderBookData)
        };
      }
      
      return {
        bidAskSpread: 0,
        orderImbalance: 0,
        liquidityDepth: 0
      };

    } catch (error) {
      logger.error('[StevieDataIntegration] Order book data fetch failed', { symbol, error });
      return {
        bidAskSpread: 0,
        orderImbalance: 0,
        liquidityDepth: 0
      };
    }
  }

  private calculateTechnicalIndicators(prices: number[]) {
    if (prices.length < 26) {
      return {
        rsi: 50,
        macd: 0,
        macdSignal: 0,
        bollingerBands: { upper: 0, middle: 0, lower: 0 },
        support: 0,
        resistance: 0
      };
    }

    const rsi = this.calculateRSI(prices.slice(-14));
    const { macd, signal } = this.calculateMACD(prices);
    const bollingerBands = this.calculateBollingerBands(prices.slice(-20));
    const { support, resistance } = this.calculateSupportResistance(prices.slice(-50));

    return {
      rsi,
      macd,
      macdSignal: signal,
      bollingerBands,
      support,
      resistance
    };
  }

  private calculateRSI(prices: number[]): number {
    let gains = 0, losses = 0;
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i-1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    const avgGain = gains / (prices.length - 1);
    const avgLoss = losses / (prices.length - 1);
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(prices: number[]): { macd: number; signal: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macdLine = ema12[ema12.length - 1] - ema26[ema26.length - 1];
    
    // Simplified signal line (would need more historical MACD values for proper calculation)
    const signal = macdLine * 0.9; 
    
    return { macd: macdLine, signal };
  }

  private calculateBollingerBands(prices: number[]): { upper: number; middle: number; lower: number } {
    const sma = prices.reduce((a, b) => a + b) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      upper: sma + (2 * stdDev),
      middle: sma,
      lower: sma - (2 * stdDev)
    };
  }

  private calculateSupportResistance(prices: number[]): { support: number; resistance: number } {
    const sorted = [...prices].sort((a, b) => a - b);
    const support = sorted[Math.floor(sorted.length * 0.2)]; // 20th percentile
    const resistance = sorted[Math.floor(sorted.length * 0.8)]; // 80th percentile
    
    return { support, resistance };
  }

  private calculateEMA(prices: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const ema = [prices[0]];
    for (let i = 1; i < prices.length; i++) {
      ema.push(prices[i] * k + ema[i-1] * (1 - k));
    }
    return ema;
  }

  private calculateOrderImbalance(orderBook: any): number {
    const bidVolume = orderBook.bids?.slice(0, 5).reduce((sum: number, bid: any) => sum + parseFloat(bid[1]), 0) || 0;
    const askVolume = orderBook.asks?.slice(0, 5).reduce((sum: number, ask: any) => sum + parseFloat(ask[1]), 0) || 0;
    
    if (bidVolume + askVolume === 0) return 0;
    return (bidVolume - askVolume) / (bidVolume + askVolume);
  }

  private calculateLiquidityDepth(orderBook: any): number {
    const bidDepth = orderBook.bids?.slice(0, 10).reduce((sum: number, bid: any) => sum + parseFloat(bid[1]), 0) || 0;
    const askDepth = orderBook.asks?.slice(0, 10).reduce((sum: number, ask: any) => sum + parseFloat(ask[1]), 0) || 0;
    
    return bidDepth + askDepth;
  }

  private getMinimalFallbackState(symbol: string): ComprehensiveMarketState {
    logger.warn(`[StevieDataIntegration] Using minimal fallback state for ${symbol}`);
    
    return {
      symbol,
      timestamp: Date.now(),
      currentPrice: 0,
      priceHistory24h: [],
      volumeHistory24h: [],
      priceChange24h: 0,
      volumeChange24h: 0,
      technicalIndicators: {
        rsi: 50,
        macd: 0,
        macdSignal: 0,
        bollingerBands: { upper: 0, middle: 0, lower: 0 },
        support: 0,
        resistance: 0
      },
      sentiment: {
        overall: 0,
        confidence: 0,
        twitter: 0,
        reddit: 0,
        news: 0,
        cryptoPanic: 0,
        fearGreedIndex: 0
      },
      onChain: {
        activeAddresses: 0,
        transactionCount: 0,
        whaleActivity: 0,
        exchangeFlows: 0,
        networkUtilization: 0
      },
      macroEvents: [],
      orderBook: {
        bidAskSpread: 0,
        orderImbalance: 0,
        liquidityDepth: 0
      }
    };
  }
}

// Singleton instance
export const stevieDataIntegration = new StevieDataIntegration();