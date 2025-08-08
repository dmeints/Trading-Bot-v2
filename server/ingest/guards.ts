/**
 * LIVE DATA QA & FAILOVER GUARDS
 * Detect flatlines/zeros/outliers and quarantine bad ticks
 */

interface DataPoint {
  symbol: string;
  timestamp: number;
  price: number;
  volume: number;
  source: string;
}

interface QualityMetrics {
  flatlineCount: number;
  zeroCount: number;
  outlierCount: number;
  gapCount: number;
  totalPoints: number;
  qualityScore: number;
}

interface AnomalyAlert {
  type: 'flatline' | 'zero' | 'outlier' | 'gap' | 'source_failure';
  symbol: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
  metadata: any;
}

export class DataQualityGuard {
  private priceHistory: Map<string, number[]> = new Map();
  private volumeHistory: Map<string, number[]> = new Map();
  private lastUpdates: Map<string, number> = new Map();
  private quarantinedData: Map<string, DataPoint[]> = new Map();
  private qualityMetrics: Map<string, QualityMetrics> = new Map();
  private alerts: AnomalyAlert[] = [];

  private readonly config = {
    flatlineThreshold: 5,        // 5 consecutive identical values
    zeroVolumeThreshold: 10,     // 10 consecutive zero volumes
    outlierStdMultiplier: 4,     // 4 standard deviations
    maxGapMinutes: 5,            // 5 minutes max gap
    historyWindow: 100,          // Keep last 100 data points
    minQualityScore: 0.8         // 80% minimum quality
  };

  /**
   * Main data validation function
   */
  validateDataPoint(data: DataPoint): {
    isValid: boolean;
    anomalies: string[];
    shouldQuarantine: boolean;
    qualityScore: number;
  } {
    const anomalies: string[] = [];
    let shouldQuarantine = false;

    // Check for flatlines
    if (this.detectFlatline(data)) {
      anomalies.push('flatline');
      this.recordAlert('flatline', data, 'medium', 'Price flatline detected');
    }

    // Check for zero values
    if (this.detectZeroVolume(data)) {
      anomalies.push('zero_volume');
      this.recordAlert('zero', data, 'low', 'Zero volume detected');
    }

    // Check for outliers
    if (this.detectOutlier(data)) {
      anomalies.push('outlier');
      shouldQuarantine = true;
      this.recordAlert('outlier', data, 'high', 'Price outlier detected');
    }

    // Check for gaps
    if (this.detectGap(data)) {
      anomalies.push('gap');
      this.recordAlert('gap', data, 'medium', 'Data gap detected');
    }

    // Update histories
    this.updateHistories(data);

    // Calculate quality score
    const qualityScore = this.calculateQualityScore(data.symbol);

    return {
      isValid: anomalies.length === 0,
      anomalies,
      shouldQuarantine,
      qualityScore
    };
  }

  private detectFlatline(data: DataPoint): boolean {
    const prices = this.priceHistory.get(data.symbol) || [];
    if (prices.length < this.config.flatlineThreshold) return false;

    const recent = prices.slice(-this.config.flatlineThreshold);
    return recent.every(price => price === data.price);
  }

  private detectZeroVolume(data: DataPoint): boolean {
    if (data.volume !== 0) return false;

    const volumes = this.volumeHistory.get(data.symbol) || [];
    if (volumes.length < this.config.zeroVolumeThreshold) return false;

    const recent = volumes.slice(-this.config.zeroVolumeThreshold);
    return recent.every(vol => vol === 0);
  }

  private detectOutlier(data: DataPoint): boolean {
    const prices = this.priceHistory.get(data.symbol) || [];
    if (prices.length < 10) return false; // Need sufficient history

    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    const std = Math.sqrt(variance);

    const deviation = Math.abs(data.price - mean);
    return deviation > this.config.outlierStdMultiplier * std;
  }

  private detectGap(data: DataPoint): boolean {
    const lastUpdate = this.lastUpdates.get(data.symbol);
    if (!lastUpdate) return false;

    const gapMinutes = (data.timestamp - lastUpdate) / (60 * 1000);
    return gapMinutes > this.config.maxGapMinutes;
  }

  private updateHistories(data: DataPoint): void {
    // Update price history
    const prices = this.priceHistory.get(data.symbol) || [];
    prices.push(data.price);
    if (prices.length > this.config.historyWindow) {
      prices.shift();
    }
    this.priceHistory.set(data.symbol, prices);

    // Update volume history
    const volumes = this.volumeHistory.get(data.symbol) || [];
    volumes.push(data.volume);
    if (volumes.length > this.config.historyWindow) {
      volumes.shift();
    }
    this.volumeHistory.set(data.symbol, volumes);

    // Update last timestamp
    this.lastUpdates.set(data.symbol, data.timestamp);
  }

  private calculateQualityScore(symbol: string): number {
    const metrics = this.qualityMetrics.get(symbol) || {
      flatlineCount: 0,
      zeroCount: 0,
      outlierCount: 0,
      gapCount: 0,
      totalPoints: 0,
      qualityScore: 1.0
    };

    if (metrics.totalPoints === 0) return 1.0;

    const errorRate = (metrics.flatlineCount + metrics.outlierCount + metrics.gapCount) / metrics.totalPoints;
    const qualityScore = Math.max(0, 1 - errorRate);

    metrics.qualityScore = qualityScore;
    this.qualityMetrics.set(symbol, metrics);

    return qualityScore;
  }

  private recordAlert(type: AnomalyAlert['type'], data: DataPoint, severity: AnomalyAlert['severity'], description: string): void {
    const alert: AnomalyAlert = {
      type,
      symbol: data.symbol,
      timestamp: data.timestamp,
      severity,
      description,
      metadata: { price: data.price, volume: data.volume, source: data.source }
    };

    this.alerts.push(alert);

    // Keep only recent alerts
    if (this.alerts.length > 1000) {
      this.alerts.shift();
    }

    // Update metrics
    this.updateQualityMetrics(data.symbol, type);
  }

  private updateQualityMetrics(symbol: string, anomalyType: string): void {
    const metrics = this.qualityMetrics.get(symbol) || {
      flatlineCount: 0,
      zeroCount: 0,
      outlierCount: 0,
      gapCount: 0,
      totalPoints: 0,
      qualityScore: 1.0
    };

    metrics.totalPoints++;

    switch (anomalyType) {
      case 'flatline':
        metrics.flatlineCount++;
        break;
      case 'zero':
        metrics.zeroCount++;
        break;
      case 'outlier':
        metrics.outlierCount++;
        break;
      case 'gap':
        metrics.gapCount++;
        break;
    }

    this.qualityMetrics.set(symbol, metrics);
  }

  /**
   * Quarantine bad data point
   */
  quarantineData(data: DataPoint, reason: string): void {
    const quarantined = this.quarantinedData.get(data.symbol) || [];
    quarantined.push({ ...data, source: `quarantined_${reason}` });

    // Keep only recent quarantined data
    if (quarantined.length > 500) {
      quarantined.shift();
    }

    this.quarantinedData.set(data.symbol, quarantined);
  }

  /**
   * Get quality statistics
   */
  getQualityStats(): {
    bySymbol: Map<string, QualityMetrics>;
    alerts: AnomalyAlert[];
    quarantinedCount: number;
    overallQuality: number;
  } {
    const totalQuarantine = Array.from(this.quarantinedData.values())
      .reduce((sum, arr) => sum + arr.length, 0);

    const qualities = Array.from(this.qualityMetrics.values())
      .map(m => m.qualityScore);
    const overallQuality = qualities.length > 0
      ? qualities.reduce((sum, q) => sum + q, 0) / qualities.length
      : 1.0;

    return {
      bySymbol: new Map(this.qualityMetrics),
      alerts: [...this.alerts],
      quarantinedCount: totalQuarantine,
      overallQuality
    };
  }

  /**
   * Get recent alerts by severity
   */
  getRecentAlerts(severity?: AnomalyAlert['severity'], limit: number = 50): AnomalyAlert[] {
    let filtered = [...this.alerts];

    if (severity) {
      filtered = filtered.filter(alert => alert.severity === severity);
    }

    return filtered
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Check if symbol data quality is acceptable
   */
  isSymbolHealthy(symbol: string): boolean {
    const metrics = this.qualityMetrics.get(symbol);
    if (!metrics) return true; // No data yet, assume healthy

    return metrics.qualityScore >= this.config.minQualityScore;
  }

  /**
   * Clear old data and reset metrics
   */
  cleanup(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

    // Clear old alerts
    this.alerts = this.alerts.filter(alert => alert.timestamp > cutoff);

    // Clear old quarantined data
    for (const [symbol, data] of this.quarantinedData) {
      const recent = data.filter(d => d.timestamp > cutoff);
      this.quarantinedData.set(symbol, recent);
    }
  }
}

export default DataQualityGuard;