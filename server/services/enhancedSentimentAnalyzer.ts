import axios from 'axios';
import { logger } from '../utils/logger.js';
import { apiGuardrailManager } from '../middleware/apiGuardrails.js';

// Enhanced sentiment analyzer with guardrail protection
export class EnhancedSentimentAnalyzer {

  // Reddit sentiment analysis with guardrail protection
  async getRedditSentiment(symbol: string): Promise<any> {
    const clientId = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      logger.warn('[Reddit] API credentials not provided - sentiment analysis disabled');
      return {
        sentiment: 0,
        confidence: 0,
        volume: 0,
        source: 'reddit',
        error: 'Reddit API credentials not configured'
      };
    }

    // Check guardrails before making request
    if (!apiGuardrailManager.canMakeRequest('reddit')) {
      const stats = apiGuardrailManager.getStats('reddit');
      logger.warn('[Reddit] Request blocked by guardrails', {
        symbol,
        remaining: stats?.remaining,
        resetTime: stats?.resetTime
      });
      
      return {
        sentiment: 0,
        confidence: 0,
        volume: 0,
        source: 'reddit',
        error: 'Rate limit protection active',
        rateLimited: true,
        retryAfter: stats?.resetTime
      };
    }

    try {
      // Get Reddit OAuth token
      const authResponse = await axios.post('https://www.reddit.com/api/v1/access_token', 
        'grant_type=client_credentials',
        {
          auth: {
            username: clientId,
            password: clientSecret
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'SkippyTrading/1.0.0'
          }
        }
      );

      const accessToken = authResponse.data.access_token;
      
      // Search relevant subreddits for cryptocurrency discussions
      const subreddits = ['cryptocurrency', 'bitcoin', 'ethtrader', 'cryptomarkets'];
      const cleanSymbol = symbol.split('/')[0].toLowerCase();
      
      const searchPromises = subreddits.map(subreddit =>
        axios.get(`https://oauth.reddit.com/r/${subreddit}/search`, {
          params: {
            q: cleanSymbol,
            sort: 'new',
            limit: 25,
            t: 'day'
          },
          headers: {
            'Authorization': `bearer ${accessToken}`,
            'User-Agent': 'SkippyTrading/1.0.0'
          }
        }).catch(error => {
          logger.warn(`[Reddit] Error searching r/${subreddit}:`, error.message);
          return null;
        })
      );

      const results = await Promise.all(searchPromises);
      
      // Record successful API usage
      apiGuardrailManager.recordUsage('reddit');
      
      let totalSentiment = 0;
      let totalPosts = 0;
      let totalScore = 0;

      for (const result of results) {
        if (!result?.data?.data?.children) continue;

        for (const post of result.data.data.children) {
          const postData = post.data;
          const title = (postData.title || '').toLowerCase();
          const selftext = (postData.selftext || '').toLowerCase();
          const combined = `${title} ${selftext}`;

          // Enhanced sentiment analysis for Reddit posts
          const positiveWords = ['bullish', 'moon', 'hodl', 'buy', 'pump', 'gains', 'profit', 'rocket', 'diamond', 'hands'];
          const negativeWords = ['bearish', 'dump', 'sell', 'crash', 'bear', 'rekt', 'loss', 'paper', 'hands', 'fear'];
          
          let sentiment = 0;
          positiveWords.forEach(word => {
            if (combined.includes(word)) sentiment += 1;
          });
          negativeWords.forEach(word => {
            if (combined.includes(word)) sentiment -= 1;
          });
          
          // Weight by post score (upvotes - downvotes)
          const score = Math.max(1, postData.score || 1);
          totalSentiment += sentiment * Math.log(score);
          totalScore += score;
          totalPosts++;
        }
      }

      const avgSentiment = totalPosts > 0 ? totalSentiment / totalPosts : 0;
      const normalizedSentiment = Math.max(-1, Math.min(1, avgSentiment / 3));
      const confidence = Math.min(0.8, totalPosts / 50);

      logger.info('[Reddit] Sentiment analysis completed', {
        symbol,
        posts: totalPosts,
        sentiment: normalizedSentiment,
        confidence,
        quotaRemaining: apiGuardrailManager.getStats('reddit')?.remaining
      });

      return {
        sentiment: normalizedSentiment,
        confidence,
        volume: totalPosts,
        source: 'reddit',
        data: {
          posts: totalPosts,
          totalScore,
          avgSentiment
        }
      };

    } catch (error) {
      logger.error('[Reddit] API error:', error);
      
      // Still record usage even on error (API call was made)
      apiGuardrailManager.recordUsage('reddit');
      
      return {
        sentiment: 0,
        confidence: 0,
        volume: 0,
        source: 'reddit',
        error: String(error)
      };
    }
  }

  // Enhanced news sentiment with CryptoPanic guardrails
  async getCryptoPanicSentiment(symbol: string): Promise<any> {
    const apiKey = process.env.CRYPTO_PANIC_API_KEY;
    
    if (!apiKey) {
      logger.warn('[CryptoPanic] API key not provided - news sentiment analysis disabled');
      return {
        sentiment: 0,
        confidence: 0,
        volume: 0,
        source: 'cryptopanic',
        error: 'CryptoPanic API key not configured'
      };
    }

    // Check guardrails before making request
    if (!apiGuardrailManager.canMakeRequest('cryptopanic')) {
      const stats = apiGuardrailManager.getStats('cryptopanic');
      logger.warn('[CryptoPanic] Request blocked by guardrails', {
        symbol,
        remaining: stats?.remaining,
        resetTime: stats?.resetTime
      });
      
      return {
        sentiment: 0,
        confidence: 0,
        volume: 0,
        source: 'cryptopanic',
        error: 'Rate limit protection active',
        rateLimited: true,
        retryAfter: stats?.resetTime
      };
    }

    try {
      const cleanSymbol = symbol.split('/')[0];
      
      const response = await axios.get('https://cryptopanic.com/api/v1/posts/', {
        params: {
          auth_token: apiKey,
          currencies: cleanSymbol,
          filter: 'hot',
          kind: 'news'
        }
      });

      // Record successful API usage
      apiGuardrailManager.recordUsage('cryptopanic');

      if (response.data?.results) {
        const articles = response.data.results;
        let totalSentiment = 0;
        let totalVotes = 0;

        for (const article of articles) {
          const title = (article.title || '').toLowerCase();
          
          // Use voting data for sentiment
          const positiveVotes = article.votes?.positive || 0;
          const negativeVotes = article.votes?.negative || 0;
          const important = article.votes?.important || 0;
          
          // Calculate sentiment from voting patterns
          const voteSentiment = positiveVotes > 0 ? 1 : 
                              negativeVotes > 0 ? -1 : 0;
          
          // Weight by total engagement
          const totalEngagement = positiveVotes + negativeVotes + important;
          totalSentiment += voteSentiment * Math.log(totalEngagement + 1);
          totalVotes += totalEngagement;
        }

        const avgSentiment = articles.length > 0 ? totalSentiment / articles.length : 0;
        const normalizedSentiment = Math.max(-1, Math.min(1, avgSentiment / 2));
        const confidence = Math.min(0.9, articles.length / 20);

        logger.info('[CryptoPanic] News sentiment analysis completed', {
          symbol,
          articles: articles.length,
          sentiment: normalizedSentiment,
          confidence,
          quotaRemaining: apiGuardrailManager.getStats('cryptopanic')?.remaining
        });

        return {
          sentiment: normalizedSentiment,
          confidence,
          volume: articles.length,
          source: 'cryptopanic',
          data: {
            articles: articles.length,
            totalVotes,
            avgSentiment
          }
        };
      }

      return {
        sentiment: 0,
        confidence: 0,
        volume: 0,
        source: 'cryptopanic',
        error: 'No news data found'
      };

    } catch (error) {
      logger.error('[CryptoPanic] API error:', error);
      
      // Record usage even on error
      apiGuardrailManager.recordUsage('cryptopanic');
      
      return {
        sentiment: 0,
        confidence: 0,
        volume: 0,
        source: 'cryptopanic',
        error: String(error)
      };
    }
  }

  // Etherscan on-chain sentiment analysis with guardrails
  async getEtherscanOnChainSentiment(symbol: string): Promise<any> {
    if (!symbol.toLowerCase().includes('eth') && !symbol.toLowerCase().includes('ethereum')) {
      return {
        sentiment: 0,
        confidence: 0,
        volume: 0,
        source: 'etherscan',
        error: 'Only Ethereum-based analysis supported'
      };
    }

    const apiKey = process.env.ETHERSCAN_API_KEY;
    
    if (!apiKey) {
      logger.warn('[Etherscan] API key not provided - on-chain analysis disabled');
      return {
        sentiment: 0,
        confidence: 0,
        volume: 0,
        source: 'etherscan',
        error: 'Etherscan API key not configured'
      };
    }

    // Check guardrails before making request
    if (!apiGuardrailManager.canMakeRequest('etherscan')) {
      const stats = apiGuardrailManager.getStats('etherscan');
      logger.warn('[Etherscan] Request blocked by guardrails', {
        symbol,
        remaining: stats?.remaining,
        resetTime: stats?.resetTime
      });
      
      return {
        sentiment: 0,
        confidence: 0,
        volume: 0,
        source: 'etherscan',
        error: 'Rate limit protection active',
        rateLimited: true,
        retryAfter: stats?.resetTime
      };
    }

    try {
      // Get Ethereum network statistics for on-chain sentiment
      const [ethSupplyResponse, gasResponse] = await Promise.all([
        axios.get('https://api.etherscan.io/api', {
          params: {
            module: 'stats',
            action: 'ethsupply',
            apikey: apiKey
          }
        }),
        axios.get('https://api.etherscan.io/api', {
          params: {
            module: 'gastracker',
            action: 'gasoracle',
            apikey: apiKey
          }
        })
      ]);

      // Record successful API usage (2 calls made)
      apiGuardrailManager.recordUsage('etherscan');
      apiGuardrailManager.recordUsage('etherscan');

      const ethSupply = parseFloat(ethSupplyResponse.data.result) / Math.pow(10, 18);
      const gasData = gasResponse.data.result;
      
      // Derive sentiment from network activity
      // Lower gas prices = less congestion = potentially bearish
      // Higher gas prices = more activity = potentially bullish
      const safeLowGas = parseInt(gasData.SafeGasPrice);
      const proposeGas = parseInt(gasData.ProposeGasPrice);
      const fastGas = parseInt(gasData.FastGasPrice);
      
      // Calculate network congestion sentiment
      const avgGas = (safeLowGas + proposeGas + fastGas) / 3;
      
      // Normalize gas prices to sentiment (-1 to 1)
      // Higher gas = more activity = more positive sentiment
      const gasSentiment = Math.min(1, Math.max(-1, (avgGas - 20) / 50));
      
      const confidence = 0.3; // Lower confidence for indirect on-chain metrics
      
      logger.info('[Etherscan] On-chain sentiment analysis completed', {
        symbol,
        ethSupply,
        avgGasPrice: avgGas,
        sentiment: gasSentiment,
        confidence,
        quotaRemaining: apiGuardrailManager.getStats('etherscan')?.remaining
      });

      return {
        sentiment: gasSentiment,
        confidence,
        volume: 1,
        source: 'etherscan',
        data: {
          ethSupply,
          gasData,
          avgGasPrice: avgGas
        }
      };

    } catch (error) {
      logger.error('[Etherscan] API error:', error);
      
      // Record usage even on error
      apiGuardrailManager.recordUsage('etherscan');
      
      return {
        sentiment: 0,
        confidence: 0,
        volume: 0,
        source: 'etherscan',
        error: String(error)
      };
    }
  }

  // Comprehensive sentiment analysis with all protected sources
  async getComprehensiveSentiment(symbol: string): Promise<any> {
    logger.info('[Enhanced Sentiment] Starting comprehensive analysis with guardrails', { symbol });

    const [redditData, newsData, onChainData] = await Promise.all([
      this.getRedditSentiment(symbol),
      this.getCryptoPanicSentiment(symbol),
      this.getEtherscanOnChainSentiment(symbol)
    ]);

    // Calculate weighted average sentiment
    const sources = [redditData, newsData, onChainData].filter(data => 
      data.confidence > 0 && !data.rateLimited
    );

    if (sources.length === 0) {
      return {
        sentiment: 0,
        confidence: 0,
        volume: 0,
        sources: [redditData, newsData, onChainData],
        error: 'All sources rate limited or unavailable'
      };
    }

    const totalWeight = sources.reduce((sum, data) => sum + data.confidence, 0);
    const weightedSentiment = sources.reduce((sum, data) => 
      sum + (data.sentiment * data.confidence), 0) / totalWeight;

    const avgConfidence = totalWeight / sources.length;
    const totalVolume = sources.reduce((sum, data) => sum + data.volume, 0);

    const result = {
      sentiment: weightedSentiment,
      confidence: avgConfidence,
      volume: totalVolume,
      sources: [redditData, newsData, onChainData],
      activeSources: sources.length,
      timestamp: new Date().toISOString(),
      guardrailsActive: true,
      quotaStatus: apiGuardrailManager.getStats()
    };

    logger.info('[Enhanced Sentiment] Comprehensive analysis completed', {
      symbol,
      sentiment: weightedSentiment,
      confidence: avgConfidence,
      activeSources: sources.length,
      totalSources: 3
    });

    return result;
  }
}