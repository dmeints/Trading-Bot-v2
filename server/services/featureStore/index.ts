
import { logger } from '../../utils/logger';

interface FeatureVector {
  features: Record<string, number>;
  timestamp: number;
  symbol: string;
  context?: Record<string, any>;
}

interface FeatureWindow {
  features: FeatureVector[];
  windowStart: number;
  windowEnd: number;
  symbol: string;
}

export class FeatureStore {
  private features: Map<string, FeatureVector[]> = new Map();
  private backtestFeatures: Map<string, FeatureVector[]> = new Map();
  private maxWindowSize: number = 1000;

  putFeature(symbol: string, features: Record<string, number>, context?: Record<string, any>): void {
    const featureVector: FeatureVector = {
      features,
      timestamp: Date.now(),
      symbol,
      context
    };

    if (!this.features.has(symbol)) {
      this.features.set(symbol, []);
    }

    const symbolFeatures = this.features.get(symbol)!;
    symbolFeatures.push(featureVector);

    // Maintain window size
    if (symbolFeatures.length > this.maxWindowSize) {
      symbolFeatures.shift();
    }

    logger.debug(`[FeatureStore] Stored features for ${symbol}`, {
      featureCount: Object.keys(features).length,
      timestamp: featureVector.timestamp
    });
  }

  getWindow(symbol: string, windowSizeMs: number): FeatureWindow {
    const now = Date.now();
    const windowStart = now - windowSizeMs;
    
    const symbolFeatures = this.features.get(symbol) || [];
    const windowFeatures = symbolFeatures.filter(
      f => f.timestamp >= windowStart && f.timestamp <= now
    );

    return {
      features: windowFeatures,
      windowStart,
      windowEnd: now,
      symbol
    };
  }

  getLatest(symbol: string): FeatureVector | null {
    const symbolFeatures = this.features.get(symbol) || [];
    return symbolFeatures.length > 0 ? symbolFeatures[symbolFeatures.length - 1] : null;
  }

  // For backtesting - store offline features
  putBacktestFeature(symbol: string, features: Record<string, number>, timestamp: number): void {
    const featureVector: FeatureVector = {
      features,
      timestamp,
      symbol
    };

    if (!this.backtestFeatures.has(symbol)) {
      this.backtestFeatures.set(symbol, []);
    }

    this.backtestFeatures.get(symbol)!.push(featureVector);
  }

  // Check parity between online and backtest features
  checkParity(symbol: string, timestamp: number, tolerance: number = 0.001): {
    hasParity: boolean;
    mismatches: Array<{ feature: string; online: number; backtest: number; diff: number }>;
  } {
    const onlineFeature = this.findClosestFeature(this.features.get(symbol) || [], timestamp);
    const backtestFeature = this.findClosestFeature(this.backtestFeatures.get(symbol) || [], timestamp);

    if (!onlineFeature || !backtestFeature) {
      return {
        hasParity: false,
        mismatches: [{ feature: 'missing_data', online: 0, backtest: 0, diff: Infinity }]
      };
    }

    const mismatches: Array<{ feature: string; online: number; backtest: number; diff: number }> = [];
    const allFeatureKeys = new Set([
      ...Object.keys(onlineFeature.features),
      ...Object.keys(backtestFeature.features)
    ]);

    for (const key of allFeatureKeys) {
      const onlineValue = onlineFeature.features[key] || 0;
      const backtestValue = backtestFeature.features[key] || 0;
      const diff = Math.abs(onlineValue - backtestValue);

      if (diff > tolerance) {
        mismatches.push({
          feature: key,
          online: onlineValue,
          backtest: backtestValue,
          diff
        });
      }
    }

    return {
      hasParity: mismatches.length === 0,
      mismatches
    };
  }

  private findClosestFeature(features: FeatureVector[], timestamp: number): FeatureVector | null {
    if (features.length === 0) return null;

    return features.reduce((closest, current) => {
      const closestDiff = Math.abs(closest.timestamp - timestamp);
      const currentDiff = Math.abs(current.timestamp - timestamp);
      return currentDiff < closestDiff ? current : closest;
    });
  }

  getParityReport(): Record<string, any> {
    const report: Record<string, any> = {
      timestamp: Date.now(),
      symbols: {},
      overallParity: true
    };

    const allSymbols = new Set([
      ...this.features.keys(),
      ...this.backtestFeatures.keys()
    ]);

    for (const symbol of allSymbols) {
      const latestOnline = this.getLatest(symbol);
      if (latestOnline) {
        const parity = this.checkParity(symbol, latestOnline.timestamp);
        report.symbols[symbol] = {
          hasParity: parity.hasParity,
          mismatchCount: parity.mismatches.length,
          lastChecked: latestOnline.timestamp
        };

        if (!parity.hasParity) {
          report.overallParity = false;
        }
      }
    }

    return report;
  }

  getStats(): Record<string, any> {
    return {
      timestamp: Date.now(),
      onlineSymbols: this.features.size,
      backtestSymbols: this.backtestFeatures.size,
      totalOnlineFeatures: Array.from(this.features.values()).reduce(
        (sum, features) => sum + features.length, 0
      ),
      totalBacktestFeatures: Array.from(this.backtestFeatures.values()).reduce(
        (sum, features) => sum + features.length, 0
      ),
      maxWindowSize: this.maxWindowSize
    };
  }

  clearBacktestData(): void {
    this.backtestFeatures.clear();
    logger.info('[FeatureStore] Cleared backtest data');
  }
}

export const featureStore = new FeatureStore();
