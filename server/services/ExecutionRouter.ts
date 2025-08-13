
import { bayesianRouter } from './StrategyRouter.js';
import { volatilityModels } from './volatility/Models.js';
import { microstructureFeatures } from './microstructure/Features.js';
import { riskGuards } from './RiskGuards.js';
import { logger } from '../utils/logger.js';

interface ExecutionPlan {
  symbol: string;
  signal: 'long' | 'flat' | 'short';
  targetSize: number;
  executionStyle: 'immediate' | 'twap' | 'vwap' | 'pov';
  urgency: number; // 0-1
  estimatedCost: number;
  riskBudget: number;
  timestamp: number;
}

interface ExecutionRecord {
  id: string;
  plan: ExecutionPlan;
  status: 'pending' | 'filled' | 'cancelled' | 'blocked';
  fillPrice?: number;
  fillSize?: number;
  blockReason?: string;
  timestamp: number;
}

interface SizingSnapshot {
  symbol: string;
  baseSize: number;
  uncertaintyScale: number;
  volTargetScale: number;
  finalSize: number;
  confidence: number;
  timestamp: number;
}

class ExecutionRouter {
  private executions: Map<string, ExecutionRecord> = new Map();
  private lastSizing: SizingSnapshot | null = null;
  private readonly maxSize = 1000000; // $1M max per trade
  
  async plan(context: any = {}): Promise<ExecutionPlan> {
    try {
      // Get strategy signal from Bayesian router
      const choice = bayesianRouter.choosePolicy(context);
      
      // Determine signal from policy
      const signal = this.policyToSignal(choice.policyId);
      
      // Get volatility forecast
      const symbol = context.symbol || 'BTCUSDT';
      const volForecast = volatilityModels.forecastVol(symbol, 60);
      
      // Get microstructure data
      const microData = microstructureFeatures.getSnapshot(symbol);
      
      // Calculate target size with uncertainty scaling
      const targetSize = this.calculateSize(signal, volForecast, microData, context);
      
      // Determine execution style based on market conditions
      const executionStyle = this.chooseExecutionStyle(microData, targetSize);
      
      // Estimate transaction costs
      const estimatedCost = this.estimateCost(targetSize, microData, executionStyle);
      
      const plan: ExecutionPlan = {
        symbol,
        signal,
        targetSize,
        executionStyle,
        urgency: Math.abs(choice.score) / 0.1, // Normalize to 0-1
        estimatedCost,
        riskBudget: context.riskBudget || 0.02,
        timestamp: Date.now()
      };
      
      return plan;
      
    } catch (error) {
      logger.error('Error creating execution plan:', { error: String(error) });
      
      // Fallback plan
      return {
        symbol: context.symbol || 'BTCUSDT',
        signal: 'flat',
        targetSize: 0,
        executionStyle: 'immediate',
        urgency: 0,
        estimatedCost: 0,
        riskBudget: 0.01,
        timestamp: Date.now()
      };
    }
  }
  
  async execute(plan: ExecutionPlan): Promise<ExecutionRecord> {
    const id = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Check risk guards
      const notional = Math.abs(plan.targetSize * 45000); // Rough price approximation
      const riskCheck = riskGuards.checkOrder(plan.symbol, notional);
      
      if (!riskCheck.allowed) {
        const record: ExecutionRecord = {
          id,
          plan,
          status: 'blocked',
          blockReason: riskCheck.reason,
          timestamp: Date.now()
        };
        
        this.executions.set(id, record);
        logger.warn(`Execution blocked for ${plan.symbol}:`, riskCheck.reason);
        return record;
      }
      
      // For paper trading, simulate execution
      const simulatedFill = this.simulateExecution(plan);
      
      const record: ExecutionRecord = {
        id,
        plan,
        status: 'filled',
        fillPrice: simulatedFill.price,
        fillSize: simulatedFill.size,
        timestamp: Date.now()
      };
      
      this.executions.set(id, record);
      
      // Record with risk guards
      riskGuards.recordOrder(plan.symbol, notional);
      
      logger.info(`Executed ${plan.symbol} ${plan.signal}:`, {
        size: simulatedFill.size,
        price: simulatedFill.price,
        cost: plan.estimatedCost
      });
      
      return record;
      
    } catch (error) {
      logger.error('Error executing plan:', { error: String(error) });
      
      const record: ExecutionRecord = {
        id,
        plan,
        status: 'cancelled',
        blockReason: String(error),
        timestamp: Date.now()
      };
      
      this.executions.set(id, record);
      return record;
    }
  }
  
  private calculateSize(
    signal: string, 
    volForecast: any, 
    microData: any, 
    context: any
  ): number {
    if (signal === 'flat') return 0;
    
    // Base size from context or default
    const sMax = context.maxSize || 0.1; // 0.1 BTC default
    
    // Uncertainty width from volatility models
    const uncertaintyWidth = Math.max(volForecast.sigmaHAR, volForecast.sigmaGARCH);
    const wStar = context.targetVol || 0.02; // 2% target vol
    
    // Kelly-lite sizing with uncertainty discount
    const kellyFraction = Math.min(0.25, sMax * Math.exp(-uncertaintyWidth / wStar));
    
    // Vol targeting adjustment
    const volTargetScale = wStar / uncertaintyWidth;
    
    // Microstructure adjustment (reduce size if low liquidity)
    const microScale = microData ? 
      Math.min(1, 1 / (1 + microData.spread_bps / 10)) : 1;
    
    const finalSize = kellyFraction * volTargetScale * microScale * (signal === 'short' ? -1 : 1);
    
    // Store sizing snapshot
    this.lastSizing = {
      symbol: context.symbol || 'BTCUSDT',
      baseSize: sMax,
      uncertaintyScale: Math.exp(-uncertaintyWidth / wStar),
      volTargetScale,
      finalSize: Math.abs(finalSize),
      confidence: volForecast.confidence || 0.5,
      timestamp: Date.now()
    };
    
    return Math.max(-this.maxSize, Math.min(this.maxSize, finalSize));
  }
  
  private chooseExecutionStyle(microData: any, targetSize: number): ExecutionPlan['executionStyle'] {
    if (!microData) return 'immediate';
    
    const sizeUsd = Math.abs(targetSize * 45000);
    
    // Large orders need careful execution
    if (sizeUsd > 50000) {
      return microData.micro_vol > 0.01 ? 'vwap' : 'twap';
    }
    
    // High urgency or good liquidity
    if (microData.spread_bps < 5 && microData.obi < 0.3) {
      return 'immediate';
    }
    
    return 'pov'; // Participation of volume
  }
  
  private estimateCost(targetSize: number, microData: any, style: string): number {
    const sizeUsd = Math.abs(targetSize * 45000);
    const alpha = 1.5; // Impact exponent
    
    // Market impact: k * size^alpha
    const impactCost = 0.0001 * Math.pow(sizeUsd / 10000, alpha);
    
    // Spread cost
    const spreadCost = microData ? (microData.spread_bps / 10000) / 2 : 0.0005;
    
    // Style-dependent adjustment
    const styleMultiplier = {
      'immediate': 1.0,
      'twap': 0.7,
      'vwap': 0.8,
      'pov': 0.6
    }[style] || 1.0;
    
    return (impactCost + spreadCost) * styleMultiplier;
  }
  
  private simulateExecution(plan: ExecutionPlan): { price: number; size: number } {
    // Simulate realistic execution with slippage
    const basePrice = plan.symbol === 'BTCUSDT' ? 45000 : 3000;
    const slippage = plan.estimatedCost * (Math.random() + 0.5); // 0.5-1.5x expected cost
    
    const fillPrice = plan.signal === 'long' ? 
      basePrice * (1 + slippage) : 
      basePrice * (1 - slippage);
    
    const fillRatio = 0.8 + Math.random() * 0.2; // 80-100% fill
    const fillSize = plan.targetSize * fillRatio;
    
    return { price: fillPrice, size: fillSize };
  }
  
  private policyToSignal(policyId: string): ExecutionPlan['signal'] {
    // Map policy to trading signal
    const policySignals: Record<string, ExecutionPlan['signal']> = {
      'p_momentum': 'long',
      'p_breakout': 'long', 
      'p_mean_revert': 'short',
      'p_sma': 'long',
      'p_vol_target': 'flat'
    };
    
    return policySignals[policyId] || 'flat';
  }
  
  getLastSizing(): SizingSnapshot | null {
    return this.lastSizing ? { ...this.lastSizing } : null;
  }
  
  getExecutionHistory(limit = 10): ExecutionRecord[] {
    return Array.from(this.executions.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
}

export const executionRouter = new ExecutionRouter();
export type { ExecutionPlan, ExecutionRecord, SizingSnapshot };
