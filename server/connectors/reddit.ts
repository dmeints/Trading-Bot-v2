/**
 * Reddit API Connector for Community Sentiment Analysis
 * Fetches community sentiment data from cryptocurrency subreddits
 */

import axios, { AxiosResponse } from 'axios';
import { RateLimiter } from 'limiter';
import { logger } from '../utils/logger';
import { db } from '../db';
import { sentimentTicksExtended, connectorHealth } from '@shared/schema';
import type { InsertSentimentTick, InsertConnectorHealth } from '@shared/schema';

interface RedditPostResponse {
  data: {
    children: Array<{
      data: {
        id: string;
        title: string;
        selftext: string;
        score: number;
        num_comments: number;
        created_utc: number;
        subreddit: string;
        author: string;
        upvote_ratio: number;
      };
    }>;
    after?: string;
  };
}

export class RedditConnector {
  private clientId: string | undefined;
  private clientSecret: string | undefined;
  private baseUrl = 'https://www.reddit.com/api/v1';
  private oauthUrl = 'https://oauth.reddit.com';
  private limiter: RateLimiter;
  private requestCount = 0;
  private errorCount = 0;
  private accessToken: string | null = null;

  constructor() {
    this.clientId = process.env.REDDIT_CLIENT_ID;
    this.clientSecret = process.env.REDDIT_CLIENT_SECRET;
    // Rate limit: 60 requests per minute for authenticated API
    this.limiter = new RateLimiter({ tokensPerInterval: 60, interval: 60000 });
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Reddit API credentials not configured');
    }

    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await axios.post(`${this.baseUrl}/access_token`, 
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'SkippyBot/1.0',
          },
        }
      );

      this.accessToken = response.data.access_token;
      logger.info('Reddit access token obtained');
      return this.accessToken;
      
    } catch (error) {
      logger.error('Failed to get Reddit access token', error);
      throw error;
    }
  }

  private async makeRequest<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    await this.limiter.removeTokens(1);
    this.requestCount++;

    const token = await this.getAccessToken();
    const config = {
      baseURL: this.oauthUrl,
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'SkippyBot/1.0',
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
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      await this.updateHealthStatus('degraded', errorMessage);
      
      logger.error('Reddit API error', {
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
    const subreddits = this.getCryptoSubreddits(symbol);
    const sentiments: InsertSentimentTick[] = [];

    try {
      for (const subreddit of subreddits) {
        const posts = await this.fetchSubredditPosts(subreddit, symbol);
        if (posts.length > 0) {
          const sentiment = this.analyzePosts(posts, symbol);
          sentiments.push(sentiment);
        }
      }

      logger.info(`Fetched Reddit sentiment for ${symbol}`, {
        subreddits: subreddits.length,
        sentiments: sentiments.length,
      });

      return sentiments;
      
    } catch (error) {
      logger.error(`Failed to fetch Reddit sentiment for ${symbol}`, error);
      throw error;
    }
  }

  private async fetchSubredditPosts(subreddit: string, symbol: string): Promise<any[]> {
    const endpoint = `/r/${subreddit}/hot.json`;
    const params = {
      limit: 50,
      t: 'day', // Posts from last 24 hours
    };

    try {
      const data = await this.makeRequest<RedditPostResponse>(endpoint, params);
      
      if (!data.data?.children?.length) {
        logger.warn(`No posts found in r/${subreddit}`);
        return [];
      }

      // Filter posts related to the symbol
      const symbolKeywords = this.getSymbolKeywords(symbol);
      const relevantPosts = data.data.children.filter(post => {
        const text = (post.data.title + ' ' + post.data.selftext).toLowerCase();
        return symbolKeywords.some(keyword => text.includes(keyword.toLowerCase()));
      });

      return relevantPosts.map(post => post.data);
      
    } catch (error) {
      logger.error(`Failed to fetch posts from r/${subreddit}`, error);
      return [];
    }
  }

  private analyzePosts(posts: any[], symbol: string): InsertSentimentTick {
    let totalScore = 0;
    let totalComments = 0;
    let bullishCount = 0;
    let bearishCount = 0;

    for (const post of posts) {
      totalScore += post.score;
      totalComments += post.num_comments;

      // Analyze sentiment based on title and content
      const text = post.title + ' ' + post.selftext;
      const sentiment = this.analyzeTextSentiment(text);
      
      if (sentiment > 0) bullishCount++;
      if (sentiment < 0) bearishCount++;
    }

    // Calculate overall sentiment score
    const sentimentScore = posts.length > 0 
      ? (bullishCount - bearishCount) / posts.length 
      : 0;

    // Weight by engagement (upvotes and comments)
    const avgEngagement = posts.length > 0 ? (totalScore + totalComments) / posts.length : 0;
    const weightedSentiment = sentimentScore * Math.min(1, avgEngagement / 100);

    return {
      timestamp: new Date(),
      source: 'reddit',
      symbol: symbol.replace('USDT', ''),
      score: Math.max(-1, Math.min(1, weightedSentiment)), // Clamp to [-1, 1]
      volume: posts.length,
      topic: `${symbol} community sentiment`,
      raw: {
        posts: posts.slice(0, 3), // Store first 3 posts
        totalScore,
        totalComments,
        bullishCount,
        bearishCount,
        avgEngagement,
      } as Record<string, any>,
      provider: 'reddit',
      provenance: {
        provider: 'reddit',
        fetchedAt: new Date().toISOString(),
        quotaCost: 1,
        postsAnalyzed: posts.length,
      } as Record<string, any>,
    };
  }

  private getCryptoSubreddits(symbol: string): string[] {
    const subredditMap: Record<string, string[]> = {
      'BTCUSDT': ['Bitcoin', 'CryptoCurrency', 'BitcoinBeginners'],
      'ETHUSDT': ['ethereum', 'ethtrader', 'CryptoCurrency'],
      'SOLUSDT': ['solana', 'CryptoCurrency'],
      'ADAUSDT': ['cardano', 'CryptoCurrency'],
      'DOTUSDT': ['dot', 'CryptoCurrency'],
    };

    return subredditMap[symbol] || ['CryptoCurrency'];
  }

  private getSymbolKeywords(symbol: string): string[] {
    const keywordMap: Record<string, string[]> = {
      'BTCUSDT': ['bitcoin', 'btc', 'satoshi'],
      'ETHUSDT': ['ethereum', 'eth', 'ether', 'vitalik'],
      'SOLUSDT': ['solana', 'sol'],
      'ADAUSDT': ['cardano', 'ada'],
      'DOTUSDT': ['polkadot', 'dot'],
    };

    return keywordMap[symbol] || [symbol.replace('USDT', '')];
  }

  private analyzeTextSentiment(text: string): number {
    const bullishKeywords = [
      'bullish', 'moon', 'pump', 'buy', 'hodl', 'diamond hands', 'to the moon',
      'green', 'profit', 'gain', 'up', 'rise', 'rally', 'surge', 'breakout',
      'ath', 'all time high', 'bullrun', 'adoption', 'institutional'
    ];

    const bearishKeywords = [
      'bearish', 'dump', 'crash', 'sell', 'panic', 'fear', 'red', 'blood',
      'drop', 'fall', 'down', 'correction', 'dip', 'bubble', 'scam',
      'dead', 'rekt', 'liquidated', 'bear market', 'recession'
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

      logger.info(`Stored ${ticks.length} Reddit sentiment ticks`);
    } catch (error) {
      logger.error('Failed to store Reddit sentiment ticks', error);
      throw error;
    }
  }

  private async updateHealthStatus(status: 'healthy' | 'degraded' | 'down', lastError: string | null): Promise<void> {
    try {
      await db.insert(connectorHealth).values({
        provider: 'reddit',
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
      logger.error('Failed to update Reddit connector health', error);
    }
  }

  async getHealthStatus(): Promise<any> {
    return {
      provider: 'reddit',
      status: this.errorCount > 10 ? 'degraded' : 'healthy',
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      hasCredentials: !!(this.clientId && this.clientSecret),
    };
  }
}