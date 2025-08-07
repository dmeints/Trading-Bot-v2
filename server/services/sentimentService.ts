import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger";

export interface SentimentData {
  id: string;
  date: string;
  score: number;
  source: 'reddit' | 'twitter' | 'news' | 'aggregate';
  token?: string;
  metadata: {
    positive_mentions?: number;
    negative_mentions?: number;
    neutral_mentions?: number;
    total_mentions?: number;
    trending_keywords?: string[];
  };
}

export class SentimentService {
  private static instance: SentimentService;
  private isInitialized = false;

  static getInstance(): SentimentService {
    if (!SentimentService.instance) {
      SentimentService.instance = new SentimentService();
    }
    return SentimentService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('Initializing Sentiment Service');
      await this.ensureSentimentTables();
      this.isInitialized = true;
      logger.info('Sentiment Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Sentiment Service', { error });
      throw error;
    }
  }

  private async ensureSentimentTables(): Promise<void> {
    try {
      // Create daily_sentiment table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS daily_sentiment (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          date DATE NOT NULL,
          score DECIMAL(5, 4) NOT NULL CHECK (score >= -1 AND score <= 1),
          source VARCHAR NOT NULL CHECK (source IN ('reddit', 'twitter', 'news', 'aggregate')),
          token VARCHAR,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(date, source, token)
        )
      `);

      // Create indexes
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_daily_sentiment_date ON daily_sentiment(date);
        CREATE INDEX IF NOT EXISTS idx_daily_sentiment_source ON daily_sentiment(source);
        CREATE INDEX IF NOT EXISTS idx_daily_sentiment_token ON daily_sentiment(token);
      `);

      logger.info('Sentiment tables ensured');
    } catch (error) {
      logger.error('Failed to ensure sentiment tables', { error });
      throw error;
    }
  }

  async fetchDailySentiment(): Promise<SentimentData[]> {
    try {
      logger.info('Fetching daily sentiment data');

      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      
      // Mock sentiment data for demo (would connect to real sentiment APIs)
      const mockSentimentData = [
        {
          date: today.toISOString().split('T')[0],
          score: Math.random() * 0.6 - 0.3, // -0.3 to 0.3
          source: 'reddit' as const,
          token: 'BTC',
          metadata: {
            positive_mentions: Math.floor(Math.random() * 500) + 200,
            negative_mentions: Math.floor(Math.random() * 300) + 100,
            neutral_mentions: Math.floor(Math.random() * 800) + 400,
            total_mentions: 0,
            trending_keywords: ['bitcoin', 'hodl', 'moon', 'dip']
          }
        },
        {
          date: today.toISOString().split('T')[0],
          score: Math.random() * 0.4 - 0.2, // -0.2 to 0.2
          source: 'twitter' as const,
          token: 'ETH',
          metadata: {
            positive_mentions: Math.floor(Math.random() * 400) + 150,
            negative_mentions: Math.floor(Math.random() * 250) + 80,
            neutral_mentions: Math.floor(Math.random() * 600) + 300,
            total_mentions: 0,
            trending_keywords: ['ethereum', 'defi', 'gas', 'merge']
          }
        },
        {
          date: today.toISOString().split('T')[0],
          score: Math.random() * 0.8 - 0.4, // -0.4 to 0.4
          source: 'news' as const,
          metadata: {
            positive_mentions: Math.floor(Math.random() * 200) + 50,
            negative_mentions: Math.floor(Math.random() * 150) + 30,
            neutral_mentions: Math.floor(Math.random() * 300) + 100,
            total_mentions: 0,
            trending_keywords: ['crypto', 'regulation', 'adoption', 'innovation']
          }
        },
        {
          date: yesterday.toISOString().split('T')[0],
          score: Math.random() * 0.6 - 0.3,
          source: 'aggregate' as const,
          metadata: {
            total_mentions: Math.floor(Math.random() * 10000) + 5000,
            trending_keywords: ['crypto', 'bitcoin', 'market', 'trading']
          }
        }
      ];

      const sentimentData: SentimentData[] = mockSentimentData.map(data => {
        // Calculate total mentions
        if (data.metadata.positive_mentions) {
          data.metadata.total_mentions = 
            (data.metadata.positive_mentions || 0) + 
            (data.metadata.negative_mentions || 0) + 
            (data.metadata.neutral_mentions || 0);
        }

        return {
          id: `sentiment_${Date.now()}_${Math.random()}`,
          ...data
        };
      });

      // Store sentiment data in database
      for (const sentiment of sentimentData) {
        await db.execute(sql`
          INSERT INTO daily_sentiment (
            id, date, score, source, token, metadata
          ) VALUES (
            ${sentiment.id}, ${sentiment.date}, ${sentiment.score}, 
            ${sentiment.source}, ${sentiment.token || null}, ${JSON.stringify(sentiment.metadata)}
          ) ON CONFLICT (date, source, token) DO UPDATE SET
            score = EXCLUDED.score,
            metadata = EXCLUDED.metadata
        `);
      }

      logger.info('Daily sentiment data fetched and stored', { count: sentimentData.length });
      return sentimentData;
    } catch (error) {
      logger.error('Failed to fetch daily sentiment', { error });
      throw error;
    }
  }

  async getRecentSentiment(days: number = 7): Promise<SentimentData[]> {
    try {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);
      
      const result = await db.execute(sql`
        SELECT * FROM daily_sentiment 
        WHERE date >= ${sinceDate.toISOString().split('T')[0]}
        ORDER BY date DESC, source ASC
      `);

      return result.rows.map(row => ({
        id: row.id as string,
        date: row.date as string,
        score: Number(row.score),
        source: row.source as 'reddit' | 'twitter' | 'news' | 'aggregate',
        token: row.token as string || undefined,
        metadata: row.metadata as SentimentData['metadata']
      }));
    } catch (error) {
      logger.error('Failed to get recent sentiment', { error });
      throw error;
    }
  }

  async getSentimentByToken(token: string, days: number = 30): Promise<SentimentData[]> {
    try {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);
      
      const result = await db.execute(sql`
        SELECT * FROM daily_sentiment 
        WHERE token = ${token} AND date >= ${sinceDate.toISOString().split('T')[0]}
        ORDER BY date DESC
      `);

      return result.rows.map(row => ({
        id: row.id as string,
        date: row.date as string,
        score: Number(row.score),
        source: row.source as 'reddit' | 'twitter' | 'news' | 'aggregate',
        token: row.token as string,
        metadata: row.metadata as SentimentData['metadata']
      }));
    } catch (error) {
      logger.error('Failed to get sentiment by token', { error, token });
      throw error;
    }
  }

  async getAggregatedSentiment(days: number = 7): Promise<{ date: string; score: number; volume: number }[]> {
    try {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);
      
      const result = await db.execute(sql`
        SELECT 
          date,
          AVG(score) as avg_score,
          SUM((metadata->>'total_mentions')::int) as total_volume
        FROM daily_sentiment 
        WHERE date >= ${sinceDate.toISOString().split('T')[0]}
          AND metadata->>'total_mentions' IS NOT NULL
        GROUP BY date
        ORDER BY date DESC
      `);

      return result.rows.map(row => ({
        date: row.date as string,
        score: Number(row.avg_score),
        volume: Number(row.total_volume) || 0
      }));
    } catch (error) {
      logger.error('Failed to get aggregated sentiment', { error });
      throw error;
    }
  }
}

export const sentimentService = SentimentService.getInstance();