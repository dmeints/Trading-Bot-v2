import axios from 'axios';
import { storage } from '../storage';
import type { InsertSentimentData } from '@shared/schema';
import { xApiCache } from './xApiCache.js';
import { logger } from '../utils/logger.js';

export interface SentimentResult {
  sentiment: number; // -1 (negative) to 1 (positive)
  confidence: number;
  volume: number;
  source: string;
  data: any;
}

export class SentimentAnalyzer {
  private sources: Map<string, SentimentSource> = new Map();

  constructor() {
    this.sources.set('fear_greed', new FearGreedIndexSource());
    this.sources.set('reddit', new RedditSentimentSource());
    this.sources.set('x', new XSentimentSource());
    this.sources.set('news', new NewsSentimentSource());
    this.sources.set('google_trends', new GoogleTrendsSource());
  }

  async analyzeSentiment(symbol: string): Promise<SentimentResult[]> {
    const promises = Array.from(this.sources.entries()).map(async ([sourceName, source]) => {
      try {
        const result = await source.getSentiment(symbol);
        
        // Store sentiment data (placeholder until storage method is implemented)
        // await storage.createSentimentData(...);

        return result;
      } catch (error) {
        console.error(`Error fetching sentiment from ${sourceName}:`, error);
        return {
          sentiment: 0,
          confidence: 0,
          volume: 0,
          source: sourceName,
          data: { error: String(error) }
        };
      }
    });

    return await Promise.all(promises);
  }

  async getAggregatedSentiment(symbol: string): Promise<{
    overallSentiment: number;
    confidence: number;
    breakdown: SentimentResult[];
  }> {
    const results = await this.analyzeSentiment(symbol);
    
    let weightedSentiment = 0;
    let totalWeight = 0;
    let avgConfidence = 0;

    results.forEach(result => {
      const weight = result.confidence * result.volume;
      weightedSentiment += result.sentiment * weight;
      totalWeight += weight;
      avgConfidence += result.confidence;
    });

    return {
      overallSentiment: totalWeight > 0 ? weightedSentiment / totalWeight : 0,
      confidence: avgConfidence / results.length,
      breakdown: results
    };
  }

  async getHistoricalSentiment(symbol: string, hours: number = 24): Promise<SentimentResult[]> {
    // Placeholder until storage method is implemented
    return [];
  }
}

abstract class SentimentSource {
  abstract getSentiment(symbol: string): Promise<SentimentResult>;
}

class FearGreedIndexSource extends SentimentSource {
  async getSentiment(symbol: string): Promise<SentimentResult> {
    try {
      // Fear & Greed Index API
      const response = await axios.get('https://api.alternative.me/fng/');
      const data = response.data;
      
      if (data && data.data && data.data[0]) {
        const value = parseInt(data.data[0].value);
        const sentiment = (value - 50) / 50; // Convert 0-100 to -1 to 1
        
        return {
          sentiment,
          confidence: 0.8,
          volume: 1,
          source: 'fear_greed',
          data: data.data[0]
        };
      }
      
      throw new Error('Invalid response from Fear & Greed API');
    } catch (error) {
      return {
        sentiment: 0,
        confidence: 0,
        volume: 0,
        source: 'fear_greed',
        data: { error: String(error) }
      };
    }
  }
}

class RedditSentimentSource extends SentimentSource {
  async getSentiment(symbol: string): Promise<SentimentResult> {
    const apiKey = process.env.REDDIT_API_KEY;
    
    if (!apiKey) {
      console.warn('[Reddit] API key not provided - sentiment analysis disabled');
      return {
        sentiment: 0,
        confidence: 0,
        volume: 0,
        source: 'reddit',
        data: { error: 'Reddit API key not configured' }
      };
    }

    try {
      const cleanSymbol = symbol.split('/')[0].toLowerCase();
      
      // Search relevant crypto subreddits
      const subreddits = ['cryptocurrency', 'cryptomarkets', 'bitcoin', 'ethereum'];
      const searchQuery = `${cleanSymbol} OR ${symbol}`;
      
      const response = await axios.get('https://www.reddit.com/search.json', {
        params: {
          q: searchQuery,
          sort: 'new',
          limit: 100,
          t: 'day'
        },
        headers: {
          'User-Agent': 'CryptoTradingBot/1.0'
        }
      });

      if (response.data?.data?.children) {
        const posts = response.data.data.children;
        let totalSentiment = 0;
        let postCount = 0;
        let commentCount = 0;

        for (const post of posts) {
          const postData = post.data;
          const title = postData.title.toLowerCase();
          const content = (postData.selftext || '').toLowerCase();
          
          // Simple sentiment analysis based on keywords
          const positiveWords = ['bullish', 'moon', 'pump', 'buy', 'hodl', 'green', 'up', 'gains'];
          const negativeWords = ['bearish', 'dump', 'sell', 'crash', 'red', 'down', 'loss', 'fear'];
          
          let sentimentScore = 0;
          positiveWords.forEach(word => {
            if (title.includes(word) || content.includes(word)) sentimentScore += 1;
          });
          negativeWords.forEach(word => {
            if (title.includes(word) || content.includes(word)) sentimentScore -= 1;
          });
          
          totalSentiment += sentimentScore;
          postCount++;
          commentCount += postData.num_comments || 0;
        }

        const averageSentiment = postCount > 0 ? totalSentiment / postCount : 0;
        const normalizedSentiment = Math.max(-1, Math.min(1, averageSentiment / 3));

        return {
          sentiment: normalizedSentiment,
          confidence: Math.min(0.8, postCount / 50), // Higher confidence with more data
          volume: postCount,
          source: 'reddit',
          data: { 
            posts: postCount,
            comments: commentCount,
            rawSentiment: totalSentiment
          }
        };
      }

      return {
        sentiment: 0,
        confidence: 0,
        volume: 0,
        source: 'reddit',
        data: { error: 'No data found' }
      };
    } catch (error) {
      console.error('[Reddit] API error:', error);
      return {
        sentiment: 0,
        confidence: 0,
        volume: 0,
        source: 'reddit',
        data: { error: String(error) }
      };
    }
  }
}

class XSentimentSource extends SentimentSource {
  async getSentiment(symbol: string): Promise<SentimentResult> {
    const bearerToken = process.env.X_BEARER_TOKEN;
    
    if (!bearerToken) {
      logger.warn('[X API] Bearer token not provided - sentiment analysis disabled');
      return {
        sentiment: 0,
        confidence: 0,
        volume: 0,
        source: 'x',
        data: { error: 'X API Bearer token not configured', cached: false }
      };
    }

    const cleanSymbol = symbol.split('/')[0];
    const queryParams = {
      query: `${cleanSymbol} OR ${symbol} -is:retweet lang:en`,
      max_results: 100,
      'tweet.fields': 'created_at,public_metrics,context_annotations'
    };

    // Check cache first - CRITICAL for 100/month limit
    const cached = xApiCache.get(queryParams);
    if (cached) {
      logger.info('[X API] Cache hit - precious request saved!', { 
        symbol, 
        age: Math.round((Date.now() - cached.timestamp) / 1000 / 60) 
      });
      return {
        ...cached.data,
        data: { ...cached.data.data, cached: true, cacheAge: Date.now() - cached.timestamp }
      };
    }

    // Check if we have remaining quota (simulated check - in real app, would track usage)
    logger.warn('[X API] Making precious API request', { 
      symbol, 
      warning: 'Only 100 requests/month available - use sparingly!' 
    });

    try {
      // Make the precious API request
      const response = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
        params: queryParams,
        headers: {
          'Authorization': `Bearer ${bearerToken}`
        }
      });

      if (response.data?.data) {
        const tweets = response.data.data;
        let totalSentiment = 0;
        let totalEngagement = 0;

        for (const tweet of tweets) {
          const text = tweet.text.toLowerCase();
          
          // Enhanced sentiment analysis
          const strongPositive = ['moon', 'bullish', 'pump', 'rocket', 'green', 'gains', 'profit'];
          const positive = ['buy', 'hold', 'hodl', 'up', 'good', 'strong', 'support'];
          const negative = ['sell', 'dump', 'bear', 'crash', 'down', 'loss', 'fear'];
          const strongNegative = ['panic', 'dead', 'rekt', 'liquidated', 'scam'];
          
          let sentiment = 0;
          strongPositive.forEach(word => { if (text.includes(word)) sentiment += 2; });
          positive.forEach(word => { if (text.includes(word)) sentiment += 1; });
          negative.forEach(word => { if (text.includes(word)) sentiment -= 1; });
          strongNegative.forEach(word => { if (text.includes(word)) sentiment -= 2; });
          
          const engagement = (tweet.public_metrics?.like_count || 0) + 
                           (tweet.public_metrics?.retweet_count || 0) * 2 +
                           (tweet.public_metrics?.reply_count || 0);
          
          totalSentiment += sentiment * Math.log(engagement + 1); // Weight by engagement
          totalEngagement += engagement;
        }

        const averageSentiment = tweets.length > 0 ? totalSentiment / tweets.length : 0;
        const normalizedSentiment = Math.max(-1, Math.min(1, averageSentiment / 5));

        const result = {
          sentiment: normalizedSentiment,
          confidence: Math.min(0.9, tweets.length / 100),
          volume: tweets.length,
          source: 'x',
          data: {
            tweets: tweets.length,
            totalEngagement,
            averageEngagement: totalEngagement / tweets.length,
            cached: false,
            timestamp: Date.now()
          }
        };

        // Cache for 24 hours minimum to preserve API quota
        xApiCache.set(queryParams, result, 24 * 60 * 60 * 1000);
        logger.warn('[X API] Response cached for 24 hours', { 
          symbol, 
          tweets: tweets.length,
          quotaUsed: '1/100 monthly' 
        });

        return result;
      }

      return {
        sentiment: 0,
        confidence: 0,
        volume: 0,
        source: 'x',
        data: { error: 'No tweets found', cached: false }
      };
    } catch (error) {
      logger.error('[X API] Request failed - precious quota may have been wasted!', {
        error: String(error),
        symbol,
        warning: 'Check if this counts against 100/month limit'
      });
      return {
        sentiment: 0,
        confidence: 0,
        volume: 0,
        source: 'x',
        data: { error: String(error), cached: false }
      };
    }
  }
}

class NewsSentimentSource extends SentimentSource {
  async getSentiment(symbol: string): Promise<SentimentResult> {
    const apiKey = process.env.CRYPTO_PANIC_API_KEY;
    
    if (!apiKey) {
      console.warn('[News] CryptoPanic API key not provided - sentiment analysis disabled');
      return {
        sentiment: 0,
        confidence: 0,
        volume: 0,
        source: 'news',
        data: { error: 'CryptoPanic API key not configured' }
      };
    }

    try {
      const cleanSymbol = symbol.split('/')[0].toLowerCase();
      
      // CryptoPanic API for crypto news sentiment
      const response = await axios.get('https://cryptopanic.com/api/v1/posts/', {
        params: {
          auth_token: apiKey,
          currencies: cleanSymbol,
          filter: 'hot',
          kind: 'news',
          public: 'true'
        }
      });

      if (response.data?.results) {
        const articles = response.data.results;
        let totalSentiment = 0;
        let totalVotes = 0;

        for (const article of articles) {
          const title = article.title.toLowerCase();
          
          // Analyze sentiment from title and votes
          const positiveWords = ['bullish', 'surge', 'rally', 'adoption', 'partnership', 'green', 'gains', 'growth'];
          const negativeWords = ['bearish', 'crash', 'sell-off', 'hack', 'ban', 'regulation', 'red', 'loss', 'drop'];
          
          let sentimentScore = 0;
          positiveWords.forEach(word => {
            if (title.includes(word)) sentimentScore += 1;
          });
          negativeWords.forEach(word => {
            if (title.includes(word)) sentimentScore -= 1;
          });
          
          // Factor in community voting if available
          const positiveVotes = article.votes?.positive || 0;
          const negativeVotes = article.votes?.negative || 0;
          const voteWeight = positiveVotes - negativeVotes;
          
          totalSentiment += sentimentScore + (voteWeight * 0.1);
          totalVotes += positiveVotes + negativeVotes;
        }

        const averageSentiment = articles.length > 0 ? totalSentiment / articles.length : 0;
        const normalizedSentiment = Math.max(-1, Math.min(1, averageSentiment / 2));

        return {
          sentiment: normalizedSentiment,
          confidence: Math.min(0.8, articles.length / 20),
          volume: articles.length,
          source: 'news',
          data: {
            articles: articles.length,
            totalVotes,
            averageVotes: totalVotes / articles.length
          }
        };
      }

      return {
        sentiment: 0,
        confidence: 0,
        volume: 0,
        source: 'news',
        data: { error: 'No news articles found' }
      };
    } catch (error) {
      console.error('[News] CryptoPanic API error:', error);
      return {
        sentiment: 0,
        confidence: 0,
        volume: 0,
        source: 'news',
        data: { error: String(error) }
      };
    }
  }
}

class GoogleTrendsSource extends SentimentSource {
  async getSentiment(symbol: string): Promise<SentimentResult> {
    try {
      // Simulate Google Trends data
      const cleanSymbol = symbol.split('/')[0];
      const searchVolume = Math.floor(Math.random() * 100) + 20;
      
      // Higher search volume might indicate more interest
      const sentiment = Math.min((searchVolume - 50) / 100, 0.3);
      
      return {
        sentiment,
        confidence: 0.4,
        volume: searchVolume,
        source: 'google_trends',
        data: { 
          searchVolume,
          trend: searchVolume > 70 ? 'rising' : searchVolume < 30 ? 'falling' : 'stable',
          simulation: true 
        }
      };
    } catch (error) {
      return {
        sentiment: 0,
        confidence: 0,
        volume: 0,
        source: 'google_trends',
        data: { error: String(error) }
      };
    }
  }
}

export const sentimentAnalyzer = new SentimentAnalyzer();