import OpenAI from "openai";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger";
import { nanoid } from "nanoid";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface VectorRecord {
  id: string;
  type: 'trade' | 'signal' | 'backtest' | 'market_event';
  content: string;
  metadata: Record<string, any>;
  timestamp: Date;
  embedding?: number[];
}

export interface SimilarityResult {
  id: string;
  type: string;
  content: string;
  metadata: Record<string, any>;
  timestamp: Date;
  similarity: number;
}

export class VectorService {
  private static instance: VectorService;
  private isInitialized = false;

  static getInstance(): VectorService {
    if (!VectorService.instance) {
      VectorService.instance = new VectorService();
    }
    return VectorService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('Initializing Vector Service');
      
      // Ensure vector index metadata table exists
      await this.ensureVectorTables();
      
      this.isInitialized = true;
      logger.info('Vector Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Vector Service', { error });
      throw error;
    }
  }

  private async ensureVectorTables(): Promise<void> {
    try {
      // Create vector index metadata table if not exists
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS vector_index_metadata (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          index_type VARCHAR NOT NULL,
          last_indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          total_records INTEGER DEFAULT 0,
          version VARCHAR DEFAULT '1.0.0',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Create vector records table for in-database storage
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS vector_records (
          id VARCHAR PRIMARY KEY,
          type VARCHAR NOT NULL,
          content TEXT NOT NULL,
          metadata JSONB DEFAULT '{}',
          embedding vector(1536),
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      logger.info('Vector tables ensured');
    } catch (error) {
      logger.error('Failed to ensure vector tables', { error });
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Failed to generate embedding', { error, text: text.substring(0, 100) });
      throw error;
    }
  }

  async upsertVectors(records: VectorRecord[]): Promise<void> {
    try {
      for (const record of records) {
        // Generate embedding if not provided
        if (!record.embedding) {
          record.embedding = await this.generateEmbedding(record.content);
        }

        // Upsert into database
        await db.execute(sql`
          INSERT INTO vector_records (id, type, content, metadata, embedding, timestamp)
          VALUES (${record.id}, ${record.type}, ${record.content}, ${JSON.stringify(record.metadata)}, ${JSON.stringify(record.embedding)}, ${record.timestamp.toISOString()})
          ON CONFLICT (id) DO UPDATE SET
            content = EXCLUDED.content,
            metadata = EXCLUDED.metadata,
            embedding = EXCLUDED.embedding,
            timestamp = EXCLUDED.timestamp
        `);
      }

      logger.info('Upserted vectors', { count: records.length });
    } catch (error) {
      logger.error('Failed to upsert vectors', { error });
      throw error;
    }
  }

  async querySimilar(query: string | number[], type?: string, topK: number = 5): Promise<SimilarityResult[]> {
    try {
      let queryEmbedding: number[];
      
      if (typeof query === 'string') {
        queryEmbedding = await this.generateEmbedding(query);
      } else {
        queryEmbedding = query;
      }

      // Use cosine similarity for vector search
      let sqlQuery = sql`
        SELECT 
          id, type, content, metadata, timestamp,
          1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
        FROM vector_records
      `;

      if (type) {
        sqlQuery = sql`${sqlQuery} WHERE type = ${type}`;
      }

      sqlQuery = sql`${sqlQuery}
        ORDER BY similarity DESC
        LIMIT ${topK}
      `;

      const result = await db.execute(sqlQuery);

      return result.rows.map(row => ({
        id: row.id as string,
        type: row.type as string,
        content: row.content as string,
        metadata: row.metadata as Record<string, any>,
        timestamp: new Date(row.timestamp as string),
        similarity: Number(row.similarity)
      }));
    } catch (error) {
      logger.error('Failed to query similar vectors', { error });
      throw error;
    }
  }

  async findSimilarById(recordId: string, topK: number = 5): Promise<SimilarityResult[]> {
    try {
      // Get the embedding for the specified record
      const result = await db.execute(sql`
        SELECT embedding FROM vector_records WHERE id = ${recordId}
      `);

      if (result.rows.length === 0) {
        throw new Error(`Record with id ${recordId} not found`);
      }

      const embedding = JSON.parse(result.rows[0].embedding as string);
      return this.querySimilar(embedding, undefined, topK + 1); // +1 to exclude self
    } catch (error) {
      logger.error('Failed to find similar by ID', { error, recordId });
      throw error;
    }
  }

  async indexTradeEvents(): Promise<number> {
    try {
      logger.info('Starting trade events indexing');
      
      // Get last indexed timestamp
      const lastIndexed = await this.getLastIndexedTimestamp('trades');
      
      // Fetch new trades since last index
      const tradesResult = await db.execute(sql`
        SELECT * FROM trades 
        WHERE created_at > ${lastIndexed.toISOString()}
        ORDER BY created_at ASC
      `);

      const records: VectorRecord[] = tradesResult.rows.map(trade => ({
        id: `trade_${trade.id}`,
        type: 'trade' as const,
        content: `Trade: ${trade.symbol} ${trade.side} ${trade.quantity} at $${trade.price}. PnL: $${trade.realized_pnl || 0}. Strategy: ${trade.strategy || 'manual'}`,
        metadata: {
          symbol: trade.symbol,
          side: trade.side,
          quantity: trade.quantity,
          price: trade.price,
          realized_pnl: trade.realized_pnl,
          strategy: trade.strategy
        },
        timestamp: new Date(trade.created_at as string)
      }));

      if (records.length > 0) {
        await this.upsertVectors(records);
        await this.updateLastIndexedTimestamp('trades', records.length);
      }

      logger.info('Trade events indexing completed', { indexed: records.length });
      return records.length;
    } catch (error) {
      logger.error('Failed to index trade events', { error });
      throw error;
    }
  }

  async indexAISignals(): Promise<number> {
    try {
      logger.info('Starting AI signals indexing');
      
      const lastIndexed = await this.getLastIndexedTimestamp('ai_signals');
      
      // Fetch AI activities (signals, insights, etc.)
      const signalsResult = await db.execute(sql`
        SELECT * FROM ai_activities 
        WHERE created_at > ${lastIndexed.toISOString()}
        ORDER BY created_at ASC
      `);

      const records: VectorRecord[] = signalsResult.rows.map(signal => ({
        id: `signal_${signal.id}`,
        type: 'signal' as const,
        content: `AI Signal: ${signal.activity_type} for ${signal.symbol}. Confidence: ${signal.confidence}. ${signal.reasoning || ''}`,
        metadata: {
          activity_type: signal.activity_type,
          symbol: signal.symbol,
          confidence: signal.confidence,
          reasoning: signal.reasoning,
          agent_type: signal.agent_type
        },
        timestamp: new Date(signal.created_at as string)
      }));

      if (records.length > 0) {
        await this.upsertVectors(records);
        await this.updateLastIndexedTimestamp('ai_signals', records.length);
      }

      logger.info('AI signals indexing completed', { indexed: records.length });
      return records.length;
    } catch (error) {
      logger.error('Failed to index AI signals', { error });
      throw error;
    }
  }

  async indexBacktestResults(): Promise<number> {
    try {
      logger.info('Starting backtest results indexing');
      
      const lastIndexed = await this.getLastIndexedTimestamp('backtests');
      
      // Fetch backtest results
      const backtestsResult = await db.execute(sql`
        SELECT * FROM backtests 
        WHERE created_at > ${lastIndexed.toISOString()}
        ORDER BY created_at ASC
      `);

      const records: VectorRecord[] = backtestsResult.rows.map(backtest => ({
        id: `backtest_${backtest.id}`,
        type: 'backtest' as const,
        content: `Backtest: ${backtest.strategy_name} strategy. Total Return: ${backtest.total_return}%. Sharpe Ratio: ${backtest.sharpe_ratio}. Max Drawdown: ${backtest.max_drawdown}%. Trades: ${backtest.total_trades}`,
        metadata: {
          strategy_name: backtest.strategy_name,
          total_return: backtest.total_return,
          sharpe_ratio: backtest.sharpe_ratio,
          max_drawdown: backtest.max_drawdown,
          total_trades: backtest.total_trades,
          parameters: backtest.parameters
        },
        timestamp: new Date(backtest.created_at as string)
      }));

      if (records.length > 0) {
        await this.upsertVectors(records);
        await this.updateLastIndexedTimestamp('backtests', records.length);
      }

      logger.info('Backtest results indexing completed', { indexed: records.length });
      return records.length;
    } catch (error) {
      logger.error('Failed to index backtest results', { error });
      throw error;
    }
  }

  async runFullReindex(): Promise<{ trades: number; signals: number; backtests: number }> {
    try {
      logger.info('Starting full reindex');
      
      // Reset all last indexed timestamps
      await db.execute(sql`
        UPDATE vector_index_metadata 
        SET last_indexed_at = '1970-01-01T00:00:00Z'::timestamp
      `);

      const trades = await this.indexTradeEvents();
      const signals = await this.indexAISignals();
      const backtests = await this.indexBacktestResults();

      logger.info('Full reindex completed', { trades, signals, backtests });
      return { trades, signals, backtests };
    } catch (error) {
      logger.error('Failed to run full reindex', { error });
      throw error;
    }
  }

  private async getLastIndexedTimestamp(indexType: string): Promise<Date> {
    try {
      const result = await db.execute(sql`
        SELECT last_indexed_at FROM vector_index_metadata 
        WHERE index_type = ${indexType}
      `);

      if (result.rows.length === 0) {
        // Create initial record
        await db.execute(sql`
          INSERT INTO vector_index_metadata (index_type, last_indexed_at)
          VALUES (${indexType}, '1970-01-01T00:00:00Z'::timestamp)
        `);
        return new Date('1970-01-01T00:00:00Z');
      }

      return new Date(result.rows[0].last_indexed_at as string);
    } catch (error) {
      logger.error('Failed to get last indexed timestamp', { error, indexType });
      return new Date('1970-01-01T00:00:00Z');
    }
  }

  private async updateLastIndexedTimestamp(indexType: string, recordCount: number): Promise<void> {
    try {
      await db.execute(sql`
        UPDATE vector_index_metadata 
        SET 
          last_indexed_at = NOW(),
          total_records = total_records + ${recordCount},
          updated_at = NOW()
        WHERE index_type = ${indexType}
      `);
    } catch (error) {
      logger.error('Failed to update last indexed timestamp', { error, indexType });
    }
  }
}

export const vectorService = VectorService.getInstance();