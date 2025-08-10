/**
 * Blockchair API Connector - Phase A Implementation
 * Fetches Bitcoin on-chain data (hashrate, active addresses) with rate limiting and provenance tracking  
 */

import axios, { AxiosResponse } from 'axios';
import { db } from '../db';
import { onchainTicks, connectorHealth, type InsertOnchainTick, type InsertConnectorHealth } from '@shared/schema';
import { logger } from '../utils/logger';
import { RateLimiter } from 'limiter';

export interface BlockchairStatsResponse {
  data: {
    blocks: number;
    transactions: number;
    outputs: number;
    circulation: number;
    blocks_24h: number;
    transactions_24h: number;
    difficulty: number;
    volume_24h: number;
    mempool_transactions: number;
    mempool_size: number;
    mempool_tps: number;
    mempool_total_fee_usd: number;
    best_block_height: number;
    best_block_hash: string;
    best_block_time: string;
    blockchain_size: number;
    average_transaction_fee_24h: number;
    average_transaction_fee_usd_24h: number;
    median_transaction_fee_24h: number;
    inflation_24h: number;
    cdd_24h: number;
    largest_transaction_24h: {
      hash: string;
      value_usd: number;
    };
    countdowns: any[];
  };
  context: {
    code: number;
    source: string;
    limit: string;
    offset: string;
    rows: number;
    pre_rows: number;
    total_rows: number;
    state: number;
    cache: {
      live: boolean;
      type: string;
      since: string;
    };
  };
}

export interface BlockchairAddressStatsResponse {
  data: {
    [address: string]: {
      address: {
        type: string;
        script_hex: string;
        balance: number;
        balance_usd: number;
        received: number;
        received_usd: number;
        spent: number;
        spent_usd: number;
        output_count: number;
        unspent_output_count: number;
        first_seen_receiving: string;
        last_seen_receiving: string;
        first_seen_spending: string;
        last_seen_spending: string;
        transaction_count: number;
      };
    };
  };
}

export class BlockchairConnector {
  private baseUrl = 'https://api.blockchair.com/bitcoin';
  private limiter: RateLimiter;
  private requestCount = 0;
  private errorCount = 0;
  private whaleAddresses: Set<string>;

  constructor() {
    // Rate limit: 30 requests per minute for free plan
    this.limiter = new RateLimiter({ tokensPerInterval: 30, interval: 60000 });
    
    // Known Bitcoin whale addresses for monitoring
    this.whaleAddresses = new Set([
      '1P5ZEDWTKTFGxQjZphgWPQUpe554WKDfHQ', // Silk Road seized coins
      '1FeexV6bAHb8ybZjqQMjJrcCrHGW9sb6uF', // BitFinex wallet
      '3D2oetdNuZUqQHPJmcMDDHYoqkyNVsFk9r', // BitMEX wallet
      '1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s', // Whale wallet
      '1LQoWist8KkaUXSPKZHNvEyfrEkPHzSsCd', // Whale wallet
    ]);
  }

  private async makeRequest<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    await this.limiter.removeTokens(1);
    this.requestCount++;

    const config = {
      baseURL: this.baseUrl,
      params,
      timeout: 15000,
    };

    try {
      const response: AxiosResponse<T> = await axios.get(endpoint, config);
      await this.updateHealthStatus('healthy', null);
      return response.data;
    } catch (error: any) {
      this.errorCount++;
      const errorMessage = error.response?.data?.context?.error || error.message || 'Unknown error';
      await this.updateHealthStatus('degraded', errorMessage);
      
      logger.error('Blockchair API error', {
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

  async fetchBitcoinStats(): Promise<InsertOnchainTick[]> {
    const endpoint = '/stats';

    try {
      const data = await this.makeRequest<BlockchairStatsResponse>(endpoint);
      
      if (!data.data) {
        logger.warn('No Bitcoin stats data returned from Blockchair');
        return [];
      }

      const stats = data.data;
      const timestamp = new Date();
      const onchainTicks: InsertOnchainTick[] = [];

      // Create ticks for various Bitcoin network metrics
      const networkMetrics = [
        { metric: 'difficulty', value: stats.difficulty },
        { metric: 'blocks_24h', value: stats.blocks_24h },
        { metric: 'transactions_24h', value: stats.transactions_24h },
        { metric: 'volume_24h', value: stats.volume_24h },
        { metric: 'mempool_transactions', value: stats.mempool_transactions },
        { metric: 'mempool_size', value: stats.mempool_size },
        { metric: 'average_fee_24h', value: stats.average_transaction_fee_24h },
        { metric: 'median_fee_24h', value: stats.median_transaction_fee_24h },
        { metric: 'circulation', value: stats.circulation },
        { metric: 'blockchain_size', value: stats.blockchain_size },
        { metric: 'coin_days_destroyed_24h', value: stats.cdd_24h },
      ];

      for (const { metric, value } of networkMetrics) {
        onchainTicks.push({
          timestamp,
          chain: 'bitcoin',
          metric,
          value: value.toString(),
          provider: 'blockchair',
          provenance: {
            provider: 'blockchair',
            endpoint,
            fetchedAt: new Date().toISOString(),
            quotaCost: 1,
            best_block_height: stats.best_block_height,
            best_block_time: stats.best_block_time,
            cache_info: data.context.cache,
          },
        });
      }

      // Calculate estimated hashrate from difficulty
      // Hashrate ≈ Difficulty × 2^32 / 600 (seconds per block)
      const estimatedHashrate = stats.difficulty * Math.pow(2, 32) / 600;
      onchainTicks.push({
        timestamp,
        chain: 'bitcoin',
        metric: 'estimated_hashrate',
        value: estimatedHashrate.toString(),
        provider: 'blockchair',
        provenance: {
          provider: 'blockchair',
          endpoint,
          fetchedAt: new Date().toISOString(),
          quotaCost: 0, // Calculated from existing data
          calculation: 'difficulty * 2^32 / 600',
          difficulty: stats.difficulty,
        },
      });

      logger.info(`Fetched ${onchainTicks.length} Bitcoin network metrics from Blockchair`);
      return onchainTicks;
      
    } catch (error) {
      logger.error('Failed to fetch Bitcoin stats from Blockchair', error);
      throw error;
    }
  }

  async fetchWhaleActivity(): Promise<InsertOnchainTick[]> {
    const onchainTicks: InsertOnchainTick[] = [];
    const addresses = Array.from(this.whaleAddresses).slice(0, 5); // Limit to 5 addresses to conserve API calls
    
    // Process addresses in chunks to respect rate limits
    for (let i = 0; i < addresses.length; i += 3) {
      const chunk = addresses.slice(i, i + 3);
      const addressesParam = chunk.join(',');
      
      try {
        const endpoint = '/addresses';
        const params = { addresses: addressesParam };

        const data = await this.makeRequest<BlockchairAddressStatsResponse>(endpoint, params);
        
        if (!data.data) {
          logger.warn(`No address data returned for chunk: ${addressesParam}`);
          continue;
        }

        // Process whale activity data
        let totalBalance = 0;
        let totalTransactionCount = 0;
        let recentActivityCount = 0;

        for (const address of chunk) {
          const addressData = data.data[address];
          if (addressData) {
            totalBalance += addressData.address.balance;
            totalTransactionCount += addressData.address.transaction_count;
            
            // Check for recent activity (last seen within 30 days)
            const lastActivity = new Date(addressData.address.last_seen_receiving || addressData.address.last_seen_spending);
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            
            if (lastActivity > thirtyDaysAgo) {
              recentActivityCount++;
            }
          }
        }

        // Create aggregate whale activity metrics
        onchainTicks.push(
          {
            timestamp: new Date(),
            chain: 'bitcoin',
            metric: 'whale_balance_aggregate',
            value: (totalBalance / 1e8).toString(), // Convert satoshis to BTC
            provider: 'blockchair',
            provenance: {
              provider: 'blockchair',
              endpoint,
              fetchedAt: new Date().toISOString(),
              quotaCost: 1,
              addresses_monitored: chunk,
              total_addresses: chunk.length,
            },
          },
          {
            timestamp: new Date(),
            chain: 'bitcoin',
            metric: 'whale_transaction_count',
            value: totalTransactionCount.toString(),
            provider: 'blockchair',
            provenance: {
              provider: 'blockchair',
              endpoint,
              fetchedAt: new Date().toISOString(),
              quotaCost: 0, // Same request as above
              addresses_monitored: chunk,
            },
          },
          {
            timestamp: new Date(),
            chain: 'bitcoin',
            metric: 'whale_recent_activity',
            value: recentActivityCount.toString(),
            provider: 'blockchair',
            provenance: {
              provider: 'blockchair',
              endpoint,
              fetchedAt: new Date().toISOString(),
              quotaCost: 0, // Same request as above
              addresses_monitored: chunk,
              activity_threshold_days: 30,
            },
          }
        );

        // Small delay between chunks
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        logger.error(`Failed to fetch whale activity for chunk: ${addressesParam}`, error);
        continue; // Continue with remaining chunks
      }
    }

    logger.info(`Fetched ${onchainTicks.length} whale activity metrics from Blockchair`);
    return onchainTicks;
  }

  async storeOnchainTicks(ticks: InsertOnchainTick[]): Promise<void> {
    if (ticks.length === 0) return;

    try {
      await db.insert(onchainTicks).values(ticks);
      logger.info(`Stored ${ticks.length} Blockchair onchain ticks to database`);
    } catch (error) {
      logger.error('Failed to store Blockchair onchain ticks', error);
      throw error;
    }
  }

  private async updateHealthStatus(status: 'healthy' | 'degraded' | 'down', error: string | null): Promise<void> {
    const healthData: InsertConnectorHealth = {
      provider: 'blockchair',
      status,
      lastSuccessfulFetch: status === 'healthy' ? new Date() : undefined,
      lastError: error,
      requestCount24h: this.requestCount,
      errorCount24h: this.errorCount,
      quotaUsed: this.requestCount,
      quotaLimit: 43200, // 30 requests per minute * 24 hours
    };

    try {
      await db.insert(connectorHealth)
        .values(healthData)
        .onConflictDoUpdate({
          target: connectorHealth.provider,
          set: healthData,
        });
    } catch (error) {
      logger.error('Failed to update Blockchair connector health', error);
    }
  }

  async getHealthStatus(): Promise<{ status: string; requestCount: number; errorCount: number }> {
    return {
      status: this.errorCount / Math.max(this.requestCount, 1) > 0.1 ? 'degraded' : 'healthy',
      requestCount: this.requestCount,
      errorCount: this.errorCount,
    };
  }

  resetDailyCounters(): void {
    this.requestCount = 0;
    this.errorCount = 0;
  }
}

// Export singleton instance
export const blockchairConnector = new BlockchairConnector();