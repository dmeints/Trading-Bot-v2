
import { logger } from '../utils/logger';
import { z } from 'zod';

// Schemas for data validation
const OHLCVSchema = z.object({
  symbol: z.string(),
  timestamp: z.number(),
  open: z.number().positive(),
  high: z.number().positive(),
  low: z.number().positive(),
  close: z.number().positive(),
  volume: z.number().nonnegative()
});

const L2Schema = z.object({
  symbol: z.string(),
  timestamp: z.number(),
  bids: z.array(z.tuple([z.number().positive(), z.number().positive()])),
  asks: z.array(z.tuple([z.number().positive(), z.number().positive()])),
  sequence: z.number().optional()
});

interface QualityMetrics {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  quarantinedRecords: number;
  anomalies: number;
  lastUpdate: number;
}

interface DataAnomaly {
  type: 'price_spike' | 'volume_spike' | 'missing_data' | 'stale_data' | 'schema_violation';
  symbol: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high';
  details: Record<string, any>;
}

export class DataQuality {
  private metrics: Map<string, QualityMetrics> = new Map();
  private quarantine: Map<string, any[]> = new Map();
  private anomalies: DataAnomaly[] = [];
  private priceHistory: Map<string, number[]> = new Map();
  private volumeHistory: Map<string, number[]> = new Map();

  validateOHLCV(data: any): { isValid: boolean; errors: string[] } {
    try {
      OHLCVSchema.parse(data);
      
      // Additional business logic validation
      const errors: string[] = [];
      
      if (data.high < data.low) {
        errors.push('High price cannot be less than low price');
      }
      
      if (data.close > data.high || data.close < data.low) {
        errors.push('Close price must be within high-low range');
      }
      
      if (data.open > data.high || data.open < data.low) {
        errors.push('Open price must be within high-low range');
      }

      // Check for price spikes
      const priceChange = this.checkPriceSpike(data);
      if (priceChange.isSpike) {
        errors.push(`Potential price spike detected: ${priceChange.changePercent}%`);
        this.recordAnomaly({
          type: 'price_spike',
          symbol: data.symbol,
          timestamp: data.timestamp,
          severity: priceChange.changePercent > 50 ? 'high' : 'medium',
          details: { changePercent: priceChange.changePercent, price: data.close }
        });
      }

      // Check for volume spikes
      const volumeChange = this.checkVolumeSpike(data);
      if (volumeChange.isSpike) {
        this.recordAnomaly({
          type: 'volume_spike',
          symbol: data.symbol,
          timestamp: data.timestamp,
          severity: volumeChange.changeMultiple > 10 ? 'high' : 'medium',
          details: { changeMultiple: volumeChange.changeMultiple, volume: data.volume }
        });
      }

      this.updateMetrics('ohlcv', errors.length === 0);
      
      if (errors.length > 0) {
        this.quarantineData('ohlcv', data, errors);
      }

      return { isValid: errors.length === 0, errors };
    } catch (error) {
      this.updateMetrics('ohlcv', false);
      this.quarantineData('ohlcv', data, ['Schema validation failed']);
      return { isValid: false, errors: ['Schema validation failed'] };
    }
  }

  validateL2(data: any): { isValid: boolean; errors: string[] } {
    try {
      L2Schema.parse(data);
      
      const errors: string[] = [];
      
      // Check bid/ask spread sanity
      if (data.bids.length > 0 && data.asks.length > 0) {
        const topBid = data.bids[0][0];
        const topAsk = data.asks[0][0];
        
        if (topBid >= topAsk) {
          errors.push('Crossed book: top bid >= top ask');
        }
        
        const spread = topAsk - topBid;
        const midPrice = (topBid + topAsk) / 2;
        const spreadPercent = (spread / midPrice) * 100;
        
        if (spreadPercent > 10) { // 10% spread threshold
          errors.push(`Abnormally wide spread: ${spreadPercent.toFixed(2)}%`);
        }
      }
      
      // Check for proper price/size ordering
      let lastBidPrice = Infinity;
      for (const [price, size] of data.bids) {
        if (price > lastBidPrice) {
          errors.push('Bids not properly ordered (descending)');
          break;
        }
        if (size <= 0) {
          errors.push('Invalid bid size');
          break;
        }
        lastBidPrice = price;
      }
      
      let lastAskPrice = 0;
      for (const [price, size] of data.asks) {
        if (price < lastAskPrice) {
          errors.push('Asks not properly ordered (ascending)');
          break;
        }
        if (size <= 0) {
          errors.push('Invalid ask size');
          break;
        }
        lastAskPrice = price;
      }

      this.updateMetrics('l2', errors.length === 0);
      
      if (errors.length > 0) {
        this.quarantineData('l2', data, errors);
      }

      return { isValid: errors.length === 0, errors };
    } catch (error) {
      this.updateMetrics('l2', false);
      this.quarantineData('l2', data, ['Schema validation failed']);
      return { isValid: false, errors: ['Schema validation failed'] };
    }
  }

  private checkPriceSpike(data: any): { isSpike: boolean; changePercent: number } {
    const symbol = data.symbol;
    const currentPrice = data.close;
    
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }
    
    const history = this.priceHistory.get(symbol)!;
    
    if (history.length === 0) {
      history.push(currentPrice);
      return { isSpike: false, changePercent: 0 };
    }
    
    const lastPrice = history[history.length - 1];
    const changePercent = Math.abs((currentPrice - lastPrice) / lastPrice) * 100;
    
    // Add to history (keep last 100 prices)
    history.push(currentPrice);
    if (history.length > 100) {
      history.shift();
    }
    
    // Consider >20% price change as spike
    return { isSpike: changePercent > 20, changePercent };
  }

  private checkVolumeSpike(data: any): { isSpike: boolean; changeMultiple: number } {
    const symbol = data.symbol;
    const currentVolume = data.volume;
    
    if (!this.volumeHistory.has(symbol)) {
      this.volumeHistory.set(symbol, []);
    }
    
    const history = this.volumeHistory.get(symbol)!;
    
    if (history.length < 10) { // Need some history
      history.push(currentVolume);
      return { isSpike: false, changeMultiple: 1 };
    }
    
    // Calculate average of last 10 volumes
    const avgVolume = history.slice(-10).reduce((sum, vol) => sum + vol, 0) / 10;
    const changeMultiple = currentVolume / avgVolume;
    
    // Add to history (keep last 100 volumes)
    history.push(currentVolume);
    if (history.length > 100) {
      history.shift();
    }
    
    // Consider >5x average volume as spike
    return { isSpike: changeMultiple > 5, changeMultiple };
  }

  private recordAnomaly(anomaly: DataAnomaly): void {
    this.anomalies.push(anomaly);
    
    // Keep only last 1000 anomalies
    if (this.anomalies.length > 1000) {
      this.anomalies.shift();
    }
    
    logger.warn(`[DataQuality] Anomaly detected: ${anomaly.type}`, anomaly);
  }

  private updateMetrics(dataType: string, isValid: boolean): void {
    if (!this.metrics.has(dataType)) {
      this.metrics.set(dataType, {
        totalRecords: 0,
        validRecords: 0,
        invalidRecords: 0,
        quarantinedRecords: 0,
        anomalies: 0,
        lastUpdate: Date.now()
      });
    }
    
    const metrics = this.metrics.get(dataType)!;
    metrics.totalRecords++;
    metrics.lastUpdate = Date.now();
    
    if (isValid) {
      metrics.validRecords++;
    } else {
      metrics.invalidRecords++;
    }
  }

  private quarantineData(dataType: string, data: any, errors: string[]): void {
    if (!this.quarantine.has(dataType)) {
      this.quarantine.set(dataType, []);
    }
    
    const quarantineData = {
      data,
      errors,
      timestamp: Date.now(),
      id: `${dataType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    const quarantineList = this.quarantine.get(dataType)!;
    quarantineList.push(quarantineData);
    
    // Keep only last 100 quarantined items per type
    if (quarantineList.length > 100) {
      quarantineList.shift();
    }
    
    // Update quarantine counter
    const metrics = this.metrics.get(dataType);
    if (metrics) {
      metrics.quarantinedRecords++;
    }
    
    logger.warn(`[DataQuality] Data quarantined: ${dataType}`, {
      id: quarantineData.id,
      errors
    });
  }

  getStats(): Record<string, any> {
    const stats: Record<string, any> = {
      timestamp: Date.now(),
      dataTypes: {},
      quarantine: {},
      recentAnomalies: this.anomalies.slice(-20)
    };
    
    // Aggregate metrics by data type
    for (const [dataType, metrics] of this.metrics) {
      stats.dataTypes[dataType] = {
        ...metrics,
        successRate: metrics.totalRecords > 0 ? 
          (metrics.validRecords / metrics.totalRecords) * 100 : 0
      };
    }
    
    // Quarantine summary
    for (const [dataType, quarantineList] of this.quarantine) {
      stats.quarantine[dataType] = {
        count: quarantineList.length,
        latest: quarantineList.slice(-5)
      };
    }
    
    return stats;
  }

  getQuarantineData(dataType: string, limit: number = 10): any[] {
    const quarantineList = this.quarantine.get(dataType) || [];
    return quarantineList.slice(-limit);
  }

  getAnomalies(limit: number = 50): DataAnomaly[] {
    return this.anomalies.slice(-limit);
  }

  clearQuarantine(dataType: string): void {
    this.quarantine.set(dataType, []);
    logger.info(`[DataQuality] Cleared quarantine for ${dataType}`);
  }

  isHealthy(): boolean {
    for (const [dataType, metrics] of this.metrics) {
      const successRate = metrics.totalRecords > 0 ? 
        (metrics.validRecords / metrics.totalRecords) * 100 : 100;
      
      if (successRate < 95) { // Less than 95% success rate is unhealthy
        return false;
      }
    }
    
    return true;
  }
}

export const dataQuality = new DataQuality();
