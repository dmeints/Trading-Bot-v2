/**
 * Reddit API Connector - Phase A Implementation
 * Fetches crypto subreddit posts/comments for sentiment analysis with rate limiting and provenance tracking
 */

import axios, { AxiosResponse } from 'axios';
import { db } from '../db';
import { sentimentTicks, connectorHealth, type InsertSentimentTick, type InsertConnectorHealth } from '@shared/schema';
import { logger } from '../utils/logger';
import { RateLimiter } from 'limiter';

export interface RedditPostData {
  id: string;
  title: string;
  selftext: string;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  created_utc: number;
  subreddit: string;
  author: string;
  permalink: string;
  url: string;
}

export interface RedditCommentData {
  id: string;
  body: string;
  score: number;
  created_utc: number;
  subreddit: string;
  author: string;
  permalink: string;
  parent_id: string;
}

export interface RedditResponse {
  data: {
    children: Array<{
      data: RedditPostData | RedditCommentData;
    }>;
    after?: string;
    before?: string;
  };
}

export class RedditConnector {
  private clientId: string | undefined;
  private clientSecret: string | undefined;
  private userAgent = 'SkippyTrading/1.0';
  private baseUrl = 'https://oauth.reddit.com';
  private authUrl = 'https://www.reddit.com/api/v1/access_token';
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private limiter: RateLimiter;
  private requestCount = 0;
  private errorCount = 0;
  private cryptoSubreddits: string[];

  constructor() {
    this.clientId = process.env.REDDIT_CLIENT_ID;
    this.clientSecret = process.env.REDDIT_CLIENT_SECRET;
    // Rate limit: 60 requests per minute for OAuth
    this.limiter = new RateLimiter({ tokensPerInterval: 60, interval: 60000 });
    
    // Crypto-related subreddits to monitor
    this.cryptoSubreddits = [
      'CryptoCurrency',
      'Bitcoin',
      'ethereum',
      'solana', 
      'cardano',
      'dot',
      'CryptoMarkets',
      'altcoin',
      'CoinBase',
      'binance',
    ];
  }

  private async authenticate(): Promise<void> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Reddit API credentials not configured');
    }

    // Check if token is still valid
    if (this.accessToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    
    try {
      const response = await axios.post(
        this.authUrl,
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': this.userAgent,
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Reddit tokens expire in 1 hour, set expiry with 5min buffer
      this.tokenExpiresAt = new Date(Date.now() + (response.data.expires_in - 300) * 1000);
      
      logger.info('Reddit authentication successful');
    } catch (error: any) {
      logger.error('Reddit authentication failed', error);
      throw new Error(`Reddit authentication failed: ${error.message}`);
    }
  }

  private async makeRequest<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    await this.authenticate();
    await this.limiter.removeTokens(1);
    this.requestCount++;

    const config = {
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'User-Agent': this.userAgent,
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

  async fetchPostsBySymbol(symbol: string, limit: number = 100): Promise<InsertSentimentTick[]> {
    const keywords = this.getKeywordsForSymbol(symbol);
    if (!keywords.length) {
      logger.warn(`No keywords configured for symbol: ${symbol}`);
      return [];
    }

    const sentimentTicks: InsertSentimentTick[] = [];

    // Search across crypto subreddits
    for (const subreddit of this.cryptoSubreddits) {
      try {
        const posts = await this.searchSubreddit(subreddit, keywords, limit / this.cryptoSubreddits.length);
        
        for (const post of posts) {
          const sentiment = this.analyzeTextSentiment(post.title + ' ' + post.selftext);
          const volume = this.calculatePostVolume(post);
          
          sentimentTicks.push({
            timestamp: new Date(post.created_utc * 1000),
            source: 'reddit',
            symbol,
            score: sentiment.score,
            volume,
            topic: `r/${post.subreddit}`,
            raw: {
              post_id: post.id,
              title: post.title,
              selftext: post.selftext,
              score: post.score,
              upvote_ratio: post.upvote_ratio,
              num_comments: post.num_comments,
              author: post.author,
              subreddit: post.subreddit,
              permalink: post.permalink,
              keywords_matched: keywords.filter(kw => 
                (post.title + ' ' + post.selftext).toLowerCase().includes(kw.toLowerCase())
              ),
            },
            provenance: {
              provider: 'reddit',
              endpoint: `/r/${subreddit}/search`,
              fetchedAt: new Date().toISOString(),
              quotaCost: 1,
              subreddit,
              keywords: keywords.join(','),
              limit,
            },
          });
        }
      } catch (error) {
        logger.error(`Failed to fetch posts from r/${subreddit}`, error);
      }
    }

    logger.info(`Fetched ${sentimentTicks.length} Reddit posts for ${symbol}`);
    return sentimentTicks;
  }

  private async searchSubreddit(subreddit: string, keywords: string[], limit: number): Promise<RedditPostData[]> {
    const query = keywords.join(' OR ');
    const endpoint = `/r/${subreddit}/search`;
    const params = {
      q: query,
      restrict_sr: 'on',
      sort: 'new',
      limit: Math.min(limit, 25), // Reddit API limit
      t: 'day', // Last 24 hours
    };

    try {
      const data = await this.makeRequest<RedditResponse>(endpoint, params);
      
      return data.data.children.map(child => child.data as RedditPostData);
    } catch (error) {
      logger.error(`Failed to search r/${subreddit}`, error);
      return [];
    }
  }

  async fetchHotPosts(subreddit: string, limit: number = 25): Promise<InsertSentimentTick[]> {
    const endpoint = `/r/${subreddit}/hot`;
    const params = { limit: Math.min(limit, 100) };

    try {
      const data = await this.makeRequest<RedditResponse>(endpoint, params);
      const sentimentTicks: InsertSentimentTick[] = [];

      for (const child of data.data.children) {
        const post = child.data as RedditPostData;
        const symbol = this.detectSymbolFromText(post.title + ' ' + post.selftext);
        
        if (symbol) {
          const sentiment = this.analyzeTextSentiment(post.title + ' ' + post.selftext);
          const volume = this.calculatePostVolume(post);
          
          sentimentTicks.push({
            timestamp: new Date(post.created_utc * 1000),
            source: 'reddit',
            symbol,
            score: sentiment.score,
            volume,
            topic: `r/${post.subreddit}`,
            raw: {
              post_id: post.id,
              title: post.title,
              selftext: post.selftext,
              score: post.score,
              upvote_ratio: post.upvote_ratio,
              num_comments: post.num_comments,
              author: post.author,
              subreddit: post.subreddit,
              permalink: post.permalink,
            },
            provenance: {
              provider: 'reddit',
              endpoint,
              fetchedAt: new Date().toISOString(),
              quotaCost: 1,
              subreddit,
              limit,
            },
          });
        }
      }

      logger.info(`Fetched ${sentimentTicks.length} hot posts from r/${subreddit}`);
      return sentimentTicks;
      
    } catch (error) {
      logger.error(`Failed to fetch hot posts from r/${subreddit}`, error);
      throw error;
    }
  }

  private getKeywordsForSymbol(symbol: string): string[] {
    const keywordMap: Record<string, string[]> = {
      'BTCUSDT': ['Bitcoin', 'BTC', '$BTC'],
      'ETHUSDT': ['Ethereum', 'ETH', '$ETH'],
      'SOLUSDT': ['Solana', 'SOL', '$SOL'],
      'ADAUSDT': ['Cardano', 'ADA', '$ADA'],
      'DOTUSDT': ['Polkadot', 'DOT', '$DOT'],
      'LINKUSDT': ['Chainlink', 'LINK', '$LINK'],
      'MATICUSDT': ['Polygon', 'MATIC', '$MATIC'],
      'AVAXUSDT': ['Avalanche', 'AVAX', '$AVAX'],
    };
    
    return keywordMap[symbol] || [];
  }

  private detectSymbolFromText(text: string): string | null {
    const lowerText = text.toLowerCase();
    
    // Simple symbol detection based on keywords
    const symbolMap = {
      'BTCUSDT': ['bitcoin', 'btc', '$btc'],
      'ETHUSDT': ['ethereum', 'eth', '$eth'],
      'SOLUSDT': ['solana', 'sol', '$sol'],
      'ADAUSDT': ['cardano', 'ada', '$ada'],
      'DOTUSDT': ['polkadot', 'dot', '$dot'],
    };
    
    for (const [symbol, keywords] of Object.entries(symbolMap)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return symbol;
      }
    }
    
    return null;
  }

  private analyzeTextSentiment(text: string): { score: number; confidence: number } {
    // Simple sentiment analysis based on keywords
    const positiveWords = ['bullish', 'moon', 'pump', 'buy', 'long', 'up', 'rise', 'gain', 'profit', 'bull', 'hodl', 'diamond hands'];
    const negativeWords = ['bearish', 'dump', 'sell', 'short', 'down', 'drop', 'loss', 'bear', 'crash', 'dip', 'paper hands'];
    
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
      return { score: 0, confidence: 0.1 };
    }
    
    const score = (positiveCount - negativeCount) / totalSentimentWords;
    const confidence = Math.min(totalSentimentWords / 5, 1);
    
    return { score: Math.max(-1, Math.min(1, score)), confidence };
  }

  private calculatePostVolume(post: RedditPostData): number {
    // Calculate engagement volume based on score and comments
    return Math.max(0, post.score) + post.num_comments * 2; // Weight comments higher
  }

  async storeSentimentTicks(ticks: InsertSentimentTick[]): Promise<void> {
    if (ticks.length === 0) return;

    try {
      await db.insert(sentimentTicks).values(ticks);
      logger.info(`Stored ${ticks.length} Reddit sentiment ticks to database`);
    } catch (error) {
      logger.error('Failed to store Reddit sentiment ticks', error);
      throw error;
    }
  }

  private async updateHealthStatus(status: 'healthy' | 'degraded' | 'down', error: string | null): Promise<void> {
    const healthData: InsertConnectorHealth = {
      provider: 'reddit',
      status,
      lastSuccessfulFetch: status === 'healthy' ? new Date() : undefined,
      lastError: error,
      requestCount24h: this.requestCount,
      errorCount24h: this.errorCount,
      quotaUsed: this.requestCount,
      quotaLimit: 60,
    };

    try {
      await db.insert(connectorHealth)
        .values(healthData)
        .onConflictDoUpdate({
          target: connectorHealth.provider,
          set: healthData,
        });
    } catch (error) {
      logger.error('Failed to update Reddit connector health', error);
    }
  }

  async getHealthStatus(): Promise<{ status: string; requestCount: number; errorCount: number; configured: boolean }> {
    const configured = !!(this.clientId && this.clientSecret);
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
export const redditConnector = new RedditConnector();