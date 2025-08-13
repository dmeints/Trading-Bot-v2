
import { logger } from '../../utils/logger.js';

export interface LiquidityEstimate {
  impact: number;
  slippage: number;
  strategy: 'TWAP' | 'VWAP' | 'POV' | 'IMMEDIATE';
  confidence: number;
}

export class LiquidityModels {
  estimateImpact(symbol: string, size: number, urgency: 'LOW' | 'MEDIUM' | 'HIGH'): LiquidityEstimate {
    // Mock market conditions for impact estimation
    const baseVolume = this.getSymbolVolume(symbol);
    const marketImpact = Math.min(0.01, (size / baseVolume) * 0.1); // Cap at 1%
    
    // Adjust for urgency
    let strategy: LiquidityEstimate['strategy'] = 'VWAP';
    let impactMultiplier = 1.0;
    
    switch (urgency) {
      case 'LOW':
        strategy = 'TWAP';
        impactMultiplier = 0.7; // More patient = less impact
        break;
      case 'MEDIUM':
        strategy = 'VWAP';
        impactMultiplier = 1.0;
        break;
      case 'HIGH':
        strategy = 'IMMEDIATE';
        impactMultiplier = 1.5; // More urgent = more impact
        break;
    }

    const impact = marketImpact * impactMultiplier;
    const slippage = impact * 0.5; // Slippage is typically ~50% of market impact
    const confidence = Math.max(0.5, 1.0 - (size / baseVolume)); // Lower confidence for larger sizes

    logger.info(`[LiquidityModels] ${symbol} size=${size} urgency=${urgency} impact=${impact.toFixed(4)} strategy=${strategy}`);

    return {
      impact,
      slippage,
      strategy,
      confidence
    };
  }

  private getSymbolVolume(symbol: string): number {
    // Mock daily volume estimates
    const volumes: Record<string, number> = {
      'BTCUSDT': 1000000, // $1M daily volume
      'ETHUSDT': 500000,  // $500K daily volume
      'SOLUSDT': 100000   // $100K daily volume
    };
    return volumes[symbol] || 50000; // Default $50K
  }
}

export const liquidityModels = new LiquidityModels();
