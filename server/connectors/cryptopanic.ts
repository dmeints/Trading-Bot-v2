/**
 * CryptoPanic API Connector for News Sentiment Analysis
 * Fetches cryptocurrency news with voting sentiment data
 */

import axios, { AxiosResponse } from 'axios';
import { RateLimiter } from 'limiter';
import { logger } from '../utils/logger';
import { db } from '../db';
import { sentimentTicksExtended, connectorHealth } from '@shared/schema';
import type { InsertSentimentTick, InsertConnectorHealth } from '@shared/schema';

interface CryptoPanicResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Array<{
    id: number;
    title: string;
    url: string;
    created_at: string;
    domain: string;
    votes: {
      negative: number;
      positive: number;
      important: number;
      liked: number;
      disliked: number;
      lol: number;
      toxic: number;
      saved: number;
      comments: number;
    };
    currencies: Array<{
      code: string;
      title: string;
      slug: string;
      url: string;
    }>;
    kind: string; // 'news' | 'media'
    source: {
      title: string;
      region: string;
      domain: string;
    };
  }>;
}

export class CryptoPanicConnector {
  private apiKey: string | undefined;
  private baseUrl = 'https://cryptopanic.com/api/v1';
  private limiter: RateLimiter;
  private requestCount = 0;
  private errorCount = 0;

  constructor() {
    this.apiKey = process.env.CRYPTOPANIC_API_KEY;
    // Rate limit: 1000 requests per day for free plan
    this.limiter = new RateLimiter({ tokensPerInterval: 1000, interval: 24 * 60 * 60 * 1000 });
  }

  private async makeRequest<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    if (!this.apiKey) {
      throw new Error('CryptoPanic API key not configured');
    }

    await this.limiter.removeTokens(1);
    this.requestCount++;

    const config = {
      baseURL: this.baseUrl,
      params: {
        auth_token: this.apiKey,
        ...params,
      },
      timeout: 10000,
    };

    try {
      const response: AxiosResponse<T> = await axios.get(endpoint, config);
      await this.updateHealthStatus('healthy', null);
      return response.data;
    } catch (error: any) {
      this.errorCount++;
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
      await this.updateHealthStatus('degraded', errorMessage);
      
      logger.error('CryptoPanic API error', {
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

  async fetchSentimentData(symbol: string): Promise<InsertSentimentTick[]> {
    try {
      // Map symbol to CryptoPanic currency code
      const currencyCode = this.symbolToCurrencyCode(symbol);
      
      const endpoint = '/posts/';
      const params = {
        currencies: currencyCode,
        kind: 'news',
        regions: 'en',
        filter: 'hot',
        page_size: 50,
      };

      const data = await this.makeRequest<CryptoPanicResponse>(endpoint, params);
      
      if (!data.results?.length) {
        logger.warn(`No news found for ${symbol} on CryptoPanic`);
        return [];
      }

      // Analyze sentiment from news votes
      const sentiments: InsertSentimentTick[] = [];
      let totalVotes = 0;
      let positiveScore = 0;
      let negativeScore = 0;
      let importantCount = 0;

      for (const article of data.results) {
        const votes = article.votes;
        const articleTotalVotes = votes.positive + votes.negative + votes.important + 
                                 votes.liked + votes.disliked + votes.lol + votes.toxic;
        
        totalVotes += articleTotalVotes;
        
        // Calculate weighted sentiment for each article
        const articlePositive = votes.positive + votes.liked + votes.important;
        const articleNegative = votes.negative + votes.disliked + votes.toxic;
        
        positiveScore += articlePositive;
        negativeScore += articleNegative;
        
        if (votes.important > 0) importantCount++;
      }

      // Calculate overall sentiment score
      const totalSentimentVotes = positiveScore + negativeScore;
      const sentimentScore = totalSentimentVotes > 0 
        ? (positiveScore - negativeScore) / totalSentimentVotes 
        : 0;

      // Weight by importance and volume
      const importanceWeight = importantCount / data.results.length;
      const volumeWeight = Math.min(1, totalVotes / 100); // Normalize volume
      const weightedSentiment = sentimentScore * (1 + importanceWeight) * volumeWeight;

      sentiments.push({
        timestamp: new Date(),
        source: 'cryptopanic',
        symbol: symbol.replace('USDT', ''),
        score: Math.max(-1, Math.min(1, weightedSentiment)), // Clamp to [-1, 1]
        volume: data.results.length,
        topic: `${symbol} news sentiment`,
        raw: {
          articles: data.results.slice(0, 3), // Store first 3 articles
          totalVotes,
          positiveScore,
          negativeScore,
          importantCount,
          sources: [...new Set(data.results.map(a => a.source.title))],
        } as Record<string, any>,
        provider: 'cryptopanic',
        provenance: {
          provider: 'cryptopanic',
          endpoint,
          fetchedAt: new Date().toISOString(),
          quotaCost: 1,
          currencyCode,
          articlesAnalyzed: data.results.length,
        } as Record<string, any>,
      });

      logger.info(`Fetched CryptoPanic sentiment for ${symbol}`, {
        articles: data.results.length,
        sentimentScore: weightedSentiment,
        totalVotes,
        importantCount,
      });

      return sentiments;
      
    } catch (error) {
      logger.error(`Failed to fetch CryptoPanic sentiment for ${symbol}`, error);
      throw error;
    }
  }

  private symbolToCurrencyCode(symbol: string): string {
    const currencyMap: Record<string, string> = {
      'BTCUSDT': 'BTC',
      'ETHUSDT': 'ETH',
      'SOLUSDT': 'SOL',
      'ADAUSDT': 'ADA',
      'DOTUSDT': 'DOT',
      'LINKUSDT': 'LINK',
      'MATICUSDT': 'MATIC',
      'AVAXUSDT': 'AVAX',
    };

    return currencyMap[symbol] || symbol.replace('USDT', '');
  }

  async storeSentimentTicks(ticks: InsertSentimentTick[]): Promise<void> {
    if (ticks.length === 0) return;

    try {
      await db.insert(sentimentTicks)
        .values(ticks)
        .onConflictDoUpdate({
          target: [sentimentTicks.source, sentimentTicks.symbol, sentimentTicks.timestamp],
          set: {
            score: sentimentTicks.score,
            volume: sentimentTicks.volume,
            topic: sentimentTicks.topic,
            raw: sentimentTicks.raw,
            provenance: sentimentTicks.provenance,
            fetchedAt: new Date(),
          },
        });

      logger.info(`Stored ${ticks.length} CryptoPanic sentiment ticks`);
    } catch (error) {
      logger.error('Failed to store CryptoPanic sentiment ticks', error);
      throw error;
    }
  }

  private async updateHealthStatus(status: 'healthy' | 'degraded' | 'down', lastError: string | null): Promise<void> {
    try {
      await db.insert(connectorHealth).values({
        provider: 'cryptopanic',
        status,
        requestCount: this.requestCount,
        errorCount: this.errorCount,
        lastError,
        quotaCost: this.requestCount,
      } as InsertConnectorHealth).onConflictDoUpdate({
        target: connectorHealth.provider,
        set: {
          status,
          requestCount: this.requestCount,
          errorCount: this.errorCount,
          lastError,
          quotaCost: this.requestCount,
          lastChecked: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to update CryptoPanic connector health', error);
    }
  }

  async getHealthStatus(): Promise<any> {
    return {
      provider: 'cryptopanic',
      status: this.errorCount > 10 ? 'degraded' : 'healthy',
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      hasCredentials: !!this.apiKey,
    };
  }
}