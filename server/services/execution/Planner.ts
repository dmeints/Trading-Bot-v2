
/**
 * Execution Impact-aware Planner
 * Size and schedule orders to minimize slippage
 */

import { logger } from '../../utils/logger';
import { microstructureFeatures } from '../microstructure/Features';
import { volatilityModels } from '../volatility/Models';

export interface ExecutionPlan {
  symbol: string;
  totalSize: number;
  style: 'immediate' | 'twap' | 'vwap' | 'pov';
  slices: number;
  timeHorizon: number; // minutes
  estimatedCost: number; // bps
  estimatedSlippage: number; // bps
  urgency: number; // 0-1
}

export interface MarketConditions {
  spread_bps: number;
  depth_score: number; // 0-1, higher = more depth
  micro_vol: number;
  volatility_forecast: number;
}

class ExecutionPlanner {
  private plans = new Map<string, ExecutionPlan>();

  /**
   * Create execution plan for a trade
   */
  async createPlan(symbol: string, size: number, urgency: number = 0.5): Promise<ExecutionPlan> {
    try {
      const conditions = await this.getMarketConditions(symbol);
      const style = this.selectExecutionStyle(conditions, urgency);
      const plan = this.buildExecutionPlan(symbol, size, style, conditions, urgency);
      
      this.plans.set(`${symbol}_${Date.now()}`, plan);
      
      logger.debug(`[ExecutionPlanner] Created ${style} plan for ${symbol}: ${size} size, cost=${plan.estimatedCost.toFixed(1)}bps`);
      
      return plan;

    } catch (error) {
      logger.error(`[ExecutionPlanner] Error creating plan for ${symbol}:`, error);
      return this.createFallbackPlan(symbol, size, urgency);
    }
  }

  /**
   * Get current market conditions
   */
  private async getMarketConditions(symbol: string): Promise<MarketConditions> {
    // Get microstructure data
    const microSnapshot = microstructureFeatures.getSnapshot(symbol);
    const volForecast = await volatilityModels.forecastVol(symbol, 30);

    const spread_bps = microSnapshot?.spread_bps || 5;
    const micro_vol = microSnapshot?.micro_vol || 0.02;
    const volatility_forecast = volForecast?.sigmaHAR || 0.03;

    // Estimate depth score from spread and cancel rate
    const cancel_rate = microSnapshot?.cancel_rate || 0.2;
    const depth_score = Math.max(0, Math.min(1, (20 - spread_bps) / 20 * (1 - cancel_rate)));

    return {
      spread_bps,
      depth_score,
      micro_vol,
      volatility_forecast
    };
  }

  /**
   * Select execution style based on conditions
   */
  private selectExecutionStyle(conditions: MarketConditions, urgency: number): ExecutionPlan['style'] {
    const { spread_bps, depth_score, micro_vol } = conditions;

    // Immediate execution criteria
    if (urgency > 0.8 && spread_bps < 5) {
      return 'immediate';
    }

    // High micro volatility or thin depth = use time-based strategies
    if (micro_vol > 0.05 || depth_score < 0.3) {
      return Math.random() > 0.5 ? 'twap' : 'vwap';
    }

    // Medium conditions = POV (participation of volume)
    if (depth_score > 0.6 && spread_bps < 10) {
      return 'pov';
    }

    // Default to TWAP for conservative execution
    return 'twap';
  }

  /**
   * Build detailed execution plan
   */
  private buildExecutionPlan(
    symbol: string,
    totalSize: number,
    style: ExecutionPlan['style'],
    conditions: MarketConditions,
    urgency: number
  ): ExecutionPlan {
    let slices: number;
    let timeHorizon: number; // minutes

    switch (style) {
      case 'immediate':
        slices = 1;
        timeHorizon = 0.1;
        break;

      case 'twap':
        slices = Math.max(5, Math.min(20, Math.floor(totalSize * 1000))); // More slices for larger trades
        timeHorizon = Math.max(5, Math.min(60, 30 / urgency));
        break;

      case 'vwap':
        slices = Math.max(3, Math.min(15, Math.floor(totalSize * 800)));
        timeHorizon = Math.max(10, Math.min(120, 45 / urgency));
        break;

      case 'pov':
        slices = Math.max(4, Math.min(25, Math.floor(totalSize * 1200)));
        timeHorizon = Math.max(15, Math.min(180, 60 / urgency));
        break;

      default:
        slices = 10;
        timeHorizon = 30;
    }

    const { estimatedCost, estimatedSlippage } = this.estimateCosts(
      totalSize,
      style,
      conditions,
      slices
    );

    return {
      symbol,
      totalSize,
      style,
      slices,
      timeHorizon,
      estimatedCost,
      estimatedSlippage,
      urgency
    };
  }

  /**
   * Estimate execution costs
   * cost ≈ k * size^α + spread/2
   */
  private estimateCosts(
    size: number,
    style: ExecutionPlan['style'],
    conditions: MarketConditions,
    slices: number
  ): { estimatedCost: number; estimatedSlippage: number } {
    const { spread_bps, depth_score, micro_vol, volatility_forecast } = conditions;

    // Base cost from spread
    const spreadCost = spread_bps / 2;

    // Market impact scaling
    const alpha = 0.6; // Impact exponent
    const k = this.getImpactCoefficient(style, conditions);
    const impactCost = k * Math.pow(size, alpha);

    // Timing cost from micro volatility
    const timingCost = micro_vol * volatility_forecast * 100; // Convert to bps

    // Slicing benefit (more slices = less impact)
    const slicingBenefit = Math.max(0, (slices - 1) * 0.1);

    let estimatedSlippage = impactCost + timingCost - slicingBenefit;
    let estimatedCost = spreadCost + estimatedSlippage;

    // Style-specific adjustments
    switch (style) {
      case 'immediate':
        estimatedCost *= 1.5; // Higher cost for immediacy
        break;
      case 'pov':
        estimatedCost *= 0.8; // Lower cost with volume participation
        break;
      case 'vwap':
        estimatedCost *= 0.9; // Slight cost benefit
        break;
    }

    return {
      estimatedCost: Math.max(0.1, estimatedCost), // Minimum 0.1 bps
      estimatedSlippage: Math.max(0, estimatedSlippage)
    };
  }

  /**
   * Get market impact coefficient based on style and conditions
   */
  private getImpactCoefficient(style: ExecutionPlan['style'], conditions: MarketConditions): number {
    const { depth_score } = conditions;
    
    // Base coefficient (higher = more impact)
    let k = 2.0;

    // Adjust for market depth
    k *= (1.5 - depth_score); // Less depth = more impact

    // Style adjustments
    switch (style) {
      case 'immediate':
        k *= 2.0; // High impact for immediate execution
        break;
      case 'twap':
        k *= 0.7; // Lower impact with time spreading
        break;
      case 'vwap':
        k *= 0.6; // Even lower with volume matching
        break;
      case 'pov':
        k *= 0.5; // Lowest impact with participation limits
        break;
    }

    return k;
  }

  /**
   * Create fallback plan when data is unavailable
   */
  private createFallbackPlan(symbol: string, size: number, urgency: number): ExecutionPlan {
    return {
      symbol,
      totalSize: size,
      style: 'twap',
      slices: Math.max(5, Math.floor(size * 1000)),
      timeHorizon: 30,
      estimatedCost: 8.0, // 8 bps fallback
      estimatedSlippage: 3.0,
      urgency
    };
  }

  /**
   * Get the most recent plan for debugging
   */
  getLastPlan(): ExecutionPlan | null {
    const plans = Array.from(this.plans.values());
    return plans.length > 0 ? plans[plans.length - 1] : null;
  }

  /**
   * Clear old plans (keep last 100)
   */
  cleanup(): void {
    if (this.plans.size > 100) {
      const entries = Array.from(this.plans.entries());
      const toKeep = entries.slice(-100);
      this.plans.clear();
      for (const [key, value] of toKeep) {
        this.plans.set(key, value);
      }
    }
  }
}

export const executionPlanner = new ExecutionPlanner();
