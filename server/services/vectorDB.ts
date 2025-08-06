import OpenAI from 'openai';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface TradeVector {
  id: string;
  embedding: number[];
  metadata: {
    symbol: string;
    side: string;
    price: number;
    timestamp: string;
    pnl?: number;
    confidence?: number;
    reasoning?: string;
    market_conditions?: any;
  };
}

interface SimilarityResult {
  trade: TradeVector;
  similarity: number;
  context: string;
}

export class VectorDBService {
  private static instance: VectorDBService;
  
  static getInstance(): VectorDBService {
    if (!this.instance) {
      this.instance = new VectorDBService();
    }
    return this.instance;
  }

  /**
   * Generate embedding for trade context
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });
      
      return response.data[0].embedding;
    } catch (error) {
      logger.error('Failed to generate embedding', { error });
      throw error;
    }
  }

  /**
   * Index a completed trade for future similarity searches
   */
  async indexTrade(tradeData: {
    id: string;
    symbol: string;
    side: string;
    price: number;
    quantity: number;
    pnl?: number;
    confidence?: number;
    reasoning?: string;
    market_conditions?: any;
    timestamp: Date;
  }): Promise<void> {
    try {
      // Create contextual description for embedding
      const context = this.createTradeContext(tradeData);
      
      // Generate embedding
      const embedding = await this.generateEmbedding(context);
      
      // Store in database with vector
      await db.execute(sql`
        INSERT INTO trade_vectors (
          id, trade_id, embedding, context, metadata, created_at
        ) VALUES (
          gen_random_uuid(),
          ${tradeData.id},
          ${JSON.stringify(embedding)},
          ${context},
          ${JSON.stringify({
            symbol: tradeData.symbol,
            side: tradeData.side,
            price: tradeData.price,
            timestamp: tradeData.timestamp.toISOString(),
            pnl: tradeData.pnl,
            confidence: tradeData.confidence,
            reasoning: tradeData.reasoning,
            market_conditions: tradeData.market_conditions
          })},
          NOW()
        )
        ON CONFLICT (trade_id) DO UPDATE SET
          embedding = EXCLUDED.embedding,
          context = EXCLUDED.context,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `);
      
      logger.info('Trade indexed in vector DB', { tradeId: tradeData.id, symbol: tradeData.symbol });
    } catch (error) {
      logger.error('Failed to index trade', { error, tradeId: tradeData.id });
    }
  }

  /**
   * Find similar trading scenarios
   */
  async findSimilarTrades(
    query: string,
    limit: number = 5,
    minSimilarity: number = 0.7
  ): Promise<SimilarityResult[]> {
    try {
      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Perform vector similarity search using cosine similarity
      const results = await db.execute(sql`
        WITH similarity_scores AS (
          SELECT 
            tv.*,
            (
              SELECT 1 - (
                embedding <-> ${JSON.stringify(queryEmbedding)}::vector
              )
            ) as similarity
          FROM trade_vectors tv
          WHERE tv.embedding IS NOT NULL
        )
        SELECT *
        FROM similarity_scores
        WHERE similarity >= ${minSimilarity}
        ORDER BY similarity DESC
        LIMIT ${limit}
      `);
      
      return results.rows.map((row: any) => ({
        trade: {
          id: row.id,
          embedding: JSON.parse(row.embedding),
          metadata: JSON.parse(row.metadata)
        },
        similarity: parseFloat(row.similarity),
        context: row.context
      }));
      
    } catch (error) {
      logger.error('Failed to find similar trades', { error, query });
      return [];
    }
  }

  /**
   * Get contextual insights for a trading decision
   */
  async getContextualInsights(
    symbol: string,
    action: 'buy' | 'sell',
    currentPrice: number,
    marketConditions?: any
  ): Promise<{
    similar_scenarios: SimilarityResult[];
    recommendations: string[];
    risk_factors: string[];
  }> {
    try {
      const query = `Trading ${symbol} ${action} at ${currentPrice} with market conditions: ${JSON.stringify(marketConditions)}`;
      
      const similarTrades = await this.findSimilarTrades(query, 3, 0.6);
      
      // Analyze patterns from similar trades
      const recommendations: string[] = [];
      const riskFactors: string[] = [];
      
      if (similarTrades.length > 0) {
        const successfulTrades = similarTrades.filter(t => 
          t.trade.metadata.pnl && parseFloat(t.trade.metadata.pnl.toString()) > 0
        );
        
        const unsuccessfulTrades = similarTrades.filter(t => 
          t.trade.metadata.pnl && parseFloat(t.trade.metadata.pnl.toString()) <= 0
        );
        
        if (successfulTrades.length > unsuccessfulTrades.length) {
          recommendations.push('Historical data suggests this scenario has positive outcomes');
          recommendations.push(`${successfulTrades.length}/${similarTrades.length} similar trades were profitable`);
        } else {
          riskFactors.push('Similar scenarios have shown mixed or negative results');
          riskFactors.push(`Only ${successfulTrades.length}/${similarTrades.length} similar trades were profitable`);
        }
        
        // Extract common reasoning patterns
        const reasoningPatterns = similarTrades
          .map(t => t.trade.metadata.reasoning)
          .filter(Boolean);
          
        if (reasoningPatterns.length > 0) {
          recommendations.push('Consider: ' + reasoningPatterns.slice(0, 2).join(', '));
        }
      } else {
        riskFactors.push('No similar historical scenarios found - proceed with caution');
      }
      
      return {
        similar_scenarios: similarTrades,
        recommendations,
        risk_factors: riskFactors
      };
      
    } catch (error) {
      logger.error('Failed to get contextual insights', { error, symbol, action });
      return {
        similar_scenarios: [],
        recommendations: ['Unable to retrieve historical context'],
        risk_factors: ['Historical analysis unavailable']
      };
    }
  }

  /**
   * Create contextual description for a trade
   */
  private createTradeContext(tradeData: {
    symbol: string;
    side: string;
    price: number;
    quantity: number;
    pnl?: number;
    confidence?: number;
    reasoning?: string;
    market_conditions?: any;
    timestamp: Date;
  }): string {
    const outcome = tradeData.pnl ? (tradeData.pnl > 0 ? 'profitable' : 'loss') : 'unknown';
    
    return `
      Trade: ${tradeData.side} ${tradeData.quantity} ${tradeData.symbol} at $${tradeData.price}
      Outcome: ${outcome} (PnL: ${tradeData.pnl || 'pending'})
      Confidence: ${tradeData.confidence || 'unknown'}
      Reasoning: ${tradeData.reasoning || 'not provided'}
      Market conditions: ${JSON.stringify(tradeData.market_conditions || {})}
      Timestamp: ${tradeData.timestamp.toISOString()}
    `.trim();
  }

  /**
   * Clean up old vectors to maintain performance
   */
  async cleanupOldVectors(daysToKeep: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      await db.execute(sql`
        DELETE FROM trade_vectors 
        WHERE created_at < ${cutoffDate.toISOString()}
      `);
      
      logger.info('Cleaned up old trade vectors', { cutoffDate, daysToKeep });
    } catch (error) {
      logger.error('Failed to cleanup old vectors', { error });
    }
  }
}

// Create table for vector storage (if using PostgreSQL with pgvector)
export async function initializeVectorDB(): Promise<void> {
  try {
    // Create extension and table if they don't exist
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS trade_vectors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trade_id VARCHAR(255) UNIQUE NOT NULL,
        embedding VECTOR(1536), -- OpenAI embedding dimensions
        context TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create indexes for performance
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_trade_vectors_embedding 
      ON trade_vectors USING ivfflat (embedding vector_cosine_ops)
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_trade_vectors_created_at 
      ON trade_vectors (created_at DESC)
    `);
    
    logger.info('Vector DB initialized successfully');
  } catch (error) {
    logger.warn('Vector DB initialization skipped - pgvector extension not available', { error });
    // Fall back to JSONB storage without vector operations
    await initializeFallbackVectorDB();
  }
}

// Fallback for environments without pgvector
async function initializeFallbackVectorDB(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS trade_vectors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trade_id VARCHAR(255) UNIQUE NOT NULL,
      embedding JSONB, -- Store as JSON array
      context TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_trade_vectors_trade_id 
    ON trade_vectors (trade_id)
  `);
}