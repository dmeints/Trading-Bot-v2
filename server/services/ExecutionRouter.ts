import { logger } from '../utils/logger.js';
import { strategyRouter } from './StrategyRouter.js';
import { liquidityModels } from './execution/LiquidityModels.js';
import { riskGuards } from './RiskGuards.js';

export interface ExecutionRecord {
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

export interface SizingSnapshot {
  symbol: string;
  baseSize: number;
  uncertaintyWidth: number;
  finalSize: number;
  timestamp: Date;
  confidence: number;
}

interface ExecutionParams {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price?: number;
  orderType: 'market' | 'limit';
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
}

interface ExecutionResult {
  success: boolean;
  orderId: string;
  executedQuantity: number;
  executedPrice: number;
  timestamp: Date;
  blocked?: boolean;
  reason?: string;
  limits?: any;
}


export class ExecutionRouter {
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

  async planAndExecute(symbol: string, baseSize: number = 1000): Promise<ExecutionRecord> {
    try {
      // Plan: Get policy choice from StrategyRouter
      const context = {
        regime: 'bull', // Mock regime detection
        vol: 0.02,
        trend: 0.1,
        funding: 0.0001,
        sentiment: 0.3
      };

      const choice = strategyRouter.choose(context);
      logger.info(`[ExecutionRouter] Strategy choice: ${choice.policyId} (score: ${choice.score.toFixed(4)})`);

      // Convert policy to signal
      const signal = this.policyToSignal(choice);

      // Size with uncertainty
      const uncertaintyWidth = this.getConformalUncertainty(symbol);
      const sizing = this.computeUncertaintyScaledSize(symbol, baseSize * signal.sizeMultiplier, uncertaintyWidth);

      // Check risk guards
      const guardResult = riskGuards.checkExecution(symbol, signal.side, sizing.finalSize * this.getMockFillPrice(symbol));
      if (!guardResult.allowed) {
        throw new Error(`Execution blocked: ${guardResult.reason}`);
      }

      // Get liquidity estimate
      const liquidityEst = liquidityModels.estimateImpact(symbol, sizing.finalSize, 'MEDIUM');

      // Execute in paper mode
      const executionRecord: ExecutionRecord = {
        id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        timestamp: new Date(),
        symbol,
        policyId: choice.policyId,
        requestedSize: baseSize * signal.sizeMultiplier,
        finalSize: sizing.finalSize,
        fillPrice: this.getMockFillPrice(symbol),
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

  async execute(params: ExecutionParams): Promise<ExecutionResult> {
    try {
      const { symbol, side, quantity, price, orderType, timeInForce = 'GTC' } = params;

      logger.info(`[ExecutionRouter] Executing order: ${symbol} ${side} ${quantity} @ ${price || 'market'}`);

      // Risk guard check
      const estimatedPrice = price || 50000; // Use provided price or estimate for market orders
      const notionalSize = quantity * estimatedPrice;

      const riskCheck = riskGuards.checkExecution(symbol, side, notionalSize);

      if (!riskCheck.allowed) {
        logger.warn(`[ExecutionRouter] Order blocked by risk guards: ${riskCheck.reason}`);
        return {
          success: false,
          orderId: '',
          executedQuantity: 0,
          executedPrice: 0,
          timestamp: new Date(),
          blocked: true,
          reason: riskCheck.reason,
          limits: riskCheck.limits
        };
      }

      // Simulate order execution
      const simulatedExecutionTime = Math.random() * 100; // ms
      await new Promise(resolve => setTimeout(resolve, simulatedExecutionTime));

      const executionPrice = price || this.getMockFillPrice(symbol);
      const executedQuantity = quantity; // Assume full fill for simulation

      const result: ExecutionResult = {
        success: true,
        orderId: `order_${Math.random().toString(36).substr(2, 9)}`,
        executedQuantity: executedQuantity,
        executedPrice: executionPrice,
        timestamp: new Date(),
      };

      // Record execution for risk tracking
      if (result.success && result.executedQuantity > 0) {
        riskGuards.recordExecution({
          symbol,
          side,
          finalSize: result.executedQuantity,
          fillPrice: result.executedPrice,
          timestamp: result.timestamp
        });
      }

      logger.info(`[ExecutionRouter] Order executed successfully: ${result.orderId}`);

      return result;
    } catch (error) {
      logger.error(`[ExecutionRouter] Execution failed:`, error);
      return {
        success: false,
        orderId: '',
        executedQuantity: 0,
        executedPrice: 0,
        timestamp: new Date(),
        blocked: true, // Treat errors as blocked for simplicity
        reason: error instanceof Error ? error.message : 'Unknown execution error',
      };
    }
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

  getExecutionRecords(): ExecutionRecord[] {
    return this.executionLog.slice(-50); // Return last 50 executions
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

  private getMockFillPrice(symbol: string): number {
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
}

export const executionRouter = ExecutionRouter.getInstance();