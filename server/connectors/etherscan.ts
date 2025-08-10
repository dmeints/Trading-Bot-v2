/**
 * Etherscan API Connector for Ethereum On-chain Analytics
 * Fetches Ethereum blockchain metrics for algorithmic trading
 */

import axios, { AxiosResponse } from 'axios';
import { RateLimiter } from 'limiter';
import { logger } from '../utils/logger';
import { db } from '../db';
import { onchainTicksExtended, connectorHealth } from '@shared/schema';
import type { InsertOnchainTick, InsertConnectorHealth } from '@shared/schema';

interface EtherscanResponse {
  status: string;
  message: string;
  result: any;
}

interface GasOracleResponse {
  status: string;
  message: string;
  result: {
    SafeGasPrice: string;
    StandardGasPrice: string;
    FastGasPrice: string;
    suggestBaseFee: string;
    gasUsedRatio: string;
  };
}

export class EtherscanConnector {
  private apiKey: string | undefined;
  private baseUrl = 'https://api.etherscan.io/api';
  private limiter: RateLimiter;
  private requestCount = 0;
  private errorCount = 0;

  constructor() {
    this.apiKey = process.env.ETHERSCAN_API_KEY;
    // Rate limit: 5 requests per second for free plan
    this.limiter = new RateLimiter({ tokensPerInterval: 5, interval: 1000 });
  }

  private async makeRequest<T>(params: Record<string, any>): Promise<T> {
    if (!this.apiKey) {
      throw new Error('Etherscan API key not configured');
    }

    await this.limiter.removeTokens(1);
    this.requestCount++;

    const config = {
      baseURL: this.baseUrl,
      params: {
        ...params,
        apikey: this.apiKey,
      },
      timeout: 10000,
    };

    try {
      const response: AxiosResponse<T> = await axios.get('', config);
      await this.updateHealthStatus('healthy', null);
      return response.data;
    } catch (error: any) {
      this.errorCount++;
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      await this.updateHealthStatus('degraded', errorMessage);
      
      logger.error('Etherscan API error', {
        params,
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
      // Fetch gas prices
      const gasData = await this.fetchGasPrices();
      if (gasData) {
        metrics.push({
          timestamp,
          chain: 'ethereum',
          metric: 'gas_price_safe',
          value: gasData.SafeGasPrice,
          provider: 'etherscan',
          provenance: {
            provider: 'etherscan',
            fetchedAt: timestamp.toISOString(),
            quotaCost: 1,
            module: 'gastracker',
            action: 'gasoracle',
          } as Record<string, any>,
        });

        metrics.push({
          timestamp,
          chain: 'ethereum',
          metric: 'gas_price_standard',
          value: gasData.StandardGasPrice,
          provider: 'etherscan',
          provenance: {
            provider: 'etherscan',
            fetchedAt: timestamp.toISOString(),
            quotaCost: 0, // Same request
          } as Record<string, any>,
        });

        metrics.push({
          timestamp,
          chain: 'ethereum',
          metric: 'gas_price_fast',
          value: gasData.FastGasPrice,
          provider: 'etherscan',
          provenance: {
            provider: 'etherscan',
            fetchedAt: timestamp.toISOString(),
            quotaCost: 0, // Same request
          } as Record<string, any>,
        });
      }

      // Fetch latest block data
      const blockData = await this.fetchLatestBlock();
      if (blockData) {
        metrics.push({
          timestamp,
          chain: 'ethereum',
          metric: 'latest_block',
          value: blockData.number.toString(),
          provider: 'etherscan',
          provenance: {
            provider: 'etherscan',
            fetchedAt: timestamp.toISOString(),
            quotaCost: 1,
            module: 'proxy',
            action: 'eth_blockNumber',
          } as Record<string, any>,
        });

        metrics.push({
          timestamp,
          chain: 'ethereum',
          metric: 'block_gas_used',
          value: blockData.gasUsed.toString(),
          provider: 'etherscan',
          provenance: {
            provider: 'etherscan',
            fetchedAt: timestamp.toISOString(),
            quotaCost: 1,
            blockNumber: blockData.number,
          } as Record<string, any>,
        });
      }

      // Fetch ETH supply data
      const supplyData = await this.fetchEthSupply();
      if (supplyData) {
        metrics.push({
          timestamp,
          chain: 'ethereum',
          metric: 'total_supply',
          value: supplyData.toString(),
          provider: 'etherscan',
          provenance: {
            provider: 'etherscan',
            fetchedAt: timestamp.toISOString(),
            quotaCost: 1,
            module: 'stats',
            action: 'ethsupply',
          } as Record<string, any>,
        });
      }

      logger.info(`Fetched ${metrics.length} Ethereum on-chain metrics`);
      return metrics;
      
    } catch (error) {
      logger.error('Failed to fetch Ethereum on-chain metrics', error);
      throw error;
    }
  }

  private async fetchGasPrices(): Promise<any> {
    const params = {
      module: 'gastracker',
      action: 'gasoracle',
    };

    try {
      const response = await this.makeRequest<GasOracleResponse>(params);
      
      if (response.status !== '1') {
        logger.warn('Etherscan gas oracle error', { message: response.message });
        return null;
      }

      return response.result;
    } catch (error) {
      logger.error('Failed to fetch gas prices', error);
      return null;
    }
  }

  private async fetchLatestBlock(): Promise<any> {
    // Get latest block number
    const blockNumberParams = {
      module: 'proxy',
      action: 'eth_blockNumber',
    };

    try {
      const blockNumberResponse = await this.makeRequest<EtherscanResponse>(blockNumberParams);
      
      if (blockNumberResponse.status !== '1') {
        logger.warn('Failed to get latest block number', { message: blockNumberResponse.message });
        return null;
      }

      const blockNumber = parseInt(blockNumberResponse.result, 16);

      // Get block details
      const blockParams = {
        module: 'proxy',
        action: 'eth_getBlockByNumber',
        tag: `0x${blockNumber.toString(16)}`,
        boolean: 'true',
      };

      const blockResponse = await this.makeRequest<EtherscanResponse>(blockParams);
      
      if (blockResponse.status !== '1') {
        logger.warn('Failed to get block details', { message: blockResponse.message });
        return null;
      }

      return {
        number: blockNumber,
        gasUsed: parseInt(blockResponse.result.gasUsed, 16),
        gasLimit: parseInt(blockResponse.result.gasLimit, 16),
        timestamp: parseInt(blockResponse.result.timestamp, 16),
      };
    } catch (error) {
      logger.error('Failed to fetch latest block', error);
      return null;
    }
  }

  private async fetchEthSupply(): Promise<number | null> {
    const params = {
      module: 'stats',
      action: 'ethsupply',
    };

    try {
      const response = await this.makeRequest<EtherscanResponse>(params);
      
      if (response.status !== '1') {
        logger.warn('Failed to get ETH supply', { message: response.message });
        return null;
      }

      // Convert from wei to ETH
      return parseInt(response.result) / 1e18;
    } catch (error) {
      logger.error('Failed to fetch ETH supply', error);
      return null;
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

      logger.info(`Stored ${ticks.length} Ethereum on-chain ticks`);
    } catch (error) {
      logger.error('Failed to store Ethereum on-chain ticks', error);
      throw error;
    }
  }

  private async updateHealthStatus(status: 'healthy' | 'degraded' | 'down', lastError: string | null): Promise<void> {
    try {
      await db.insert(connectorHealth).values({
        provider: 'etherscan',
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
      logger.error('Failed to update Etherscan connector health', error);
    }
  }

  async getHealthStatus(): Promise<any> {
    return {
      provider: 'etherscan',
      status: this.errorCount > 10 ? 'degraded' : 'healthy',
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      hasCredentials: !!this.apiKey,
    };
  }
}