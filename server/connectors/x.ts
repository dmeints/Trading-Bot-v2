/**
 * X (Twitter) API v2 Connector - Phase A Implementation
 * Fetches tweets by symbol/hashtag for sentiment analysis with rate limiting and provenance tracking
 */

import axios, { AxiosResponse } from 'axios';
import { db } from '../db';
import { sentimentTicks, connectorHealth, type InsertSentimentTick, type InsertConnectorHealth } from '@shared/schema';
import { logger } from '../utils/logger';
import { RateLimiter } from 'limiter';

export interface TwitterTweetData {
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
  context_annotations?: Array<{
    domain: {
      id: string;
      name: string;
      description: string;
    };
    entity: {
      id: string;
      name: string;
      description?: string;
    };
  }>;
}

export interface TwitterSearchResponse {
  data: TwitterTweetData[];
  meta: {
    newest_id: string;
    oldest_id: string;
    result_count: number;
    next_token?: string;
  };
}

export class XConnector {
  private bearerToken: string | undefined;
  private baseUrl = 'https://api.twitter.com/2';
  private limiter: RateLimiter;
  private requestCount = 0;
  private errorCount = 0;
  private cryptoHashtags: Map<string, string[]>;

  constructor() {
    this.bearerToken = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;
    // Rate limit: 300 requests per 15 minutes for search endpoint
    this.limiter = new RateLimiter({ tokensPerInterval: 300, interval: 15 * 60 * 1000 });
    
    // Map crypto symbols to relevant hashtags and keywords
    this.cryptoHashtags = new Map([
      ['BTCUSDT', ['#Bitcoin', '#BTC', '$BTC', 'Bitcoin']],
      ['ETHUSDT', ['#Ethereum', '#ETH', '$ETH', 'Ethereum']],
      ['SOLUSDT', ['#Solana', '#SOL', '$SOL', 'Solana']],
      ['ADAUSDT', ['#Cardano', '#ADA', '$ADA', 'Cardano']],
      ['DOTUSDT', ['#Polkadot', '#DOT', '$DOT', 'Polkadot']],
      ['LINKUSDT', ['#Chainlink', '#LINK', '$LINK', 'Chainlink']],
      ['MATICUSDT', ['#Polygon', '#MATIC', '$MATIC', 'Polygon']],
      ['AVAXUSDT', ['#Avalanche', '#AVAX', '$AVAX', 'Avalanche']],
    ]);
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
      timeout: 15000,
    };

    try {
      const response: AxiosResponse<T> = await axios.get(endpoint, config);
      await this.updateHealthStatus('healthy', null);
      return response.data;
    } catch (error: any) {
      this.errorCount++;
      const errorMessage = error.response?.data?.title || error.response?.data?.detail || error.message || 'Unknown error';
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

  async fetchTweetsBySymbol(symbol: string, maxResults: number = 100): Promise<InsertSentimentTick[]> {
    const hashtags = this.cryptoHashtags.get(symbol);
    if (!hashtags?.length) {
      logger.warn(`No hashtags configured for symbol: ${symbol}`);
      return [];
    }

    // Build search query with OR conditions for all hashtags/keywords
    const query = hashtags.map(tag => `"${tag}"`).join(' OR ') + ' -is:retweet lang:en';
    
    const endpoint = '/tweets/search/recent';
    const params = {
      query,
      max_results: Math.min(maxResults, 100), // API limit is 100 per request
      'tweet.fields': 'created_at,author_id,public_metrics,context_annotations',
      expansions: 'author_id',
    };

    try {
      const data = await this.makeRequest<TwitterSearchResponse>(endpoint, params);
      
      if (!data.data?.length) {
        logger.info(`No tweets found for symbol: ${symbol}`);
        return [];
      }

      // Convert to sentiment ticks
      const sentimentTicks: InsertSentimentTick[] = [];
      
      for (const tweet of data.data) {
        const sentiment = this.analyzeTweetSentiment(tweet.text);
        const volume = this.calculateTweetVolume(tweet.public_metrics);
        
        sentimentTicks.push({
          timestamp: new Date(tweet.created_at),
          source: 'twitter',
          symbol,
          score: sentiment.score,
          volume,
          topic: hashtags.find(tag => tweet.text.toLowerCase().includes(tag.toLowerCase())) || symbol,
          raw: {
            tweet_id: tweet.id,
            text: tweet.text,
            author_id: tweet.author_id,
            public_metrics: tweet.public_metrics,
            context_annotations: tweet.context_annotations,
            hashtags_matched: hashtags.filter(tag => tweet.text.toLowerCase().includes(tag.toLowerCase())),
          },
          provenance: {
            provider: 'twitter',
            endpoint,
            fetchedAt: new Date().toISOString(),
            quotaCost: 1,
            query,
            max_results: maxResults,
            result_count: data.data.length,
          },
        });
      }

      logger.info(`Fetched ${sentimentTicks.length} tweets for ${symbol} from X`);
      return sentimentTicks;
      
    } catch (error) {
      logger.error(`Failed to fetch tweets for ${symbol}`, error);
      if (error.message === 'X Bearer Token not configured') {
        return []; // Return empty array instead of throwing for missing config
      }
      throw error;
    }
  }

  private analyzeTweetSentiment(text: string): { score: number; confidence: number } {
    // Simple sentiment analysis based on keywords
    const positiveWords = ['bullish', 'moon', 'pump', 'buy', 'long', 'up', 'rise', 'gain', 'profit', 'bull', 'rocket', '🚀', '📈'];
    const negativeWords = ['bearish', 'dump', 'sell', 'short', 'down', 'drop', 'loss', 'bear', 'crash', 'dip', '📉', '💀'];
    
    const lowerText = text.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;
    
    positiveWords.forEach(word => {
      if (lowerText.includes(word)) positiveCount++;
    });
    
    negativeWords.forEach(word => {
      if (lowerText.includes(word)) negativeCount++;
    });
    
    const totalSentimentWords = positiveCount + negativeCount;
    
    if (totalSentimentWords === 0) {
      return { score: 0, confidence: 0.1 }; // Neutral with low confidence
    }
    
    const score = (positiveCount - negativeCount) / totalSentimentWords;
    const confidence = Math.min(totalSentimentWords / 5, 1); // Higher confidence with more sentiment words
    
    return { score: Math.max(-1, Math.min(1, score)), confidence };
  }

  private calculateTweetVolume(metrics: TwitterTweetData['public_metrics']): number {
    // Calculate engagement volume based on interactions
    return metrics.retweet_count + metrics.like_count + metrics.reply_count + metrics.quote_count;
  }

  async storeSentimentTicks(ticks: InsertSentimentTick[]): Promise<void> {
    if (ticks.length === 0) return;

    try {
      // Insert sentiment ticks (allowing duplicates as they represent different tweets)
      await db.insert(sentimentTicks).values(ticks);
      logger.info(`Stored ${ticks.length} sentiment ticks from X to database`);
    } catch (error) {
      logger.error('Failed to store X sentiment ticks', error);
      throw error;
    }
  }

  private async updateHealthStatus(status: 'healthy' | 'degraded' | 'down', error: string | null): Promise<void> {
    const healthData: InsertConnectorHealth = {
      provider: 'twitter',
      status,
      lastSuccessfulFetch: status === 'healthy' ? new Date() : undefined,
      lastError: error,
      requestCount24h: this.requestCount,
      errorCount24h: this.errorCount,
      quotaUsed: this.requestCount,
      quotaLimit: 300,
    };

    try {
      await db.insert(connectorHealth)
        .values(healthData)
        .onConflictDoUpdate({
          target: connectorHealth.provider,
          set: healthData,
        });
    } catch (error) {
      logger.error('Failed to update X connector health', error);
    }
  }

  async getHealthStatus(): Promise<{ status: string; requestCount: number; errorCount: number; configured: boolean }> {
    return {
      status: !this.bearerToken ? 'down' : 
              this.errorCount / Math.max(this.requestCount, 1) > 0.1 ? 'degraded' : 'healthy',
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      configured: !!this.bearerToken,
    };
  }

  resetDailyCounters(): void {
    this.requestCount = 0;
    this.errorCount = 0;
  }
}

// Export singleton instance
export const xConnector = new XConnector();