/**
 * Feature Switchboard - Ablation-ready feature engineering
 * High signal/low cost features with selective enablement
 */

import { logger } from '../../utils/logger';
import { BarData } from '../data/qc';

export interface FeatureConfig {
  price_features: boolean;
  microstructure: boolean;
  derivatives: boolean;
  lookback_periods: number[];
  volatility_window: number;
}

export interface FeatureVector {
  timestamp: Date;
  symbol: string;
  
  // Price features (always enabled)
  returns_1?: number;
  returns_5?: number;
  returns_20?: number;
  atr_20?: number;
  zscore_5?: number;
  zscore_20?: number;
  volatility?: number;
  
  // Microstructure features (high signal)
  spread?: number;
  spread_pct?: number;
  depth_imbalance?: number;
  order_flow_imbalance?: number;
  mlofi_5?: number;  // Multi-Level Order Flow Imbalance
  
  // Derivatives features (optional - enable only if ablation shows lift)
  funding_rate_delta?: number;
  open_interest_delta?: number;
  funding_normalized?: number;
  oi_normalized?: number;
  
  // Technical indicators (lightweight)
  rsi_14?: number;
  bb_position?: number;  // Position within Bollinger Bands
  momentum_10?: number;
  
  // Meta features
  hour_of_day?: number;
  day_of_week?: number;
  volatility_regime?: number;  // Low/medium/high vol regime
}

export class FeatureSwitchboard {
  private config: FeatureConfig;
  private cache: Map<string, number[]> = new Map();
  
  constructor(config: FeatureConfig) {
    this.config = config;
  }
  
  async generateFeatures(data: BarData[], symbol: string): Promise<FeatureVector[]> {
    logger.info('[FeatureSwitchboard] Generating features', { 
      symbol, 
      bars: data.length,
      config: this.config
    });
    
    const features: FeatureVector[] = [];
    const maxLookback = Math.max(...this.config.lookback_periods, this.config.volatility_window);
    
    for (let i = maxLookback; i < data.length; i++) {
      const currentBar = data[i];
      const feature: FeatureVector = {
        timestamp: currentBar.timestamp,
        symbol: symbol
      };
      
      // Price features (always enabled - core signal)
      if (this.config.price_features) {
        this.addPriceFeatures(feature, data, i);
      }
      
      // Microstructure features (high signal/low cost)
      if (this.config.microstructure) {
        this.addMicrostructureFeatures(feature, data, i);
      }
      
      // Derivatives features (optional - expensive)
      if (this.config.derivatives) {
        this.addDerivativesFeatures(feature, data, i);
      }
      
      // Add lightweight technical indicators
      this.addTechnicalFeatures(feature, data, i);
      
      // Add meta features
      this.addMetaFeatures(feature, data[i]);
      
      features.push(feature);
    }
    
    logger.info('[FeatureSwitchboard] Feature generation complete', { 
      symbol,
      features: features.length,
      enabledSets: this.getEnabledFeatureSets()
    });
    
    return features;
  }
  
  private addPriceFeatures(feature: FeatureVector, data: BarData[], index: number): void {
    const current = data[index];
    
    // Returns at different horizons
    if (index >= 1) {
      feature.returns_1 = Math.log(current.close / data[index - 1].close);
    }
    
    if (index >= 5) {
      feature.returns_5 = Math.log(current.close / data[index - 5].close);
    }
    
    if (index >= 20) {
      feature.returns_20 = Math.log(current.close / data[index - 20].close);
    }
    
    // Average True Range (volatility)
    if (index >= 20) {
      const atrPeriod = 20;
      let atr = 0;
      
      for (let j = index - atrPeriod + 1; j <= index; j++) {
        const high = data[j].high;
        const low = data[j].low;
        const prevClose = j > 0 ? data[j - 1].close : data[j].close;
        
        const tr = Math.max(
          high - low,
          Math.abs(high - prevClose),
          Math.abs(low - prevClose)
        );
        
        atr += tr;
      }
      
      feature.atr_20 = atr / atrPeriod / current.close; // Normalized by price
    }
    
    // Z-scores for mean reversion signals
    if (index >= this.config.lookback_periods[0]) {
      feature.zscore_5 = this.calculateZScore(data, index, 5, 'close');
    }
    
    if (index >= this.config.lookback_periods[2]) {
      feature.zscore_20 = this.calculateZScore(data, index, 20, 'close');
    }
    
    // Rolling volatility
    if (index >= this.config.volatility_window) {
      feature.volatility = this.calculateVolatility(data, index, this.config.volatility_window);
    }
  }
  
  private addMicrostructureFeatures(feature: FeatureVector, data: BarData[], index: number): void {
    const current = data[index];
    
    // Bid-ask spread (if available)
    if (current.bid && current.ask && current.bid > 0 && current.ask > 0) {
      feature.spread = current.ask - current.bid;
      feature.spread_pct = (current.ask - current.bid) / current.close;
    }
    
    // Depth imbalance (if available)
    if (current.depth_imbalance !== undefined) {
      feature.depth_imbalance = current.depth_imbalance;
    }
    
    // Order Flow Imbalance - estimated from volume and price movement
    if (index >= 1) {
      const priceChange = current.close - data[index - 1].close;
      const volumeWeight = current.volume / (current.volume + data[index - 1].volume + 1);
      feature.order_flow_imbalance = Math.sign(priceChange) * volumeWeight;
    }
    
    // Multi-Level Order Flow Imbalance (5-period)
    if (index >= 5) {
      let ofi = 0;
      for (let j = index - 4; j <= index; j++) {
        if (j > 0) {
          const pc = data[j].close - data[j - 1].close;
          const vw = data[j].volume / (data[j].volume + data[j - 1].volume + 1);
          ofi += Math.sign(pc) * vw;
        }
      }
      feature.mlofi_5 = ofi / 5;
    }
  }
  
  private addDerivativesFeatures(feature: FeatureVector, data: BarData[], index: number): void {
    // Note: These would require additional data sources
    // Implemented as placeholders - enable only if ablation shows value
    
    // Funding rate delta (if available)
    // feature.funding_rate_delta = ...;
    
    // Open interest delta (if available)
    // feature.open_interest_delta = ...;
    
    // Normalized derivatives
    // feature.funding_normalized = ...;
    // feature.oi_normalized = ...;
  }
  
  private addTechnicalFeatures(feature: FeatureVector, data: BarData[], index: number): void {
    // RSI (14-period)
    if (index >= 14) {
      feature.rsi_14 = this.calculateRSI(data, index, 14);
    }
    
    // Bollinger Band position
    if (index >= 20) {
      const { upper, lower } = this.calculateBollingerBands(data, index, 20);
      if (upper && lower) {
        feature.bb_position = (data[index].close - lower) / (upper - lower);
      }
    }
    
    // Momentum (10-period rate of change)
    if (index >= 10) {
      feature.momentum_10 = (data[index].close - data[index - 10].close) / data[index - 10].close;
    }
  }
  
  private addMetaFeatures(feature: FeatureVector, bar: BarData): void {
    const date = new Date(bar.timestamp);
    
    // Time-based features
    feature.hour_of_day = date.getUTCHours() / 23; // Normalized 0-1
    feature.day_of_week = date.getUTCDay() / 6;    // Normalized 0-1
    
    // Volatility regime (if volatility is available)
    if (feature.volatility !== undefined) {
      if (feature.volatility < 0.01) feature.volatility_regime = 0;      // Low vol
      else if (feature.volatility < 0.03) feature.volatility_regime = 1; // Medium vol
      else feature.volatility_regime = 2;                                // High vol
    }
  }
  
  // Helper methods
  
  private calculateZScore(data: BarData[], index: number, period: number, field: keyof BarData): number {
    const values = data.slice(index - period + 1, index + 1).map(d => d[field] as number);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev > 0 ? (data[index][field] as number - mean) / stdDev : 0;
  }
  
  private calculateVolatility(data: BarData[], index: number, period: number): number {
    const returns: number[] = [];
    
    for (let i = index - period + 2; i <= index; i++) {
      returns.push(Math.log(data[i].close / data[i - 1].close));
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance * 252); // Annualized volatility
  }
  
  private calculateRSI(data: BarData[], index: number, period: number): number {
    let gains = 0;
    let losses = 0;
    
    for (let i = index - period + 1; i <= index; i++) {
      const change = data[i].close - data[i - 1].close;
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }
  
  private calculateBollingerBands(data: BarData[], index: number, period: number): { upper: number, lower: number } {
    const closes = data.slice(index - period + 1, index + 1).map(d => d.close);
    const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
    const variance = closes.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / closes.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      upper: mean + (2 * stdDev),
      lower: mean - (2 * stdDev)
    };
  }
  
  private getEnabledFeatureSets(): string[] {
    const enabled: string[] = [];
    
    if (this.config.price_features) enabled.push('price');
    if (this.config.microstructure) enabled.push('microstructure');
    if (this.config.derivatives) enabled.push('derivatives');
    
    return enabled;
  }
  
  // Feature ablation testing
  async testFeatureSet(testSet: string, data: BarData[], symbol: string): Promise<FeatureVector[]> {
    const originalConfig = { ...this.config };
    
    // Configure for ablation test
    switch (testSet) {
      case 'price_only':
        this.config.price_features = true;
        this.config.microstructure = false;
        this.config.derivatives = false;
        break;
      case 'price_microstructure':
        this.config.price_features = true;
        this.config.microstructure = true;
        this.config.derivatives = false;
        break;
      case 'price_microstructure_derivs':
        this.config.price_features = true;
        this.config.microstructure = true;
        this.config.derivatives = true;
        break;
    }
    
    const features = await this.generateFeatures(data, symbol);
    
    // Restore original config
    this.config = originalConfig;
    
    return features;
  }
}