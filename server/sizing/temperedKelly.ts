
import { logger } from '../utils/logger';

export interface KellyParams {
  winRate: number;
  avgWin: number;
  avgLoss: number;
  confidence?: number;
}

export function classicKellyFraction(params: KellyParams): number {
  const { winRate, avgWin, avgLoss } = params;
  
  if (avgLoss <= 0 || winRate <= 0 || winRate >= 1) return 0;
  
  const lossRate = 1 - winRate;
  const fraction = (winRate * avgWin - lossRate * avgLoss) / avgWin;
  
  return Math.max(0, fraction);
}

export function temperedKellyFraction(
  params: KellyParams,
  temperingFactor: number = 0.25
): number {
  const fullKelly = classicKellyFraction(params);
  return fullKelly * temperingFactor;
}

export function calculateKellySize(
  confidence: number,
  expectedReturn: number,
  volatility: number,
  temperingFactor: number = 0.25
): number {
  // Convert confidence and expected return to Kelly parameters
  const winRate = Math.min(0.99, Math.max(0.01, confidence));
  const avgWin = Math.abs(expectedReturn) / winRate;
  const avgLoss = Math.abs(expectedReturn) / (1 - winRate);
  
  const kellyParams: KellyParams = {
    winRate,
    avgWin,
    avgLoss,
    confidence
  };
  
  const kellyFraction = temperedKellyFraction(kellyParams, temperingFactor);
  
  // Additional volatility adjustment
  const volAdjustment = Math.min(1, 0.02 / Math.max(0.001, volatility));
  const finalSize = kellyFraction * volAdjustment;
  
  logger.debug('[KellySizing] Calculated position size', {
    confidence: confidence.toFixed(3),
    expectedReturn: expectedReturn.toFixed(4),
    volatility: volatility.toFixed(4),
    kellyFraction: kellyFraction.toFixed(4),
    volAdjustment: volAdjustment.toFixed(4),
    finalSize: finalSize.toFixed(4)
  });
  
  return Math.max(0.001, Math.min(0.1, finalSize)); // Cap between 0.1% and 10%
}

export function riskParitySize(
  positions: Array<{ symbol: string; volatility: number; correlation: number }>,
  targetRisk: number = 0.15
): Record<string, number> {
  const sizes: Record<string, number> = {};
  
  // Simple equal risk contribution
  const totalInverseVol = positions.reduce((sum, pos) => sum + (1 / pos.volatility), 0);
  
  positions.forEach(pos => {
    const weight = (1 / pos.volatility) / totalInverseVol;
    sizes[pos.symbol] = weight * targetRisk;
  });
  
  return sizes;
}

export function portfolioHeatManagement(
  currentHeat: number,
  maxHeat: number = 1.0,
  scaleDownFactor: number = 0.5
): number {
  if (currentHeat > maxHeat) {
    logger.warn('[HeatManagement] Portfolio heat exceeded, scaling down', {
      currentHeat: currentHeat.toFixed(3),
      maxHeat: maxHeat.toFixed(3),
      scaleDown: scaleDownFactor
    });
    return scaleDownFactor;
  }
  
  return 1.0;
}
