import { logger } from '../utils/logger';

interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol: string;
}

export interface DataQualityStats {
  totalCandles: number;
  quarantinedCandles: number;
  schemaViolations: number;
  spikeDetections: number;
  lastCheck: Date;
}

export class DataQuality {
  private static instance: DataQuality;
  private stats: DataQualityStats;
  private quarantinedCandles: OHLCVData[] = [];
  private priceHistory: Map<string, number[]> = new Map();

  public static getInstance(): DataQuality {
    if (!DataQuality.instance) {
      DataQuality.instance = new DataQuality();
    }
    return DataQuality.instance;
  }

  constructor() {
    this.stats = {
      totalCandles: 0,
      quarantinedCandles: 0,
      schemaViolations: 0,
      spikeDetections: 0,
      lastCheck: new Date()
    };
  }

  validateOHLCV(candle: OHLCVData): { valid: boolean; reason?: string; sanitized?: OHLCVData } {
    this.stats.totalCandles++;
    this.stats.lastCheck = new Date();

    // Schema validation
    const schemaResult = this.validateSchema(candle);
    if (!schemaResult.valid) {
      this.stats.schemaViolations++;
      logger.warn(`[DataQuality] Schema violation for ${candle.symbol}: ${schemaResult.reason}`);
      return schemaResult;
    }

    // Spike detection
    const spikeResult = this.detectSpike(candle);
    if (!spikeResult.valid) {
      this.stats.spikeDetections++;
      this.quarantineCandle(candle, spikeResult.reason || 'Spike detected');
      logger.warn(`[DataQuality] Spike detected for ${candle.symbol}: ${spikeResult.reason}`);
      return spikeResult;
    }

    // Update price history for future spike detection
    this.updatePriceHistory(candle.symbol, candle.close);

    return { valid: true, sanitized: candle };
  }

  private validateSchema(candle: OHLCVData): { valid: boolean; reason?: string } {
    // Check for finite numbers
    const prices = [candle.open, candle.high, candle.low, candle.close];
    for (const price of prices) {
      if (!isFinite(price) || isNaN(price) || price <= 0) {
        return { valid: false, reason: `Invalid price: ${price}` };
      }
    }

    // Check volume
    if (!isFinite(candle.volume) || isNaN(candle.volume) || candle.volume < 0) {
      return { valid: false, reason: `Invalid volume: ${candle.volume}` };
    }

    // Check timestamp
    if (!isFinite(candle.timestamp) || isNaN(candle.timestamp) || candle.timestamp <= 0) {
      return { valid: false, reason: `Invalid timestamp: ${candle.timestamp}` };
    }

    // Check OHLC relationship
    if (candle.high < Math.max(candle.open, candle.close, candle.low)) {
      return { valid: false, reason: 'High is less than other prices' };
    }

    if (candle.low > Math.min(candle.open, candle.close, candle.high)) {
      return { valid: false, reason: 'Low is greater than other prices' };
    }

    return { valid: true };
  }

  private detectSpike(candle: OHLCVData): { valid: boolean; reason?: string } {
    const history = this.priceHistory.get(candle.symbol);
    if (!history || history.length < 10) {
      // Not enough history for spike detection
      return { valid: true };
    }

    // Calculate z-score for the close price
    const mean = history.reduce((sum, price) => sum + price, 0) / history.length;
    const variance = history.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / history.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
      return { valid: true }; // No variance in data
    }

    const zScore = Math.abs((candle.close - mean) / stdDev);
    const zScoreThreshold = 3.0; // 3 standard deviations

    if (zScore > zScoreThreshold) {
      return {
        valid: false,
        reason: `Price spike detected: z-score ${zScore.toFixed(2)} > ${zScoreThreshold}`
      };
    }

    // Check for impossible price movements (>50% in single candle)
    const lastPrice = history[history.length - 1];
    const changePercent = Math.abs((candle.close - lastPrice) / lastPrice);
    
    if (changePercent > 0.5) {
      return {
        valid: false,
        reason: `Extreme price movement: ${(changePercent * 100).toFixed(2)}% change`
      };
    }

    return { valid: true };
  }

  private updatePriceHistory(symbol: string, price: number): void {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }

    const history = this.priceHistory.get(symbol)!;
    history.push(price);

    // Keep only last 100 prices for efficiency
    if (history.length > 100) {
      history.shift();
    }
  }

  private quarantineCandle(candle: OHLCVData, reason: string): void {
    this.quarantinedCandles.push({
      ...candle,
      timestamp: Date.now() // Mark quarantine time
    });
    this.stats.quarantinedCandles++;

    // Keep only last 100 quarantined candles
    if (this.quarantinedCandles.length > 100) {
      this.quarantinedCandles.shift();
    }

    logger.info(`[DataQuality] Quarantined ${candle.symbol} candle: ${reason}`);
  }

  async fetchReplacementCandle(symbol: string, timestamp: number): Promise<OHLCVData | null> {
    try {
      // In a real system, this would fetch from a backup data source
      // For now, interpolate from nearby candles
      const history = this.priceHistory.get(symbol);
      if (!history || history.length < 2) {
        return null;
      }

      const lastPrice = history[history.length - 1];
      const prevPrice = history[history.length - 2];

      // Simple interpolation
      const interpolatedPrice = (lastPrice + prevPrice) / 2;

      const replacement: OHLCVData = {
        timestamp,
        open: interpolatedPrice,
        high: interpolatedPrice * 1.001,
        low: interpolatedPrice * 0.999,
        close: interpolatedPrice,
        volume: 1000, // Mock volume
        symbol
      };

      logger.info(`[DataQuality] Generated replacement candle for ${symbol}`);
      return replacement;

    } catch (error) {
      logger.error(`[DataQuality] Failed to fetch replacement candle for ${symbol}:`, error);
      return null;
    }
  }

  getStats(): DataQualityStats {
    return { ...this.stats };
  }

  getQuarantinedCandles(limit: number = 10): OHLCVData[] {
    return this.quarantinedCandles.slice(-limit);
  }

  reset(): void {
    this.stats = {
      totalCandles: 0,
      quarantinedCandles: 0,
      schemaViolations: 0,
      spikeDetections: 0,
      lastCheck: new Date()
    };
    this.quarantinedCandles = [];
    this.priceHistory.clear();
    logger.info('[DataQuality] Reset stats and data');
  }
}

export const dataQuality = DataQuality.getInstance();