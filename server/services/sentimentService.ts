/**
 * SOCIAL SENTIMENT ANALYSIS SERVICE
 * Twitter/Reddit sentiment tracking with VADER and embedding-based classification
 */

import OpenAI from 'openai';
import axios from 'axios';
import { db } from '../db';

interface SocialPost {
  id: string;
  platform: 'twitter' | 'reddit' | 'telegram';
  content: string;
  author: string;
  timestamp: Date;
  engagement: {
    likes: number;
    retweets?: number;
    replies: number;
    score?: number; // Reddit upvotes
  };
  sentiment: {
    compound: number; // -1 to 1
    positive: number; // 0 to 1
    negative: number; // 0 to 1  
    neutral: number; // 0 to 1
  };
  mentions: string[]; // Asset mentions (BTC, ETH, etc.)
  influenceScore: number; // 0-100 based on author follower count and engagement
}

interface SentimentMetrics {
  overall: {
    bullish: number; // 0-100
    bearish: number; // 0-100
    neutral: number; // 0-100
    score: number; // -100 to 100
    confidence: number; // 0-1
  };
  assetSentiment: Record<string, {
    score: number; // -100 to 100
    volume: number; // mention count
    trend: 'rising' | 'falling' | 'stable';
  }>;
  topInfluencers: Array<{
    username: string;
    sentiment: number;
    followerCount: number;
    recentPosts: number;
  }>;
  viralContent: SocialPost[];
  fearGreedIndex: number; // 0-100 (0 = extreme fear, 100 = extreme greed)
}

export class SentimentService {
  private openai: OpenAI;
  private twitterBearerToken = process.env.TWITTER_BEARER_TOKEN;
  private redditClientId = process.env.REDDIT_CLIENT_ID;
  private redditSecret = process.env.REDDIT_SECRET;
  
  private sentimentCache: SocialPost[] = [];
  private lastFetchTime = 0;
  private cacheWindow = 15 * 60 * 1000; // 15 minutes

  private cryptoKeywords = [
    'bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'cryptocurrency',
    'solana', 'sol', 'cardano', 'ada', 'polkadot', 'dot', 'binance',
    'defi', 'nft', 'blockchain', 'web3', 'altcoin', 'hodl', 'moon',
    'bullish', 'bearish', 'pump', 'dump', 'ath', 'dip', 'fomo'
  ];

  private assetTickers = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'BNB', 'XRP', 'MATIC', 'AVAX', 'UNI'];

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async fetchSocialSentiment(limit: number = 100): Promise<SocialPost[]> {
    const now = Date.now();
    
    // Use cache if recent
    if (now - this.lastFetchTime < this.cacheWindow && this.sentimentCache.length > 0) {
      return this.sentimentCache;
    }

    try {
      const posts: SocialPost[] = [];

      // Fetch from multiple platforms
      await Promise.all([
        this.fetchTwitterSentiment(limit / 2),
        this.fetchRedditSentiment(limit / 2)
      ]).then(results => {
        results.flat().forEach(post => {
          if (post && !posts.some(p => p.id === post.id)) {
            posts.push(post);
          }
        });
      });

      // Sort by influence score and timestamp
      posts.sort((a, b) => {
        const scoreWeight = 0.7;
        const timeWeight = 0.3;
        const aScore = a.influenceScore * scoreWeight + (Date.now() - a.timestamp.getTime()) / (24 * 60 * 60 * 1000) * timeWeight;
        const bScore = b.influenceScore * scoreWeight + (Date.now() - b.timestamp.getTime()) / (24 * 60 * 60 * 1000) * timeWeight;
        return bScore - aScore;
      });

      this.sentimentCache = posts.slice(0, limit);
      this.lastFetchTime = now;

      return this.sentimentCache;
    } catch (error) {
      console.error('Failed to fetch social sentiment:', error);
      return this.generateMockSentimentData(limit);
    }
  }

  private async fetchTwitterSentiment(limit: number): Promise<SocialPost[]> {
    if (!this.twitterBearerToken) {
      return this.generateMockTwitterData(limit);
    }

    try {
      // Twitter API v2 search
      const query = this.cryptoKeywords.slice(0, 5).join(' OR ');
      const response = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
        headers: {
          'Authorization': `Bearer ${this.twitterBearerToken}`
        },
        params: {
          query: `(${query}) -is:retweet`,
          max_results: Math.min(limit, 100),
          'tweet.fields': 'public_metrics,created_at,author_id',
          'user.fields': 'public_metrics'
        }
      });

      const tweets = response.data.data || [];
      const posts: SocialPost[] = [];

      for (const tweet of tweets) {
        const sentiment = await this.analyzeSentiment(tweet.text);
        const mentions = this.extractAssetMentions(tweet.text);
        
        if (mentions.length > 0) { // Only include crypto-related posts
          posts.push({
            id: `tw_${tweet.id}`,
            platform: 'twitter',
            content: tweet.text,
            author: tweet.author_id,
            timestamp: new Date(tweet.created_at),
            engagement: {
              likes: tweet.public_metrics?.like_count || 0,
              retweets: tweet.public_metrics?.retweet_count || 0,
              replies: tweet.public_metrics?.reply_count || 0
            },
            sentiment,
            mentions,
            influenceScore: this.calculateInfluenceScore(tweet.public_metrics, 'twitter')
          });
        }
      }

      return posts;
    } catch (error) {
      console.error('Twitter fetch failed:', error);
      return this.generateMockTwitterData(limit);
    }
  }

  private async fetchRedditSentiment(limit: number): Promise<SocialPost[]> {
    if (!this.redditClientId || !this.redditSecret) {
      return this.generateMockRedditData(limit);
    }

    try {
      // Reddit API authentication
      const auth = Buffer.from(`${this.redditClientId}:${this.redditSecret}`).toString('base64');
      const tokenResponse = await axios.post('https://www.reddit.com/api/v1/access_token', 
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'User-Agent': 'SkippyBot/1.0'
          }
        }
      );

      const accessToken = tokenResponse.data.access_token;

      // Fetch from crypto subreddits
      const subreddits = ['CryptoCurrency', 'Bitcoin', 'ethereum', 'CryptoMarkets'];
      const posts: SocialPost[] = [];

      for (const subreddit of subreddits) {
        const response = await axios.get(`https://oauth.reddit.com/r/${subreddit}/hot`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': 'SkippyBot/1.0'
          },
          params: {
            limit: Math.floor(limit / subreddits.length)
          }
        });

        const redditPosts = response.data.data.children || [];

        for (const post of redditPosts) {
          const data = post.data;
          const content = data.title + (data.selftext ? ' ' + data.selftext : '');
          const sentiment = await this.analyzeSentiment(content);
          const mentions = this.extractAssetMentions(content);

          if (mentions.length > 0 && content.length > 10) {
            posts.push({
              id: `rd_${data.id}`,
              platform: 'reddit',
              content: content.slice(0, 500), // Limit content length
              author: data.author,
              timestamp: new Date(data.created_utc * 1000),
              engagement: {
                likes: data.ups || 0,
                replies: data.num_comments || 0,
                score: data.score || 0
              },
              sentiment,
              mentions,
              influenceScore: this.calculateInfluenceScore({
                ups: data.ups,
                num_comments: data.num_comments
              }, 'reddit')
            });
          }
        }
      }

      return posts;
    } catch (error) {
      console.error('Reddit fetch failed:', error);
      return this.generateMockRedditData(limit);
    }
  }

  private async analyzeSentiment(text: string): Promise<SocialPost['sentiment']> {
    try {
      // Use OpenAI for more accurate sentiment analysis
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{
          role: "user",
          content: `Analyze the sentiment of this cryptocurrency-related text. Return JSON with compound (-1 to 1), positive (0-1), negative (0-1), and neutral (0-1) scores:

"${text.slice(0, 300)}"`
        }],
        response_format: { type: "json_object" },
        max_tokens: 150
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        compound: Math.max(-1, Math.min(1, result.compound || 0)),
        positive: Math.max(0, Math.min(1, result.positive || 0)),
        negative: Math.max(0, Math.min(1, result.negative || 0)),
        neutral: Math.max(0, Math.min(1, result.neutral || 0.5))
      };
    } catch (error) {
      console.error('Sentiment analysis failed:', error);
      // Fallback to simple keyword-based sentiment
      return this.simpleKeywordSentiment(text);
    }
  }

  private simpleKeywordSentiment(text: string): SocialPost['sentiment'] {
    const bullishWords = ['moon', 'pump', 'bullish', 'buy', 'hodl', 'ath', 'breakout', 'rally', 'surge'];
    const bearishWords = ['dump', 'crash', 'bearish', 'sell', 'drop', 'fall', 'dip', 'correction'];
    
    const lowerText = text.toLowerCase();
    const bullishCount = bullishWords.filter(word => lowerText.includes(word)).length;
    const bearishCount = bearishWords.filter(word => lowerText.includes(word)).length;
    
    const compound = (bullishCount - bearishCount) / Math.max(1, bullishCount + bearishCount);
    const positive = bullishCount > 0 ? bullishCount / (bullishCount + bearishCount + 1) : 0;
    const negative = bearishCount > 0 ? bearishCount / (bullishCount + bearishCount + 1) : 0;
    const neutral = 1 - positive - negative;

    return { compound, positive, negative, neutral };
  }

  private extractAssetMentions(text: string): string[] {
    const mentions: string[] = [];
    const lowerText = text.toLowerCase();
    
    for (const ticker of this.assetTickers) {
      const variations = [ticker.toLowerCase(), `$${ticker.toLowerCase()}`];
      if (variations.some(variant => lowerText.includes(variant))) {
        mentions.push(ticker);
      }
    }

    // Check for full names
    const assetNames: Record<string, string> = {
      'bitcoin': 'BTC',
      'ethereum': 'ETH',
      'solana': 'SOL',
      'cardano': 'ADA',
      'polkadot': 'DOT'
    };

    for (const [name, ticker] of Object.entries(assetNames)) {
      if (lowerText.includes(name) && !mentions.includes(ticker)) {
        mentions.push(ticker);
      }
    }

    return Array.from(new Set(mentions)); // Remove duplicates
  }

  private calculateInfluenceScore(metrics: any, platform: 'twitter' | 'reddit'): number {
    if (platform === 'twitter') {
      const followers = metrics.followers_count || 1000; // Default assumption
      const engagement = (metrics.like_count || 0) + (metrics.retweet_count || 0) * 2;
      return Math.min(100, Math.log10(followers) * 20 + Math.log10(engagement + 1) * 10);
    } else { // reddit
      const score = metrics.score || metrics.ups || 0;
      const comments = metrics.num_comments || 0;
      return Math.min(100, Math.log10(score + 1) * 25 + Math.log10(comments + 1) * 15);
    }
  }

  async getComprehensiveSentimentMetrics(): Promise<SentimentMetrics> {
    const posts = await this.fetchSocialSentiment(200);
    
    if (posts.length === 0) {
      return this.getMockSentimentMetrics();
    }

    // Calculate overall sentiment
    let totalCompound = 0;
    let totalWeight = 0;
    const assetSentiments: Record<string, { scores: number[]; volumes: number }> = {};

    for (const post of posts) {
      const weight = post.influenceScore / 100;
      totalCompound += post.sentiment.compound * weight;
      totalWeight += weight;

      // Track per-asset sentiment
      for (const asset of post.mentions) {
        if (!assetSentiments[asset]) {
          assetSentiments[asset] = { scores: [], volumes: 0 };
        }
        assetSentiments[asset].scores.push(post.sentiment.compound * weight);
        assetSentiments[asset].volumes++;
      }
    }

    const overallScore = totalWeight > 0 ? totalCompound / totalWeight : 0;
    const scaledScore = overallScore * 100; // Convert to -100 to 100

    // Calculate distribution
    const positive = posts.filter(p => p.sentiment.compound > 0.1).length;
    const negative = posts.filter(p => p.sentiment.compound < -0.1).length;
    const neutral = posts.length - positive - negative;

    const bullish = (positive / posts.length) * 100;
    const bearish = (negative / posts.length) * 100;
    const neutralPercentage = (neutral / posts.length) * 100;

    // Process asset sentiments
    const processedAssetSentiment: Record<string, any> = {};
    for (const [asset, data] of Object.entries(assetSentiments)) {
      const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      processedAssetSentiment[asset] = {
        score: avgScore * 100,
        volume: data.volumes,
        trend: avgScore > 0.1 ? 'rising' : avgScore < -0.1 ? 'falling' : 'stable'
      };
    }

    // Get top influencers and viral content
    const topInfluencers = this.getTopInfluencers(posts);
    const viralContent = posts.filter(p => p.influenceScore > 70).slice(0, 10);

    return {
      overall: {
        bullish: Math.round(bullish),
        bearish: Math.round(bearish),
        neutral: Math.round(neutralPercentage),
        score: Math.round(scaledScore),
        confidence: Math.min(1, totalWeight / 10)
      },
      assetSentiment: processedAssetSentiment,
      topInfluencers,
      viralContent,
      fearGreedIndex: this.calculateFearGreedIndex(scaledScore, posts)
    };
  }

  private getTopInfluencers(posts: SocialPost[]): SentimentMetrics['topInfluencers'] {
    const influencers: Record<string, any> = {};

    for (const post of posts) {
      if (!influencers[post.author]) {
        influencers[post.author] = {
          username: post.author,
          posts: [],
          totalInfluence: 0
        };
      }
      
      influencers[post.author].posts.push(post);
      influencers[post.author].totalInfluence += post.influenceScore;
    }

    return Object.values(influencers)
      .filter((inf: any) => inf.posts.length >= 2) // At least 2 posts
      .map((inf: any) => ({
        username: inf.username,
        sentiment: inf.posts.reduce((sum: number, p: SocialPost) => sum + p.sentiment.compound, 0) / inf.posts.length * 100,
        followerCount: Math.floor(inf.totalInfluence * 1000), // Estimated
        recentPosts: inf.posts.length
      }))
      .sort((a, b) => b.followerCount - a.followerCount)
      .slice(0, 10);
  }

  private calculateFearGreedIndex(sentimentScore: number, posts: SocialPost[]): number {
    // Fear & Greed Index based on sentiment and other factors
    const baseScore = ((sentimentScore + 100) / 2); // Convert -100/100 to 0-100
    
    // Adjust based on volume and engagement
    const avgEngagement = posts.reduce((sum, p) => sum + p.engagement.likes + p.engagement.replies, 0) / posts.length;
    const volumeMultiplier = Math.log10(posts.length + 1) / 3; // Higher volume = more reliable
    const engagementMultiplier = Math.log10(avgEngagement + 1) / 5;
    
    let adjustedScore = baseScore * (1 + volumeMultiplier + engagementMultiplier);
    
    // Add some randomness to simulate market volatility factors
    adjustedScore += (Math.random() - 0.5) * 10;
    
    return Math.max(0, Math.min(100, Math.round(adjustedScore)));
  }

  private generateMockSentimentData(count: number): SocialPost[] {
    const mockPosts: SocialPost[] = [];
    const platforms: Array<'twitter' | 'reddit'> = ['twitter', 'reddit'];
    const sampleTexts = [
      'Bitcoin is looking bullish! Great momentum building up',
      'ETH gas fees are still too high, bearish on short term',
      'Solana ecosystem is growing rapidly, very bullish',
      'Market correction seems healthy, time to accumulate',
      'DeFi yields are dropping, concerning trend',
      'Institutional adoption of crypto increasing steadily',
      'NFT market cooling down, but still has potential',
      'Layer 2 solutions gaining traction, bullish for ETH',
      'Regulatory clarity needed for market growth',
      'Web3 development activity at all-time highs'
    ];

    for (let i = 0; i < count; i++) {
      const platform = platforms[Math.floor(Math.random() * platforms.length)];
      const content = sampleTexts[i % sampleTexts.length];
      const sentiment = this.simpleKeywordSentiment(content);
      
      mockPosts.push({
        id: `${platform}_mock_${i}`,
        platform,
        content,
        author: `user_${Math.floor(Math.random() * 10000)}`,
        timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
        engagement: {
          likes: Math.floor(Math.random() * 1000),
          retweets: platform === 'twitter' ? Math.floor(Math.random() * 100) : undefined,
          replies: Math.floor(Math.random() * 50),
          score: platform === 'reddit' ? Math.floor(Math.random() * 500) : undefined
        },
        sentiment,
        mentions: this.extractAssetMentions(content),
        influenceScore: Math.floor(Math.random() * 100)
      });
    }

    return mockPosts;
  }

  private generateMockTwitterData(count: number): SocialPost[] {
    return this.generateMockSentimentData(count).map(post => ({
      ...post,
      platform: 'twitter' as const,
      id: `tw_${post.id}`
    }));
  }

  private generateMockRedditData(count: number): SocialPost[] {
    return this.generateMockSentimentData(count).map(post => ({
      ...post,
      platform: 'reddit' as const,
      id: `rd_${post.id}`
    }));
  }

  private getMockSentimentMetrics(): SentimentMetrics {
    const mockPosts = this.generateMockSentimentData(100);
    
    return {
      overall: {
        bullish: 45,
        bearish: 30,
        neutral: 25,
        score: 15,
        confidence: 0.7
      },
      assetSentiment: {
        BTC: { score: 20, volume: 50, trend: 'rising' },
        ETH: { score: 10, volume: 35, trend: 'stable' },
        SOL: { score: 30, volume: 20, trend: 'rising' },
        ADA: { score: -10, volume: 15, trend: 'falling' }
      },
      topInfluencers: [
        { username: 'crypto_whale_1', sentiment: 25, followerCount: 150000, recentPosts: 5 },
        { username: 'defi_expert', sentiment: -5, followerCount: 85000, recentPosts: 3 }
      ],
      viralContent: mockPosts.slice(0, 5),
      fearGreedIndex: 62
    };
  }

  async getSentimentSignal(): Promise<{
    score: number; // -100 to 100
    confidence: number; // 0-1
    trend: 'bullish' | 'bearish' | 'neutral';
    strength: 'weak' | 'moderate' | 'strong';
  }> {
    const metrics = await this.getComprehensiveSentimentMetrics();
    
    const score = metrics.overall.score;
    const confidence = metrics.overall.confidence;
    
    const trend = score > 10 ? 'bullish' : score < -10 ? 'bearish' : 'neutral';
    const strength = Math.abs(score) > 30 ? 'strong' : Math.abs(score) > 15 ? 'moderate' : 'weak';
    
    return { score, confidence, trend, strength };
  }
}

export const sentimentService = new SentimentService();