/**
 * X (Twitter) API Connector for Social Sentiment Analysis
 * Fetches social sentiment data for cryptocurrency trading algorithms
 */

import axios, { AxiosResponse } from 'axios';
import { RateLimiter } from 'limiter';
import { logger } from '../utils/logger';
import { db } from '../db';
import { sentimentTicksExtended, connectorHealth } from '@shared/schema';
import type { InsertSentimentTick, InsertConnectorHealth } from '@shared/schema';

interface XTweetResponse {
  data: Array<{
    id: string;
    text: string;
    created_at: string;
    author_id: string;
    public_metrics: {
      retweet_count: number;
      like_count: number;
      reply_count: number;
      quote_count: number;
    };
  }>;
  meta?: {
    result_count: number;
    next_token?: string;
  };
}

export class XConnector {
  private apiKey: string | undefined;
  private bearerToken: string | undefined;
  private baseUrl = 'https://api.twitter.com/2';
  private limiter: RateLimiter;
  private requestCount = 0;
  private errorCount = 0;

  constructor() {
    this.apiKey = process.env.X_API_KEY;
    this.bearerToken = process.env.X_BEARER_TOKEN;
    // Rate limit: 300 requests per 15 minutes for Academic Research
    this.limiter = new RateLimiter({ tokensPerInterval: 300, interval: 15 * 60 * 1000 });
  }

  private async makeRequest<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    if (!this.bearerToken) {
      throw new Error('X Bearer Token not configured');
    }

    await this.limiter.removeTokens(1);
    this.requestCount++;

    const config = {
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.bearerToken}`,
        'Content-Type': 'application/json',
      },
      params,
      timeout: 10000,
    };

    try {
      const response: AxiosResponse<T> = await axios.get(endpoint, config);
      await this.updateHealthStatus('healthy', null);
      return response.data;
    } catch (error: any) {
      this.errorCount++;
      const errorMessage = error.response?.data?.title || error.message || 'Unknown error';
      await this.updateHealthStatus('degraded', errorMessage);
      
      logger.error('X API error', {
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
    // Build search query for crypto mentions
    const cryptoTerms = this.getCryptoSearchTerms(symbol);
    const query = cryptoTerms.join(' OR ');
    
    const endpoint = '/tweets/search/recent';
    const params = {
      query: `(${query}) -is:retweet lang:en`,
      'tweet.fields': 'created_at,author_id,public_metrics',
      max_results: 100,
    };

    try {
      const data = await this.makeRequest<XTweetResponse>(endpoint, params);
      
      if (!data.data?.length) {
        logger.warn(`No tweets found for ${symbol}`);
        return [];
      }

      // Analyze sentiment from tweets
      const sentiments: InsertSentimentTick[] = [];
      let totalEngagement = 0;
      let bullishCount = 0;
      let bearishCount = 0;

      for (const tweet of data.data) {
        const engagement = tweet.public_metrics.like_count + 
                         tweet.public_metrics.retweet_count + 
                         tweet.public_metrics.reply_count;
        totalEngagement += engagement;

        // Simple sentiment analysis based on keywords
        const sentiment = this.analyzeTweetSentiment(tweet.text);
        if (sentiment > 0) bullishCount++;
        if (sentiment < 0) bearishCount++;
      }

      // Calculate overall sentiment score
      const totalTweets = data.data.length;
      const sentimentScore = totalTweets > 0 
        ? (bullishCount - bearishCount) / totalTweets 
        : 0;

      sentiments.push({
        timestamp: new Date(),
        source: 'x',
        symbol: symbol.replace('USDT', ''),
        score: Math.max(-1, Math.min(1, sentimentScore)), // Clamp to [-1, 1]
        volume: totalTweets,
        topic: `${symbol} social mentions`,
        raw: {
          tweets: data.data.slice(0, 5), // Store first 5 tweets
          totalEngagement,
          bullishCount,
          bearishCount,
        } as Record<string, any>,
        provider: 'x',
        provenance: {
          provider: 'x',
          endpoint,
          fetchedAt: new Date().toISOString(),
          quotaCost: 1,
          query,
          resultCount: totalTweets,
        } as Record<string, any>,
      });

      logger.info(`Fetched X sentiment for ${symbol}`, {
        tweets: totalTweets,
        sentimentScore,
        engagement: totalEngagement,
      });

      return sentiments;
      
    } catch (error) {
      logger.error(`Failed to fetch X sentiment for ${symbol}`, error);
      throw error;
    }
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

      logger.info(`Stored ${ticks.length} X sentiment ticks`);
    } catch (error) {
      logger.error('Failed to store X sentiment ticks', error);
      throw error;
    }
  }

  private getCryptoSearchTerms(symbol: string): string[] {
    const symbolMap: Record<string, string[]> = {
      'BTCUSDT': ['Bitcoin', 'BTC', '#Bitcoin', '#BTC', '$BTC'],
      'ETHUSDT': ['Ethereum', 'ETH', '#Ethereum', '#ETH', '$ETH'],
      'SOLUSDT': ['Solana', 'SOL', '#Solana', '#SOL', '$SOL'],
      'ADAUSDT': ['Cardano', 'ADA', '#Cardano', '#ADA', '$ADA'],
      'DOTUSDT': ['Polkadot', 'DOT', '#Polkadot', '#DOT', '$DOT'],
    };

    return symbolMap[symbol] || [symbol.replace('USDT', '')];
  }

  private analyzeTweetSentiment(text: string): number {
    const bullishKeywords = [
      'moon', 'bullish', 'buy', 'pump', 'rocket', 'up', 'rise', 'gain',
      'profit', 'hodl', 'diamond', 'hands', 'to the moon', 'green',
      'rally', 'surge', 'breakthrough', 'all time high', 'ATH'
    ];

    const bearishKeywords = [
      'dump', 'crash', 'sell', 'bear', 'drop', 'fall', 'down', 'loss',
      'red', 'dip', 'correction', 'panic', 'fear', 'blood', 'massacre',
      'dead', 'rekt', 'liquidated', 'bubble', 'ponzi'
    ];

    const lowerText = text.toLowerCase();
    let sentiment = 0;

    for (const keyword of bullishKeywords) {
      if (lowerText.includes(keyword)) sentiment += 1;
    }

    for (const keyword of bearishKeywords) {
      if (lowerText.includes(keyword)) sentiment -= 1;
    }

    return Math.max(-1, Math.min(1, sentiment / 10)); // Normalize
  }

  private async updateHealthStatus(status: 'healthy' | 'degraded' | 'down', lastError: string | null): Promise<void> {
    try {
      await db.insert(connectorHealth).values({
        provider: 'x',
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
      logger.error('Failed to update X connector health', error);
    }
  }

  async getHealthStatus(): Promise<any> {
    return {
      provider: 'x',
      status: this.errorCount > 10 ? 'degraded' : 'healthy',
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      hasCredentials: !!this.bearerToken,
    };
  }
}