import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger";

export interface OnChainEvent {
  id: string;
  tx_hash: string;
  block_number: number;
  token: string;
  amount: number;
  from_address: string;
  to_address: string;
  event_type: 'whale_transfer' | 'large_swap' | 'bridge_activity';
  timestamp: Date;
  metadata: Record<string, any>;
}

export class OnChainService {
  private static instance: OnChainService;
  private isInitialized = false;

  static getInstance(): OnChainService {
    if (!OnChainService.instance) {
      OnChainService.instance = new OnChainService();
    }
    return OnChainService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('Initializing On-Chain Service');
      await this.ensureOnChainTables();
      this.isInitialized = true;
      logger.info('On-Chain Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize On-Chain Service', { error });
      throw error;
    }
  }

  private async ensureOnChainTables(): Promise<void> {
    try {
      // Create onchain_events table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS onchain_events (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          tx_hash VARCHAR UNIQUE NOT NULL,
          block_number BIGINT NOT NULL,
          token VARCHAR NOT NULL,
          amount DECIMAL(20, 8) NOT NULL,
          from_address VARCHAR NOT NULL,
          to_address VARCHAR NOT NULL,
          event_type VARCHAR NOT NULL CHECK (event_type IN ('whale_transfer', 'large_swap', 'bridge_activity')),
          metadata JSONB DEFAULT '{}',
          timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Create index for efficient queries
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_onchain_events_timestamp ON onchain_events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_onchain_events_token ON onchain_events(token);
        CREATE INDEX IF NOT EXISTS idx_onchain_events_type ON onchain_events(event_type);
      `);

      logger.info('On-chain tables ensured');
    } catch (error) {
      logger.error('Failed to ensure on-chain tables', { error });
      throw error;
    }
  }

  async fetchWhaleTransfers(): Promise<OnChainEvent[]> {
    try {
      logger.info('Fetching whale transfer data');

      // Mock whale transfer data for demo (would connect to real API like Etherscan)
      const mockWhaleData = [
        {
          tx_hash: `0x${Math.random().toString(16).substr(2, 40)}`,
          block_number: Math.floor(Math.random() * 1000000) + 18000000,
          token: 'BTC',
          amount: Math.random() * 100 + 50, // 50-150 BTC
          from_address: `0x${Math.random().toString(16).substr(2, 40)}`,
          to_address: `0x${Math.random().toString(16).substr(2, 40)}`,
          event_type: 'whale_transfer' as const,
          timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
          metadata: {
            usd_value: Math.random() * 10000000 + 5000000,
            exchange: Math.random() > 0.5 ? 'Binance' : 'Coinbase'
          }
        },
        {
          tx_hash: `0x${Math.random().toString(16).substr(2, 40)}`,
          block_number: Math.floor(Math.random() * 1000000) + 18000000,
          token: 'ETH',
          amount: Math.random() * 1000 + 500, // 500-1500 ETH
          from_address: `0x${Math.random().toString(16).substr(2, 40)}`,
          to_address: `0x${Math.random().toString(16).substr(2, 40)}`,
          event_type: 'whale_transfer' as const,
          timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
          metadata: {
            usd_value: Math.random() * 5000000 + 2000000,
            gas_used: Math.floor(Math.random() * 50000) + 21000
          }
        }
      ];

      const events: OnChainEvent[] = mockWhaleData.map(data => ({
        id: `onchain_${Date.now()}_${Math.random()}`,
        ...data
      }));

      // Store events in database
      for (const event of events) {
        await db.execute(sql`
          INSERT INTO onchain_events (
            id, tx_hash, block_number, token, amount, from_address, to_address, 
            event_type, metadata, timestamp
          ) VALUES (
            ${event.id}, ${event.tx_hash}, ${event.block_number}, ${event.token}, 
            ${event.amount}, ${event.from_address}, ${event.to_address}, 
            ${event.event_type}, ${JSON.stringify(event.metadata)}, ${event.timestamp.toISOString()}
          ) ON CONFLICT (tx_hash) DO NOTHING
        `);
      }

      logger.info('Whale transfer data fetched and stored', { count: events.length });
      return events;
    } catch (error) {
      logger.error('Failed to fetch whale transfers', { error });
      throw error;
    }
  }

  async getRecentEvents(hours: number = 24): Promise<OnChainEvent[]> {
    try {
      const sinceTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      const result = await db.execute(sql`
        SELECT * FROM onchain_events 
        WHERE timestamp >= ${sinceTime.toISOString()}
        ORDER BY timestamp DESC
        LIMIT 100
      `);

      return result.rows.map(row => ({
        id: row.id as string,
        tx_hash: row.tx_hash as string,
        block_number: Number(row.block_number),
        token: row.token as string,
        amount: Number(row.amount),
        from_address: row.from_address as string,
        to_address: row.to_address as string,
        event_type: row.event_type as 'whale_transfer' | 'large_swap' | 'bridge_activity',
        timestamp: new Date(row.timestamp as string),
        metadata: row.metadata as Record<string, any>
      }));
    } catch (error) {
      logger.error('Failed to get recent on-chain events', { error });
      throw error;
    }
  }

  async getEventsByToken(token: string, limit: number = 50): Promise<OnChainEvent[]> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM onchain_events 
        WHERE token = ${token}
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `);

      return result.rows.map(row => ({
        id: row.id as string,
        tx_hash: row.tx_hash as string,
        block_number: Number(row.block_number),
        token: row.token as string,
        amount: Number(row.amount),
        from_address: row.from_address as string,
        to_address: row.to_address as string,
        event_type: row.event_type as 'whale_transfer' | 'large_swap' | 'bridge_activity',
        timestamp: new Date(row.timestamp as string),
        metadata: row.metadata as Record<string, any>
      }));
    } catch (error) {
      logger.error('Failed to get events by token', { error, token });
      throw error;
    }
  }
}

export const onChainService = OnChainService.getInstance();