/**
 * CoinGecko Pro API Connector - Phase A Implementation
 * Fetches OHLCV data (1m/5m/1h/1d) with rate limiting and provenance tracking
 */

import axios, { AxiosResponse } from 'axios';
import { db } from '../db';
import { marketBars, connectorHealth, type InsertMarketBar, type InsertConnectorHealth } from '@shared/schema';
import { logger } from '../utils/logger';
import { RateLimiter } from 'limiter';

export interface CoinGeckoPriceData {
  id: string;
  symbol: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number | null;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
}

export interface CoinGeckoOHLCVResponse {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

export class CoinGeckoConnector {
  private apiKey: string | undefined;
  private baseUrl = 'https://pro-api.coingecko.com/api/v3';
  private limiter: RateLimiter;
  private requestCount = 0;
  private errorCount = 0;
  private coinSymbolMap: Map<string, string>;

  constructor() {
    this.apiKey = process.env.COINGECKO_API_KEY;
    // Rate limit: 500 requests/minute for Pro plan
    this.limiter = new RateLimiter({ tokensPerInterval: 500, interval: 60000 });
    
    // Map trading symbols to CoinGecko IDs
    this.coinSymbolMap = new Map([
      ['BTCUSDT', 'bitcoin'],
      ['ETHUSDT', 'ethereum'],
      ['SOLUSDT', 'solana'],
      ['ADAUSDT', 'cardano'],
      ['DOTUSDT', 'polkadot'],
      ['LINKUSDT', 'chainlink'],
      ['MATICUSDT', 'matic-network'],
      ['AVAXUSDT', 'avalanche-2'],
    ]);
  }

  private async makeRequest<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    await this.limiter.removeTokens(1);
    this.requestCount++;

    const config = {
      baseURL: this.baseUrl,
      headers: this.apiKey ? { 'x-cg-pro-api-key': this.apiKey } : {},
      params,
      timeout: 10000,
    };

    try {
      const response: AxiosResponse<T> = await axios.get(endpoint, config);
      await this.updateHealthStatus('healthy', null);
      return response.data;
    } catch (error: any) {
      this.errorCount++;
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      await this.updateHealthStatus('degraded', errorMessage);
      
      logger.error('CoinGecko API error', {
        endpoint,
        error: errorMessage,
        status: error.response?.status,
      });

      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded');
      }
      
      throw error;
    }
  }

  async fetchOHLCV(symbol: string, timeframe: '1m' | '5m' | '1h' | '1d', days: number = 1): Promise<InsertMarketBar[]> {
    const coinId = this.coinSymbolMap.get(symbol);
    if (!coinId) {
      throw new Error(`Unknown symbol: ${symbol}`);
    }

    // Map timeframes to CoinGecko parameters
    const intervalMap = {
      '1m': 'minutely',
      '5m': 'minutely', 
      '1h': 'hourly',
      '1d': 'daily'
    };

    const interval = intervalMap[timeframe];
    const endpoint = `/coins/${coinId}/market_chart`;
    const params = {
      vs_currency: 'usd',
      days: days.toString(),
      interval,
    };

    try {
      const data = await this.makeRequest<CoinGeckoOHLCVResponse>(endpoint, params);
      
      if (!data.prices?.length) {
        logger.warn(`No OHLCV data returned for ${symbol}`);
        return [];
      }

      // Convert to market bars format
      const bars: InsertMarketBar[] = [];
      const datasetId = `coingecko_${symbol}_${timeframe}_${Date.now()}`;
      
      for (let i = 0; i < data.prices.length; i++) {
        const [timestamp, close] = data.prices[i];
        const [, marketCap] = data.market_caps[i] || [timestamp, 0];
        const [, volume] = data.total_volumes[i] || [timestamp, 0];
        
        // For CoinGecko we only have close prices, so we approximate OHLC
        bars.push({
          symbol,
          timeframe,
          timestamp: new Date(timestamp),
          open: close.toString(), // Approximate
          high: close.toString(), // Approximate  
          low: close.toString(), // Approximate
          close: close.toString(),
          volume: volume.toString(),
          provider: 'coingecko',
          datasetId,
          provenance: {
            provider: 'coingecko',
            endpoint,
            fetchedAt: new Date().toISOString(),
            quotaCost: 1,
            coinId,
            interval,
            days,
          } as Record<string, any>,
        });
      }

      logger.info(`Fetched ${bars.length} OHLCV bars for ${symbol} from CoinGecko`);
      return bars;
      
    } catch (error) {
      logger.error(`Failed to fetch OHLCV for ${symbol}`, error);
      throw error;
    }
  }

  async fetchCurrentPrices(symbols: string[]): Promise<CoinGeckoPriceData[]> {
    const coinIds = symbols
      .map(s => this.coinSymbolMap.get(s))
      .filter(Boolean)
      .join(',');

    if (!coinIds) {
      return [];
    }

    const endpoint = '/coins/markets';
    const params = {
      vs_currency: 'usd',
      ids: coinIds,
      order: 'market_cap_desc',
      per_page: 100,
      page: 1,
      sparkline: false,
      price_change_percentage: '24h',
    };

    try {
      const data = await this.makeRequest<CoinGeckoPriceData[]>(endpoint, params);
      logger.info(`Fetched current prices for ${data.length} coins from CoinGecko`);
      return data;
    } catch (error) {
      logger.error('Failed to fetch current prices from CoinGecko', error);
      throw error;
    }
  }

  async storeMarketBars(bars: InsertMarketBar[]): Promise<void> {
    if (bars.length === 0) return;

    try {
      // Upsert bars with conflict resolution on (provider, symbol, timestamp)
      await db.insert(marketBars)
        .values(bars)
        .onConflictDoUpdate({
          target: [marketBars.symbol, marketBars.timestamp, marketBars.provider],
          set: {
            open: marketBars.open,
            high: marketBars.high,
            low: marketBars.low,
            close: marketBars.close,
            volume: marketBars.volume,
            datasetId: marketBars.datasetId,
            fetchedAt: new Date(),
            provenance: marketBars.provenance,
          },
        });

      logger.info(`Stored ${bars.length} market bars to database`);
    } catch (error) {
      logger.error('Failed to store market bars', error);
      throw error;
    }
  }

  private async updateHealthStatus(status: 'healthy' | 'degraded' | 'down', error: string | null): Promise<void> {
    const healthData: InsertConnectorHealth = {
      provider: 'coingecko',
      status,
      lastSuccessfulFetch: status === 'healthy' ? new Date() : undefined,
      lastError: error,
      requestCount24h: this.requestCount,
      errorCount24h: this.errorCount,
      quotaUsed: this.requestCount,
      quotaLimit: 500, // Pro plan limit
    };

    try {
      await db.insert(connectorHealth)
        .values(healthData)
        .onConflictDoUpdate({
          target: connectorHealth.provider,
          set: healthData,
        });
    } catch (error) {
      logger.error('Failed to update connector health', error);
    }
  }

  async getHealthStatus(): Promise<{ status: string; requestCount: number; errorCount: number }> {
    return {
      status: this.errorCount / Math.max(this.requestCount, 1) > 0.1 ? 'degraded' : 'healthy',
      requestCount: this.requestCount,
      errorCount: this.errorCount,
    };
  }

  // Reset counters daily
  resetDailyCounters(): void {
    this.requestCount = 0;
    this.errorCount = 0;
  }
}

// Export singleton instance
export const coinGeckoConnector = new CoinGeckoConnector();