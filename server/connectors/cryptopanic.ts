/**
 * CryptoPanic API Connector - Phase A Implementation
 * Fetches news sentiment with votes for comprehensive analysis and provenance tracking
 */

import axios, { AxiosResponse } from 'axios';
import { db } from '../db';
import { sentimentTicks, connectorHealth, type InsertSentimentTick, type InsertConnectorHealth } from '@shared/schema';
import { logger } from '../utils/logger';
import { RateLimiter } from 'limiter';

export interface CryptoPanicNewsItem {
  kind: 'news' | 'media';
  domain: string;
  title: string;
  published_at: string;
  slug: string;
  id: number;
  url: string;
  created_at: string;
  votes: {
    negative: number;
    positive: number;
    important: number;
    liked: number;
    disliked: number;
    lol: number;
    toxic: number;
    saved: number;
  };
  source: {
    domain: string;
    title: string;
    region: string;
    path?: string;
  };
  currencies?: Array<{
    code: string;
    title: string;
    slug: string;
    url: string;
  }>;
  metadata?: {
    description?: string;
  };
}

export interface CryptoPanicResponse {
  count: number;
  next?: string;
  previous?: string;
  results: CryptoPanicNewsItem[];
}

export class CryptoPanicConnector {
  private apiKey: string | undefined;
  private baseUrl = 'https://cryptopanic.com/api/v1';
  private limiter: RateLimiter;
  private requestCount = 0;
  private errorCount = 0;
  private cryptoCurrencyMap: Map<string, string>;

  constructor() {
    this.apiKey = process.env.CRYPTOPANIC_API_KEY;
    // Rate limit: 1000 requests per day for free plan, ~1 per minute
    this.limiter = new RateLimiter({ tokensPerInterval: 60, interval: 60000 });
    
    // Map trading symbols to CryptoPanic currency codes
    this.cryptoCurrencyMap = new Map([
      ['BTCUSDT', 'BTC'],
      ['ETHUSDT', 'ETH'],
      ['SOLUSDT', 'SOL'],
      ['ADAUSDT', 'ADA'],
      ['DOTUSDT', 'DOT'],
      ['LINKUSDT', 'LINK'],
      ['MATICUSDT', 'MATIC'],
      ['AVAXUSDT', 'AVAX'],
    ]);
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
      timeout: 15000,
    };

    try {
      const response: AxiosResponse<T> = await axios.get(endpoint, config);
      await this.updateHealthStatus('healthy', null);
      return response.data;
    } catch (error: any) {
      this.errorCount++;
      const errorMessage = error.response?.data?.detail || error.response?.data?.error || error.message || 'Unknown error';
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

  async fetchNewsBySymbol(symbol: string, limit: number = 50): Promise<InsertSentimentTick[]> {
    const currency = this.cryptoCurrencyMap.get(symbol);
    if (!currency) {
      logger.warn(`No currency mapping for symbol: ${symbol}`);
      return [];
    }

    const endpoint = '/posts/';
    const params = {
      currencies: currency,
      kind: 'news',
      limit: Math.min(limit, 50), // API limit
      public: 'true', // Include public posts only
    };

    try {
      const data = await this.makeRequest<CryptoPanicResponse>(endpoint, params);
      
      if (!data.results?.length) {
        logger.info(`No news found for symbol: ${symbol}`);
        return [];
      }

      const sentimentTicks: InsertSentimentTick[] = [];
      
      for (const newsItem of data.results) {
        const sentiment = this.analyzeNewsItemSentiment(newsItem);
        const volume = this.calculateNewsVolume(newsItem);
        
        sentimentTicks.push({
          timestamp: new Date(newsItem.published_at),
          source: 'cryptopanic',
          symbol,
          score: sentiment.score,
          volume,
          topic: newsItem.source.title,
          raw: {
            news_id: newsItem.id,
            title: newsItem.title,
            url: newsItem.url,
            domain: newsItem.domain,
            slug: newsItem.slug,
            votes: newsItem.votes,
            source: newsItem.source,
            currencies: newsItem.currencies,
            metadata: newsItem.metadata,
            kind: newsItem.kind,
          },
          provenance: {
            provider: 'cryptopanic',
            endpoint,
            fetchedAt: new Date().toISOString(),
            quotaCost: 1,
            currency,
            limit,
            kind: 'news',
          },
        });
      }

      logger.info(`Fetched ${sentimentTicks.length} news items for ${symbol} from CryptoPanic`);
      return sentimentTicks;
      
    } catch (error) {
      logger.error(`Failed to fetch news for ${symbol}`, error);
      if (error.message === 'CryptoPanic API key not configured') {
        return []; // Return empty array instead of throwing for missing config
      }
      throw error;
    }
  }

  async fetchTrendingNews(limit: number = 25): Promise<InsertSentimentTick[]> {
    const endpoint = '/posts/';
    const params = {
      kind: 'news',
      filter: 'trending',
      limit: Math.min(limit, 50),
      public: 'true',
    };

    try {
      const data = await this.makeRequest<CryptoPanicResponse>(endpoint, params);
      
      if (!data.results?.length) {
        logger.info('No trending news found');
        return [];
      }

      const sentimentTicks: InsertSentimentTick[] = [];
      
      for (const newsItem of data.results) {
        // Extract symbol from currencies if available
        const symbol = this.extractSymbolFromCurrencies(newsItem.currencies);
        if (!symbol) continue;

        const sentiment = this.analyzeNewsItemSentiment(newsItem);
        const volume = this.calculateNewsVolume(newsItem);
        
        sentimentTicks.push({
          timestamp: new Date(newsItem.published_at),
          source: 'cryptopanic',
          symbol,
          score: sentiment.score,
          volume,
          topic: newsItem.source.title,
          raw: {
            news_id: newsItem.id,
            title: newsItem.title,
            url: newsItem.url,
            domain: newsItem.domain,
            slug: newsItem.slug,
            votes: newsItem.votes,
            source: newsItem.source,
            currencies: newsItem.currencies,
            metadata: newsItem.metadata,
            kind: newsItem.kind,
            is_trending: true,
          },
          provenance: {
            provider: 'cryptopanic',
            endpoint,
            fetchedAt: new Date().toISOString(),
            quotaCost: 1,
            filter: 'trending',
            limit,
            kind: 'news',
          },
        });
      }

      logger.info(`Fetched ${sentimentTicks.length} trending news items from CryptoPanic`);
      return sentimentTicks;
      
    } catch (error) {
      logger.error('Failed to fetch trending news from CryptoPanic', error);
      throw error;
    }
  }

  private analyzeNewsItemSentiment(newsItem: CryptoPanicNewsItem): { score: number; confidence: number } {
    const { votes } = newsItem;
    
    // Analyze voting patterns to determine sentiment
    const totalVotes = votes.positive + votes.negative + votes.important + votes.liked + votes.disliked + votes.lol + votes.toxic;
    
    if (totalVotes === 0) {
      // Analyze title for sentiment keywords as fallback
      return this.analyzeTitleSentiment(newsItem.title);
    }
    
    // Weight different vote types
    const positiveScore = votes.positive * 1.0 + votes.liked * 0.8 + votes.important * 0.6;
    const negativeScore = votes.negative * 1.0 + votes.disliked * 0.8 + votes.toxic * 1.2;
    const neutralScore = votes.lol * 0.3; // LOL votes are somewhat neutral
    
    const totalWeightedVotes = positiveScore + negativeScore + neutralScore;
    
    if (totalWeightedVotes === 0) {
      return { score: 0, confidence: 0.1 };
    }
    
    const score = (positiveScore - negativeScore) / totalWeightedVotes;
    const confidence = Math.min(totalVotes / 10, 1); // Higher confidence with more votes
    
    return { 
      score: Math.max(-1, Math.min(1, score)),
      confidence: Math.max(0.1, confidence)
    };
  }

  private analyzeTitleSentiment(title: string): { score: number; confidence: number } {
    const positiveWords = ['surge', 'rise', 'gain', 'bull', 'pump', 'moon', 'breakthrough', 'adoption', 'partnership', 'upgrade'];
    const negativeWords = ['crash', 'dump', 'bear', 'drop', 'fall', 'hack', 'scam', 'ban', 'regulation', 'concern'];
    
    const lowerTitle = title.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;
    
    positiveWords.forEach(word => {
      if (lowerTitle.includes(word)) positiveCount++;
    });
    
    negativeWords.forEach(word => {
      if (lowerTitle.includes(word)) negativeCount++;
    });
    
    const totalSentimentWords = positiveCount + negativeCount;
    
    if (totalSentimentWords === 0) {
      return { score: 0, confidence: 0.1 };
    }
    
    const score = (positiveCount - negativeCount) / totalSentimentWords;
    const confidence = Math.min(totalSentimentWords / 3, 0.5); // Lower confidence than votes
    
    return { score: Math.max(-1, Math.min(1, score)), confidence };
  }

  private calculateNewsVolume(newsItem: CryptoPanicNewsItem): number {
    const { votes } = newsItem;
    
    // Calculate total engagement volume
    return votes.positive + votes.negative + votes.important + votes.liked + votes.disliked + votes.lol + votes.toxic + votes.saved;
  }

  private extractSymbolFromCurrencies(currencies?: CryptoPanicNewsItem['currencies']): string | null {
    if (!currencies?.length) return null;
    
    // Find the first currency that matches our supported symbols
    for (const currency of currencies) {
      const symbol = Array.from(this.cryptoCurrencyMap.entries())
        .find(([, code]) => code === currency.code)?.[0];
      
      if (symbol) {
        return symbol;
      }
    }
    
    return null;
  }

  async storeSentimentTicks(ticks: InsertSentimentTick[]): Promise<void> {
    if (ticks.length === 0) return;

    try {
      await db.insert(sentimentTicks).values(ticks);
      logger.info(`Stored ${ticks.length} CryptoPanic sentiment ticks to database`);
    } catch (error) {
      logger.error('Failed to store CryptoPanic sentiment ticks', error);
      throw error;
    }
  }

  private async updateHealthStatus(status: 'healthy' | 'degraded' | 'down', error: string | null): Promise<void> {
    const healthData: InsertConnectorHealth = {
      provider: 'cryptopanic',
      status,
      lastSuccessfulFetch: status === 'healthy' ? new Date() : undefined,
      lastError: error,
      requestCount24h: this.requestCount,
      errorCount24h: this.errorCount,
      quotaUsed: this.requestCount,
      quotaLimit: 1000, // Daily limit for free plan
    };

    try {
      await db.insert(connectorHealth)
        .values(healthData)
        .onConflictDoUpdate({
          target: connectorHealth.provider,
          set: healthData,
        });
    } catch (error) {
      logger.error('Failed to update CryptoPanic connector health', error);
    }
  }

  async getHealthStatus(): Promise<{ status: string; requestCount: number; errorCount: number; configured: boolean }> {
    const configured = !!this.apiKey;
    return {
      status: !configured ? 'down' : 
              this.errorCount / Math.max(this.requestCount, 1) > 0.1 ? 'degraded' : 'healthy',
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      configured,
    };
  }

  resetDailyCounters(): void {
    this.requestCount = 0;
    this.errorCount = 0;
  }
}

// Export singleton instance
export const cryptoPanicConnector = new CryptoPanicConnector();