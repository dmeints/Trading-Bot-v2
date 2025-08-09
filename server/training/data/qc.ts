/**
 * Data Quality Control for Stevie Training
 * UTC normalization, deduplication, gap detection, outlier guards
 */

import { logger } from '../../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface BarData {
  timestamp: Date;
  symbol: string;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  bid?: number;
  ask?: number;
  spread?: number;
  depth_imbalance?: number;
}

export interface QCResults {
  total_bars: number;
  valid_bars: number;
  duplicates_removed: number;
  gaps_detected: number;
  outliers_flagged: number;
  quality_score: number;
}

export class DataQualityController {
  private config: any;
  
  constructor(config: any) {
    this.config = config;
  }
  
  async processSymbol(symbol: string, timeframe: string, data: BarData[]): Promise<{ data: BarData[], results: QCResults }> {
    logger.info('[DataQC] Starting quality control', { symbol, timeframe, bars: data.length });
    
    let processed = [...data];
    const results: QCResults = {
      total_bars: data.length,
      valid_bars: 0,
      duplicates_removed: 0,
      gaps_detected: 0,
      outliers_flagged: 0,
      quality_score: 0
    };
    
    // 1. UTC normalization
    processed = this.normalizeTimestamps(processed);
    
    // 2. Remove duplicates
    const { data: dedupedData, duplicatesRemoved } = this.removeDuplicates(processed);
    processed = dedupedData;
    results.duplicates_removed = duplicatesRemoved;
    
    // 3. Sort by timestamp
    processed.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // 4. Gap detection and flagging
    const gaps = this.detectGaps(processed, timeframe);
    results.gaps_detected = gaps.length;
    
    // 5. Outlier detection and flagging
    const outliers = this.detectOutliers(processed);
    results.outliers_flagged = outliers.length;
    
    // 6. Filter invalid data
    processed = this.filterValidBars(processed);
    results.valid_bars = processed.length;
    
    // 7. Calculate quality score
    results.quality_score = this.calculateQualityScore(results);
    
    logger.info('[DataQC] Quality control complete', { 
      symbol, 
      timeframe, 
      results: {
        ...results,
        retention_rate: `${((results.valid_bars / results.total_bars) * 100).toFixed(2)}%`
      }
    });
    
    return { data: processed, results };
  }
  
  private normalizeTimestamps(data: BarData[]): BarData[] {
    return data.map(bar => ({
      ...bar,
      timestamp: new Date(bar.timestamp.toISOString().replace(/\.\d{3}Z$/, ':00.000Z'))
    }));
  }
  
  private removeDuplicates(data: BarData[]): { data: BarData[], duplicatesRemoved: number } {
    const seen = new Set<string>();
    const unique: BarData[] = [];
    let duplicatesRemoved = 0;
    
    for (const bar of data) {
      const key = `${bar.symbol}_${bar.timeframe}_${bar.timestamp.getTime()}`;
      if (seen.has(key)) {
        duplicatesRemoved++;
      } else {
        seen.add(key);
        unique.push(bar);
      }
    }
    
    return { data: unique, duplicatesRemoved };
  }
  
  private detectGaps(data: BarData[], timeframe: string): Array<{ index: number, gapMinutes: number }> {
    const gaps: Array<{ index: number, gapMinutes: number }> = [];
    const expectedInterval = this.getExpectedInterval(timeframe);
    const maxGap = this.config.data?.max_gap_minutes || 5;
    
    for (let i = 1; i < data.length; i++) {
      const timeDiff = data[i].timestamp.getTime() - data[i-1].timestamp.getTime();
      const minuteDiff = timeDiff / (1000 * 60);
      
      if (minuteDiff > expectedInterval + maxGap) {
        gaps.push({ index: i, gapMinutes: minuteDiff });
      }
    }
    
    return gaps;
  }
  
  private detectOutliers(data: BarData[]): Array<{ index: number, reason: string, value: number }> {
    const outliers: Array<{ index: number, reason: string, value: number }> = [];
    const threshold = this.config.data?.outlier_std_threshold || 4.0;
    
    // Price outliers (based on returns)
    const returns = data.slice(1).map((bar, i) => 
      Math.log(bar.close / data[i].close)
    );
    
    if (returns.length > 10) {
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
      const stdDev = Math.sqrt(variance);
      
      returns.forEach((ret, i) => {
        const zScore = Math.abs((ret - mean) / stdDev);
        if (zScore > threshold) {
          outliers.push({
            index: i + 1,
            reason: 'extreme_return',
            value: ret
          });
        }
      });
    }
    
    // Volume outliers
    const volumes = data.map(bar => bar.volume).filter(v => v > 0);
    if (volumes.length > 10) {
      const volumeMean = volumes.reduce((a, b) => a + b, 0) / volumes.length;
      const volumeStd = Math.sqrt(volumes.reduce((a, b) => a + Math.pow(b - volumeMean, 2), 0) / volumes.length);
      
      data.forEach((bar, i) => {
        if (bar.volume > 0) {
          const zScore = Math.abs((bar.volume - volumeMean) / volumeStd);
          if (zScore > threshold) {
            outliers.push({
              index: i,
              reason: 'extreme_volume',
              value: bar.volume
            });
          }
        }
      });
    }
    
    return outliers;
  }
  
  private filterValidBars(data: BarData[]): BarData[] {
    const minVolume = this.config.data?.min_volume_filter || 1000;
    
    return data.filter(bar => {
      // Basic OHLCV validation
      if (bar.open <= 0 || bar.high <= 0 || bar.low <= 0 || bar.close <= 0) {
        return false;
      }
      
      // High >= Low validation
      if (bar.high < bar.low) {
        return false;
      }
      
      // OHLC within high/low range
      if (bar.open < bar.low || bar.open > bar.high ||
          bar.close < bar.low || bar.close > bar.high) {
        return false;
      }
      
      // Minimum volume filter
      if (bar.volume < minVolume) {
        return false;
      }
      
      return true;
    });
  }
  
  private calculateQualityScore(results: QCResults): number {
    if (results.total_bars === 0) return 0;
    
    const retentionRate = results.valid_bars / results.total_bars;
    const duplicateRate = results.duplicates_removed / results.total_bars;
    const gapRate = results.gaps_detected / Math.max(results.valid_bars - 1, 1);
    const outlierRate = results.outliers_flagged / results.total_bars;
    
    // Weighted quality score (0-100)
    const score = Math.max(0, 
      retentionRate * 50 +           // 50% weight on retention
      (1 - duplicateRate) * 20 +     // 20% weight on dedup
      (1 - gapRate) * 20 +           // 20% weight on gaps
      (1 - outlierRate) * 10         // 10% weight on outliers
    );
    
    return Math.round(score * 100) / 100;
  }
  
  private getExpectedInterval(timeframe: string): number {
    const intervals: { [key: string]: number } = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '1h': 60,
      '4h': 240,
      '1d': 1440
    };
    
    return intervals[timeframe] || 1;
  }
  
  async generateQCReport(symbol: string, timeframe: string, results: QCResults): Promise<void> {
    const reportPath = path.join(process.cwd(), 'training', 'reports', 'qc');
    await fs.mkdir(reportPath, { recursive: true });
    
    const report = {
      symbol,
      timeframe,
      timestamp: new Date().toISOString(),
      ...results,
      retention_rate: results.valid_bars / results.total_bars,
      recommendations: this.generateRecommendations(results)
    };
    
    const filename = `qc_${symbol.replace('/', '-')}_${timeframe}_${Date.now()}.json`;
    await fs.writeFile(
      path.join(reportPath, filename),
      JSON.stringify(report, null, 2)
    );
    
    logger.info('[DataQC] Report generated', { reportPath: filename, qualityScore: results.quality_score });
  }
  
  private generateRecommendations(results: QCResults): string[] {
    const recommendations: string[] = [];
    
    if (results.quality_score < 80) {
      recommendations.push('Data quality below 80% - consider alternative data sources');
    }
    
    if (results.gaps_detected > results.valid_bars * 0.05) {
      recommendations.push('High gap rate detected - implement gap-filling strategy');
    }
    
    if (results.outliers_flagged > results.valid_bars * 0.02) {
      recommendations.push('High outlier rate - review outlier detection parameters');
    }
    
    if (results.duplicates_removed > results.total_bars * 0.01) {
      recommendations.push('High duplicate rate - check data source reliability');
    }
    
    return recommendations;
  }
}