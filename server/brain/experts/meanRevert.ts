
/**
 * Mean Reversion Expert Strategy
 * Low volatility counter-trend strategy with statistical signals
 */

import { logger } from '../../utils/logger';
import { StateVector, RegimeState } from '../state_space';
import { ExpertAction } from './breakout';

export interface MeanReversionSignals {
  overextension: boolean;
  volumeExhaustion: boolean;
  sentimentExtreme: boolean;
  technicalOversold: boolean;
  regimeAlignment: boolean;
}

export class MeanReversionExpert {
  private priceHistory: number[] = [];
  private returnHistory: number[] = [];
  private sentimentHistory: number[] = [];
  private readonly lookbackPeriod: number = 50;
  private readonly overextensionThreshold: number = 2.0; // Z-score threshold
  private readonly maxVolThreshold: number = 0.20; // Maximum volatility for mean reversion

  constructor(
    private readonly baseSize: number = 0.03,
    private readonly maxSize: number = 0.10
  ) {}

  /**
   * Generate trading decision for mean reversion strategy
   */
  async decide(
    state: StateVector,
    regimes: RegimeState[],
    features: any
  ): Promise<ExpertAction> {
    // Update histories
    this.updateHistory(features.price, state.sentimentScore);

    // Check regime suitability
    const meanRevertRegime = this.getMeanRevertRegimeProbability(regimes);
    if (meanRevertRegime < 0.4) {
      return this.holdAction('Mean revert regime probability too low');
    }

    // Check volatility environment
    if (state.volatility > this.maxVolThreshold) {
      return this.holdAction('Volatility too high for mean reversion');
    }

    // Detect mean reversion signals
    const signals = this.detectMeanReversionSignals(state, features);
    const signalCount = Object.values(signals).filter(Boolean).length;

    if (signalCount < 3) {
      return this.holdAction(`Insufficient signals (${signalCount}/5)`);
    }

    // Determine reversion direction
    const direction = this.determineReversionDirection(state, features);
    if (!direction) {
      return this.holdAction('No clear reversion direction');
    }

    // Calculate position size
    const signalStrength = signalCount / 5;
    const volatilityDiscount = Math.max(0.5, this.maxVolThreshold / Math.max(state.volatility, 0.05));
    const regimeBoost = Math.min(1.2, meanRevertRegime + 0.2);

    let sizePct = this.baseSize * signalStrength * volatilityDiscount * regimeBoost;
    sizePct = Math.min(sizePct, this.maxSize);

    // Conservative take profit and stop loss for mean reversion
    const volMultiplier = Math.max(0.8, state.volatility / 0.15);
    const tpBps = Math.round(80 * volMultiplier);  // 0.8% base TP
    const slBps = Math.round(120 * volMultiplier); // 1.2% base SL (wider for mean reversion)

    const confidence = Math.min(0.85, 0.4 + 0.4 * signalStrength + 0.15 * meanRevertRegime);

    // Use limit orders for better execution in mean reversion
    const entryPrice = this.calculateOptimalEntry(direction, features.price, state.spread);

    logger.debug('[MeanReversionExpert] Generated signal', {
      direction,
      sizePct: sizePct.toFixed(4),
      confidence: confidence.toFixed(3),
      signals: Object.entries(signals).filter(([_, v]) => v).map(([k, _]) => k),
      meanRevertProb: meanRevertRegime.toFixed(3),
      entryPrice: entryPrice.toFixed(2)
    });

    return {
      type: 'ENTER_LIMIT',
      sizePct,
      side: direction,
      confidence,
      tpBps,
      slBps,
      price: entryPrice,
      reasoning: `Mean reversion ${direction}: ${Object.entries(signals).filter(([_, v]) => v).map(([k, _]) => k).join(', ')}`
    };
  }

  private updateHistory(price: number, sentiment: number): void {
    if (!isNaN(price) && price > 0) {
      this.priceHistory.push(price);
      if (this.priceHistory.length > this.lookbackPeriod) {
        this.priceHistory.shift();
      }

      // Calculate returns
      if (this.priceHistory.length > 1) {
        const prevPrice = this.priceHistory[this.priceHistory.length - 2];
        const return_ = (price - prevPrice) / prevPrice;
        this.returnHistory.push(return_);
        if (this.returnHistory.length > this.lookbackPeriod) {
          this.returnHistory.shift();
        }
      }
    }

    if (!isNaN(sentiment)) {
      this.sentimentHistory.push(sentiment);
      if (this.sentimentHistory.length > this.lookbackPeriod) {
        this.sentimentHistory.shift();
      }
    }
  }

  private detectMeanReversionSignals(state: StateVector, features: any): MeanReversionSignals {
    return {
      overextension: this.detectPriceOverextension(),
      volumeExhaustion: this.detectVolumeExhaustion(features),
      sentimentExtreme: this.detectSentimentExtreme(),
      technicalOversold: this.detectTechnicalOversold(state),
      regimeAlignment: this.detectRegimeAlignment(features)
    };
  }

  private detectPriceOverextension(): boolean {
    if (this.returnHistory.length < 20) return false;

    // Calculate recent cumulative return
    const recentReturns = this.returnHistory.slice(-5);
    const cumulativeReturn = recentReturns.reduce((cum, r) => cum + r, 0);

    // Calculate historical statistics
    const allReturns = this.returnHistory.slice(0, -5);
    const mean = allReturns.reduce((sum, r) => sum + r, 0) / allReturns.length;
    const variance = allReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / allReturns.length;
    const std = Math.sqrt(variance);

    if (std <= 0) return false;

    // Z-score of cumulative return
    const zScore = Math.abs(cumulativeReturn - mean * 5) / (std * Math.sqrt(5));
    return zScore > this.overextensionThreshold;
  }

  private detectVolumeExhaustion(features: any): boolean {
    // Simple heuristic: volume declining while price moving
    return features.volume && features.volume < features.avgVolume * 0.7;
  }

  private detectSentimentExtreme(): boolean {
    if (this.sentimentHistory.length < 10) return false;

    const recentSentiment = this.sentimentHistory.slice(-3);
    const avgRecentSentiment = recentSentiment.reduce((sum, s) => sum + s, 0) / recentSentiment.length;

    // Extreme positive or negative sentiment
    return Math.abs(avgRecentSentiment) > 0.6;
  }

  private detectTechnicalOversold(state: StateVector): boolean {
    // RSI-like calculation using price momentum
    if (this.returnHistory.length < 14) return false;

    const recentReturns = this.returnHistory.slice(-14);
    const gains = recentReturns.filter(r => r > 0).reduce((sum, r) => sum + r, 0);
    const losses = -recentReturns.filter(r => r < 0).reduce((sum, r) => sum + r, 0);

    if (gains + losses === 0) return false;

    const rsi = 100 - (100 / (1 + gains / losses));
    return rsi < 30 || rsi > 70; // Oversold or overbought
  }

  private detectRegimeAlignment(features: any): boolean {
    // Check if market conditions favor mean reversion
    const tightSpread = features.spread < 0.003;
    const noMacroStress = !features.macroBlackout;
    const lowVolatility = features.recentVolatility < 0.25;

    return tightSpread && noMacroStress && lowVolatility;
  }

  private determineReversionDirection(state: StateVector, features: any): 'buy' | 'sell' | null {
    let reversionScore = 0;

    // Price overextension direction
    if (this.returnHistory.length >= 5) {
      const recentReturn = this.returnHistory.slice(-5).reduce((sum, r) => sum + r, 0);
      if (recentReturn > 0.02) reversionScore -= 1; // Sell on overextension up
      else if (recentReturn < -0.02) reversionScore += 1; // Buy on overextension down
    }

    // Sentiment contrarian signal
    if (state.sentimentScore > 0.5) reversionScore -= 1;
    else if (state.sentimentScore < -0.5) reversionScore += 1;

    // Technical levels
    if (this.detectTechnicalOversold(state)) {
      const recentReturns = this.returnHistory.slice(-5);
      const totalReturn = recentReturns.reduce((sum, r) => sum + r, 0);
      if (totalReturn < -0.015) reversionScore += 1; // Buy oversold
      else if (totalReturn > 0.015) reversionScore -= 1; // Sell overbought
    }

    // Imbalance contrarian
    if (features.imbalance > 0.2) reversionScore += 1; // Buy when sellers dominate
    else if (features.imbalance < -0.2) reversionScore -= 1; // Sell when buyers dominate

    if (reversionScore >= 2) return 'buy';
    if (reversionScore <= -2) return 'sell';
    return null;
  }

  private calculateOptimalEntry(direction: 'buy' | 'sell', currentPrice: number, spread: number): number {
    // Place limit order slightly inside spread for better fill probability
    const halfSpread = spread / 2;
    const improvement = halfSpread * 0.3; // 30% through spread

    if (direction === 'buy') {
      return currentPrice - halfSpread + improvement;
    } else {
      return currentPrice + halfSpread - improvement;
    }
  }

  private getMeanRevertRegimeProbability(regimes: RegimeState[]): number {
    // Regime 0 is low volatility mean reversion
    const meanRevertRegime = regimes.find(r => r.regimeId === 0);
    return meanRevertRegime ? meanRevertRegime.probability : 0;
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
   * Get strategy parameters
   */
  getParameters(): Record<string, number> {
    return {
      baseSize: this.baseSize,
      maxSize: this.maxSize,
      overextensionThreshold: this.overextensionThreshold,
      maxVolThreshold: this.maxVolThreshold,
      lookbackPeriod: this.lookbackPeriod
    };
  }

  /**
   * Reset strategy state
   */
  reset(): void {
    this.priceHistory = [];
    this.returnHistory = [];
    this.sentimentHistory = [];
  }
}
