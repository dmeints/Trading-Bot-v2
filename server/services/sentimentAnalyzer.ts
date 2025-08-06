import axios from 'axios';
import { storage } from '../storage';
import type { InsertSentimentData } from '@shared/schema';

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
    this.sources.set('twitter', new TwitterSentimentSource());
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
    try {
      // In a real implementation, this would use Reddit API or a sentiment service
      // For now, we'll simulate based on symbol popularity
      const popularCoins = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT'];
      const cleanSymbol = symbol.split('/')[0]; // Remove /USD
      
      if (popularCoins.includes(cleanSymbol)) {
        // Simulate positive sentiment for popular coins
        return {
          sentiment: Math.random() * 0.4 + 0.1, // 0.1 to 0.5
          confidence: 0.6,
          volume: Math.floor(Math.random() * 1000) + 100,
          source: 'reddit',
          data: { 
            posts: Math.floor(Math.random() * 50) + 10,
            comments: Math.floor(Math.random() * 500) + 100,
            simulation: true 
          }
        };
      }
      
      return {
        sentiment: Math.random() * 0.2 - 0.1, // -0.1 to 0.1
        confidence: 0.4,
        volume: Math.floor(Math.random() * 100) + 10,
        source: 'reddit',
        data: { 
          posts: Math.floor(Math.random() * 20) + 5,
          comments: Math.floor(Math.random() * 100) + 20,
          simulation: true 
        }
      };
    } catch (error) {
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

class TwitterSentimentSource extends SentimentSource {
  async getSentiment(symbol: string): Promise<SentimentResult> {
    try {
      // Simulate Twitter sentiment analysis
      const cleanSymbol = symbol.split('/')[0];
      const majorCoins = ['BTC', 'ETH'];
      
      let baseSentiment = 0;
      let volume = 0;
      
      if (majorCoins.includes(cleanSymbol)) {
        baseSentiment = Math.random() * 0.6 - 0.3; // -0.3 to 0.3
        volume = Math.floor(Math.random() * 5000) + 1000;
      } else {
        baseSentiment = Math.random() * 0.4 - 0.2; // -0.2 to 0.2
        volume = Math.floor(Math.random() * 1000) + 100;
      }
      
      return {
        sentiment: baseSentiment,
        confidence: 0.5,
        volume,
        source: 'twitter',
        data: { 
          tweets: volume,
          retweets: Math.floor(volume * 0.3),
          mentions: Math.floor(volume * 1.2),
          simulation: true 
        }
      };
    } catch (error) {
      return {
        sentiment: 0,
        confidence: 0,
        volume: 0,
        source: 'twitter',
        data: { error: String(error) }
      };
    }
  }
}

class NewsSentimentSource extends SentimentSource {
  async getSentiment(symbol: string): Promise<SentimentResult> {
    try {
      // Simulate news sentiment analysis
      const cleanSymbol = symbol.split('/')[0];
      
      // Simulate news events affecting sentiment
      const newsEvents = [
        { type: 'regulatory', sentiment: -0.3, confidence: 0.8 },
        { type: 'adoption', sentiment: 0.5, confidence: 0.7 },
        { type: 'technical', sentiment: 0.2, confidence: 0.6 },
        { type: 'partnership', sentiment: 0.4, confidence: 0.7 },
        { type: 'market', sentiment: -0.1, confidence: 0.5 }
      ];
      
      const randomEvent = newsEvents[Math.floor(Math.random() * newsEvents.length)];
      
      return {
        sentiment: randomEvent.sentiment + (Math.random() * 0.2 - 0.1),
        confidence: randomEvent.confidence,
        volume: Math.floor(Math.random() * 20) + 5,
        source: 'news',
        data: { 
          eventType: randomEvent.type,
          articles: Math.floor(Math.random() * 20) + 5,
          simulation: true 
        }
      };
    } catch (error) {
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