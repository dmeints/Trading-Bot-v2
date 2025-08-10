
import { logger } from '../utils/logger';

export enum TimeFrame {
  M1 = '1m',
  M5 = '5m',
  M15 = '15m',
  H1 = '1h',
  H4 = '4h',
  D1 = '1d'
}

const TIMEFRAME_MULTIPLIERS = {
  [TimeFrame.M1]: Math.sqrt(1440), // Minutes in a day
  [TimeFrame.M5]: Math.sqrt(288),
  [TimeFrame.M15]: Math.sqrt(96),
  [TimeFrame.H1]: Math.sqrt(24),
  [TimeFrame.H4]: Math.sqrt(6),
  [TimeFrame.D1]: 1
};

const ANNUALIZATION_FACTOR = Math.sqrt(365);

export function annualizationFactor(timeframe: TimeFrame): number {
  return TIMEFRAME_MULTIPLIERS[timeframe] * ANNUALIZATION_FACTOR;
}

export function rollingAnnualizedVolPct(returns: number[], timeframe: TimeFrame = TimeFrame.D1): number {
  if (returns.length < 2) return 0.02; // Default 2% daily vol
  
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  const volatility = Math.sqrt(variance);
  
  return volatility * annualizationFactor(timeframe);
}

export function varianceTargetMultiplier(
  currentVol: number,
  targetVol: number = 0.15, // 15% annual target
  minMultiplier: number = 0.1,
  maxMultiplier: number = 2.0
): number {
  if (currentVol <= 0) return minMultiplier;
  
  const multiplier = targetVol / currentVol;
  return Math.max(minMultiplier, Math.min(maxMultiplier, multiplier));
}

export function applyVarianceTarget(
  symbol: string,
  currentVolatility: number,
  targetVolatility: number = 0.15
): number {
  const multiplier = varianceTargetMultiplier(currentVolatility, targetVolatility);
  
  logger.info('[VarianceTarget] Applied variance targeting', {
    symbol,
    currentVol: currentVolatility.toFixed(4),
    targetVol: targetVolatility.toFixed(4),
    multiplier: multiplier.toFixed(4)
  });
  
  return multiplier;
}
