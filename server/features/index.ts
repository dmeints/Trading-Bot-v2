/**
 * Unified Features Index
 * Central export for all feature calculation modules
 */

import { calculateRegime, RegimeFeatures } from './regime';
import { calculateSocial, SocialFeatures } from './social';
import { calculateOnchain, OnchainFeatures } from './onchain';
import { calculateMacro, MacroFeatures } from './macro';
import { db } from '../db';
import { marketBars } from '@shared/schema';
import { desc, eq, gte, lte, and } from 'drizzle-orm';

// Microstructure features interface
export interface MicrostructureFeatures {
  bid_ask_spread_bps: number;
  market_impact_bps: number;
  liquidity_score: number;
  order_flow_imbalance: number;
  depth_imbalance: number;
  volatility_microstructure: number;
}

// Cost features interface  
export interface CostFeatures {
  trading_fee_bps: number;
  slippage_estimate_bps: number;
  market_impact_bps: number;
  opportunity_cost_bps: number;
  total_cost_estimate_bps: number;
}

// Unified features interface
export interface UnifiedFeatures {
  symbol: string;
  timestamp: string;
  timeframe: string;
  bars: Array<{
    ts: number;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
  }>;
  micro: MicrostructureFeatures | null;
  costs: CostFeatures | null;
  regime: RegimeFeatures | null;
  social: SocialFeatures | null;
  onchain: OnchainFeatures | null;
  macro: MacroFeatures | null;
}

/**
 * Calculate microstructure features from market data
 */
async function calculateMicrostructureFeatures(
  symbol: string,
  startTime: Date,
  endTime: Date
): Promise<MicrostructureFeatures | null> {
  try {
    // Get recent market bars for microstructure analysis
    const bars = await db
      .select()
      .from(marketBars)
      .where(
        and(
          eq(marketBars.symbol, symbol),
          gte(marketBars.timestamp, startTime),
          lte(marketBars.timestamp, endTime)
        )
      )
      .orderBy(desc(marketBars.timestamp))
      .limit(100);

    if (bars.length < 10) {
      return null;
    }

    // Calculate bid-ask spread (simplified using bar data)
    const avgSpread = bars.reduce((sum, bar) => {
      const high = parseFloat(bar.high);
      const low = parseFloat(bar.low);
      const mid = (high + low) / 2;
      return sum + ((high - low) / mid * 10000); // in basis points
    }, 0) / bars.length;

    // Calculate market impact estimate
    const volumes = bars.map(bar => bar.volume ? parseFloat(bar.volume) : 0);
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const volumeStd = Math.sqrt(
      volumes.reduce((sum, vol) => sum + Math.pow(vol - avgVolume, 2), 0) / volumes.length
    );
    const volumeCV = avgVolume > 0 ? volumeStd / avgVolume : 1;
    
    const market_impact_bps = Math.min(50, avgSpread * 0.5 + volumeCV * 10);

    // Calculate liquidity score (higher is better)
    const liquidity_score = Math.max(0, Math.min(1, 
      (avgVolume / 1000000) * (1 - volumeCV) * (1 - avgSpread / 100)
    ));

    // Order flow imbalance (simplified)
    let imbalanceSum = 0;
    for (let i = 1; i < bars.length; i++) {
      const currentClose = parseFloat(bars[i-1].close);
      const prevClose = parseFloat(bars[i].close);
      const priceChange = (currentClose - prevClose) / prevClose;
      const volume = bars[i-1].volume ? parseFloat(bars[i-1].volume) : 0;
      imbalanceSum += priceChange * volume;
    }
    const order_flow_imbalance = imbalanceSum / bars.length;

    // Depth imbalance (simplified)
    const depth_imbalance = Math.random() * 0.2 - 0.1; // Placeholder

    // Microstructure volatility
    const returns = [];
    for (let i = 1; i < bars.length; i++) {
      const current = parseFloat(bars[i-1].close);
      const previous = parseFloat(bars[i].close);
      if (previous > 0) {
        returns.push(Math.log(current / previous));
      }
    }
    
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / (returns.length - 1);
    const volatility_microstructure = Math.sqrt(variance * 252 * 24 * 60) * 100; // Annualized %

    return {
      bid_ask_spread_bps: Math.round(avgSpread * 100) / 100,
      market_impact_bps: Math.round(market_impact_bps * 100) / 100,
      liquidity_score: Math.round(liquidity_score * 1000) / 1000,
      order_flow_imbalance: Math.round(order_flow_imbalance * 1000000) / 1000000,
      depth_imbalance: Math.round(depth_imbalance * 1000) / 1000,
      volatility_microstructure: Math.round(volatility_microstructure * 100) / 100
    };

  } catch (error) {
    console.error('Error calculating microstructure features:', error);
    return null;
  }
}

/**
 * Calculate trading cost features
 */
async function calculateCostFeatures(
  symbol: string,
  microFeatures: MicrostructureFeatures | null
): Promise<CostFeatures | null> {
  try {
    if (!microFeatures) {
      return null;
    }

    // Base trading fee (varies by exchange)
    const trading_fee_bps = 7; // 0.07% typical for major exchanges

    // Slippage estimate based on liquidity
    const liquidity_factor = 1 - microFeatures.liquidity_score;
    const slippage_estimate_bps = microFeatures.bid_ask_spread_bps * 0.5 + liquidity_factor * 5;

    // Market impact from microstructure
    const market_impact_bps = microFeatures.market_impact_bps;

    // Opportunity cost (simplified)
    const volatility_factor = Math.min(1, microFeatures.volatility_microstructure / 50);
    const opportunity_cost_bps = volatility_factor * 3;

    const total_cost_estimate_bps = trading_fee_bps + slippage_estimate_bps + market_impact_bps + opportunity_cost_bps;

    return {
      trading_fee_bps,
      slippage_estimate_bps: Math.round(slippage_estimate_bps * 100) / 100,
      market_impact_bps: Math.round(market_impact_bps * 100) / 100,
      opportunity_cost_bps: Math.round(opportunity_cost_bps * 100) / 100,
      total_cost_estimate_bps: Math.round(total_cost_estimate_bps * 100) / 100
    };

  } catch (error) {
    console.error('Error calculating cost features:', error);
    return null;
  }
}

/**
 * Calculate all unified features for a symbol
 */
export async function calculateUnifiedFeatures(
  symbol: string,
  startTime: Date,
  endTime: Date,
  timeframe: string = '5m'
): Promise<UnifiedFeatures> {
  try {
    console.log(`[UnifiedFeatures] Calculating for ${symbol} from ${startTime.toISOString()} to ${endTime.toISOString()}`);

    // Get market bars
    const bars = await db
      .select()
      .from(marketBars)
      .where(
        and(
          eq(marketBars.symbol, symbol),
          gte(marketBars.timestamp, startTime),
          lte(marketBars.timestamp, endTime)
        )
      )
      .orderBy(desc(marketBars.timestamp))
      .limit(50);

    const barData = bars.map(bar => ({
      ts: bar.timestamp.getTime(),
      o: parseFloat(bar.open),
      h: parseFloat(bar.high),
      l: parseFloat(bar.low),
      c: parseFloat(bar.close),
      v: bar.volume ? parseFloat(bar.volume) : 0
    }));

    // Calculate all features in parallel
    const [micro, regime, social, onchain, macro] = await Promise.all([
      calculateMicrostructureFeatures(symbol, startTime, endTime),
      calculateRegime(symbol, startTime, endTime),
      calculateSocial(symbol, startTime, endTime),
      calculateOnchain(symbol, startTime, endTime),
      calculateMacro(startTime, endTime)
    ]);

    // Calculate cost features based on microstructure
    const costs = await calculateCostFeatures(symbol, micro);

    const result: UnifiedFeatures = {
      symbol,
      timestamp: endTime.toISOString(),
      timeframe,
      bars: barData,
      micro,
      costs,
      regime,
      social,
      onchain,
      macro
    };

    console.log(`[UnifiedFeatures] Completed for ${symbol}: ${barData.length} bars, ${Object.values(result).filter(v => v !== null).length - 3} features`);

    return result;

  } catch (error) {
    console.error(`[UnifiedFeatures] Error for ${symbol}:`, error);
    
    // Return minimal structure on error
    return {
      symbol,
      timestamp: endTime.toISOString(),
      timeframe,
      bars: [],
      micro: null,
      costs: null,
      regime: null,
      social: null,
      onchain: null,
      macro: null
    };
  }
}

// Export all feature types
export * from './regime';
export * from './social';
export * from './onchain';
export * from './macro';