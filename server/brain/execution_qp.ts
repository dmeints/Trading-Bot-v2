
/**
 * Execution Optimizer using Quadratic Programming
 * Optimizes order execution under market impact and risk constraints
 */

import { logger } from '../utils/logger';

export interface OptimalExecution {
  orders: ExecutionOrder[];
  totalCost: number;
  expectedSlippage: number;
  riskScore: number;
  executionMethod: 'market' | 'limit' | 'iceberg' | 'twap';
  reasoning: string;
}

export interface ExecutionOrder {
  symbol: string;
  side: 'buy' | 'sell';
  size: number;
  orderType: 'market' | 'limit' | 'ioc' | 'fok';
  price?: number;
  timeInForce: string;
  execDelay?: number;
}

export interface ExecutionConstraints {
  maxNotional: number;
  maxSizePerSymbol: number;
  maxSlippageBps: number;
  maxLatencyMs: number;
  toxicityThreshold: number;
  inventoryBands: { lower: number; upper: number };
}

export interface MarketImpactModel {
  linearImpact: number;    // bps per % of ADV
  sqrtImpact: number;      // bps per sqrt(% of ADV)
  temporaryImpact: number; // bps for immediate execution
  permanentImpact: number; // bps for permanent price impact
}

export class ExecutionOptimizer {
  private impactModels: Map<string, MarketImpactModel> = new Map();
  private executionHistory: Map<string, number[]> = new Map();

  constructor(
    private readonly constraints: ExecutionConstraints = {
      maxNotional: 100000,
      maxSizePerSymbol: 50000,
      maxSlippageBps: 50,
      maxLatencyMs: 500,
      toxicityThreshold: 0.7,
      inventoryBands: { lower: -0.8, upper: 0.8 }
    }
  ) {
    this.initializeImpactModels();
  }

  private initializeImpactModels(): void {
    // Default impact models for different symbols
    const defaultModel: MarketImpactModel = {
      linearImpact: 0.5,     // 0.5 bps per 1% ADV
      sqrtImpact: 2.0,       // 2 bps per sqrt(1% ADV)  
      temporaryImpact: 1.0,  // 1 bp temporary impact
      permanentImpact: 0.3   // 0.3 bp permanent impact
    };

    // Set models for major symbols (would be calibrated from data)
    ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].forEach(symbol => {
      this.impactModels.set(symbol, { ...defaultModel });
    });
  }

  /**
   * Optimize execution for desired portfolio change
   */
  async optimizeExecution(
    desiredSizes: Map<string, number>, // Symbol -> desired $ change
    currentInventory: Map<string, number>,
    marketFeatures: any
  ): Promise<OptimalExecution> {
    // Convert to optimization problem variables
    const symbols = Array.from(desiredSizes.keys());
    const deltaW = symbols.map(s => desiredSizes.get(s) || 0);

    // Check constraints feasibility
    const feasibilityCheck = this.checkFeasibility(deltaW, symbols, currentInventory);
    if (!feasibilityCheck.feasible) {
      return this.createHoldExecution(feasibilityCheck.reason);
    }

    // Build cost matrices
    const { riskMatrix, impactMatrix } = this.buildCostMatrices(symbols, marketFeatures);
    const totalCostMatrix = this.addMatrices(riskMatrix, this.scaleMatrix(impactMatrix, 1.0));

    // Solve QP: min 0.5 * x'Qx + c'x subject to constraints
    const objectiveGradient = this.computeObjectiveGradient(deltaW, symbols, marketFeatures);
    const solution = this.solveQP(deltaW, totalCostMatrix, objectiveGradient, symbols, currentInventory);

    // Convert solution to execution orders
    const orders = this.createExecutionOrders(solution, symbols, marketFeatures);
    
    // Calculate execution metrics
    const totalCost = this.calculateTotalCost(solution, totalCostMatrix, objectiveGradient);
    const expectedSlippage = this.calculateExpectedSlippage(solution, symbols);
    const riskScore = this.calculateRiskScore(solution, riskMatrix);
    
    // Determine optimal execution method
    const executionMethod = this.selectExecutionMethod(solution, marketFeatures);

    const result: OptimalExecution = {
      orders,
      totalCost,
      expectedSlippage,
      riskScore,
      executionMethod,
      reasoning: this.generateExecutionReasoning(solution, symbols, marketFeatures)
    };

    logger.info('[ExecutionQP] Optimization complete', {
      symbols: symbols.length,
      totalCost: totalCost.toFixed(2),
      expectedSlippage: expectedSlippage.toFixed(1),
      executionMethod,
      riskScore: riskScore.toFixed(3)
    });

    return result;
  }

  private checkFeasibility(
    deltaW: number[],
    symbols: string[],
    currentInventory: Map<string, number>
  ): { feasible: boolean; reason?: string } {
    // Check notional limit
    const totalNotional = deltaW.reduce((sum, delta) => sum + Math.abs(delta), 0);
    if (totalNotional > this.constraints.maxNotional) {
      return { feasible: false, reason: 'Total notional exceeds limit' };
    }

    // Check per-symbol limits
    for (let i = 0; i < symbols.length; i++) {
      if (Math.abs(deltaW[i]) > this.constraints.maxSizePerSymbol) {
        return { feasible: false, reason: `Size exceeds limit for ${symbols[i]}` };
      }

      // Check inventory bands
      const currentPos = currentInventory.get(symbols[i]) || 0;
      const newPos = currentPos + deltaW[i];
      const normalizedPos = newPos / this.constraints.maxSizePerSymbol;
      
      if (normalizedPos < this.constraints.inventoryBands.lower || 
          normalizedPos > this.constraints.inventoryBands.upper) {
        return { feasible: false, reason: `Inventory bands violation for ${symbols[i]}` };
      }
    }

    return { feasible: true };
  }

  private buildCostMatrices(symbols: string[], marketFeatures: any): {
    riskMatrix: number[][];
    impactMatrix: number[][];
  } {
    const n = symbols.length;
    
    // Risk matrix (covariance + variance targeting)
    const riskMatrix = Array(n).fill(0).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          // Diagonal: individual symbol variance
          const vol = this.getSymbolVolatility(symbols[i], marketFeatures);
          riskMatrix[i][j] = vol * vol;
        } else {
          // Off-diagonal: correlation (simplified)
          const corr = this.getSymbolCorrelation(symbols[i], symbols[j]);
          const vol_i = this.getSymbolVolatility(symbols[i], marketFeatures);
          const vol_j = this.getSymbolVolatility(symbols[j], marketFeatures);
          riskMatrix[i][j] = corr * vol_i * vol_j;
        }
      }
    }

    // Impact matrix
    const impactMatrix = Array(n).fill(0).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      const model = this.impactModels.get(symbols[i]);
      if (model) {
        // Market impact is primarily diagonal (own trades impact own prices)
        impactMatrix[i][i] = model.linearImpact + model.temporaryImpact;
        
        // Cross-impact for correlated symbols
        for (let j = 0; j < n; j++) {
          if (i !== j) {
            const crossCorr = this.getSymbolCorrelation(symbols[i], symbols[j]);
            impactMatrix[i][j] = crossCorr * model.linearImpact * 0.1; // 10% cross-impact
          }
        }
      }
    }

    return { riskMatrix, impactMatrix };
  }

  private computeObjectiveGradient(
    deltaW: number[],
    symbols: string[],
    marketFeatures: any
  ): number[] {
    // Linear term in objective: alpha forecast - transaction costs
    return deltaW.map((delta, i) => {
      const expectedReturn = this.getExpectedReturn(symbols[i], marketFeatures);
      const transactionCost = this.getTransactionCost(symbols[i], Math.abs(delta));
      return -expectedReturn + transactionCost; // Minimize negative return + costs
    });
  }

  private solveQP(
    initialDelta: number[],
    costMatrix: number[][],
    gradient: number[],
    symbols: string[],
    currentInventory: Map<string, number>
  ): number[] {
    // Simple projected gradient descent for QP
    let x = [...initialDelta];
    const learningRate = 0.01;
    const maxIterations = 100;
    const tolerance = 1e-6;

    for (let iter = 0; iter < maxIterations; iter++) {
      // Compute gradient: Qx + c
      const currentGradient = gradient.map((g, i) => {
        const quadTerm = costMatrix[i].reduce((sum, q_ij, j) => sum + q_ij * x[j], 0);
        return quadTerm + g;
      });

      // Gradient step
      const newX = x.map((xi, i) => xi - learningRate * currentGradient[i]);

      // Project onto constraints
      const projectedX = this.projectConstraints(newX, symbols, currentInventory);

      // Check convergence
      const deltaX = projectedX.map((xi, i) => Math.abs(xi - x[i]));
      const maxDelta = Math.max(...deltaX);
      
      x = projectedX;
      
      if (maxDelta < tolerance) break;
    }

    return x;
  }

  private projectConstraints(
    x: number[],
    symbols: string[],
    currentInventory: Map<string, number>
  ): number[] {
    const projected = [...x];

    // Project individual size constraints
    for (let i = 0; i < projected.length; i++) {
      projected[i] = Math.max(-this.constraints.maxSizePerSymbol, 
                     Math.min(this.constraints.maxSizePerSymbol, projected[i]));
      
      // Project inventory band constraints
      const currentPos = currentInventory.get(symbols[i]) || 0;
      const newPos = currentPos + projected[i];
      const maxPos = this.constraints.maxSizePerSymbol * this.constraints.inventoryBands.upper;
      const minPos = this.constraints.maxSizePerSymbol * this.constraints.inventoryBands.lower;
      
      if (newPos > maxPos) projected[i] = maxPos - currentPos;
      if (newPos < minPos) projected[i] = minPos - currentPos;
    }

    // Project total notional constraint
    const totalNotional = projected.reduce((sum, delta) => sum + Math.abs(delta), 0);
    if (totalNotional > this.constraints.maxNotional) {
      const scale = this.constraints.maxNotional / totalNotional;
      projected.forEach((_, i) => projected[i] *= scale);
    }

    return projected;
  }

  private createExecutionOrders(
    solution: number[],
    symbols: string[],
    marketFeatures: any
  ): ExecutionOrder[] {
    const orders: ExecutionOrder[] = [];

    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      const size = Math.abs(solution[i]);
      
      if (size < 100) continue; // Skip tiny orders

      const side = solution[i] > 0 ? 'buy' : 'sell';
      const toxicity = marketFeatures.toxicity || 0;
      const spread = marketFeatures.spread || 0.001;

      // Decide order type based on market conditions
      let orderType: 'market' | 'limit' | 'ioc' | 'fok';
      let price: number | undefined;
      
      if (toxicity > this.constraints.toxicityThreshold) {
        // High toxicity: use limit orders
        orderType = 'limit';
        price = this.calculateLimitPrice(side, marketFeatures.price, spread);
      } else if (size > this.constraints.maxSizePerSymbol * 0.5) {
        // Large order: use IOC to test liquidity
        orderType = 'ioc';
      } else {
        // Normal conditions: market order
        orderType = 'market';
      }

      orders.push({
        symbol,
        side,
        size,
        orderType,
        price,
        timeInForce: orderType === 'limit' ? 'GTC' : 'IOC',
        execDelay: this.calculateExecutionDelay(size, toxicity)
      });
    }

    return orders;
  }

  private calculateLimitPrice(side: 'buy' | 'sell', midPrice: number, spread: number): number {
    const halfSpread = spread / 2;
    if (side === 'buy') {
      return midPrice - halfSpread * 0.5; // Inside spread
    } else {
      return midPrice + halfSpread * 0.5;
    }
  }

  private calculateExecutionDelay(size: number, toxicity: number): number {
    // Higher toxicity → longer delay
    const baseDela = 100; // 100ms base delay
    const toxicityPenalty = toxicity * 300; // Up to 300ms for high toxicity
    const sizePenalty = Math.log(1 + size / 1000) * 50; // Size-based delay
    
    return Math.min(this.constraints.maxLatencyMs, baseDela + toxicityPenalty + sizePenalty);
  }

  private selectExecutionMethod(solution: number[], marketFeatures: any): 'market' | 'limit' | 'iceberg' | 'twap' {
    const totalSize = solution.reduce((sum, s) => sum + Math.abs(s), 0);
    const toxicity = marketFeatures.toxicity || 0;
    const spread = marketFeatures.spread || 0.001;

    if (totalSize > this.constraints.maxSizePerSymbol * 0.8) {
      return 'twap'; // Large orders use TWAP
    } else if (toxicity > 0.6) {
      return 'iceberg'; // High toxicity uses iceberg
    } else if (spread > 0.005) {
      return 'limit'; // Wide spreads use limit orders
    } else {
      return 'market'; // Normal conditions use market orders
    }
  }

  // Helper functions for market data
  private getSymbolVolatility(symbol: string, marketFeatures: any): number {
    return marketFeatures.volatility || 0.2; // Default 20% annual volatility
  }

  private getSymbolCorrelation(symbol1: string, symbol2: string): number {
    if (symbol1 === symbol2) return 1.0;
    // Simplified correlation matrix
    return 0.3; // Default 30% correlation between crypto assets
  }

  private getExpectedReturn(symbol: string, marketFeatures: any): number {
    return marketFeatures.expectedReturn || 0.001; // Default 10 bps expected return
  }

  private getTransactionCost(symbol: string, size: number): number {
    const model = this.impactModels.get(symbol);
    if (!model) return 0.001;
    
    // Simplified transaction cost
    return model.temporaryImpact + model.linearImpact * (size / 10000);
  }

  // Matrix operations
  private addMatrices(A: number[][], B: number[][]): number[][] {
    return A.map((row, i) => row.map((val, j) => val + B[i][j]));
  }

  private scaleMatrix(matrix: number[][], scale: number): number[][] {
    return matrix.map(row => row.map(val => val * scale));
  }

  private calculateTotalCost(solution: number[], costMatrix: number[][], gradient: number[]): number {
    // 0.5 * x'Qx + c'x
    const quadraticCost = solution.reduce((sum, xi, i) => {
      const rowSum = costMatrix[i].reduce((rowSum, q_ij, j) => rowSum + q_ij * solution[j], 0);
      return sum + 0.5 * xi * rowSum;
    }, 0);

    const linearCost = solution.reduce((sum, xi, i) => sum + gradient[i] * xi, 0);
    
    return quadraticCost + linearCost;
  }

  private calculateExpectedSlippage(solution: number[], symbols: string[]): number {
    return solution.reduce((totalSlippage, size, i) => {
      const model = this.impactModels.get(symbols[i]);
      if (!model) return totalSlippage;
      
      const sizePct = Math.abs(size) / 10000; // Assume 10k is 1% of ADV
      const slippage = model.temporaryImpact + model.linearImpact * sizePct + 
                      model.sqrtImpact * Math.sqrt(sizePct);
      
      return totalSlippage + slippage * Math.abs(size);
    }, 0) / solution.reduce((sum, s) => sum + Math.abs(s), 1);
  }

  private calculateRiskScore(solution: number[], riskMatrix: number[][]): number {
    // x'Σx normalized by position size
    const riskContrib = solution.reduce((sum, xi, i) => {
      const rowSum = riskMatrix[i].reduce((rowSum, sigma_ij, j) => rowSum + sigma_ij * solution[j], 0);
      return sum + xi * rowSum;
    }, 0);

    const totalSize = solution.reduce((sum, s) => sum + Math.abs(s), 1);
    return Math.sqrt(Math.abs(riskContrib)) / totalSize;
  }

  private generateExecutionReasoning(solution: number[], symbols: string[], marketFeatures: any): string {
    const totalSize = solution.reduce((sum, s) => sum + Math.abs(s), 0);
    const activeSymbols = solution.filter(s => Math.abs(s) > 100).length;
    const toxicity = marketFeatures.toxicity || 0;
    
    return `Optimized execution: ${activeSymbols} symbols, $${totalSize.toFixed(0)} total, toxicity ${(toxicity*100).toFixed(0)}%`;
  }

  private createHoldExecution(reason: string): OptimalExecution {
    return {
      orders: [],
      totalCost: 0,
      expectedSlippage: 0,
      riskScore: 0,
      executionMethod: 'market',
      reasoning: `Execution blocked: ${reason}`
    };
  }

  /**
   * Update impact models based on execution outcomes
   */
  updateImpactModel(symbol: string, size: number, realizedSlippage: number): void {
    if (!this.executionHistory.has(symbol)) {
      this.executionHistory.set(symbol, []);
    }

    const history = this.executionHistory.get(symbol)!;
    history.push(realizedSlippage);
    
    if (history.length > 100) {
      history.shift();
    }

    // Simple model update (could be more sophisticated)
    const model = this.impactModels.get(symbol);
    if (model && history.length > 10) {
      const avgSlippage = history.reduce((sum, s) => sum + s, 0) / history.length;
      const learningRate = 0.1;
      
      model.temporaryImpact = model.temporaryImpact * (1 - learningRate) + avgSlippage * learningRate;
    }
  }
}
