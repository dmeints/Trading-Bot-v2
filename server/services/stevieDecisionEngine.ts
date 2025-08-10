/**
 * STEVIE DECISION ENGINE
 * Integrates the real algorithmic trading logic with live market data
 * Replaces the 3-line if-statement with comprehensive quantitative analysis
 */

import { decide } from '../strategy/stevie';
import { defaultStevieConfig } from '../../shared/src/stevie/config';
import { logger } from '../utils/logger';
import axios from 'axios';

export interface TradingDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  sizePct: number;
  reasoning: string;
  tag?: string;
  takeProfit?: number;
  stopLoss?: number;
  orderType: 'market' | 'limit' | 'ioc';
  price?: number;
}

export class StevieDecisionEngine {
  private lastDecisionTime: Map<string, number> = new Map();
  private recentDecisions: Map<string, TradingDecision[]> = new Map();

  constructor() {
    logger.info('[StevieDecisionEngine] Initialized with real algorithmic trading logic');
  }

  /**
   * Get actual trading decision based on ALL market data sources
   */
  async getTradingDecision(symbol: string, currentPosition?: any): Promise<TradingDecision> {
    try {
      // Enforce cooldown period
      const lastTime = this.lastDecisionTime.get(symbol) || 0;
      const now = Date.now();
      const cooldownMs = defaultStevieConfig.minInterTradeSec * 1000;
      
      if (now - lastTime < cooldownMs) {
        return {
          action: 'HOLD',
          confidence: 0,
          sizePct: 0,
          reasoning: `Cooldown active (${Math.ceil((cooldownMs - (now - lastTime)) / 1000)}s remaining)`,
          orderType: 'market'
        };
      }

      // Get real features from comprehensive market data
      const featuresResponse = await axios.get(`http://localhost:5000/api/features/live/${symbol}`);
      const features = featuresResponse.data;

      // Convert position to expected format
      const position = currentPosition ? {
        symbol: currentPosition.symbol,
        qty: currentPosition.quantity,
        avgPrice: currentPosition.avgPrice
      } : null;

      // Run the REAL algorithm
      const decision = decide(features, position, defaultStevieConfig);
      
      this.lastDecisionTime.set(symbol, now);

      // Convert algorithm output to trading decision
      const tradingDecision = this.convertAlgorithmDecision(decision, features, symbol);

      // Store for analysis
      const recentDecisions = this.recentDecisions.get(symbol) || [];
      recentDecisions.push(tradingDecision);
      if (recentDecisions.length > 10) recentDecisions.shift();
      this.recentDecisions.set(symbol, recentDecisions);

      logger.info(`[StevieDecisionEngine] Generated decision for ${symbol}`, {
        action: tradingDecision.action,
        confidence: tradingDecision.confidence,
        sizePct: tradingDecision.sizePct,
        tag: tradingDecision.tag,
        reasoning: tradingDecision.reasoning
      });

      return tradingDecision;

    } catch (error) {
      logger.error(`[StevieDecisionEngine] Error generating decision for ${symbol}`, { error });
      
      return {
        action: 'HOLD',
        confidence: 0,
        sizePct: 0,
        reasoning: `Error accessing market data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        orderType: 'market'
      };
    }
  }

  /**
   * Convert algorithm decision to trading format
   */
  private convertAlgorithmDecision(decision: any, features: any, symbol: string): TradingDecision {
    if (decision.type === 'HOLD') {
      return {
        action: 'HOLD',
        confidence: 0,
        sizePct: 0,
        reasoning: `Hold: ${decision.reason}`,
        orderType: 'market'
      };
    }

    // Calculate confidence based on multiple factors
    const volPct = features.regime?.vol_pct || 50;
    const socialDelta = Math.abs(features.social?.delta || 0);
    const spreadBps = features.micro?.spread_bps || 999;
    const liquidityTier = features.regime?.liquidity_tier || 3;

    // Confidence scoring (0-100)
    let confidence = 50; // Base confidence
    
    // Volume regime factor
    if (decision.tag === 'breakout' && volPct > 70) confidence += 20;
    if (decision.tag === 'mean_revert' && volPct < 40) confidence += 15;
    
    // Social sentiment factor
    confidence += Math.min(15, socialDelta * 20);
    
    // Liquidity factor
    confidence += liquidityTier === 1 ? 10 : liquidityTier === 2 ? 5 : 0;
    
    // Spread factor (tighter spread = higher confidence)
    confidence += Math.max(0, 10 - spreadBps / 2);
    
    confidence = Math.min(95, Math.max(5, confidence));

    // Determine action based on algorithm decision and market context
    let action: 'BUY' | 'SELL' = 'BUY';
    if (decision.tag === 'mean_revert') {
      // Mean reversion: trade against the current direction
      const priceDirection = features.micro?.trade_run_len || 0;
      action = priceDirection > 0 ? 'SELL' : 'BUY';
    } else {
      // Breakout/news: trade with the momentum
      const socialBias = features.social?.delta || 0;
      action = socialBias >= 0 ? 'BUY' : 'SELL';
    }

    // Calculate take profit and stop loss prices
    const currentPrice = features.bars[features.bars.length - 1]?.c || 0;
    const tpBps = decision.tp_bps || 10;
    const slBps = decision.sl_bps || 6;
    
    const takeProfit = action === 'BUY' 
      ? currentPrice * (1 + tpBps / 10000)
      : currentPrice * (1 - tpBps / 10000);
      
    const stopLoss = action === 'BUY'
      ? currentPrice * (1 - slBps / 10000)
      : currentPrice * (1 + slBps / 10000);

    return {
      action,
      confidence,
      sizePct: decision.sizePct || 0.5,
      reasoning: this.generateReasoning(decision, features, confidence),
      tag: decision.tag,
      takeProfit,
      stopLoss,
      orderType: decision.type === 'ENTER_MARKET' ? 'market' : 
                 decision.type === 'ENTER_IOC' ? 'ioc' : 'limit',
      price: decision.price
    };
  }

  /**
   * Generate human-readable reasoning for the decision
   */
  private generateReasoning(decision: any, features: any, confidence: number): string {
    const tag = decision.tag || 'unknown';
    const volPct = features.regime?.vol_pct || 50;
    const socialDelta = features.social?.delta || 0;
    const spreadBps = Math.round(features.micro?.spread_bps || 0);
    
    const reasonParts = [];
    
    // Main strategy reasoning
    if (tag === 'breakout') {
      reasonParts.push(`Breakout detected: High volatility (${volPct.toFixed(0)}th percentile)`);
      if (socialDelta > 0.5) reasonParts.push(`Strong positive sentiment (${socialDelta.toFixed(2)})`);
    } else if (tag === 'mean_revert') {
      reasonParts.push(`Mean reversion: Low volatility (${volPct.toFixed(0)}th percentile) with price snapback`);
    } else if (tag === 'news') {
      reasonParts.push(`News momentum: Social sentiment spike detected`);
    }
    
    // Market conditions
    if (spreadBps <= 10) reasonParts.push(`Tight spreads (${spreadBps} bps)`);
    if (features.regime?.liquidity_tier === 1) reasonParts.push(`High liquidity tier`);
    
    // Risk factors
    if (features.onchain?.gas_spike_flag) reasonParts.push(`Elevated gas costs`);
    if (features.macro?.blackout) reasonParts.push(`Macro event risk`);
    
    return reasonParts.join('. ') + `. Confidence: ${confidence}%`;
  }

  /**
   * Get recent decision history for analysis
   */
  getDecisionHistory(symbol: string): TradingDecision[] {
    return this.recentDecisions.get(symbol) || [];
  }

  /**
   * Get algorithm performance metrics
   */
  getAlgorithmMetrics(symbol: string): any {
    const decisions = this.getDecisionHistory(symbol);
    if (decisions.length === 0) return null;

    const totalDecisions = decisions.length;
    const actionCounts = decisions.reduce((acc, d) => {
      acc[d.action] = (acc[d.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgConfidence = decisions.reduce((sum, d) => sum + d.confidence, 0) / totalDecisions;
    const avgSize = decisions.filter(d => d.action !== 'HOLD')
                            .reduce((sum, d) => sum + d.sizePct, 0) / 
                   Math.max(1, totalDecisions - (actionCounts.HOLD || 0));

    return {
      totalDecisions,
      actionDistribution: actionCounts,
      avgConfidence: Math.round(avgConfidence),
      avgPositionSize: avgSize.toFixed(3),
      activeDecisions: totalDecisions - (actionCounts.HOLD || 0)
    };
  }
}

// Singleton instance
export const stevieDecisionEngine = new StevieDecisionEngine();