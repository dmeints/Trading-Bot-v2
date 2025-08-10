/**
 * Unified Connector Manager - Phase A Implementation
 * Manages all 8 external data connectors with health monitoring, rate limiting, and provenance tracking
 */

import { logger } from '../utils/logger';
import { coinGeckoConnector } from './coingecko';
import { binanceConnector } from './binance';
import { xConnector } from './x';
import { redditConnector } from './reddit';
import { cryptoPanicConnector } from './cryptopanic';
import { etherscanConnector } from './etherscan';
import { blockchairConnector } from './blockchair';
import { tradingEconomicsConnector } from './tradingeconomics';

export interface ConnectorHealthSummary {
  provider: string;
  status: 'healthy' | 'degraded' | 'down';
  requestCount: number;
  errorCount: number;
  configured: boolean;
}

export interface DataFetchResult {
  success: boolean;
  provider: string;
  rowsStored: number;
  error?: string;
  executionTimeMs: number;
}

export class ConnectorManager {
  private connectors = {
    coingecko: coinGeckoConnector,
    binance: binanceConnector,
    twitter: xConnector,
    reddit: redditConnector,
    cryptopanic: cryptoPanicConnector,
    etherscan: etherscanConnector,
    blockchair: blockchairConnector,
    tradingeconomics: tradingEconomicsConnector,
  };

  private readonly supportedSymbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT', 'DOTUSDT', 
    'LINKUSDT', 'MATICUSDT', 'AVAXUSDT'
  ];

  /**
   * Fetch market data from CoinGecko and Binance
   */
  async fetchMarketData(symbols: string[] = this.supportedSymbols): Promise<DataFetchResult[]> {
    const results: DataFetchResult[] = [];

    // Fetch OHLCV from CoinGecko
    const coinGeckoStart = Date.now();
    try {
      let totalRows = 0;
      for (const symbol of symbols) {
        const bars = await this.connectors.coingecko.fetchOHLCV(symbol, '1h', 24);
        if (bars.length > 0) {
          await this.connectors.coingecko.storeMarketBars(bars);
          totalRows += bars.length;
        }
      }
      
      results.push({
        success: true,
        provider: 'coingecko',
        rowsStored: totalRows,
        executionTimeMs: Date.now() - coinGeckoStart,
      });
      
      logger.info(`CoinGecko: Stored ${totalRows} market bars`);
    } catch (error: any) {
      results.push({
        success: false,
        provider: 'coingecko',
        rowsStored: 0,
        error: error.message,
        executionTimeMs: Date.now() - coinGeckoStart,
      });
      logger.error('Failed to fetch CoinGecko data', error);
    }

    // Fetch klines from Binance
    const binanceStart = Date.now();
    try {
      let totalRows = 0;
      for (const symbol of symbols) {
        const bars = await this.connectors.binance.fetchKlines(symbol, '1h', 100);
        if (bars.length > 0) {
          await this.connectors.binance.storeMarketBars(bars);
          totalRows += bars.length;
        }
      }
      
      results.push({
        success: true,
        provider: 'binance',
        rowsStored: totalRows,
        executionTimeMs: Date.now() - binanceStart,
      });
      
      logger.info(`Binance: Stored ${totalRows} market bars`);
    } catch (error: any) {
      results.push({
        success: false,
        provider: 'binance',
        rowsStored: 0,
        error: error.message,
        executionTimeMs: Date.now() - binanceStart,
      });
      logger.error('Failed to fetch Binance data', error);
    }

    return results;
  }

  /**
   * Fetch sentiment data from social sources
   */
  async fetchSentimentData(symbols: string[] = this.supportedSymbols): Promise<DataFetchResult[]> {
    const results: DataFetchResult[] = [];

    // Fetch from X (Twitter)
    const twitterStart = Date.now();
    try {
      let totalRows = 0;
      for (const symbol of symbols) {
        const ticks = await this.connectors.twitter.fetchTweetsBySymbol(symbol, 50);
        if (ticks.length > 0) {
          await this.connectors.twitter.storeSentimentTicks(ticks);
          totalRows += ticks.length;
        }
      }
      
      results.push({
        success: true,
        provider: 'twitter',
        rowsStored: totalRows,
        executionTimeMs: Date.now() - twitterStart,
      });
      
      logger.info(`Twitter: Stored ${totalRows} sentiment ticks`);
    } catch (error: any) {
      results.push({
        success: false,
        provider: 'twitter',
        rowsStored: 0,
        error: error.message,
        executionTimeMs: Date.now() - twitterStart,
      });
      logger.error('Failed to fetch Twitter data', error);
    }

    // Fetch from Reddit
    const redditStart = Date.now();
    try {
      let totalRows = 0;
      for (const symbol of symbols) {
        const ticks = await this.connectors.reddit.fetchPostsBySymbol(symbol, 25);
        if (ticks.length > 0) {
          await this.connectors.reddit.storeSentimentTicks(ticks);
          totalRows += ticks.length;
        }
      }
      
      results.push({
        success: true,
        provider: 'reddit',
        rowsStored: totalRows,
        executionTimeMs: Date.now() - redditStart,
      });
      
      logger.info(`Reddit: Stored ${totalRows} sentiment ticks`);
    } catch (error: any) {
      results.push({
        success: false,
        provider: 'reddit',
        rowsStored: 0,
        error: error.message,
        executionTimeMs: Date.now() - redditStart,
      });
      logger.error('Failed to fetch Reddit data', error);
    }

    // Fetch from CryptoPanic
    const cryptoPanicStart = Date.now();
    try {
      let totalRows = 0;
      for (const symbol of symbols) {
        const ticks = await this.connectors.cryptopanic.fetchNewsBySymbol(symbol, 25);
        if (ticks.length > 0) {
          await this.connectors.cryptopanic.storeSentimentTicks(ticks);
          totalRows += ticks.length;
        }
      }
      
      results.push({
        success: true,
        provider: 'cryptopanic',
        rowsStored: totalRows,
        executionTimeMs: Date.now() - cryptoPanicStart,
      });
      
      logger.info(`CryptoPanic: Stored ${totalRows} sentiment ticks`);
    } catch (error: any) {
      results.push({
        success: false,
        provider: 'cryptopanic',
        rowsStored: 0,
        error: error.message,
        executionTimeMs: Date.now() - cryptoPanicStart,
      });
      logger.error('Failed to fetch CryptoPanic data', error);
    }

    return results;
  }

  /**
   * Fetch on-chain data from blockchain sources
   */
  async fetchOnChainData(): Promise<DataFetchResult[]> {
    const results: DataFetchResult[] = [];

    // Fetch Ethereum data from Etherscan
    const etherscanStart = Date.now();
    try {
      const gasMetrics = await this.connectors.etherscan.fetchGasMetrics();
      const whaleActivity = await this.connectors.etherscan.fetchWhaleTransactions();
      const supplyMetrics = await this.connectors.etherscan.fetchEthSupplyMetrics();
      
      const allTicks = [...gasMetrics, ...whaleActivity, ...supplyMetrics];
      if (allTicks.length > 0) {
        await this.connectors.etherscan.storeOnchainTicks(allTicks);
      }
      
      results.push({
        success: true,
        provider: 'etherscan',
        rowsStored: allTicks.length,
        executionTimeMs: Date.now() - etherscanStart,
      });
      
      logger.info(`Etherscan: Stored ${allTicks.length} onchain ticks`);
    } catch (error: any) {
      results.push({
        success: false,
        provider: 'etherscan',
        rowsStored: 0,
        error: error.message,
        executionTimeMs: Date.now() - etherscanStart,
      });
      logger.error('Failed to fetch Etherscan data', error);
    }

    // Fetch Bitcoin data from Blockchair
    const blockchairStart = Date.now();
    try {
      const btcStats = await this.connectors.blockchair.fetchBitcoinStats();
      const whaleActivity = await this.connectors.blockchair.fetchWhaleActivity();
      
      const allTicks = [...btcStats, ...whaleActivity];
      if (allTicks.length > 0) {
        await this.connectors.blockchair.storeOnchainTicks(allTicks);
      }
      
      results.push({
        success: true,
        provider: 'blockchair',
        rowsStored: allTicks.length,
        executionTimeMs: Date.now() - blockchairStart,
      });
      
      logger.info(`Blockchair: Stored ${allTicks.length} onchain ticks`);
    } catch (error: any) {
      results.push({
        success: false,
        provider: 'blockchair',
        rowsStored: 0,
        error: error.message,
        executionTimeMs: Date.now() - blockchairStart,
      });
      logger.error('Failed to fetch Blockchair data', error);
    }

    return results;
  }

  /**
   * Fetch macro economic data from Trading Economics
   */
  async fetchMacroData(): Promise<DataFetchResult[]> {
    const results: DataFetchResult[] = [];

    const tradingEconomicsStart = Date.now();
    try {
      const calendarEvents = await this.connectors.tradingeconomics.fetchCalendarEvents(7);
      const fedEvents = await this.connectors.tradingeconomics.fetchFedRateDecisions();
      
      const allEvents = [...calendarEvents, ...fedEvents];
      if (allEvents.length > 0) {
        await this.connectors.tradingeconomics.storeMacroEvents(allEvents);
      }
      
      results.push({
        success: true,
        provider: 'tradingeconomics',
        rowsStored: allEvents.length,
        executionTimeMs: Date.now() - tradingEconomicsStart,
      });
      
      logger.info(`Trading Economics: Stored ${allEvents.length} macro events`);
    } catch (error: any) {
      results.push({
        success: false,
        provider: 'tradingeconomics',
        rowsStored: 0,
        error: error.message,
        executionTimeMs: Date.now() - tradingEconomicsStart,
      });
      logger.error('Failed to fetch Trading Economics data', error);
    }

    return results;
  }

  /**
   * Fetch all data from all connectors
   */
  async fetchAllData(): Promise<{ summary: { totalRows: number; successCount: number; failureCount: number }; results: DataFetchResult[] }> {
    logger.info('Starting comprehensive data fetch from all 8 connectors');
    const startTime = Date.now();

    const allResults: DataFetchResult[] = [];
    
    // Run all data fetches in parallel for efficiency
    const [marketResults, sentimentResults, onchainResults, macroResults] = await Promise.all([
      this.fetchMarketData(),
      this.fetchSentimentData(), 
      this.fetchOnChainData(),
      this.fetchMacroData(),
    ]);

    allResults.push(...marketResults, ...sentimentResults, ...onchainResults, ...macroResults);

    const totalRows = allResults.reduce((sum, result) => sum + result.rowsStored, 0);
    const successCount = allResults.filter(r => r.success).length;
    const failureCount = allResults.filter(r => !r.success).length;
    const executionTimeMs = Date.now() - startTime;

    logger.info(`Data fetch completed: ${totalRows} total rows, ${successCount} successes, ${failureCount} failures in ${executionTimeMs}ms`);

    return {
      summary: { totalRows, successCount, failureCount },
      results: allResults,
    };
  }

  /**
   * Get health status of all connectors
   */
  async getAllConnectorHealth(): Promise<ConnectorHealthSummary[]> {
    const healthSummaries: ConnectorHealthSummary[] = [];

    for (const [provider, connector] of Object.entries(this.connectors)) {
      try {
        const health = await connector.getHealthStatus();
        healthSummaries.push({
          provider,
          status: health.status as 'healthy' | 'degraded' | 'down',
          requestCount: health.requestCount,
          errorCount: health.errorCount,
          configured: 'configured' in health ? health.configured : true,
        });
      } catch (error) {
        healthSummaries.push({
          provider,
          status: 'down',
          requestCount: 0,
          errorCount: 1,
          configured: false,
        });
      }
    }

    return healthSummaries;
  }

  /**
   * Start real-time data streams (WebSocket connections)
   */
  startRealTimeStreams(): void {
    logger.info('Starting real-time data streams');

    // Start Binance WebSocket for order book updates
    this.connectors.binance.startBookTickerStream(this.supportedSymbols, async (orderBookSnap) => {
      try {
        await this.connectors.binance.storeOrderBookSnap(orderBookSnap);
      } catch (error) {
        logger.error('Failed to store real-time order book data', error);
      }
    });

    logger.info('Real-time streams started successfully');
  }

  /**
   * Stop all connections and clean up
   */
  shutdown(): void {
    logger.info('Shutting down connector manager');
    
    // Close WebSocket connections
    this.connectors.binance.closeWebSocketConnections();
    
    // Reset daily counters for all connectors
    Object.values(this.connectors).forEach(connector => {
      if (connector.resetDailyCounters) {
        connector.resetDailyCounters();
      }
    });
    
    logger.info('Connector manager shutdown complete');
  }
}

// Export singleton instance
export const connectorManager = new ConnectorManager();