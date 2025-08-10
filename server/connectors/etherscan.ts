/**
 * Etherscan API Connector - Phase A Implementation
 * Fetches Ethereum on-chain analytics (gas, whale transfers) with rate limiting and provenance tracking
 */

import axios, { AxiosResponse } from 'axios';
import { db } from '../db';
import { onchainTicks, connectorHealth, type InsertOnchainTick, type InsertConnectorHealth } from '@shared/schema';
import { logger } from '../utils/logger';
import { RateLimiter } from 'limiter';

export interface EtherscanGasOracleResponse {
  status: string;
  message: string;
  result: {
    LastBlock: string;
    SafeGasPrice: string;
    ProposeGasPrice: string;
    FastGasPrice: string;
    suggestBaseFee: string;
    gasUsedRatio: string;
  };
}

export interface EtherscanBalanceResponse {
  status: string;
  message: string;
  result: string;
}

export interface EtherscanTransactionListResponse {
  status: string;
  message: string;
  result: Array<{
    blockNumber: string;
    timeStamp: string;
    hash: string;
    nonce: string;
    blockHash: string;
    transactionIndex: string;
    from: string;
    to: string;
    value: string;
    gas: string;
    gasPrice: string;
    isError: string;
    txreceipt_status: string;
    input: string;
    contractAddress: string;
    cumulativeGasUsed: string;
    gasUsed: string;
    confirmations: string;
  }>;
}

export class EtherscanConnector {
  private apiKey: string | undefined;
  private baseUrl = 'https://api.etherscan.io/api';
  private limiter: RateLimiter;
  private requestCount = 0;
  private errorCount = 0;
  private whaleAddresses: Set<string>;

  constructor() {
    this.apiKey = process.env.ETHERSCAN_API_KEY;
    // Rate limit: 5 requests per second for free plan
    this.limiter = new RateLimiter({ tokensPerInterval: 5, interval: 1000 });
    
    // Known whale addresses for monitoring
    this.whaleAddresses = new Set([
      '0x8315177ab297ba92a06054ce80a67ed4dbd7ed3a', // Binance wallet
      '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be', // Binance wallet
      '0xdfd5293d8e347dfe59e90efd55b2956a1343963d', // Binance wallet
      '0x46705dfff24256421a05d056c29e81bdc09723b8', // Whale wallet
      '0x00000000219ab540356cbb839cbe05303d7705fa', // Eth2 deposit contract
    ]);
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
        apikey: this.apiKey,
        ...params,
      },
      timeout: 15000,
    };

    try {
      const response: AxiosResponse<T> = await axios.get('', config);
      await this.updateHealthStatus('healthy', null);
      return response.data;
    } catch (error: any) {
      this.errorCount++;
      const errorMessage = error.response?.data?.result || error.message || 'Unknown error';
      await this.updateHealthStatus('degraded', errorMessage);
      
      logger.error('Etherscan API error', {
        error: errorMessage,
        status: error.response?.status,
      });

      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded');
      }
      
      throw error;
    }
  }

  async fetchGasMetrics(): Promise<InsertOnchainTick[]> {
    const params = {
      module: 'gastracker',
      action: 'gasoracle',
    };

    try {
      const data = await this.makeRequest<EtherscanGasOracleResponse>(params);
      
      if (data.status !== '1') {
        logger.warn(`Etherscan gas oracle error: ${data.message}`);
        return [];
      }

      const result = data.result;
      const timestamp = new Date();
      const onchainTicks: InsertOnchainTick[] = [];

      // Create ticks for different gas price types
      const gasMetrics = [
        { metric: 'safe_gas_price', value: result.SafeGasPrice },
        { metric: 'propose_gas_price', value: result.ProposeGasPrice },
        { metric: 'fast_gas_price', value: result.FastGasPrice },
        { metric: 'base_fee', value: result.suggestBaseFee },
        { metric: 'gas_used_ratio', value: result.gasUsedRatio },
      ];

      for (const { metric, value } of gasMetrics) {
        onchainTicks.push({
          timestamp,
          chain: 'ethereum',
          metric,
          value: parseFloat(value).toString(),
          provider: 'etherscan',
          provenance: {
            provider: 'etherscan',
            endpoint: 'gasoracle',
            fetchedAt: new Date().toISOString(),
            quotaCost: 1,
            module: 'gastracker',
            action: 'gasoracle',
            lastBlock: result.LastBlock,
          },
        });
      }

      logger.info(`Fetched ${onchainTicks.length} gas metrics from Etherscan`);
      return onchainTicks;
      
    } catch (error) {
      logger.error('Failed to fetch gas metrics from Etherscan', error);
      if (error.message === 'Etherscan API key not configured') {
        return []; // Return empty array instead of throwing for missing config
      }
      throw error;
    }
  }

  async fetchWhaleTransactions(): Promise<InsertOnchainTick[]> {
    const onchainTicks: InsertOnchainTick[] = [];
    
    for (const address of this.whaleAddresses) {
      try {
        const params = {
          module: 'account',
          action: 'txlist',
          address,
          startblock: 0,
          endblock: 99999999,
          page: 1,
          offset: 10, // Last 10 transactions
          sort: 'desc',
        };

        const data = await this.makeRequest<EtherscanTransactionListResponse>(params);
        
        if (data.status !== '1') {
          logger.warn(`Etherscan txlist error for ${address}: ${data.message}`);
          continue;
        }

        // Process recent transactions
        const recentTxs = data.result.slice(0, 5); // Last 5 transactions
        let totalValue = 0;
        let txCount = 0;

        for (const tx of recentTxs) {
          const valueEth = parseFloat(tx.value) / 1e18; // Convert wei to ETH
          if (valueEth > 100) { // Only count significant transactions
            totalValue += valueEth;
            txCount++;
          }
        }

        if (txCount > 0) {
          onchainTicks.push({
            timestamp: new Date(),
            chain: 'ethereum',
            metric: 'whale_activity',
            value: totalValue.toString(),
            provider: 'etherscan',
            provenance: {
              provider: 'etherscan',
              endpoint: 'txlist',
              fetchedAt: new Date().toISOString(),
              quotaCost: 1,
              module: 'account',
              action: 'txlist',
              address,
              transaction_count: txCount,
              total_value_eth: totalValue,
            },
          });
        }

        // Small delay between whale address requests
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        logger.error(`Failed to fetch transactions for whale ${address}`, error);
        continue; // Continue with other addresses
      }
    }

    logger.info(`Fetched ${onchainTicks.length} whale activity metrics from Etherscan`);
    return onchainTicks;
  }

  async fetchEthSupplyMetrics(): Promise<InsertOnchainTick[]> {
    const params = {
      module: 'stats',
      action: 'ethsupply',
    };

    try {
      const data = await this.makeRequest<EtherscanBalanceResponse>(params);
      
      if (data.status !== '1') {
        logger.warn(`Etherscan ETH supply error: ${data.message}`);
        return [];
      }

      const supplyWei = data.result;
      const supplyEth = parseFloat(supplyWei) / 1e18;

      const onchainTick: InsertOnchainTick = {
        timestamp: new Date(),
        chain: 'ethereum',
        metric: 'total_supply',
        value: supplyEth.toString(),
        provider: 'etherscan',
        provenance: {
          provider: 'etherscan',
          endpoint: 'ethsupply',
          fetchedAt: new Date().toISOString(),
          quotaCost: 1,
          module: 'stats',
          action: 'ethsupply',
          supply_wei: supplyWei,
        },
      };

      logger.info('Fetched ETH supply metric from Etherscan');
      return [onchainTick];
      
    } catch (error) {
      logger.error('Failed to fetch ETH supply from Etherscan', error);
      throw error;
    }
  }

  async storeOnchainTicks(ticks: InsertOnchainTick[]): Promise<void> {
    if (ticks.length === 0) return;

    try {
      // Insert onchain ticks (allowing duplicates with different timestamps)
      await db.insert(onchainTicks).values(ticks);
      logger.info(`Stored ${ticks.length} Etherscan onchain ticks to database`);
    } catch (error) {
      logger.error('Failed to store Etherscan onchain ticks', error);
      throw error;
    }
  }

  private async updateHealthStatus(status: 'healthy' | 'degraded' | 'down', error: string | null): Promise<void> {
    const healthData: InsertConnectorHealth = {
      provider: 'etherscan',
      status,
      lastSuccessfulFetch: status === 'healthy' ? new Date() : undefined,
      lastError: error,
      requestCount24h: this.requestCount,
      errorCount24h: this.errorCount,
      quotaUsed: this.requestCount,
      quotaLimit: 432000, // 5 requests per second * 24 hours
    };

    try {
      await db.insert(connectorHealth)
        .values(healthData)
        .onConflictDoUpdate({
          target: connectorHealth.provider,
          set: healthData,
        });
    } catch (error) {
      logger.error('Failed to update Etherscan connector health', error);
    }
  }

  async getHealthStatus(): Promise<{ status: string; requestCount: number; errorCount: number; configured: boolean }> {
    const configured = !!this.apiKey;
    return {
      status: !configured ? 'down' : 
              this.errorCount / Math.max(this.requestCount, 1) > 0.1 ? 'degraded' : 'healthy',
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      configured,
    };
  }

  resetDailyCounters(): void {
    this.requestCount = 0;
    this.errorCount = 0;
  }
}

// Export singleton instance
export const etherscanConnector = new EtherscanConnector();