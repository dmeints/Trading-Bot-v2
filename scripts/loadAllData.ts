#!/usr/bin/env tsx
/**
 * Stevie v1.3 - Comprehensive Data Ingestion Script
 * Fetches all market data streams for enhanced AI decision making
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import WebSocket from 'ws';
// import { createObjectCsvWriter } from 'csv-writer';

interface DataConfig {
  symbols: string[];
  dataPath: string;
  scheduledFetch: boolean;
  workers: number;
}

class ComprehensiveDataLoader {
  private config: DataConfig;
  private activeConnections: Map<string, WebSocket> = new Map();

  constructor(config: DataConfig) {
    this.config = config;
    this.ensureDataDirectories();
  }

  private ensureDataDirectories(): void {
    const dirs = [
      'data/historical',
      'data/realtime',
      'data/sentiment',
      'data/onchain',
      'data/events',
      'data/funding'
    ];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // 1. Exchange & Order-Book Streams
  async startExchangeStreams(): Promise<void> {
    console.log('[DataLoader] Starting exchange WebSocket streams...');
    
    for (const symbol of this.config.symbols) {
      await this.subscribeBinanceStream(symbol);
      await this.subscribeCoinbaseStream(symbol);
    }
  }

  private async subscribeBinanceStream(symbol: string): Promise<void> {
    const wsUrl = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@depth@100ms`;
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
      console.log(`[Binance] Connected to ${symbol} depth stream`);
    });

    ws.on('message', (data: Buffer) => {
      try {
        const depthData = JSON.parse(data.toString());
        this.saveOrderBookData(symbol, 'binance', depthData);
      } catch (error) {
        console.error(`[Binance] Error processing ${symbol}:`, error);
      }
    });

    this.activeConnections.set(`binance-${symbol}`, ws);
  }

  private async subscribeCoinbaseStream(symbol: string): Promise<void> {
    const wsUrl = 'wss://ws-feed.exchange.coinbase.com';
    const ws = new WebSocket(wsUrl);
    
    const coinbaseSymbol = symbol.replace('USDT', '-USD');
    
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'subscribe',
        product_ids: [coinbaseSymbol],
        channels: ['level2', 'ticker', 'trades']
      }));
      console.log(`[Coinbase] Subscribed to ${coinbaseSymbol} streams`);
    });

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'l2update' || message.type === 'ticker') {
          this.saveOrderBookData(symbol, 'coinbase', message);
        }
      } catch (error) {
        console.error(`[Coinbase] Error processing ${symbol}:`, error);
      }
    });

    this.activeConnections.set(`coinbase-${symbol}`, ws);
  }

  private saveOrderBookData(symbol: string, exchange: string, data: any): void {
    const filename = path.join('data/historical', `${symbol}_${exchange}_depth.csv`);
    const timestamp = new Date().toISOString();
    
    const csvData = {
      timestamp,
      symbol,
      exchange,
      bids: JSON.stringify(data.bids || data.b || []),
      asks: JSON.stringify(data.asks || data.a || []),
      raw: JSON.stringify(data)
    };

    // Append to CSV (create header if new file)
    if (!fs.existsSync(filename)) {
      const headers = Object.keys(csvData).join(',');
      const values = Object.values(csvData).map(v => `"${v}"`).join(',');
      fs.writeFileSync(filename, `${headers}\n${values}`);
    } else {
      const values = Object.values(csvData).map(v => `"${v}"`).join(',');
      fs.appendFileSync(filename, `\n${values}`);
    }
  }

  // 2. On-Chain Metrics
  async fetchOnChainData(): Promise<void> {
    console.log('[DataLoader] Fetching on-chain metrics...');
    
    for (const symbol of this.config.symbols) {
      if (symbol.includes('BTC')) {
        await this.fetchBitcoinOnChain(symbol);
      } else if (symbol.includes('ETH')) {
        await this.fetchEthereumOnChain(symbol);
      }
    }
  }

  private async fetchBitcoinOnChain(symbol: string): Promise<void> {
    try {
      // Free Bitcoin on-chain data from Blockchair API
      const response = await axios.get('https://api.blockchair.com/bitcoin/stats');
      const data = response.data.data;
      
      const onChainData = {
        timestamp: new Date().toISOString(),
        symbol,
        difficulty: data.difficulty,
        hashrate: data.hashrate_24h,
        mempool_transactions: data.mempool_transactions,
        mempool_size: data.mempool_size,
        blocks_24h: data.blocks_24h,
        volume_24h: data.volume_24h
      };

      this.saveToCSV(`data/historical/${symbol}_onchain.csv`, onChainData);
    } catch (error) {
      console.error(`[OnChain] Error fetching Bitcoin data:`, error);
    }
  }

  private async fetchEthereumOnChain(symbol: string): Promise<void> {
    try {
      // Ethereum on-chain metrics from Etherscan (free tier)
      const apiKey = process.env.ETHERSCAN_API_KEY || 'demo';
      const response = await axios.get(`https://api.etherscan.io/api?module=stats&action=ethsupply&apikey=${apiKey}`);
      
      const gasResponse = await axios.get(`https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${apiKey}`);
      
      const onChainData = {
        timestamp: new Date().toISOString(),
        symbol,
        total_supply: response.data.result,
        gas_safe: gasResponse.data.result.SafeGasPrice,
        gas_standard: gasResponse.data.result.StandardGasPrice,
        gas_fast: gasResponse.data.result.FastGasPrice
      };

      this.saveToCSV(`data/historical/${symbol}_onchain.csv`, onChainData);
    } catch (error) {
      console.error(`[OnChain] Error fetching Ethereum data:`, error);
    }
  }

  // 3. Social Sentiment Analysis
  async fetchSocialSentiment(): Promise<void> {
    console.log('[DataLoader] Analyzing social sentiment...');
    
    for (const symbol of this.config.symbols) {
      await this.analyzeCryptoSentiment(symbol);
    }
  }

  private async analyzeCryptoSentiment(symbol: string): Promise<void> {
    try {
      // Using free crypto sentiment API
      const response = await axios.get(`https://api.alternative.me/fng/?limit=1`);
      const fearGreedData = response.data.data[0];
      
      // Social media mentions (using CoinGecko trending)
      const trendingResponse = await axios.get('https://api.coingecko.com/api/v3/search/trending');
      const trending = trendingResponse.data.coins;
      
      const coinId = symbol.toLowerCase().replace('usdt', '');
      const isToTrending = trending.some((coin: any) => 
        coin.item.symbol.toLowerCase() === coinId.replace('btc', 'bitcoin').replace('eth', 'ethereum')
      );
      
      const sentimentData = {
        timestamp: new Date().toISOString(),
        symbol,
        fear_greed_index: fearGreedData.value,
        fear_greed_classification: fearGreedData.value_classification,
        is_trending: isToTrending,
        sentiment_score: this.calculateSentimentScore(fearGreedData.value, isToTrending)
      };

      this.saveToCSV(`data/historical/${symbol}_sentiment.csv`, sentimentData);
    } catch (error) {
      console.error(`[Sentiment] Error analyzing ${symbol}:`, error);
    }
  }

  private calculateSentimentScore(fearGreed: number, trending: boolean): number {
    // Normalize fear/greed to -1 to 1 scale
    let score = (fearGreed - 50) / 50;
    
    // Boost if trending
    if (trending) {
      score *= 1.2;
    }
    
    return Math.max(-1, Math.min(1, score));
  }

  // 4. Economic Events Calendar
  async fetchEconomicEvents(): Promise<void> {
    console.log('[DataLoader] Fetching economic events...');
    
    try {
      // Free economic calendar from Trading Economics
      const response = await axios.get('https://api.tradingeconomics.com/calendar?c=guest:guest&f=json');
      
      const events = response.data.map((event: any) => ({
        timestamp: new Date().toISOString(),
        event_date: event.Date,
        country: event.Country,
        event_name: event.Event,
        actual: event.Actual,
        forecast: event.Forecast,
        previous: event.Previous,
        importance: event.Importance,
        impact_score: this.calculateEventImpact(event.Importance, event.Country)
      }));

      this.saveToCSV('data/historical/events.csv', events, true);
    } catch (error) {
      console.error('[Events] Error fetching economic events:', error);
    }
  }

  private calculateEventImpact(importance: string, country: string): number {
    let impact = 0;
    
    // Importance scoring
    if (importance === 'High') impact += 0.8;
    else if (importance === 'Medium') impact += 0.5;
    else impact += 0.2;
    
    // Country impact (US events have higher crypto correlation)
    if (country === 'United States') impact *= 1.5;
    else if (['China', 'Japan', 'European Union'].includes(country)) impact *= 1.2;
    
    return Math.min(1, impact);
  }

  // 5. Derivatives & Funding Rates
  async fetchDerivativesData(): Promise<void> {
    console.log('[DataLoader] Fetching derivatives data...');
    
    for (const symbol of this.config.symbols) {
      await this.fetchFundingRates(symbol);
      await this.fetchOpenInterest(symbol);
    }
  }

  private async fetchFundingRates(symbol: string): Promise<void> {
    try {
      // Binance futures funding rate
      const response = await axios.get(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}`);
      const latestRate = response.data[response.data.length - 1];
      
      const fundingData = {
        timestamp: new Date().toISOString(),
        symbol,
        funding_rate: parseFloat(latestRate.fundingRate),
        funding_time: new Date(latestRate.fundingTime).toISOString(),
        annualized_rate: parseFloat(latestRate.fundingRate) * 365 * 3 // 3 times daily
      };

      this.saveToCSV(`data/historical/${symbol}_funding.csv`, fundingData);
    } catch (error) {
      console.error(`[Funding] Error fetching rates for ${symbol}:`, error);
    }
  }

  private async fetchOpenInterest(symbol: string): Promise<void> {
    try {
      // Binance open interest
      const response = await axios.get(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`);
      
      const oiData = {
        timestamp: new Date().toISOString(),
        symbol,
        open_interest: parseFloat(response.data.openInterest),
        open_interest_value: parseFloat(response.data.openInterestValue || '0')
      };

      this.saveToCSV(`data/historical/${symbol}_oi.csv`, oiData);
    } catch (error) {
      console.error(`[OpenInterest] Error fetching data for ${symbol}:`, error);
    }
  }

  // Utility Methods
  private saveToCSV(filename: string, data: any, isArray = false): void {
    const records = isArray ? data : [data];
    
    if (!fs.existsSync(filename)) {
      // Create new file with headers
      const headers = Object.keys(records[0]);
      const csvContent = [
        headers.join(','),
        ...records.map((record: any) => headers.map(h => `"${record[h] || ''}"`).join(','))
      ].join('\n');
      
      fs.writeFileSync(filename, csvContent);
    } else {
      // Append to existing file
      const lines = records.map((record: any) => 
        Object.values(record).map(v => `"${v || ''}"`).join(',')
      ).join('\n');
      
      fs.appendFileSync(filename, '\n' + lines);
    }
  }

  // Main execution methods
  async runOneShot(): Promise<void> {
    console.log('[DataLoader] Running one-shot data collection...');
    
    await Promise.all([
      this.fetchOnChainData(),
      this.fetchSocialSentiment(),
      this.fetchEconomicEvents(),
      this.fetchDerivativesData()
    ]);
    
    console.log('[DataLoader] One-shot collection completed');
  }

  async runStreaming(): Promise<void> {
    console.log('[DataLoader] Starting streaming data collection...');
    
    // Start WebSocket streams
    await this.startExchangeStreams();
    
    // Schedule periodic updates
    setInterval(() => this.fetchOnChainData(), 60000 * 5); // Every 5 minutes
    setInterval(() => this.fetchSocialSentiment(), 60000 * 2); // Every 2 minutes
    setInterval(() => this.fetchEconomicEvents(), 60000 * 15); // Every 15 minutes
    setInterval(() => this.fetchDerivativesData(), 60000 * 1); // Every minute
    
    console.log('[DataLoader] Streaming collection started');
  }

  async shutdown(): Promise<void> {
    console.log('[DataLoader] Shutting down data collection...');
    
    for (const [name, ws] of this.activeConnections) {
      ws.close();
      console.log(`[DataLoader] Closed connection: ${name}`);
    }
    
    this.activeConnections.clear();
  }
}

// CLI Interface
async function main() {
  const config: DataConfig = {
    symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT'],
    dataPath: 'data',
    scheduledFetch: process.argv.includes('--scheduled'),
    workers: parseInt(process.argv.find(arg => arg.startsWith('--workers='))?.split('=')[1] || '1')
  };

  const loader = new ComprehensiveDataLoader(config);
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[DataLoader] Received SIGINT, shutting down gracefully...');
    await loader.shutdown();
    process.exit(0);
  });

  if (process.argv.includes('--oneshot')) {
    await loader.runOneShot();
    process.exit(0);
  } else {
    await loader.runStreaming();
    
    // Keep process alive
    process.stdin.resume();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { ComprehensiveDataLoader };