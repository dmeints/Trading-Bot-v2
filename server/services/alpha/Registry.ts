/**
 * Alpha Registry Service
 * Manages alpha signals and attribution analysis
 */

import { logger } from '../../utils/logger';
import { microstructureFeatures } from '../microstructure/Features';
import { volatilityModels } from '../volatility/Models';
import { optionsSmile } from '../options/Smile';

export interface AlphaSignal {
  id: string;
  name: string;
  description: string;
  category: 'microstructure' | 'volatility' | 'options' | 'technical' | 'macro';
  weight: number;
  value: number;
  confidence: number;
  timestamp: Date;
}

export interface AlphaDefinition {
  id: string;
  name: string;
  description: string;
  category: 'microstructure' | 'volatility' | 'options' | 'technical' | 'macro';
  weight_init: number;
  transform: (context: any) => Promise<{ value: number; confidence: number }>;
}

export interface BlendedSignal {
  symbol: string;
  timestamp: Date;
  aggregate_signal: number;
  confidence: number;
  components: AlphaSignal[];
  attribution: Record<string, number>; // Signal ID -> contribution
}

export interface TradeAttribution {
  trade_id: string;
  symbol: string;
  pnl: number;
  signal_contributions: Record<string, number>;
  shapley_values: Record<string, number>;
  timestamp: Date;
}

// Define AlphaContext and AlphaAttribution interfaces
export interface AlphaContext {
  symbol: string;
  price?: number;
  timestamp?: Date;
  [key: string]: any;
}

export interface AlphaAttribution {
  tradeId: string;
  timestamp: Date;
  alphaId: string;
  contribution: number;
  signal: number;
  weight: number;
  marginalPnl: number;
}

class AlphaRegistry {
  private alphas = new Map<string, AlphaDefinition>();
  private signals = new Map<string, BlendedSignal>();
  private attributions: TradeAttribution[] = [];
  private weights = new Map<string, number>();
  private alphaAttributions = new Map<string, AlphaAttribution[]>();


  constructor() {
    this.registerBuiltinAlphas();
  }

  /**
   * Register built-in alpha signals
   */
  private registerBuiltinAlphas(): void {
    // Microstructure alphas
    this.register({
      id: 'obi_signal',
      name: 'Order Book Imbalance',
      description: 'Direction signal from bid/ask imbalance',
      category: 'microstructure',
      weight_init: 0.2,
      transform: async (context) => {
        const snapshot = microstructureFeatures.getSnapshot(context.symbol);
        if (!snapshot) return { value: 0, confidence: 0 };

        // OBI ranges from -1 to 1, use as direction signal
        const value = Math.tanh(snapshot.obi * 2); // Smooth signal
        const confidence = Math.min(1, Math.abs(snapshot.obi) * 2);

        return { value, confidence };
      }
    });

    this.register({
      id: 'trade_imbalance',
      name: 'Trade Imbalance',
      description: 'Direction from buy/sell flow imbalance',
      category: 'microstructure',
      weight_init: 0.15,
      transform: async (context) => {
        const snapshot = microstructureFeatures.getSnapshot(context.symbol);
        if (!snapshot) return { value: 0, confidence: 0 };

        const value = Math.tanh(snapshot.ti * 1.5);
        const confidence = Math.min(1, Math.abs(snapshot.ti) * 1.5);

        return { value, confidence };
      }
    });

    this.register({
      id: 'spread_signal',
      name: 'Spread Tightness',
      description: 'Liquidity signal from bid-ask spread',
      category: 'microstructure',
      weight_init: 0.1,
      transform: async (context) => {
        const snapshot = microstructureFeatures.getSnapshot(context.symbol);
        if (!snapshot) return { value: 0, confidence: 0 };

        // Tight spread = positive signal (better liquidity)
        const normalizedSpread = Math.min(snapshot.spread_bps / 20, 1); // Normalize to 0-1
        const value = 1 - normalizedSpread; // Invert: tight spread = high value
        const confidence = 0.8; // Medium confidence

        return { value, confidence };
      }
    });

    // Volatility alphas
    this.register({
      id: 'vol_regime',
      name: 'Volatility Regime',
      description: 'Signal from volatility level changes',
      category: 'volatility',
      weight_init: 0.2,
      transform: async (context) => {
        const forecast = await volatilityModels.forecastVol(context.symbol, 60);

        // Use average of HAR and GARCH
        const avgVol = (forecast.sigmaHAR + forecast.sigmaGARCH) / 2;

        // High vol = negative signal (risk off), low vol = positive (risk on)
        const normalizedVol = Math.min(avgVol / 0.1, 1); // Normalize against 10% vol
        const value = 1 - normalizedVol * 2; // Map to -1 to 1 range
        const confidence = forecast.confidence;

        return { value, confidence };
      }
    });

    this.register({
      id: 'vol_convergence',
      name: 'Model Convergence',
      description: 'Agreement between HAR and GARCH forecasts',
      category: 'volatility',
      weight_init: 0.1,
      transform: async (context) => {
        const forecast = await volatilityModels.forecastVol(context.symbol, 60);

        // Model agreement = higher confidence
        const diff = Math.abs(forecast.sigmaHAR - forecast.sigmaGARCH);
        const agreement = Math.exp(-diff * 20); // Exponential decay of disagreement

        const value = 0; // Neutral signal, just affects confidence
        const confidence = agreement * forecast.confidence;

        return { value, confidence };
      }
    });

    // Options alphas
    this.register({
      id: 'risk_reversal',
      name: 'Risk Reversal',
      description: 'Skew signal from call/put IV difference',
      category: 'options',
      weight_init: 0.15,
      transform: async (context) => {
        const smile = optionsSmile.getSmileMetrics(context.symbol);
        if (!smile) return { value: 0, confidence: 0 };

        // Positive RR = call vol > put vol = bullish
        const value = Math.tanh(smile.rr25 * 10); // Scale and bound
        const confidence = 0.7; // Medium confidence

        return { value, confidence };
      }
    });

    this.register({
      id: 'iv_term_slope',
      name: 'IV Term Structure',
      description: 'Signal from term structure slope',
      category: 'options',
      weight_init: 0.1,
      transform: async (context) => {
        const smile = optionsSmile.getSmileMetrics(context.symbol);
        if (!smile) return { value: 0, confidence: 0 };

        // Positive slope = contango = potentially bearish
        const value = -Math.tanh(smile.iv_term_slope * 100); // Invert and scale
        const confidence = 0.6;

        return { value, confidence };
      }
    });

    logger.info(`[AlphaRegistry] Registered ${this.alphas.size} built-in alpha signals`);
  }

  /**
   * Register new alpha signal
   */
  register(alpha: AlphaDefinition): void {
    // Initialize weight if not already set
    if (!this.weights.has(alpha.id)) {
      this.weights.set(alpha.id, alpha.weight_init);
    }
    this.alphas.set(alpha.id, alpha);
    logger.debug(`[AlphaRegistry] Registered alpha: ${alpha.id}`);
  }

  /**
   * Get all registered alphas
   */
  getRegistry(): AlphaDefinition[] {
    return Array.from(this.alphas.values());
  }

  /**
   * Generate blended signal for context
   */
  async generateSignal(context: any): Promise<BlendedSignal> {
    const { symbol } = context;
    const timestamp = new Date();
    const components: AlphaSignal[] = [];

    // Generate individual signals
    for (const [id, alpha] of this.alphas) {
      try {
        const { value, confidence } = await alpha.transform(context);
        const currentWeight = this.weights.get(id) || alpha.weight_init;

        components.push({
          id,
          name: alpha.name,
          description: alpha.description,
          category: alpha.category,
          weight: currentWeight,
          value,
          confidence,
          timestamp
        });

      } catch (error) {
        logger.error(`[AlphaRegistry] Error generating signal ${id}:`, error);
        // Add zero signal on error
        components.push({
          id,
          name: alpha.name,
          description: alpha.description,
          category: alpha.category,
          weight: this.weights.get(id) || 0,
          value: 0,
          confidence: 0,
          timestamp
        });
      }
    }

    // Blend signals
    const { aggregate_signal, confidence, attribution } = this.blendSignals(components);

    const blendedSignal: BlendedSignal = {
      symbol,
      timestamp,
      aggregate_signal,
      confidence,
      components,
      attribution
    };

    this.signals.set(symbol, blendedSignal);

    logger.debug(`[AlphaRegistry] Generated signal for ${symbol}: ${aggregate_signal.toFixed(3)} (conf: ${confidence.toFixed(2)})`);

    return blendedSignal;
  }

  /**
   * Blend individual signals into aggregate
   */
  private blendSignals(components: AlphaSignal[]): {
    aggregate_signal: number;
    confidence: number;
    attribution: Record<string, number>;
  } {
    let weightedSum = 0;
    let totalWeight = 0;
    let totalConfidence = 0;
    const attribution: Record<string, number> = {};

    for (const signal of components) {
      const effectiveWeight = signal.weight * signal.confidence;
      const contribution = signal.value * effectiveWeight;

      weightedSum += contribution;
      totalWeight += effectiveWeight;
      totalConfidence += signal.confidence;

      attribution[signal.id] = contribution;
    }

    // Normalize
    const aggregate_signal = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const confidence = components.length > 0 ? totalConfidence / components.length : 0;

    // Normalize attribution to show relative contributions
    const totalAttribution = Object.values(attribution).reduce((sum, val) => sum + Math.abs(val), 0);
    if (totalAttribution > 0) {
      for (const key in attribution) {
        attribution[key] = attribution[key] / totalAttribution;
      }
    }

    return { aggregate_signal, confidence, attribution };
  }

  /**
   * Record trade attribution
   */
  recordTradeAttribution(tradeId: string, symbol: string, pnl: number): void {
    const signal = this.signals.get(symbol);
    if (!signal) return;

    // Simple attribution: proportional to signal contributions
    const signalContributions: Record<string, number> = {};
    const shapleyValues: Record<string, number> = {};

    // For now, use linear attribution (could implement Shapley values later)
    for (const [signalId, contribution] of Object.entries(signal.attribution)) {
      signalContributions[signalId] = contribution * pnl;
      shapleyValues[signalId] = this.calculateShapleyValue(signalId, signal, pnl);
    }

    const attribution: TradeAttribution = {
      trade_id: tradeId,
      symbol,
      pnl,
      signal_contributions: signalContributions,
      shapley_values: shapleyValues,
      timestamp: new Date()
    };

    this.attributions.push(attribution);

    // Keep only last 1000 attributions
    if (this.attributions.length > 1000) {
      this.attributions.shift();
    }

    logger.debug(`[AlphaRegistry] Recorded attribution for trade ${tradeId}: PnL=${pnl.toFixed(4)}`);
  }

  /**
   * Calculate Shapley value for signal (simplified leave-one-out)
   */
  private calculateShapleyValue(signalId: string, signal: BlendedSignal, pnl: number): number {
    // Simplified: marginal contribution = difference when signal removed
    const withSignal = signal.aggregate_signal;

    // Simulate without this signal
    const componentsWithout = signal.components.filter(c => c.id !== signalId);
    const { aggregate_signal: withoutSignal } = this.blendSignals(componentsWithout);

    const marginalContribution = withSignal - withoutSignal;
    return marginalContribution * pnl;
  }

  /**
   * Get attribution for trade
   */
  getTradeAttribution(tradeId: string): TradeAttribution | null {
    return this.attributions.find(attr => attr.trade_id === tradeId) || null;
  }

  /**
   * Get latest signal for symbol
   */
  getLatestSignal(symbol: string): BlendedSignal | null {
    return this.signals.get(symbol) || null;
  }

  /**
   * Get all attributions
   */
  getAllAttributions(): TradeAttribution[] {
    return [...this.attributions];
  }

  /**
   * Calculate PnL attribution by alpha over time window
   */
  calculateAlphaPnL(windowDays: number = 7): Record<string, number> {
    const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const recentAttributions = this.attributions.filter(attr => attr.timestamp >= cutoff);

    const alphaPnL: Record<string, number> = {};

    for (const attribution of recentAttributions) {
      for (const [alphaId, pnl] of Object.entries(attribution.shapley_values)) {
        if (!alphaPnL[alphaId]) {
          alphaPnL[alphaId] = 0;
        }
        alphaPnL[alphaId] += pnl;
      }
    }

    return alphaPnL;
  }

  /**
   * Update alpha weights (for online learning)
   */
  updateWeights(updates: Record<string, number>): void {
    for (const [alphaId, newWeight] of Object.entries(updates)) {
      if (this.alphas.has(alphaId)) {
        this.weights.set(alphaId, newWeight);
        logger.debug(`[AlphaRegistry] Updated weight for ${alphaId}: ${newWeight.toFixed(4)}`);
      }
    }
  }

  /**
   * Record alpha attribution for a trade
   */
  recordAttribution(tradeId: string, alphaSignals: Record<string, number>, totalPnl: number): void {
    const timestamp = new Date();
    const attributions: AlphaAttribution[] = [];

    // Simple leave-one-out attribution
    const alphaIds = Object.keys(alphaSignals);
    const totalWeight = alphaIds.reduce((sum, id) => sum + (this.weights.get(id) || 0), 0);

    for (const alphaId of alphaIds) {
      const signal = alphaSignals[alphaId];
      const weight = this.weights.get(alphaId) || 0;
      const contribution = totalWeight > 0 ? (weight / totalWeight) : 0;
      const marginalPnl = contribution * totalPnl;

      attributions.push({
        tradeId,
        timestamp,
        alphaId,
        contribution,
        signal,
        weight,
        marginalPnl
      });
    }

    this.alphaAttributions.set(tradeId, attributions);
    logger.debug(`[AlphaRegistry] Recorded attribution for trade ${tradeId}: ${attributions.length} alphas`);
  }

  /**
   * Get attribution for a trade
   */
  getAttribution(tradeId: string): AlphaAttribution[] {
    return this.alphaAttributions.get(tradeId) || [];
  }

  /**
   * Get aggregated alpha PnL over a time window
   */
  getAlphaPnL(windowDays: number = 7): Record<string, number> {
    const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const alphaPnL: Record<string, number> = {};

    for (const attributions of this.alphaAttributions.values()) {
      for (const attr of attributions) {
        if (attr.timestamp >= cutoff) {
          alphaPnL[attr.alphaId] = (alphaPnL[attr.alphaId] || 0) + attr.marginalPnl;
        }
      }
    }

    return alphaPnL;
  }
}

export const alphaRegistry = new AlphaRegistry();