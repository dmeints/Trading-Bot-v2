
/**
 * Breakout Expert Strategy
 * High volatility momentum strategy with regime-aware entry
 */

import { logger } from '../../utils/logger';
import { StateVector, RegimeState } from '../state_space';

export interface ExpertAction {
  type: 'HOLD' | 'ENTER_MARKET' | 'ENTER_LIMIT';
  sizePct: number;
  price?: number;
  side: 'buy' | 'sell';
  confidence: number;
  tpBps: number;
  slBps: number;
  reasoning: string;
}

export interface BreakoutSignals {
  volumeSpike: boolean;
  priceBreakout: boolean;
  volatilityExpansion: boolean;
  sentimentMomentum: boolean;
  regimeAlignment: boolean;
}

export class BreakoutExpert {
  private priceHistory: number[] = [];
  private volumeHistory: number[] = [];
  private readonly lookbackPeriod: number = 20;
  private readonly volThreshold: number = 0.25; // 25% annual vol
  private readonly volumeMultiplier: number = 2.0;
  private readonly breakoutThreshold: number = 0.02; // 2% price move

  constructor(
    private readonly baseSize: number = 0.05,
    private readonly maxSize: number = 0.15
  ) {}

  /**
   * Generate trading decision for breakout strategy
   */
  async decide(
    state: StateVector,
    regimes: RegimeState[],
    features: any
  ): Promise<ExpertAction> {
    // Update price and volume history
    this.updateHistory(features.price, features.volume);

    // Check regime suitability
    const trendingRegime = this.getTrendingRegimeProbability(regimes);
    if (trendingRegime < 0.3) {
      return this.holdAction('Trending regime probability too low');
    }

    // Detect breakout signals
    const signals = this.detectBreakoutSignals(state, features);
    const signalCount = Object.values(signals).filter(Boolean).length;

    if (signalCount < 3) {
      return this.holdAction(`Insufficient signals (${signalCount}/5)`);
    }

    // Determine breakout direction
    const direction = this.determineBreakoutDirection(state, features);
    if (!direction) {
      return this.holdAction('No clear breakout direction');
    }

    // Calculate position size based on signal strength
    const signalStrength = signalCount / 5;
    const volatilityAdjustment = Math.min(1.5, this.volThreshold / state.volatility);
    const regimeBoost = Math.min(1.3, trendingRegime + 0.3);

    let sizePct = this.baseSize * signalStrength * volatilityAdjustment * regimeBoost;
    sizePct = Math.min(sizePct, this.maxSize);

    // Set take profit and stop loss based on volatility
    const volMultiplier = Math.max(1, state.volatility / 0.2);
    const tpBps = Math.round(150 * volMultiplier); // 1.5% base TP, scaled by vol
    const slBps = Math.round(75 * volMultiplier);   // 0.75% base SL, scaled by vol

    const confidence = Math.min(0.95, 0.3 + 0.6 * signalStrength + 0.1 * trendingRegime);

    logger.debug('[BreakoutExpert] Generated signal', {
      direction,
      sizePct: sizePct.toFixed(4),
      confidence: confidence.toFixed(3),
      signals: Object.entries(signals).filter(([_, v]) => v).map(([k, _]) => k),
      trendingProb: trendingRegime.toFixed(3)
    });

    return {
      type: features.spread > 0.003 ? 'ENTER_LIMIT' : 'ENTER_MARKET',
      sizePct,
      side: direction,
      confidence,
      tpBps,
      slBps,
      price: direction === 'buy' ? features.price * 1.001 : features.price * 0.999,
      reasoning: `Breakout ${direction}: ${Object.entries(signals).filter(([_, v]) => v).map(([k, _]) => k).join(', ')}`
    };
  }

  private updateHistory(price: number, volume: number): void {
    if (!isNaN(price) && price > 0) {
      this.priceHistory.push(price);
      if (this.priceHistory.length > this.lookbackPeriod) {
        this.priceHistory.shift();
      }
    }

    if (!isNaN(volume) && volume > 0) {
      this.volumeHistory.push(volume);
      if (this.volumeHistory.length > this.lookbackPeriod) {
        this.volumeHistory.shift();
      }
    }
  }

  private detectBreakoutSignals(state: StateVector, features: any): BreakoutSignals {
    return {
      volumeSpike: this.detectVolumeSpike(),
      priceBreakout: this.detectPriceBreakout(),
      volatilityExpansion: this.detectVolatilityExpansion(state),
      sentimentMomentum: this.detectSentimentMomentum(state),
      regimeAlignment: this.detectRegimeAlignment(features)
    };
  }

  private detectVolumeSpike(): boolean {
    if (this.volumeHistory.length < 10) return false;

    const recentVolume = this.volumeHistory.slice(-3).reduce((sum, v) => sum + v, 0) / 3;
    const avgVolume = this.volumeHistory.slice(0, -3).reduce((sum, v) => sum + v, 0) / (this.volumeHistory.length - 3);

    return avgVolume > 0 && recentVolume > avgVolume * this.volumeMultiplier;
  }

  private detectPriceBreakout(): boolean {
    if (this.priceHistory.length < 10) return false;

    const currentPrice = this.priceHistory[this.priceHistory.length - 1];
    const previousPrices = this.priceHistory.slice(0, -1);
    
    const maxPrevious = Math.max(...previousPrices);
    const minPrevious = Math.min(...previousPrices);
    const avgPrevious = previousPrices.reduce((sum, p) => sum + p, 0) / previousPrices.length;

    const upBreakout = currentPrice > maxPrevious * (1 + this.breakoutThreshold);
    const downBreakout = currentPrice < minPrevious * (1 - this.breakoutThreshold);

    return upBreakout || downBreakout;
  }

  private detectVolatilityExpansion(state: StateVector): boolean {
    return state.volatility > this.volThreshold;
  }

  private detectSentimentMomentum(state: StateVector): boolean {
    return Math.abs(state.sentimentScore) > 0.3;
  }

  private detectRegimeAlignment(features: any): boolean {
    // Check if market conditions favor breakout
    const spreadTight = features.spread < 0.005;
    const liquidityGood = features.imbalance !== undefined && Math.abs(features.imbalance) < 0.3;
    const noMacroBlackout = !features.macroBlackout;

    return spreadTight && liquidityGood && noMacroBlackout;
  }

  private determineBreakoutDirection(state: StateVector, features: any): 'buy' | 'sell' | null {
    let bullishSignals = 0;
    let bearishSignals = 0;

    // Price momentum
    if (this.priceHistory.length >= 5) {
      const recentTrend = this.priceHistory.slice(-3).reduce((sum, p, i, arr) => 
        i > 0 ? sum + (p - arr[i-1]) : sum, 0
      );
      if (recentTrend > 0) bullishSignals++;
      else if (recentTrend < 0) bearishSignals++;
    }

    // Sentiment alignment
    if (state.sentimentScore > 0.2) bullishSignals++;
    else if (state.sentimentScore < -0.2) bearishSignals++;

    // On-chain bias
    if (state.onchainBias > 0.1) bullishSignals++;
    else if (state.onchainBias < -0.1) bearishSignals++;

    // Imbalance direction
    if (features.imbalance < -0.1) bullishSignals++; // Order book favors buyers
    else if (features.imbalance > 0.1) bearishSignals++; // Order book favors sellers

    if (bullishSignals > bearishSignals + 1) return 'buy';
    if (bearishSignals > bullishSignals + 1) return 'sell';
    return null;
  }

  private getTrendingRegimeProbability(regimes: RegimeState[]): number {
    // Regime 1 is high volatility trending
    const trendingRegime = regimes.find(r => r.regimeId === 1);
    return trendingRegime ? trendingRegime.probability : 0;
  }

  private holdAction(reason: string): ExpertAction {
    return {
      type: 'HOLD',
      sizePct: 0,
      side: 'buy',
      confidence: 0,
      tpBps: 0,
      slBps: 0,
      reasoning: reason
    };
  }

  /**
   * Get strategy parameters for optimization
   */
  getParameters(): Record<string, number> {
    return {
      baseSize: this.baseSize,
      maxSize: this.maxSize,
      volThreshold: this.volThreshold,
      volumeMultiplier: this.volumeMultiplier,
      breakoutThreshold: this.breakoutThreshold,
      lookbackPeriod: this.lookbackPeriod
    };
  }

  /**
   * Update strategy parameters
   */
  updateParameters(params: Partial<Record<string, number>>): void {
    // Implementation would update internal parameters
    logger.info('[BreakoutExpert] Parameters updated', params);
  }

  /**
   * Reset strategy state
   */
  reset(): void {
    this.priceHistory = [];
    this.volumeHistory = [];
  }
}
