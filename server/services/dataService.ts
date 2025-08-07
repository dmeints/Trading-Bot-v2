/**
 * PHASE 1: LAZY CSV READER - STREAMING DATA SERVICE
 * Efficiently streams historical data from CSV files with caching
 */

import fs from 'fs';
import path from 'path';
import { Transform } from 'stream';
import { logger } from '../utils/logger';

export interface HistoricalBar {
  timestamp: number;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookSnapshot {
  timestamp: number;
  symbol: string;
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
  spread: number;
}

export interface OnChainEvent {
  timestamp: number;
  symbol: string;
  whale_transfers: number;
  large_tx_count: number;
  exchange_flows: number;
  active_addresses: number;
}

export interface SentimentPoint {
  timestamp: number;
  symbol: string;
  sentiment: number;
  confidence: number;
  source: string;
}

export interface FundingRate {
  timestamp: number;
  symbol: string;
  funding_rate: number;
  predicted_rate: number;
  open_interest: number;
}

export interface EconomicEvent {
  timestamp: number;
  event: string;
  impact: 'high' | 'medium' | 'low';
  actual: number | null;
  forecast: number | null;
  previous: number | null;
}

export class HistoricalDataService {
  private readonly dataDir = './data/historical';
  private cache: Map<string, any[]> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();
  private readonly cacheExpiry = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.ensureDataDirectory();
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      logger.warn(`Historical data directory ${this.dataDir} does not exist. Run loadAllData.ts first.`);
    }
  }

  private isCacheValid(key: string): boolean {
    const timestamp = this.cacheTimestamps.get(key);
    return timestamp ? (Date.now() - timestamp) < this.cacheExpiry : false;
  }

  private async loadCSVData<T>(filepath: string, parser: (row: string[]) => T): Promise<T[]> {
    const cacheKey = filepath;
    
    if (this.cache.has(cacheKey) && this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey) as T[];
    }

    try {
      const fullPath = path.join(this.dataDir, filepath);
      
      if (!fs.existsSync(fullPath)) {
        logger.warn(`CSV file not found: ${fullPath}`);
        return [];
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      
      const data: T[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = this.parseCSVLine(line);
        if (values.length === headers.length) {
          data.push(parser(values));
        }
      }

      // Cache the result
      this.cache.set(cacheKey, data);
      this.cacheTimestamps.set(cacheKey, Date.now());
      
      logger.info(`Loaded ${data.length} records from ${filepath}`);
      return data;
    } catch (error) {
      logger.error(`Failed to load CSV data from ${filepath}:`, error);
      return [];
    }
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  async getHistoricalBars(symbol: string, startTime?: number, endTime?: number): Promise<HistoricalBar[]> {
    const data = await this.loadCSVData<HistoricalBar>(
      `ohlcv/${symbol}_ohlcv.csv`,
      (row) => ({
        timestamp: parseInt(row[0]),
        symbol: row[1],
        open: parseFloat(row[2]),
        high: parseFloat(row[3]),
        low: parseFloat(row[4]),
        close: parseFloat(row[5]),
        volume: parseFloat(row[6])
      })
    );

    if (startTime || endTime) {
      return data.filter(bar => {
        if (startTime && bar.timestamp < startTime) return false;
        if (endTime && bar.timestamp > endTime) return false;
        return true;
      });
    }

    return data;
  }

  async getOrderBookSnapshots(symbol: string, startTime?: number, endTime?: number): Promise<OrderBookSnapshot[]> {
    // Generate synthetic order book data based on OHLCV
    const bars = await this.getHistoricalBars(symbol, startTime, endTime);
    
    return bars.map(bar => {
      const midPrice = (bar.high + bar.low) / 2;
      const spread = (bar.high - bar.low) * 0.1; // 10% of the range
      
      return {
        timestamp: bar.timestamp,
        symbol: bar.symbol,
        bids: this.generateOrderBookSide(midPrice - spread / 2, false, 10),
        asks: this.generateOrderBookSide(midPrice + spread / 2, true, 10),
        spread: spread / midPrice * 100 // Spread percentage
      };
    });
  }

  private generateOrderBookSide(basePrice: number, isAsk: boolean, levels: number): Array<{ price: number; size: number }> {
    const result = [];
    const step = basePrice * 0.001; // 0.1% steps
    
    for (let i = 0; i < levels; i++) {
      const price = isAsk ? basePrice + (step * i) : basePrice - (step * i);
      const size = (Math.random() * 10 + 1) * (1 - i * 0.1); // Decreasing size with distance
      
      result.push({ price, size });
    }
    
    return result;
  }

  async getOnChainEvents(symbol: string, startTime?: number, endTime?: number): Promise<OnChainEvent[]> {
    const data = await this.loadCSVData<OnChainEvent>(
      `onchain/${symbol}_onchain.csv`,
      (row) => ({
        timestamp: parseInt(row[0]),
        symbol: row[1],
        whale_transfers: parseInt(row[2]),
        large_tx_count: parseInt(row[3]),
        exchange_flows: parseInt(row[4]),
        active_addresses: parseInt(row[5])
      })
    );

    if (startTime || endTime) {
      return data.filter(event => {
        if (startTime && event.timestamp < startTime) return false;
        if (endTime && event.timestamp > endTime) return false;
        return true;
      });
    }

    return data;
  }

  async getSentimentSeries(symbol: string, startTime?: number, endTime?: number): Promise<SentimentPoint[]> {
    const data = await this.loadCSVData<SentimentPoint>(
      `sentiment/${symbol}_sentiment.csv`,
      (row) => ({
        timestamp: parseInt(row[0]),
        symbol: row[1],
        sentiment: parseFloat(row[2]),
        confidence: parseFloat(row[3]),
        source: row[4]
      })
    );

    if (startTime || endTime) {
      return data.filter(point => {
        if (startTime && point.timestamp < startTime) return false;
        if (endTime && point.timestamp > endTime) return false;
        return true;
      });
    }

    return data;
  }

  async getFundingRates(symbol: string, startTime?: number, endTime?: number): Promise<FundingRate[]> {
    const data = await this.loadCSVData<FundingRate>(
      `funding/${symbol}_funding.csv`,
      (row) => ({
        timestamp: parseInt(row[0]),
        symbol: row[1],
        funding_rate: parseFloat(row[2]),
        predicted_rate: parseFloat(row[3]),
        open_interest: parseFloat(row[4])
      })
    );

    if (startTime || endTime) {
      return data.filter(rate => {
        if (startTime && rate.timestamp < startTime) return false;
        if (endTime && rate.timestamp > endTime) return false;
        return true;
      });
    }

    return data;
  }

  async getEconomicEvents(startTime?: number, endTime?: number): Promise<EconomicEvent[]> {
    const data = await this.loadCSVData<EconomicEvent>(
      'macro/economic_events.csv',
      (row) => ({
        timestamp: parseInt(row[0]),
        event: row[1],
        impact: row[2] as 'high' | 'medium' | 'low',
        actual: row[3] ? parseFloat(row[3]) : null,
        forecast: row[4] ? parseFloat(row[4]) : null,
        previous: row[5] ? parseFloat(row[5]) : null
      })
    );

    if (startTime || endTime) {
      return data.filter(event => {
        if (startTime && event.timestamp < startTime) return false;
        if (endTime && event.timestamp > endTime) return false;
        return true;
      });
    }

    return data;
  }

  // Utility methods
  async getLatestBar(symbol: string): Promise<HistoricalBar | null> {
    const bars = await this.getHistoricalBars(symbol);
    return bars.length > 0 ? bars[bars.length - 1] : null;
  }

  async getBarCount(symbol: string): Promise<number> {
    const bars = await this.getHistoricalBars(symbol);
    return bars.length;
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
    logger.info('Historical data cache cleared');
  }
}

export const historicalDataService = new HistoricalDataService();