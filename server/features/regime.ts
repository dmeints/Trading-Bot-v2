/**
 * Market Regime Detection Features
 * Advanced algorithms to identify and classify market conditions
 */

import { db } from '../db';
import { marketBars } from '@shared/schema';
import { desc, eq, gte, lte, and } from 'drizzle-orm';

export interface RegimeFeatures {
  regime_classification: 'trending' | 'ranging' | 'volatile' | 'transitioning';
  trend_strength: number; // -100 to 100, negative = bearish, positive = bullish
  vol_pct: number; // Annualized volatility percentage
  liquidity_tier: number; // 1 = high liquidity, 2 = medium, 3 = low
  regime_persistence: number; // How stable the current regime is (0-1)
  breakout_probability: number; // Probability of regime change (0-1)
  mean_reversion_score: number; // How mean-reverting the current regime is (0-1)
}

/**
 * Calculate comprehensive market regime features
 */
export async function calculateRegime(
  symbol: string,
  startTime: Date,
  endTime: Date
): Promise<RegimeFeatures | null> {
  try {
    // Get sufficient historical data for regime analysis
    const lookbackTime = new Date(startTime.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days lookback
    
    const bars = await db
      .select()
      .from(marketBars)
      .where(
        and(
          eq(marketBars.symbol, symbol),
          gte(marketBars.timestamp, lookbackTime),
          lte(marketBars.timestamp, endTime)
        )
      )
      .orderBy(desc(marketBars.timestamp))
      .limit(200); // Up to 200 bars for analysis

    if (bars.length < 20) {
      console.log(`[Regime] Insufficient data for ${symbol}: ${bars.length} bars`);
      return null;
    }

    // Convert to price array for analysis
    const prices = bars.map(bar => parseFloat(bar.close)).reverse(); // Chronological order
    const volumes = bars.map(bar => bar.volume ? parseFloat(bar.volume) : 0).reverse();
    
    // Calculate returns
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i-1] > 0) {
        returns.push(Math.log(prices[i] / prices[i-1]));
      }
    }

    if (returns.length < 10) {
      return null;
    }

    // Calculate volatility (annualized)
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (returns.length - 1);
    const vol_pct = Math.sqrt(variance * 365 * 24 * 60) * 100; // Assuming minute bars, annualized

    // Calculate trend strength using multiple methods
    const trend_strength = calculateTrendStrength(prices, returns);
    
    // Regime classification based on volatility and trend
    const regime_classification = classifyRegime(trend_strength, vol_pct, returns);
    
    // Liquidity tier assessment
    const liquidity_tier = assessLiquidityTier(volumes, symbol);
    
    // Regime persistence (how stable the current regime is)
    const regime_persistence = calculateRegimePersistence(returns);
    
    // Breakout probability
    const breakout_probability = calculateBreakoutProbability(prices, vol_pct);
    
    // Mean reversion score
    const mean_reversion_score = calculateMeanReversionScore(returns);

    const result: RegimeFeatures = {
      regime_classification,
      trend_strength: Math.round(trend_strength * 100) / 100,
      vol_pct: Math.round(vol_pct * 100) / 100,
      liquidity_tier,
      regime_persistence: Math.round(regime_persistence * 1000) / 1000,
      breakout_probability: Math.round(breakout_probability * 1000) / 1000,
      mean_reversion_score: Math.round(mean_reversion_score * 1000) / 1000
    };

    console.log(`[Regime] Calculated for ${symbol}: ${result.regime_classification}, trend: ${result.trend_strength}, vol: ${result.vol_pct}%`);

    return result;

  } catch (error) {
    console.error(`[Regime] Error calculating for ${symbol}:`, error);
    return null;
  }
}

/**
 * Calculate trend strength using multiple indicators
 */
function calculateTrendStrength(prices: number[], returns: number[]): number {
  if (prices.length < 14) return 0;
  
  // Method 1: Linear regression slope
  const n = prices.length;
  const x = Array.from({length: n}, (_, i) => i);
  const y = prices;
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const normalizedSlope = slope / (sumY / n) * 100; // Normalize by average price
  
  // Method 2: ADX (Average Directional Index) approximation
  const adx = calculateSimpleADX(prices);
  
  // Method 3: Moving average alignment
  const ma5 = calculateSMA(prices, 5);
  const ma10 = calculateSMA(prices, 10);
  const ma20 = calculateSMA(prices, 20);
  
  let maAlignment = 0;
  if (ma5 > ma10 && ma10 > ma20) {
    maAlignment = 30; // Bullish alignment
  } else if (ma5 < ma10 && ma10 < ma20) {
    maAlignment = -30; // Bearish alignment
  }
  
  // Combine methods
  const combinedTrend = (normalizedSlope * 0.4) + (adx - 25) + (maAlignment * 0.4);
  
  return Math.max(-100, Math.min(100, combinedTrend));
}

/**
 * Classify market regime based on trend and volatility
 */
function classifyRegime(trendStrength: number, volatility: number, returns: number[]): RegimeFeatures['regime_classification'] {
  // High volatility threshold
  if (volatility > 60) {
    return 'volatile';
  }
  
  // Strong trend threshold
  if (Math.abs(trendStrength) > 40) {
    return 'trending';
  }
  
  // Check for ranging conditions
  const rangingIndicator = calculateRangingScore(returns);
  if (rangingIndicator > 0.6) {
    return 'ranging';
  }
  
  // Default to transitioning if unclear
  return 'transitioning';
}

/**
 * Assess liquidity tier based on volume and symbol characteristics
 */
function assessLiquidityTier(volumes: number[], symbol: string): number {
  // Major pairs get better liquidity tier
  const majorSymbols = ['BTC/USD', 'ETH/USD', 'BTC/USDT', 'ETH/USDT'];
  const isMajor = majorSymbols.some(major => symbol.includes(major.split('/')[0]));
  
  // Calculate average volume
  const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
  
  // Calculate volume consistency (lower CV is better)
  const volumeStd = Math.sqrt(
    volumes.reduce((sum, vol) => sum + Math.pow(vol - avgVolume, 2), 0) / volumes.length
  );
  const volumeCV = avgVolume > 0 ? volumeStd / avgVolume : 1;
  
  if (isMajor && avgVolume > 1000000 && volumeCV < 0.5) {
    return 1; // High liquidity
  } else if (avgVolume > 100000 && volumeCV < 1) {
    return 2; // Medium liquidity
  } else {
    return 3; // Low liquidity
  }
}

/**
 * Calculate regime persistence (how stable current regime is)
 */
function calculateRegimePersistence(returns: number[]): number {
  if (returns.length < 10) return 0.5;
  
  // Calculate rolling regime classifications
  const windowSize = 10;
  const regimeChanges = [];
  
  for (let i = windowSize; i < returns.length; i++) {
    const window1 = returns.slice(i - windowSize, i);
    const window2 = returns.slice(i - windowSize/2, i);
    
    const vol1 = Math.sqrt(window1.reduce((sum, r) => sum + r*r, 0) / window1.length);
    const vol2 = Math.sqrt(window2.reduce((sum, r) => sum + r*r, 0) / window2.length);
    
    regimeChanges.push(Math.abs(vol2 - vol1));
  }
  
  const avgRegimeChange = regimeChanges.reduce((sum, change) => sum + change, 0) / regimeChanges.length;
  
  // Lower regime changes = higher persistence
  return Math.max(0, Math.min(1, 1 - avgRegimeChange * 100));
}

/**
 * Calculate breakout probability
 */
function calculateBreakoutProbability(prices: number[], volatility: number): number {
  if (prices.length < 20) return 0.3; // Default moderate probability
  
  // Bollinger Band squeeze detection
  const ma20 = calculateSMA(prices, 20);
  const std20 = calculateStandardDeviation(prices.slice(-20));
  
  const currentPrice = prices[prices.length - 1];
  const upperBand = ma20 + 2 * std20;
  const lowerBand = ma20 - 2 * std20;
  
  // Price near bands increases breakout probability
  const distanceToUpper = Math.abs(currentPrice - upperBand) / currentPrice;
  const distanceToLower = Math.abs(currentPrice - lowerBand) / currentPrice;
  const minDistance = Math.min(distanceToUpper, distanceToLower);
  
  // Low volatility + price near bands = higher breakout probability
  const volatilityFactor = Math.max(0, 1 - volatility / 40);
  const proximityFactor = Math.max(0, 1 - minDistance * 20);
  
  return Math.min(0.9, 0.1 + volatilityFactor * 0.4 + proximityFactor * 0.4);
}

/**
 * Calculate mean reversion score
 */
function calculateMeanReversionScore(returns: number[]): number {
  if (returns.length < 10) return 0.5;
  
  // Calculate autocorrelation at lag 1
  const n = returns.length;
  const mean = returns.reduce((sum, r) => sum + r, 0) / n;
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 1; i < n; i++) {
    numerator += (returns[i] - mean) * (returns[i-1] - mean);
  }
  
  for (let i = 0; i < n; i++) {
    denominator += (returns[i] - mean) * (returns[i] - mean);
  }
  
  const autocorr = denominator > 0 ? numerator / denominator : 0;
  
  // Negative autocorrelation indicates mean reversion
  // Convert to 0-1 scale where 1 = strong mean reversion
  return Math.max(0, Math.min(1, -autocorr));
}

// Helper functions

function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1];
  const recent = prices.slice(-period);
  return recent.reduce((sum, price) => sum + price, 0) / recent.length;
}

function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function calculateSimpleADX(prices: number[]): number {
  if (prices.length < 14) return 25; // Default ADX value
  
  // Simplified ADX calculation
  let trueRanges = [];
  let dmPlus = [];
  let dmMinus = [];
  
  for (let i = 1; i < prices.length; i++) {
    const high = prices[i];
    const low = prices[i];
    const prevClose = prices[i-1];
    
    const tr = Math.max(
      Math.abs(high - low),
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
    
    const dmPlusValue = high - prices[i-1] > prices[i-1] - low ? Math.max(high - prices[i-1], 0) : 0;
    const dmMinusValue = prices[i-1] - low > high - prices[i-1] ? Math.max(prices[i-1] - low, 0) : 0;
    
    dmPlus.push(dmPlusValue);
    dmMinus.push(dmMinusValue);
  }
  
  // Calculate averages
  const avgTR = trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
  const avgDMPlus = dmPlus.reduce((sum, dm) => sum + dm, 0) / dmPlus.length;
  const avgDMMinus = dmMinus.reduce((sum, dm) => sum + dm, 0) / dmMinus.length;
  
  const diPlus = avgTR > 0 ? (avgDMPlus / avgTR) * 100 : 0;
  const diMinus = avgTR > 0 ? (avgDMMinus / avgTR) * 100 : 0;
  
  const dx = Math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100;
  
  return isNaN(dx) ? 25 : dx;
}

function calculateRangingScore(returns: number[]): number {
  if (returns.length < 10) return 0.5;
  
  // Calculate the ratio of small moves to large moves
  const absReturns = returns.map(Math.abs);
  absReturns.sort((a, b) => a - b);
  
  const q25 = absReturns[Math.floor(absReturns.length * 0.25)];
  const q75 = absReturns[Math.floor(absReturns.length * 0.75)];
  
  const smallMoves = absReturns.filter(r => r <= q25).length;
  const largeMoves = absReturns.filter(r => r >= q75).length;
  
  // More small moves relative to large moves = more ranging
  return smallMoves > largeMoves ? (smallMoves / absReturns.length) : 0.3;
}