
/**
 * Execution Planner Service
 * Impact-aware order scheduling with TWAP/VWAP/POV strategies
 */

import { logger } from '../../utils/logger';
import { microstructureFeatures } from '../microstructure/Features';
import { volatilityModels } from '../volatility/Models';

export interface ExecutionPlan {
  symbol: string;
  size: number;
  style: 'immediate' | 'twap' | 'vwap' | 'pov';
  urgency: 'low' | 'medium' | 'high';
  estimated_cost: number;
  estimated_slippage: number;
  time_horizon_mins: number;
  slice_count: number;
  slice_size: number;
  rationale: string;
  confidence: number;
}

export interface MarketConditions {
  spread_bps: number;
  depth_score: number;
  micro_vol: number;
  cancel_rate: number;
  liquidity_score: number;
}

class ExecutionPlanner {
  // Cost model parameters
  private costParams = {
    spread_cost_factor: 0.5,      // Half spread as base cost
    impact_alpha: 0.6,            // Market impact power law exponent
    impact_k: 0.1,                // Market impact coefficient
    urgency_premium: 0.2,         // Premium for immediate execution
    vol_penalty: 2.0,             // Volatility cost multiplier
    depth_threshold: 0.3          // Depth score threshold for style selection
  };

  /**
   * Create execution plan for order
   */
  async createPlan(symbol: string, size: number, urgency: 'low' | 'medium' | 'high' = 'medium'): Promise<ExecutionPlan> {
    try {
      // Get market conditions
      const conditions = await this.getMarketConditions(symbol);
      
      // Select execution style
      const style = this.selectExecutionStyle(conditions, urgency, size);
      
      // Calculate time horizon and slicing
      const { time_horizon_mins, slice_count } = this.calculateTimeHorizon(style, urgency, conditions);
      const slice_size = slice_count > 0 ? size / slice_count : size;
      
      // Estimate costs
      const { estimated_cost, estimated_slippage } = this.estimateCosts(
        style, size, conditions, time_horizon_mins
      );
      
      // Generate rationale
      const rationale = this.generateRationale(style, conditions, urgency);
      
      // Calculate confidence based on data quality
      const confidence = this.calculateConfidence(conditions);

      const plan: ExecutionPlan = {
        symbol,
        size,
        style,
        urgency,
        estimated_cost,
        estimated_slippage,
        time_horizon_mins,
        slice_count,
        slice_size,
        rationale,
        confidence
      };

      logger.info(`[ExecutionPlanner] Created plan for ${symbol}: ${style} execution, cost=${estimated_cost.toFixed(4)}`);
      
      return plan;

    } catch (error) {
      logger.error(`[ExecutionPlanner] Error creating plan for ${symbol}:`, error);
      return this.getFallbackPlan(symbol, size, urgency);
    }
  }

  /**
   * Get current market conditions
   */
  private async getMarketConditions(symbol: string): Promise<MarketConditions> {
    // Get microstructure data
    const microData = microstructureFeatures.getSnapshot(symbol);
    
    // Get volatility forecast
    const volForecast = await volatilityModels.forecastVol(symbol, 15); // 15-min horizon
    
    if (!microData) {
      // Generate mock conditions if no data
      return this.getMockConditions(symbol);
    }

    // Calculate depth score (higher = better liquidity)
    const depth_score = Math.max(0, 1 - microData.spread_bps / 20); // Normalize spread to depth
    
    // Calculate liquidity score
    const liquidity_score = Math.min(1, depth_score * (1 - microData.cancel_rate));

    return {
      spread_bps: microData.spread_bps,
      depth_score,
      micro_vol: microData.micro_vol,
      cancel_rate: microData.cancel_rate,
      liquidity_score
    };
  }

  /**
   * Select optimal execution style
   */
  private selectExecutionStyle(
    conditions: MarketConditions, 
    urgency: 'low' | 'medium' | 'high',
    size: number
  ): 'immediate' | 'twap' | 'vwap' | 'pov' {
    
    // High urgency = immediate execution
    if (urgency === 'high') {
      return 'immediate';
    }
    
    // Tight spread and good depth = immediate execution possible
    if (conditions.spread_bps < 5 && conditions.depth_score > 0.7) {
      return urgency === 'medium' ? 'immediate' : 'twap';
    }
    
    // High volatility = use VWAP to ride volume
    if (conditions.micro_vol > 0.05) {
      return 'vwap';
    }
    
    // Poor liquidity = use POV to avoid impact
    if (conditions.liquidity_score < 0.3 || size > 1.0) { // Large size threshold
      return 'pov';
    }
    
    // Default to TWAP for balanced execution
    return 'twap';
  }

  /**
   * Calculate time horizon and slicing
   */
  private calculateTimeHorizon(
    style: 'immediate' | 'twap' | 'vwap' | 'pov',
    urgency: 'low' | 'medium' | 'high',
    conditions: MarketConditions
  ): { time_horizon_mins: number; slice_count: number } {
    
    let base_horizon: number;
    let base_slices: number;
    
    switch (style) {
      case 'immediate':
        base_horizon = 1;
        base_slices = 1;
        break;
      case 'twap':
        base_horizon = urgency === 'low' ? 30 : 15;
        base_slices = urgency === 'low' ? 10 : 5;
        break;
      case 'vwap':
        base_horizon = 20; // Match typical volume patterns
        base_slices = 8;
        break;
      case 'pov':
        base_horizon = urgency === 'low' ? 60 : 30;
        base_slices = urgency === 'low' ? 20 : 10;
        break;
    }
    
    // Adjust for market conditions
    const vol_adjustment = 1 + conditions.micro_vol * 2; // More volatile = longer horizon
    const liquidity_adjustment = 2 - conditions.liquidity_score; // Poor liquidity = longer
    
    const time_horizon_mins = Math.round(base_horizon * vol_adjustment * liquidity_adjustment);
    const slice_count = Math.round(base_slices * liquidity_adjustment);
    
    return { time_horizon_mins: Math.max(1, time_horizon_mins), slice_count: Math.max(1, slice_count) };
  }

  /**
   * Estimate execution costs
   */
  private estimateCosts(
    style: 'immediate' | 'twap' | 'vwap' | 'pov',
    size: number,
    conditions: MarketConditions,
    time_horizon_mins: number
  ): { estimated_cost: number; estimated_slippage: number } {
    
    // Base spread cost
    const spread_cost = conditions.spread_bps * this.costParams.spread_cost_factor / 10000;
    
    // Market impact cost: k * size^alpha
    const impact_cost = this.costParams.impact_k * Math.pow(size, this.costParams.impact_alpha);
    
    // Volatility cost
    const vol_cost = conditions.micro_vol * this.costParams.vol_penalty * Math.sqrt(time_horizon_mins / 60);
    
    // Style-specific adjustments
    let style_multiplier = 1.0;
    switch (style) {
      case 'immediate':
        style_multiplier = 1.0 + this.costParams.urgency_premium;
        break;
      case 'twap':
        style_multiplier = 0.8; // Reduced impact through timing
        break;
      case 'vwap':
        style_multiplier = 0.7; // Best execution through volume matching
        break;
      case 'pov':
        style_multiplier = 0.9; // Moderate impact reduction
        break;
    }
    
    // Liquidity adjustment
    const liquidity_multiplier = 2 - conditions.liquidity_score; // Poor liquidity = higher cost
    
    const estimated_slippage = (spread_cost + impact_cost + vol_cost) * style_multiplier * liquidity_multiplier;
    
    // Total cost includes fees (assume 0.1% trading fee)
    const estimated_cost = estimated_slippage + 0.001;
    
    return { 
      estimated_cost: Math.max(0, estimated_cost),
      estimated_slippage: Math.max(0, estimated_slippage)
    };
  }

  /**
   * Generate execution rationale
   */
  private generateRationale(
    style: 'immediate' | 'twap' | 'vwap' | 'pov',
    conditions: MarketConditions,
    urgency: 'low' | 'medium' | 'high'
  ): string {
    
    const parts: string[] = [];
    
    // Style reasoning
    switch (style) {
      case 'immediate':
        parts.push('Immediate execution due to');
        if (urgency === 'high') parts.push('high urgency');
        if (conditions.spread_bps < 5) parts.push('tight spread');
        if (conditions.depth_score > 0.7) parts.push('good depth');
        break;
      case 'twap':
        parts.push('TWAP execution for balanced timing');
        break;
      case 'vwap':
        parts.push('VWAP execution due to high volatility');
        break;
      case 'pov':
        parts.push('POV execution due to');
        if (conditions.liquidity_score < 0.3) parts.push('poor liquidity');
        parts.push('large size');
        break;
    }
    
    // Condition details
    if (conditions.spread_bps > 10) {
      parts.push('wide spread detected');
    }
    if (conditions.micro_vol > 0.05) {
      parts.push('high volatility');
    }
    if (conditions.cancel_rate > 0.5) {
      parts.push('high cancel rate');
    }
    
    return parts.join(', ');
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(conditions: MarketConditions): number {
    // Confidence based on data freshness and quality
    let confidence = 0.8; // Base confidence
    
    // Reduce confidence for poor conditions
    if (conditions.spread_bps > 20) confidence *= 0.8;
    if (conditions.liquidity_score < 0.2) confidence *= 0.7;
    if (conditions.cancel_rate > 0.8) confidence *= 0.9;
    
    return Math.max(0.3, Math.min(1.0, confidence));
  }

  /**
   * Get mock market conditions for testing
   */
  private getMockConditions(symbol: string): MarketConditions {
    const baseSpread = symbol.includes('BTC') ? 3 : 5; // BTC tighter than alts
    
    return {
      spread_bps: baseSpread + Math.random() * 5,
      depth_score: 0.4 + Math.random() * 0.4,
      micro_vol: 0.02 + Math.random() * 0.03,
      cancel_rate: 0.1 + Math.random() * 0.3,
      liquidity_score: 0.3 + Math.random() * 0.5
    };
  }

  /**
   * Fallback plan when errors occur
   */
  private getFallbackPlan(symbol: string, size: number, urgency: 'low' | 'medium' | 'high'): ExecutionPlan {
    return {
      symbol,
      size,
      style: urgency === 'high' ? 'immediate' : 'twap',
      urgency,
      estimated_cost: 0.005, // 0.5% fallback cost
      estimated_slippage: 0.003,
      time_horizon_mins: urgency === 'high' ? 1 : 15,
      slice_count: urgency === 'high' ? 1 : 5,
      slice_size: urgency === 'high' ? size : size / 5,
      rationale: 'Fallback plan due to data unavailability',
      confidence: 0.3
    };
  }
}

export const executionPlanner = new ExecutionPlanner();
