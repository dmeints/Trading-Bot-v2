/**
 * Cross-Market Intelligence - Revolutionary Multi-Asset Analysis
 * 
 * Global regime detection, contagion prediction, and multi-market correlation analysis
 */

import { storage } from '../storage';
import { logger } from '../utils/logger';

export interface GlobalMarketRegime {
  regimeId: string;
  primaryMarket: string;
  secondaryMarkets: string[];
  regimeType: 'risk_on' | 'risk_off' | 'transitional' | 'crisis';
  confidence: number;
  indicators: {
    vix: number;
    dxy: number; // Dollar index
    yields: number; // 10Y Treasury yields
    cryptoCorrelation: number;
  };
  timestamp: Date;
}

export interface ContagionPrediction {
  sourceMarket: string;
  targetMarkets: string[];
  contagionProbability: number;
  transmissionChannels: string[];
  timeframe: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
}

export interface CrossAssetCorrelation {
  assetPair: string;
  correlation: number;
  rollingCorrelation: number[];
  breakdownRisk: number;
  stabilityScore: number;
  lastUpdated: Date;
}

export class CrossMarketIntelligenceEngine {
  private globalRegimes: GlobalMarketRegime[] = [];
  private contagionPredictions: ContagionPrediction[] = [];
  private crossAssetCorrelations: Map<string, CrossAssetCorrelation> = new Map();
  private marketIndicators: Map<string, any> = new Map();

  constructor() {
    this.initializeMarketData();
  }

  private initializeMarketData() {
    // Initialize with simulated market indicators
    this.marketIndicators.set('VIX', { value: 20.5, change: -0.8, trend: 'declining' });
    this.marketIndicators.set('DXY', { value: 102.3, change: 0.4, trend: 'rising' });
    this.marketIndicators.set('TNX', { value: 4.25, change: 0.05, trend: 'stable' });
    this.marketIndicators.set('GOLD', { value: 2018.5, change: -12.3, trend: 'declining' });
    this.marketIndicators.set('SPX', { value: 4185.2, change: 18.5, trend: 'rising' });
  }

  async detectGlobalMarketRegime(): Promise<GlobalMarketRegime> {
    try {
      // Gather multi-market indicators
      const indicators = await this.gatherGlobalIndicators();
      
      // Analyze regime characteristics
      const regimeType = this.classifyGlobalRegime(indicators);
      
      // Calculate confidence based on indicator convergence
      const confidence = this.calculateRegimeConfidence(indicators, regimeType);
      
      // Identify primary and secondary markets driving the regime
      const { primaryMarket, secondaryMarkets } = this.identifyMarketDrivers(indicators);

      const globalRegime: GlobalMarketRegime = {
        regimeId: `global_${regimeType}_${Date.now()}`,
        primaryMarket,
        secondaryMarkets,
        regimeType,
        confidence,
        indicators,
        timestamp: new Date()
      };

      // Store regime
      this.globalRegimes.push(globalRegime);
      
      // Keep only recent regimes (last 50)
      if (this.globalRegimes.length > 50) {
        this.globalRegimes = this.globalRegimes.slice(-50);
      }

      logger.info(`Detected global market regime`, {
        regimeType,
        confidence,
        primaryMarket,
        secondaryMarkets: secondaryMarkets.length
      });

      return globalRegime;

    } catch (error) {
      logger.error(`Failed to detect global market regime`, { error });
      throw error;
    }
  }

  private async gatherGlobalIndicators(): Promise<any> {
    // In a real implementation, these would come from external APIs
    // For now, we'll simulate realistic market indicators

    const vix = this.marketIndicators.get('VIX')?.value || 20;
    const dxy = this.marketIndicators.get('DXY')?.value || 102;
    const yields = this.marketIndicators.get('TNX')?.value || 4.2;
    
    // Calculate crypto-to-traditional correlation
    const cryptoCorrelation = await this.calculateCryptoTraditionalCorrelation();

    return {
      vix,
      dxy,
      yields,
      cryptoCorrelation,
      goldPrice: this.marketIndicators.get('GOLD')?.value || 2000,
      spxLevel: this.marketIndicators.get('SPX')?.value || 4200,
      bondSpreads: this.simulateBondSpreads(),
      commodityIndex: this.simulateCommodityIndex(),
      emergingMarkets: this.simulateEmergingMarkets()
    };
  }

  private classifyGlobalRegime(indicators: any): 'risk_on' | 'risk_off' | 'transitional' | 'crisis' {
    const { vix, dxy, yields, cryptoCorrelation } = indicators;

    // Crisis conditions
    if (vix > 35 && cryptoCorrelation > 0.8) {
      return 'crisis';
    }

    // Risk-off conditions
    if (vix > 25 && dxy > 105 && yields < 3.5) {
      return 'risk_off';
    }

    // Risk-on conditions
    if (vix < 20 && yields > 4.0 && cryptoCorrelation < 0.4) {
      return 'risk_on';
    }

    // Default to transitional
    return 'transitional';
  }

  private calculateRegimeConfidence(indicators: any, regimeType: string): number {
    // Calculate confidence based on how strongly indicators align with regime
    let alignmentScore = 0;
    let totalIndicators = 0;

    // VIX alignment
    const vixAlignment = this.calculateVixAlignment(indicators.vix, regimeType);
    alignmentScore += vixAlignment;
    totalIndicators++;

    // DXY alignment
    const dxyAlignment = this.calculateDxyAlignment(indicators.dxy, regimeType);
    alignmentScore += dxyAlignment;
    totalIndicators++;

    // Yields alignment
    const yieldsAlignment = this.calculateYieldsAlignment(indicators.yields, regimeType);
    alignmentScore += yieldsAlignment;
    totalIndicators++;

    // Crypto correlation alignment
    const correlationAlignment = this.calculateCorrelationAlignment(indicators.cryptoCorrelation, regimeType);
    alignmentScore += correlationAlignment;
    totalIndicators++;

    const confidence = alignmentScore / totalIndicators;
    return Math.max(0.3, Math.min(0.95, confidence));
  }

  private calculateVixAlignment(vix: number, regimeType: string): number {
    switch (regimeType) {
      case 'crisis': return vix > 35 ? 0.9 : 0.3;
      case 'risk_off': return vix > 25 ? 0.8 : 0.4;
      case 'risk_on': return vix < 20 ? 0.9 : 0.4;
      case 'transitional': return vix >= 20 && vix <= 25 ? 0.8 : 0.5;
      default: return 0.5;
    }
  }

  private calculateDxyAlignment(dxy: number, regimeType: string): number {
    switch (regimeType) {
      case 'crisis': return dxy > 108 ? 0.9 : 0.6;
      case 'risk_off': return dxy > 105 ? 0.8 : 0.5;
      case 'risk_on': return dxy < 100 ? 0.9 : 0.5;
      case 'transitional': return dxy >= 100 && dxy <= 105 ? 0.8 : 0.6;
      default: return 0.5;
    }
  }

  private calculateYieldsAlignment(yields: number, regimeType: string): number {
    switch (regimeType) {
      case 'crisis': return yields < 3.0 ? 0.9 : 0.4;
      case 'risk_off': return yields < 3.5 ? 0.8 : 0.5;
      case 'risk_on': return yields > 4.0 ? 0.9 : 0.6;
      case 'transitional': return yields >= 3.5 && yields <= 4.0 ? 0.8 : 0.6;
      default: return 0.5;
    }
  }

  private calculateCorrelationAlignment(correlation: number, regimeType: string): number {
    switch (regimeType) {
      case 'crisis': return correlation > 0.8 ? 0.9 : 0.4;
      case 'risk_off': return correlation > 0.6 ? 0.8 : 0.5;
      case 'risk_on': return correlation < 0.4 ? 0.9 : 0.6;
      case 'transitional': return correlation >= 0.4 && correlation <= 0.6 ? 0.8 : 0.6;
      default: return 0.5;
    }
  }

  private identifyMarketDrivers(indicators: any): { primaryMarket: string; secondaryMarkets: string[] } {
    const marketScores = new Map<string, number>();

    // Score markets based on indicator strength
    marketScores.set('US_Equities', this.calculateMarketScore('equities', indicators));
    marketScores.set('US_Bonds', this.calculateMarketScore('bonds', indicators));
    marketScores.set('USD', this.calculateMarketScore('usd', indicators));
    marketScores.set('Crypto', this.calculateMarketScore('crypto', indicators));
    marketScores.set('Commodities', this.calculateMarketScore('commodities', indicators));

    // Sort by score
    const sortedMarkets = Array.from(marketScores.entries())
      .sort((a, b) => b[1] - a[1]);

    const primaryMarket = sortedMarkets[0][0];
    const secondaryMarkets = sortedMarkets.slice(1, 4).map(([market]) => market);

    return { primaryMarket, secondaryMarkets };
  }

  private calculateMarketScore(market: string, indicators: any): number {
    switch (market) {
      case 'equities':
        return (indicators.spxLevel / 4200) * 0.5 + (1 - indicators.vix / 50) * 0.5;
      case 'bonds':
        return (indicators.yields / 5) * 0.6 + (1 - indicators.bondSpreads / 200) * 0.4;
      case 'usd':
        return (indicators.dxy / 110) * 0.7 + (indicators.yields / 5) * 0.3;
      case 'crypto':
        return (1 - indicators.cryptoCorrelation) * 0.6 + (1 - indicators.vix / 50) * 0.4;
      case 'commodities':
        return (indicators.commodityIndex / 100) * 0.7 + (indicators.goldPrice / 2100) * 0.3;
      default:
        return 0.5;
    }
  }

  async predictContagion(): Promise<ContagionPrediction[]> {
    try {
      const predictions: ContagionPrediction[] = [];
      
      // Analyze potential contagion from major markets
      const sourceMarkets = ['US_Equities', 'US_Bonds', 'EUR', 'CNY', 'Crypto'];
      
      for (const sourceMarket of sourceMarkets) {
        const prediction = await this.analyzeContagionFromMarket(sourceMarket);
        if (prediction.contagionProbability > 0.3) {
          predictions.push(prediction);
        }
      }

      // Sort by probability
      predictions.sort((a, b) => b.contagionProbability - a.contagionProbability);

      this.contagionPredictions = predictions;

      logger.info(`Generated contagion predictions`, { 
        predictionCount: predictions.length,
        highRiskCount: predictions.filter(p => p.severity === 'high' || p.severity === 'critical').length
      });

      return predictions;

    } catch (error) {
      logger.error(`Failed to predict contagion`, { error });
      return [];
    }
  }

  private async analyzeContagionFromMarket(sourceMarket: string): Promise<ContagionPrediction> {
    // Analyze potential transmission channels
    const transmissionChannels = this.identifyTransmissionChannels(sourceMarket);
    
    // Calculate contagion probability
    const contagionProbability = this.calculateContagionProbability(sourceMarket, transmissionChannels);
    
    // Identify target markets
    const targetMarkets = this.identifyTargetMarkets(sourceMarket);
    
    // Determine severity
    const severity = this.determineSeverity(contagionProbability, transmissionChannels.length);
    
    // Estimate timeframe
    const timeframe = this.estimateContagionTimeframe(sourceMarket, severity);

    return {
      sourceMarket,
      targetMarkets,
      contagionProbability,
      transmissionChannels,
      timeframe,
      severity,
      confidence: Math.min(0.9, contagionProbability + 0.2)
    };
  }

  private identifyTransmissionChannels(sourceMarket: string): string[] {
    const channelMap: Record<string, string[]> = {
      'US_Equities': ['portfolio_rebalancing', 'risk_parity_funds', 'margin_calls', 'sentiment_contagion'],
      'US_Bonds': ['yield_curve_shifts', 'duration_hedging', 'flight_to_quality', 'central_bank_policy'],
      'EUR': ['currency_hedging', 'european_banks', 'trade_linkages', 'policy_divergence'],
      'CNY': ['commodity_demand', 'supply_chain_disruption', 'capital_controls', 'trade_war'],
      'Crypto': ['risk_appetite', 'leverage_unwinding', 'institutional_flows', 'regulatory_spillover']
    };

    return channelMap[sourceMarket] || ['general_risk_sentiment'];
  }

  private calculateContagionProbability(sourceMarket: string, channels: string[]): number {
    // Base probability by market importance
    const baseProbability: Record<string, number> = {
      'US_Equities': 0.7,
      'US_Bonds': 0.65,
      'EUR': 0.5,
      'CNY': 0.55,
      'Crypto': 0.4
    };

    const base = baseProbability[sourceMarket] || 0.3;
    const channelBonus = Math.min(0.25, channels.length * 0.05);
    
    // Current market stress multiplier
    const stressMultiplier = this.getCurrentStressLevel();
    
    return Math.min(0.95, base + channelBonus) * stressMultiplier;
  }

  private getCurrentStressLevel(): number {
    const vix = this.marketIndicators.get('VIX')?.value || 20;
    return Math.min(1.5, 0.8 + (vix - 20) / 50);
  }

  private identifyTargetMarkets(sourceMarket: string): string[] {
    const targetMap: Record<string, string[]> = {
      'US_Equities': ['Global_Equities', 'Crypto', 'Commodities', 'EM_Currencies'],
      'US_Bonds': ['Global_Bonds', 'USD_Pairs', 'Gold', 'REITS'],
      'EUR': ['European_Assets', 'EUR_Pairs', 'European_Banks'],
      'CNY': ['Asian_Markets', 'Commodities', 'AUD', 'Emerging_Asia'],
      'Crypto': ['Risk_Assets', 'Tech_Stocks', 'Growth_Assets']
    };

    return targetMap[sourceMarket] || ['Risk_Assets'];
  }

  private determineSeverity(probability: number, channelCount: number): 'low' | 'medium' | 'high' | 'critical' {
    if (probability > 0.8 && channelCount >= 4) return 'critical';
    if (probability > 0.6 && channelCount >= 3) return 'high';
    if (probability > 0.4 && channelCount >= 2) return 'medium';
    return 'low';
  }

  private estimateContagionTimeframe(sourceMarket: string, severity: string): string {
    const timeframes: Record<string, Record<string, string>> = {
      'US_Equities': { 'critical': '1-2h', 'high': '2-6h', 'medium': '6-24h', 'low': '1-3d' },
      'US_Bonds': { 'critical': '30min-2h', 'high': '2-12h', 'medium': '12-48h', 'low': '2-7d' },
      'Crypto': { 'critical': '5min-1h', 'high': '1-4h', 'medium': '4-24h', 'low': '1-2d' }
    };

    return timeframes[sourceMarket]?.[severity] || '1-3d';
  }

  async analyzeCrossAssetCorrelations(): Promise<CrossAssetCorrelation[]> {
    try {
      const correlations: CrossAssetCorrelation[] = [];
      
      // Define cross-asset pairs
      const assetPairs = [
        'BTC/SPX', 'BTC/GOLD', 'BTC/DXY', 'BTC/VIX',
        'ETH/NASDAQ', 'ETH/TNX', 'SOL/RUSSELL',
        'SPX/TNX', 'GOLD/DXY', 'VIX/TNX'
      ];

      for (const pair of assetPairs) {
        const correlation = await this.calculateCrossAssetCorrelation(pair);
        correlations.push(correlation);
        this.crossAssetCorrelations.set(pair, correlation);
      }

      logger.info(`Analyzed cross-asset correlations`, { 
        pairCount: correlations.length,
        highCorrelationCount: correlations.filter(c => Math.abs(c.correlation) > 0.7).length
      });

      return correlations;

    } catch (error) {
      logger.error(`Failed to analyze cross-asset correlations`, { error });
      return [];
    }
  }

  private async calculateCrossAssetCorrelation(assetPair: string): Promise<CrossAssetCorrelation> {
    // Simulate correlation calculation with realistic values
    const [asset1, asset2] = assetPair.split('/');
    
    // Get correlation based on asset types
    const correlation = this.getRealisticCorrelation(asset1, asset2);
    
    // Generate rolling correlation (last 30 periods)
    const rollingCorrelation = this.generateRollingCorrelation(correlation, 30);
    
    // Calculate breakdown risk
    const breakdownRisk = this.calculateBreakdownRisk(rollingCorrelation);
    
    // Calculate stability score
    const stabilityScore = this.calculateStabilityScore(rollingCorrelation);

    return {
      assetPair,
      correlation,
      rollingCorrelation,
      breakdownRisk,
      stabilityScore,
      lastUpdated: new Date()
    };
  }

  private getRealisticCorrelation(asset1: string, asset2: string): number {
    // Realistic correlation mapping
    const correlationMap: Record<string, number> = {
      'BTC_SPX': 0.45 + (Math.random() - 0.5) * 0.3,
      'BTC_GOLD': -0.15 + (Math.random() - 0.5) * 0.4,
      'BTC_DXY': -0.25 + (Math.random() - 0.5) * 0.3,
      'BTC_VIX': -0.35 + (Math.random() - 0.5) * 0.4,
      'ETH_NASDAQ': 0.52 + (Math.random() - 0.5) * 0.25,
      'SPX_TNX': 0.15 + (Math.random() - 0.5) * 0.4,
      'GOLD_DXY': -0.65 + (Math.random() - 0.5) * 0.2,
      'VIX_TNX': -0.30 + (Math.random() - 0.5) * 0.3
    };

    const key = `${asset1}_${asset2}`;
    return correlationMap[key] || (Math.random() - 0.5) * 0.6;
  }

  private generateRollingCorrelation(currentCorrelation: number, periods: number): number[] {
    const correlations = [];
    let correlation = currentCorrelation;
    
    for (let i = 0; i < periods; i++) {
      // Add some noise and mean reversion
      const noise = (Math.random() - 0.5) * 0.1;
      const meanReversion = (currentCorrelation - correlation) * 0.05;
      correlation += noise + meanReversion;
      
      // Clamp to [-1, 1]
      correlation = Math.max(-1, Math.min(1, correlation));
      correlations.push(correlation);
    }
    
    return correlations;
  }

  private calculateBreakdownRisk(rollingCorrelations: number[]): number {
    if (rollingCorrelations.length < 5) return 0.5;

    // Calculate volatility of correlations
    const mean = rollingCorrelations.reduce((sum, c) => sum + c, 0) / rollingCorrelations.length;
    const variance = rollingCorrelations.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / rollingCorrelations.length;
    const volatility = Math.sqrt(variance);

    // Higher volatility = higher breakdown risk
    return Math.min(0.95, volatility * 2);
  }

  private calculateStabilityScore(rollingCorrelations: number[]): number {
    if (rollingCorrelations.length < 5) return 0.5;

    const volatility = this.calculateVolatility(rollingCorrelations);
    const trend = this.calculateTrend(rollingCorrelations);
    
    // Stability is inverse of volatility, with trend stability bonus
    const baseStability = 1 / (1 + volatility * 5);
    const trendStability = 1 / (1 + Math.abs(trend) * 10);
    
    return (baseStability + trendStability) / 2;
  }

  private calculateVolatility(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 3) return 0;

    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  // Helper methods for simulation
  private async calculateCryptoTraditionalCorrelation(): Promise<number> {
    // Simulate realistic crypto-traditional correlation
    return 0.4 + (Math.random() - 0.5) * 0.6;
  }

  private simulateBondSpreads(): number {
    return 80 + (Math.random() - 0.5) * 40; // 60-120 bps
  }

  private simulateCommodityIndex(): number {
    return 85 + (Math.random() - 0.5) * 30; // 70-100 index level
  }

  private simulateEmergingMarkets(): number {
    return 92 + (Math.random() - 0.5) * 16; // 84-100 index level
  }

  // Public interface methods
  getCurrentGlobalRegime(): GlobalMarketRegime | null {
    return this.globalRegimes.length > 0 ? this.globalRegimes[this.globalRegimes.length - 1] : null;
  }

  getContagionPredictions(): ContagionPrediction[] {
    return [...this.contagionPredictions];
  }

  getCrossAssetCorrelations(): CrossAssetCorrelation[] {
    return Array.from(this.crossAssetCorrelations.values());
  }

  getMarketIndicators(): Record<string, any> {
    return Array.from(this.marketIndicators.entries()).reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {} as Record<string, any>);
  }

  async updateMarketIndicator(indicator: string, value: number, change: number): Promise<void> {
    const trend = change > 0 ? 'rising' : change < 0 ? 'declining' : 'stable';
    this.marketIndicators.set(indicator, { value, change, trend });
  }
}

export const crossMarketIntelligenceEngine = new CrossMarketIntelligenceEngine();