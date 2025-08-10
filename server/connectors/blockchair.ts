/**
 * Blockchair API Connector for Bitcoin On-chain Analytics
 * Fetches Bitcoin blockchain metrics for algorithmic trading
 */

import axios, { AxiosResponse } from 'axios';
import { RateLimiter } from 'limiter';
import { logger } from '../utils/logger';
import { db } from '../db';
import { onchainTicksExtended, connectorHealth } from '@shared/schema';
import type { InsertOnchainTick, InsertConnectorHealth } from '@shared/schema';

interface BlockchairStatsResponse {
  data: {
    blocks: number;
    transactions: number;
    outputs: number;
    circulation: number;
    blocks_24h: number;
    transactions_24h: number;
    difficulty: number;
    hashrate_24h: string;
    inflation_24h: number;
    median_transaction_fee_24h: number;
    mempool_transactions: number;
    mempool_size: number;
    mempool_tps: number;
    mempool_total_fee_usd: number;
    best_block_height: number;
    best_block_hash: string;
    best_block_time: string;
    blockchain_size: number;
    average_transaction_fee_24h: number;
    hodling_addresses: number;
  };
  context: {
    code: number;
    source: string;
    limit: number;
    offset: number;
    rows: number;
    pre_rows: number;
    total_rows: number;
    state: number;
    cache: {
      live: boolean;
      duration: number;
      since: string;
      until: string;
      time: number;
    };
    api: {
      version: string;
      last_major_update: string;
      next_major_update: string | null;
      documentation: string;
      notice: string;
    };
  };
}

export class BlockchairConnector {
  private apiKey: string | undefined;
  private baseUrl = 'https://api.blockchair.com';
  private limiter: RateLimiter;
  private requestCount = 0;
  private errorCount = 0;

  constructor() {
    this.apiKey = process.env.BLOCKCHAIR_API_KEY;
    // Rate limit: 30 requests per minute for free plan
    this.limiter = new RateLimiter({ tokensPerInterval: 30, interval: 60000 });
  }

  private async makeRequest<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    await this.limiter.removeTokens(1);
    this.requestCount++;

    const config = {
      baseURL: this.baseUrl,
      params: {
        ...(this.apiKey && { key: this.apiKey }),
        ...params,
      },
      timeout: 10000,
    };

    try {
      const response: AxiosResponse<T> = await axios.get(endpoint, config);
      await this.updateHealthStatus('healthy', null);
      return response.data;
    } catch (error: any) {
      this.errorCount++;
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
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

  async fetchOnchainMetrics(): Promise<InsertOnchainTick[]> {
    const metrics: InsertOnchainTick[] = [];
    const timestamp = new Date();

    try {
      // Fetch Bitcoin network statistics
      const endpoint = '/bitcoin/stats';
      const data = await this.makeRequest<BlockchairStatsResponse>(endpoint);

      if (!data.data) {
        logger.warn('No Bitcoin stats data returned from Blockchair');
        return [];
      }

      const stats = data.data;

      // Extract key metrics
      const metricsToExtract = [
        { key: 'hashrate_24h', metric: 'hashrate_24h', value: stats.hashrate_24h },
        { key: 'difficulty', metric: 'difficulty', value: stats.difficulty.toString() },
        { key: 'mempool_transactions', metric: 'mempool_size', value: stats.mempool_transactions.toString() },
        { key: 'mempool_size', metric: 'mempool_bytes', value: stats.mempool_size.toString() },
        { key: 'median_transaction_fee_24h', metric: 'median_fee_24h', value: stats.median_transaction_fee_24h.toString() },
        { key: 'average_transaction_fee_24h', metric: 'avg_fee_24h', value: stats.average_transaction_fee_24h.toString() },
        { key: 'transactions_24h', metric: 'transactions_24h', value: stats.transactions_24h.toString() },
        { key: 'blocks_24h', metric: 'blocks_24h', value: stats.blocks_24h.toString() },
        { key: 'circulation', metric: 'circulating_supply', value: stats.circulation.toString() },
        { key: 'blockchain_size', metric: 'blockchain_size', value: stats.blockchain_size.toString() },
        { key: 'best_block_height', metric: 'block_height', value: stats.best_block_height.toString() },
        { key: 'hodling_addresses', metric: 'hodling_addresses', value: stats.hodling_addresses.toString() },
      ];

      for (const metricDef of metricsToExtract) {
        if (metricDef.value !== undefined && metricDef.value !== null) {
          metrics.push({
            timestamp,
            chain: 'bitcoin',
            metric: metricDef.metric,
            value: metricDef.value,
            provider: 'blockchair',
            provenance: {
              provider: 'blockchair',
              endpoint,
              fetchedAt: timestamp.toISOString(),
              quotaCost: 1,
              originalKey: metricDef.key,
              cacheInfo: data.context?.cache,
            } as Record<string, any>,
          });
        }
      }

      // Calculate additional derived metrics
      if (stats.mempool_transactions > 0 && stats.mempool_size > 0) {
        const avgTxSize = stats.mempool_size / stats.mempool_transactions;
        metrics.push({
          timestamp,
          chain: 'bitcoin',
          metric: 'avg_mempool_tx_size',
          value: avgTxSize.toString(),
          provider: 'blockchair',
          provenance: {
            provider: 'blockchair',
            endpoint,
            fetchedAt: timestamp.toISOString(),
            quotaCost: 0, // Derived metric
            derived: true,
            calculation: 'mempool_size / mempool_transactions',
          } as Record<string, any>,
        });
      }

      // Hash rate in TH/s (convert from string if needed)
      if (stats.hashrate_24h && typeof stats.hashrate_24h === 'string') {
        const hashrateValue = parseFloat(stats.hashrate_24h.replace(/[^0-9.]/g, ''));
        if (!isNaN(hashrateValue)) {
          metrics.push({
            timestamp,
            chain: 'bitcoin',
            metric: 'hashrate_normalized',
            value: hashrateValue.toString(),
            provider: 'blockchair',
            provenance: {
              provider: 'blockchair',
              endpoint,
              fetchedAt: timestamp.toISOString(),
              quotaCost: 0, // Derived metric
              derived: true,
              unit: 'TH/s',
              originalValue: stats.hashrate_24h,
            } as Record<string, any>,
          });
        }
      }

      logger.info(`Fetched ${metrics.length} Bitcoin on-chain metrics from Blockchair`);
      return metrics;
      
    } catch (error) {
      logger.error('Failed to fetch Bitcoin on-chain metrics', error);
      throw error;
    }
  }

  async storeOnchainTicks(ticks: InsertOnchainTick[]): Promise<void> {
    if (ticks.length === 0) return;

    try {
      await db.insert(onchainTicks)
        .values(ticks)
        .onConflictDoUpdate({
          target: [onchainTicks.chain, onchainTicks.metric, onchainTicks.timestamp],
          set: {
            value: onchainTicks.value,
            provenance: onchainTicks.provenance,
            fetchedAt: new Date(),
          },
        });

      logger.info(`Stored ${ticks.length} Bitcoin on-chain ticks`);
    } catch (error) {
      logger.error('Failed to store Bitcoin on-chain ticks', error);
      throw error;
    }
  }

  private async updateHealthStatus(status: 'healthy' | 'degraded' | 'down', lastError: string | null): Promise<void> {
    try {
      await db.insert(connectorHealth).values({
        provider: 'blockchair',
        status,
        requestCount: this.requestCount,
        errorCount: this.errorCount,
        lastError,
        quotaCost: this.requestCount,
      } as InsertConnectorHealth).onConflictDoUpdate({
        target: connectorHealth.provider,
        set: {
          status,
          requestCount: this.requestCount,
          errorCount: this.errorCount,
          lastError,
          quotaCost: this.requestCount,
          lastChecked: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to update Blockchair connector health', error);
    }
  }

  async getHealthStatus(): Promise<any> {
    return {
      provider: 'blockchair',
      status: this.errorCount > 10 ? 'degraded' : 'healthy',
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      hasCredentials: !!this.apiKey,
      rateLimitRemaining: this.limiter.getTokensRemaining(),
    };
  }
}