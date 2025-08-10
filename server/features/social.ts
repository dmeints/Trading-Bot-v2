/**
 * Social Sentiment Features
 * Advanced social media and community sentiment analysis
 */

export interface SocialFeatures {
  sentiment_score: number; // -1 to 1, negative = bearish, positive = bullish
  z: number; // Z-score relative to recent history
  confidence: number; // 0-1, confidence in the sentiment signal
  volume: number; // Social volume/mentions
  spike: boolean; // Whether there's a sentiment spike
  sources: {
    twitter_sentiment: number;
    reddit_sentiment: number; 
    news_sentiment: number;
    fear_greed_index: number;
  };
}

/**
 * Calculate comprehensive social sentiment features
 */
export async function calculateSocial(
  symbol: string,
  startTime: Date,
  endTime: Date
): Promise<SocialFeatures | null> {
  try {
    console.log(`[Social] Calculating sentiment for ${symbol}`);
    
    // Extract base symbol (e.g., BTC from BTC/USD)
    const baseSymbol = symbol.split('/')[0].toLowerCase();
    
    // Get social data from multiple sources (this would integrate with real APIs)
    const socialData = await aggregateSocialData(baseSymbol, startTime, endTime);
    
    if (!socialData) {
      console.log(`[Social] No social data available for ${symbol}`);
      return null;
    }
    
    // Calculate sentiment metrics
    const sentiment_score = calculateAggregatedSentiment(socialData);
    const z = calculateSentimentZScore(sentiment_score, socialData.historical);
    const confidence = calculateSentimentConfidence(socialData);
    const volume = socialData.totalVolume || 0;
    const spike = detectSentimentSpike(socialData);
    
    const result: SocialFeatures = {
      sentiment_score: Math.round(sentiment_score * 1000) / 1000,
      z: Math.round(z * 1000) / 1000,
      confidence: Math.round(confidence * 1000) / 1000,
      volume,
      spike,
      sources: {
        twitter_sentiment: socialData.twitter || 0,
        reddit_sentiment: socialData.reddit || 0,
        news_sentiment: socialData.news || 0,
        fear_greed_index: socialData.fearGreed || 50
      }
    };
    
    console.log(`[Social] Calculated for ${symbol}: sentiment=${result.sentiment_score}, z=${result.z}, confidence=${result.confidence}`);
    
    return result;
    
  } catch (error) {
    console.error(`[Social] Error calculating for ${symbol}:`, error);
    return null;
  }
}

/**
 * Aggregate social data from multiple sources
 * In production, this would call real APIs with proper authentication
 */
async function aggregateSocialData(symbol: string, startTime: Date, endTime: Date): Promise<any> {
  // This is a placeholder for real social data aggregation
  // In production, this would:
  // 1. Call Twitter API v2 for tweets mentioning the symbol
  // 2. Call Reddit API for relevant posts and comments
  // 3. Aggregate news sentiment from multiple sources
  // 4. Get Fear & Greed Index or similar market sentiment indicators
  
  // For now, return simulated data structure that represents real data patterns
  const timeHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
  
  // Simulate data that would come from real APIs
  const mockData = {
    twitter: Math.sin(Date.now() / (1000 * 60 * 60 * 24)) * 0.3 + Math.random() * 0.4 - 0.2,
    reddit: Math.cos(Date.now() / (1000 * 60 * 60 * 12)) * 0.2 + Math.random() * 0.3 - 0.15,
    news: (Math.random() - 0.5) * 0.6,
    fearGreed: 45 + Math.sin(Date.now() / (1000 * 60 * 60 * 24 * 7)) * 15 + Math.random() * 10,
    totalVolume: Math.max(100, Math.random() * 5000),
    historical: Array.from({length: 24}, () => Math.random() - 0.5),
    timestamps: []
  };
  
  console.log(`[Social] Aggregated social data for ${symbol}: Twitter=${mockData.twitter.toFixed(3)}, Reddit=${mockData.reddit.toFixed(3)}, Volume=${mockData.totalVolume}`);
  
  return mockData;
}

/**
 * Calculate weighted sentiment score from multiple sources
 */
function calculateAggregatedSentiment(socialData: any): number {
  const weights = {
    twitter: 0.4,  // Twitter has high influence
    reddit: 0.3,   // Reddit community sentiment
    news: 0.2,     // News sentiment
    fearGreed: 0.1 // General market sentiment
  };
  
  // Normalize fear & greed index from 0-100 to -1 to 1
  const normalizedFearGreed = (socialData.fearGreed - 50) / 50;
  
  const weightedSentiment = 
    (socialData.twitter * weights.twitter) +
    (socialData.reddit * weights.reddit) +
    (socialData.news * weights.news) +
    (normalizedFearGreed * weights.fearGreed);
  
  // Ensure result is within [-1, 1] range
  return Math.max(-1, Math.min(1, weightedSentiment));
}

/**
 * Calculate Z-score relative to recent sentiment history
 */
function calculateSentimentZScore(currentSentiment: number, historicalData: number[]): number {
  if (!historicalData || historicalData.length < 5) {
    return 0; // Can't calculate Z-score without sufficient history
  }
  
  const mean = historicalData.reduce((sum, val) => sum + val, 0) / historicalData.length;
  const variance = historicalData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalData.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return 0;
  
  return (currentSentiment - mean) / stdDev;
}

/**
 * Calculate confidence in sentiment signal
 */
function calculateSentimentConfidence(socialData: any): number {
  // Base confidence
  let confidence = 0.5;
  
  // Higher volume increases confidence
  const volumeScore = Math.min(1, socialData.totalVolume / 1000);
  confidence += volumeScore * 0.3;
  
  // Agreement across sources increases confidence
  const sentiments = [socialData.twitter, socialData.reddit, socialData.news];
  const avgSentiment = sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length;
  const disagreement = sentiments.reduce((sum, s) => sum + Math.abs(s - avgSentiment), 0) / sentiments.length;
  
  // Lower disagreement = higher confidence
  const agreementScore = Math.max(0, 1 - disagreement * 2);
  confidence += agreementScore * 0.2;
  
  // Ensure confidence is within [0, 1] range
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Detect sentiment spikes (rapid changes in sentiment)
 */
function detectSentimentSpike(socialData: any): boolean {
  if (!socialData.historical || socialData.historical.length < 5) {
    return false;
  }
  
  const recentSentiment = calculateAggregatedSentiment(socialData);
  const recentHistory = socialData.historical.slice(-5);
  const avgRecent = recentHistory.reduce((sum, val) => sum + val, 0) / recentHistory.length;
  
  // Spike if current sentiment is significantly different from recent average
  const threshold = 0.3; // Adjust sensitivity
  return Math.abs(recentSentiment - avgRecent) > threshold;
}

/**
 * Get sentiment for specific social media platform
 */
export async function getPlatformSentiment(
  platform: 'twitter' | 'reddit' | 'news',
  symbol: string,
  timeRange: { start: Date; end: Date }
): Promise<number | null> {
  try {
    const socialData = await aggregateSocialData(symbol, timeRange.start, timeRange.end);
    
    if (!socialData) return null;
    
    switch (platform) {
      case 'twitter':
        return socialData.twitter;
      case 'reddit':
        return socialData.reddit;
      case 'news':
        return socialData.news;
      default:
        return null;
    }
  } catch (error) {
    console.error(`[Social] Error getting ${platform} sentiment for ${symbol}:`, error);
    return null;
  }
}

/**
 * Analyze sentiment trend over time
 */
export async function analyzeSentimentTrend(
  symbol: string,
  hours: number = 24
): Promise<{
  trend: 'increasing' | 'decreasing' | 'stable';
  strength: number; // 0-1, strength of the trend
  inflectionPoints: number; // Number of sentiment direction changes
} | null> {
  try {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);
    
    // Get hourly sentiment data points
    const sentimentHistory: number[] = [];
    const hoursToAnalyze = Math.min(hours, 48); // Limit to 48 hours
    
    for (let i = 0; i < hoursToAnalyze; i++) {
      const hourStart = new Date(endTime.getTime() - (i + 1) * 60 * 60 * 1000);
      const hourEnd = new Date(endTime.getTime() - i * 60 * 60 * 1000);
      
      const socialData = await aggregateSocialData(symbol, hourStart, hourEnd);
      if (socialData) {
        sentimentHistory.unshift(calculateAggregatedSentiment(socialData));
      }
    }
    
    if (sentimentHistory.length < 5) {
      return null;
    }
    
    // Calculate trend using linear regression
    const n = sentimentHistory.length;
    const x = Array.from({length: n}, (_, i) => i);
    const y = sentimentHistory;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Determine trend direction
    let trend: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(slope) < 0.01) {
      trend = 'stable';
    } else if (slope > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }
    
    // Calculate trend strength (0-1)
    const strength = Math.min(1, Math.abs(slope) * 10);
    
    // Count inflection points (direction changes)
    let inflectionPoints = 0;
    for (let i = 2; i < sentimentHistory.length; i++) {
      const prev = sentimentHistory[i-2];
      const curr = sentimentHistory[i-1];
      const next = sentimentHistory[i];
      
      const slope1 = curr - prev;
      const slope2 = next - curr;
      
      if ((slope1 > 0 && slope2 < 0) || (slope1 < 0 && slope2 > 0)) {
        inflectionPoints++;
      }
    }
    
    return {
      trend,
      strength: Math.round(strength * 1000) / 1000,
      inflectionPoints
    };
    
  } catch (error) {
    console.error(`[Social] Error analyzing sentiment trend for ${symbol}:`, error);
    return null;
  }
}