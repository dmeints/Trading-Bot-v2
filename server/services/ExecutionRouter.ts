/**
 * Phase J - Real-Time Execution Router
 * Intelligent order routing based on market conditions and risk assessment
 */

import { logger } from '../utils/logger';
import type { Position, Trade, MarketBar } from "@shared/schema";
import { marketBars } from "@shared/schema";
import { db } from "../db";
import { desc, gte } from "drizzle-orm";

export interface ExecutionDecision {
  orderType: 'MAKER' | 'IOC' | 'FOK';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  expectedFillProbability: number;
  reasoning: string;
  blockedReason?: string;
  riskAssessment: {
    toxicityFlag: boolean;
    spreadAnalysis: number;
    volumeAnalysis: number;
    marketImpact: number;
  };
}

export interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  targetPrice?: number;
  maxSlippage: number;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ExecutionContext {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  strategy?: string;
}

export interface SizingSnapshot {
  symbol: string;
  baseSize: number;
  uncertaintyWidth: number;
  finalSize: number;
  timestamp: Date;
  confidence: number;
}

export import { logger } from '../utils/logger';
import { db } from '../db';
import { marketBars } from '../../shared/schema';
import { desc, gte } from 'drizzle-orm';

interface ExecutionRecord {
  id: string;
  timestamp: Date;
  symbol: string;
  policyId: string;
  requestedSize: number;
  finalSize: number;
  fillPrice: number;
  side: 'buy' | 'sell' | 'hold';
  context: any;
  uncertaintyWidth: number;
  confidence: number;
}

interface ExecutionContext {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  urgency?: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface SizingSnapshot {
  symbol: string;
  baseSize: number;
  uncertaintyWidth: number;
  finalSize: number;
  timestamp: Date;
  confidence: number;
}

interface OrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface ExecutionDecision {
  orderType: 'MAKER' | 'IOC' | 'FOK';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  expectedFillProbability: number;
  reasoning: string;
  blockedReason?: string;
  riskAssessment: {
    toxicityFlag: boolean;
    spreadAnalysis: number;
    volumeAnalysis: number;
    marketImpact: number;
  };
}

class ExecutionRouter {
  private static instance: ExecutionRouter;
  private executionLog: ExecutionRecord[] = [];
  private lastSizing: SizingSnapshot | null = null;

  public static getInstance(): ExecutionRouter {
    if (!ExecutionRouter.instance) {
      ExecutionRouter.instance = new ExecutionRouter();
    }
    return ExecutionRouter.instance;
  }

  constructor() {
    logger.info('[ExecutionRouter] Initialized');
  }

  /**
   * Analyze current market conditions for execution routing
   */
  private async analyzeMarketConditions(symbol: string): Promise<{
    spread: number;
    volatility: number;
    volume: number;
    depth: number;
    toxicityFlag: boolean;
  }> {
    const recent = new Date(Date.now() - 30 * 60 * 1000); // Last 30 minutes

    const recentBars = await db
      .select()
      .from(marketBars)
      .where(gte(marketBars.timestamp, recent))
      .orderBy(desc(marketBars.timestamp))
      .limit(10);

    if (recentBars.length === 0) {
      return {
        spread: 0.001, // Default 0.1%
        volatility: 0.02, // Default 2%
        volume: 1000,
        depth: 1000,
        toxicityFlag: false
      };
    }

    const latestBar = recentBars[0];
    const spread = latestBar.high && latestBar.low
      ? (latestBar.high - latestBar.low) / latestBar.close
      : 0.001;

    // Calculate volatility from recent bars
    const returns = recentBars
      .slice(1)
      .map((bar, i) => Math.log(bar.close / recentBars[i].close))
      .filter(r => !isNaN(r));

    const volatility = returns.length > 1
      ? Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length) * Math.sqrt(24 * 60) // Annualized
      : 0.02;

    const avgVolume = recentBars.reduce((sum, bar) => sum + (bar.volume || 0), 0) / recentBars.length;

    // Simple toxicity detection based on unusual price/volume patterns
    const toxicityFlag = spread > 0.01 || volatility > 0.5 || avgVolume < 100;

    return {
      spread,
      volatility,
      volume: avgVolume,
      depth: avgVolume * 2, // Simple depth approximation
      toxicityFlag
    };
  }

  /**
   * Calculate expected fill probability based on market conditions
   */
  private calculateFillProbability(
    orderType: 'MAKER' | 'IOC' | 'FOK',
    market: { spread: number; volatility: number; volume: number; toxicityFlag: boolean },
    urgency: 'LOW' | 'MEDIUM' | 'HIGH'
  ): number {
    let baseProbability = 0.95;

    switch (orderType) {
      case 'MAKER':
        baseProbability = 0.7; // Lower probability but better price
        break;
      case 'IOC':
        baseProbability = 0.9; // High probability, partial fills allowed
        break;
      case 'FOK':
        baseProbability = 0.8; // All or nothing
        break;
    }

    // Adjust for market conditions
    if (market.toxicityFlag) baseProbability *= 0.8;
    if (market.spread > 0.005) baseProbability *= 0.9; // Wide spreads reduce fill probability
    if (market.volatility > 0.1) baseProbability *= 0.85; // High volatility reduces fills

    // Adjust for urgency
    switch (urgency) {
      case 'HIGH':
        baseProbability *= 1.1; // More aggressive execution
        break;
      case 'MEDIUM':
        baseProbability *= 1.0;
        break;
      case 'LOW':
        baseProbability *= 0.9; // More patient execution
        break;
    }

    return Math.min(1.0, Math.max(0.1, baseProbability));
  }

  /**
   * Route order execution based on market conditions and requirements
   */
  async routeExecution(request: OrderRequest): Promise<ExecutionDecision> {
    try {
      logger.info('[ExecutionRouter] Routing order', {
        symbol: request.symbol,
        side: request.side,
        quantity: request.quantity,
        urgency: request.urgency
      });

      const market = await this.analyzeMarketConditions(request.symbol);

      // Risk assessment
      const riskAssessment = {
        toxicityFlag: market.toxicityFlag,
        spreadAnalysis: market.spread,
        volumeAnalysis: market.volume,
        marketImpact: (request.quantity / market.volume) * 100 // Percentage of average volume
      };

      // Check for blocking conditions
      if (riskAssessment.marketImpact > 20) {
        return {
          orderType: 'MAKER',
          confidence: 'LOW',
          expectedFillProbability: 0.3,
          reasoning: 'Large order size requires careful execution',
          blockedReason: 'Order size exceeds 20% of average volume - use smaller chunks',
          riskAssessment
        };
      }

      if (market.toxicityFlag && request.urgency === 'HIGH') {
        return {
          orderType: 'MAKER',
          confidence: 'LOW',
          expectedFillProbability: 0.4,
          reasoning: 'Toxic market conditions detected',
          blockedReason: 'High toxicity flag prevents urgent execution - consider delaying',
          riskAssessment
        };
      }

      // Execution routing logic
      let orderType: 'MAKER' | 'IOC' | 'FOK' = 'IOC';
      let reasoning = '';

      if (request.urgency === 'LOW' && market.spread < 0.002) {
        // Low urgency + tight spreads = use MAKER for better prices
        orderType = 'MAKER';
        reasoning = 'Tight spreads and low urgency favor maker execution for price improvement';
      } else if (request.urgency === 'HIGH' || market.volatility > 0.05) {
        // High urgency or volatile markets = use IOC for speed
        orderType = 'IOC';
        reasoning = 'High urgency or volatility requires immediate execution with IOC';
      } else if (request.quantity > market.volume * 0.1) {
        // Large orders = use FOK to avoid partial fills
        orderType = 'FOK';
        reasoning = 'Large order size requires all-or-nothing execution to avoid signaling';
      }

      const expectedFillProbability = this.calculateFillProbability(orderType, market, request.urgency);

      // Determine confidence level
      let confidence: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
      if (expectedFillProbability > 0.9) confidence = 'HIGH';
      else if (expectedFillProbability < 0.7) confidence = 'LOW';

      const decision: ExecutionDecision = {
        orderType,
        confidence,
        expectedFillProbability,
        reasoning,
        riskAssessment
      };

      logger.info('[ExecutionRouter] Execution decision', {
        orderType: decision.orderType,
        confidence: decision.confidence,
        fillProbability: decision.expectedFillProbability,
        reasoning: decision.reasoning
      });

      return decision;

    } catch (error) {
      logger.error('[ExecutionRouter] Routing failed', error);

      // Fallback to safe conservative execution
      return {
        orderType: 'MAKER',
        confidence: 'LOW',
        expectedFillProbability: 0.5,
        reasoning: 'Execution routing failed - using conservative fallback',
        blockedReason: 'System error during routing analysis',
        riskAssessment: {
          toxicityFlag: true,
          spreadAnalysis: 0.01,
          volumeAnalysis: 0,
          marketImpact: 100
        }
      };
    }
  }

  /**
   * Get current execution status for UI display
   */
  async getExecutionStatus(symbol: string): Promise<{
    marketHealth: 'HEALTHY' | 'CAUTION' | 'TOXIC';
    recommendedOrderType: 'MAKER' | 'IOC' | 'FOK';
    currentSpread: number;
    volatility: number;
    lastUpdate: Date;
  }> {
    const market = await this.analyzeMarketConditions(symbol);

    let marketHealth: 'HEALTHY' | 'CAUTION' | 'TOXIC' = 'HEALTHY';
    if (market.toxicityFlag) marketHealth = 'TOXIC';
    else if (market.spread > 0.005 || market.volatility > 0.1) marketHealth = 'CAUTION';

    let recommendedOrderType: 'MAKER' | 'IOC' | 'FOK' = 'IOC';
    if (marketHealth === 'HEALTHY' && market.spread < 0.002) recommendedOrderType = 'MAKER';
    else if (market.volatility > 0.05) recommendedOrderType = 'FOK';

    return {
      marketHealth,
      recommendedOrderType,
      currentSpread: market.spread,
      volatility: market.volatility,
      lastUpdate: new Date()
    };
  }

  getExecutionHistory(): any[] {
    return this.executionLog.slice(-100); // Return last 100 executions
  }

  computeUncertaintyScaledSize(
    symbol: string,
    baseSize: number,
    uncertaintyWidth: number = 0.1
  ): SizingSnapshot {
    // Sigmoid function: size = baseSize * sigmoid(-uncertaintyWidth)
    // Higher uncertainty -> smaller size
    const scalingFactor = this.sigmoid(-uncertaintyWidth * 10); // Scale for reasonable range
    const finalSize = baseSize * scalingFactor;

    // Confidence based on inverse of uncertainty
    const confidence = Math.max(0, Math.min(1, 1 - uncertaintyWidth));

    const snapshot: SizingSnapshot = {
      symbol,
      baseSize,
      uncertaintyWidth,
      finalSize,
      timestamp: new Date(),
      confidence
    };

    this.lastSizing = snapshot;

    logger.info(`[ExecutionRouter] Uncertainty sizing: ${symbol} base=${baseSize.toFixed(4)} uncertainty=${uncertaintyWidth.toFixed(4)} final=${finalSize.toFixed(4)} confidence=${confidence.toFixed(3)}`);

    return snapshot;
  }

  getLastSizing(): SizingSnapshot | null {
    return this.lastSizing;
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  // Mock conformal predictor uncertainty for demo
  private getConformalUncertainty(symbol: string): number {
    // Simulate varying uncertainty levels
    const baseUncertainty = 0.05 + Math.random() * 0.15; // 5-20%

    // Add symbol-specific factors
    if (symbol.includes('BTC')) return baseUncertainty * 0.8; // BTC is more predictable
    if (symbol.includes('ETH')) return baseUncertainty * 0.9;
    return baseUncertainty; // Default uncertainty
  }

  executeWithSizing(context: ExecutionContext): any {
    // Get uncertainty from conformal predictor (mocked for now)
    const uncertaintyWidth = this.getConformalUncertainty(context.symbol);

    // Compute uncertainty-scaled size
    const sizing = this.computeUncertaintyScaledSize(
      context.symbol,
      context.quantity,
      uncertaintyWidth
    );

    // Create execution with adjusted size
    const adjustedContext = {
      ...context,
      quantity: sizing.finalSize
    };

    const execution = this.routeExecution(adjustedContext as OrderRequest);

    // Log the sizing decision
    logger.info(`[ExecutionRouter] Executed ${context.symbol} ${context.side} - Original size: ${context.quantity}, Uncertainty: ${uncertaintyWidth.toFixed(4)}, Final size: ${sizing.finalSize.toFixed(4)}`);

    return {
      ...execution,
      sizingInfo: sizing
    };
  }

  /**
   * Plan-and-execute: Router choice → sizing → paper execution
   */
  async planAndExecute(symbol: string, baseSize: number = 1000): Promise<ExecutionRecord> {
    try {
      // Import StrategyRouter
      const { StrategyRouter } = await import('./StrategyRouter');
      const router = new StrategyRouter();

      // Create context for strategy router
      const context = {
        regime: 'bull', // Mock regime detection
        vol: 0.02,
        trend: 0.1,
        funding: 0.0001,
        sentiment: 0.3
      };

      // Plan: Get policy choice from StrategyRouter
      const choice = router.choose(context);
      logger.info(`[ExecutionRouter] Strategy choice: ${choice.policyId} (score: ${choice.score.toFixed(4)})`);

      // Convert policy to signal
      const signal = this.policyToSignal(choice);
      
      // Size with uncertainty
      const uncertaintyWidth = this.getConformalUncertainty(symbol);
      const sizing = this.computeUncertaintyScaledSize(symbol, baseSize * signal.sizeMultiplier, uncertaintyWidth);

      // Execute in paper mode
      const executionRecord: ExecutionRecord = {
        id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        timestamp: new Date(),
        symbol,
        policyId: choice.policyId,
        requestedSize: baseSize * signal.sizeMultiplier,
        finalSize: sizing.finalSize,
        fillPrice: await this.getMockFillPrice(symbol),
        side: signal.side,
        context,
        uncertaintyWidth,
        confidence: sizing.confidence
      };

      // Store execution record
      this.executionLog.push(executionRecord);

      // Simulate paper position update
      await this.updatePaperPosition(executionRecord);

      logger.info(`[ExecutionRouter] Plan-and-execute complete: ${JSON.stringify(executionRecord)}`);
      return executionRecord;

    } catch (error) {
      logger.error(`[ExecutionRouter] Plan-and-execute failed:`, error);
      throw error;
    }
  }

  private policyToSignal(choice: any): { side: 'buy' | 'sell' | 'hold', sizeMultiplier: number } {
    // Simple policy mapping - extend based on actual policy logic
    if (choice.score > 0.6) {
      return { side: 'buy', sizeMultiplier: 1.0 };
    } else if (choice.score < -0.6) {
      return { side: 'sell', sizeMultiplier: 1.0 };
    } else {
      return { side: 'hold', sizeMultiplier: 0.0 };
    }
  }

  private async getMockFillPrice(symbol: string): Promise<number> {
    // Mock price - in real system, get from market data
    const basePrices: Record<string, number> = {
      'BTCUSDT': 43000,
      'ETHUSDT': 2500,
      'SOLUSDT': 100
    };
    const basePrice = basePrices[symbol] || 1000;
    return basePrice * (1 + (Math.random() - 0.5) * 0.001); // Small random spread
  }

  private async updatePaperPosition(execution: ExecutionRecord): Promise<void> {
    // Mock paper position update - in real system, integrate with trading engine
    logger.info(`[ExecutionRouter] Updated paper position: ${execution.symbol} ${execution.side} ${execution.finalSize}`);
  }

  getExecutionRecords(): ExecutionRecord[] {
    return this.executionLog.slice(-50); // Return last 50 executions
  }
}

export const executionRouter = ExecutionRouter.getInstance();