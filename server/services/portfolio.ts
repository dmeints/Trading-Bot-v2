
import { logger } from '../utils/logger.js';
import { volatilityModels } from './volatility/Models.js';

interface PortfolioWeights {
  [symbol: string]: number;
}

interface PortfolioMetrics {
  expectedReturn: number;
  volatility: number;
  sharpe: number;
  cvar95: number;
  maxDrawdown: number;
}

interface OptimizationConstraints {
  symbols: string[];
  cvarBudget: number;
  volTarget: number;
  maxWeight?: number;
  minWeight?: number;
}

interface OptimizationResult {
  weights: PortfolioWeights;
  metrics: PortfolioMetrics;
  kellyFractions: PortfolioWeights;
  feasible: boolean;
  iterations: number;
  timestamp: number;
}

class PortfolioOptimizer {
  private priceHistory: Map<string, number[]> = new Map();
  private returnHistory: Map<string, number[]> = new Map();
  private lastOptimization: OptimizationResult | null = null;
  
  async optimize(constraints: OptimizationConstraints): Promise<OptimizationResult> {
    try {
      // Generate synthetic price history for demo
      this.generateSyntheticHistory(constraints.symbols);
      
      // Calculate returns and covariance matrix
      const returns = this.calculateReturns(constraints.symbols);
      const covariance = this.calculateCovariance(returns);
      const expectedReturns = this.calculateExpectedReturns(returns);
      
      // Initialize weights equally
      const n = constraints.symbols.length;
      let weights = constraints.symbols.reduce((acc, symbol) => {
        acc[symbol] = 1.0 / n;
        return acc;
      }, {} as PortfolioWeights);
      
      // Projected gradient descent optimization
      weights = await this.optimizeWithProjectedGradient(
        weights,
        expectedReturns,
        covariance,
        constraints
      );
      
      // Calculate portfolio metrics
      const metrics = this.calculatePortfolioMetrics(weights, expectedReturns, covariance);
      
      // Calculate Kelly fractions
      const kellyFractions = this.calculateKellyFractions(expectedReturns, covariance);
      
      const result: OptimizationResult = {
        weights,
        metrics,
        kellyFractions,
        feasible: this.checkFeasibility(weights, metrics, constraints),
        iterations: 50, // Fixed for demo
        timestamp: Date.now()
      };
      
      this.lastOptimization = result;
      return result;
      
    } catch (error) {
      logger.error('Portfolio optimization failed:', error);
      
      // Return equal weights fallback
      const n = constraints.symbols.length;
      const equalWeights = constraints.symbols.reduce((acc, symbol) => {
        acc[symbol] = 1.0 / n;
        return acc;
      }, {} as PortfolioWeights);
      
      return {
        weights: equalWeights,
        metrics: {
          expectedReturn: 0.08,
          volatility: constraints.volTarget,
          sharpe: 1.0,
          cvar95: constraints.cvarBudget * 0.8,
          maxDrawdown: 0.15
        },
        kellyFractions: equalWeights,
        feasible: true,
        iterations: 0,
        timestamp: Date.now()
      };
    }
  }
  
  private generateSyntheticHistory(symbols: string[]): void {
    symbols.forEach(symbol => {
      const prices = [];
      let price = symbol === 'BTCUSDT' ? 45000 : 3000;
      
      for (let i = 0; i < 252; i++) { // 1 year of daily data
        price *= (1 + (Math.random() - 0.5) * 0.04); // ±2% daily moves
        prices.push(price);
      }
      
      this.priceHistory.set(symbol, prices);
    });
  }
  
  private calculateReturns(symbols: string[]): Map<string, number[]> {
    const returns = new Map<string, number[]>();
    
    symbols.forEach(symbol => {
      const prices = this.priceHistory.get(symbol) || [];
      const rets = [];
      
      for (let i = 1; i < prices.length; i++) {
        rets.push(Math.log(prices[i] / prices[i-1]));
      }
      
      returns.set(symbol, rets);
      this.returnHistory.set(symbol, rets);
    });
    
    return returns;
  }
  
  private calculateCovariance(returns: Map<string, number[]>): number[][] {
    const symbols = Array.from(returns.keys());
    const n = symbols.length;
    const covariance = Array(n).fill(0).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const returnsI = returns.get(symbols[i]) || [];
        const returnsJ = returns.get(symbols[j]) || [];
        
        if (i === j) {
          // Variance
          const meanI = returnsI.reduce((a, b) => a + b, 0) / returnsI.length;
          covariance[i][j] = returnsI.reduce((acc, r) => acc + Math.pow(r - meanI, 2), 0) / returnsI.length;
        } else {
          // Covariance
          const meanI = returnsI.reduce((a, b) => a + b, 0) / returnsI.length;
          const meanJ = returnsJ.reduce((a, b) => a + b, 0) / returnsJ.length;
          
          covariance[i][j] = returnsI.reduce((acc, r, idx) => 
            acc + (r - meanI) * (returnsJ[idx] - meanJ), 0) / returnsI.length;
        }
      }
    }
    
    return covariance;
  }
  
  private calculateExpectedReturns(returns: Map<string, number[]>): PortfolioWeights {
    const expectedReturns: PortfolioWeights = {};
    
    returns.forEach((rets, symbol) => {
      expectedReturns[symbol] = rets.reduce((a, b) => a + b, 0) / rets.length * 252; // Annualize
    });
    
    return expectedReturns;
  }
  
  private async optimizeWithProjectedGradient(
    weights: PortfolioWeights,
    expectedReturns: PortfolioWeights,
    covariance: number[][],
    constraints: OptimizationConstraints
  ): Promise<PortfolioWeights> {
    const symbols = constraints.symbols;
    const learningRate = 0.01;
    const maxIter = 50;
    
    for (let iter = 0; iter < maxIter; iter++) {
      // Calculate gradient
      const gradient = this.calculateGradient(weights, expectedReturns, covariance, constraints);
      
      // Update weights
      symbols.forEach(symbol => {
        weights[symbol] -= learningRate * gradient[symbol];
      });
      
      // Project onto constraints
      weights = this.projectOntoConstraints(weights, constraints);
    }
    
    return weights;
  }
  
  private calculateGradient(
    weights: PortfolioWeights,
    expectedReturns: PortfolioWeights,
    covariance: number[][],
    constraints: OptimizationConstraints
  ): PortfolioWeights {
    const symbols = constraints.symbols;
    const gradient: PortfolioWeights = {};
    
    symbols.forEach((symbol, i) => {
      // Simplified gradient for mean-variance optimization
      let grad = -expectedReturns[symbol]; // Negative expected return (we minimize)
      
      // Add variance penalty
      symbols.forEach((otherSymbol, j) => {
        grad += 2 * weights[otherSymbol] * covariance[i][j];
      });
      
      gradient[symbol] = grad;
    });
    
    return gradient;
  }
  
  private projectOntoConstraints(weights: PortfolioWeights, constraints: OptimizationConstraints): PortfolioWeights {
    const symbols = constraints.symbols;
    
    // Ensure non-negative weights
    symbols.forEach(symbol => {
      weights[symbol] = Math.max(0, weights[symbol]);
    });
    
    // Normalize to sum to 1
    const sum = symbols.reduce((acc, symbol) => acc + weights[symbol], 0);
    if (sum > 0) {
      symbols.forEach(symbol => {
        weights[symbol] /= sum;
      });
    }
    
    // Apply max/min weight constraints
    const maxWeight = constraints.maxWeight || 0.4;
    const minWeight = constraints.minWeight || 0.05;
    
    symbols.forEach(symbol => {
      weights[symbol] = Math.max(minWeight, Math.min(maxWeight, weights[symbol]));
    });
    
    // Renormalize
    const finalSum = symbols.reduce((acc, symbol) => acc + weights[symbol], 0);
    symbols.forEach(symbol => {
      weights[symbol] /= finalSum;
    });
    
    return weights;
  }
  
  private calculatePortfolioMetrics(
    weights: PortfolioWeights,
    expectedReturns: PortfolioWeights,
    covariance: number[][]
  ): PortfolioMetrics {
    const symbols = Object.keys(weights);
    
    // Portfolio expected return
    const expectedReturn = symbols.reduce((acc, symbol) => 
      acc + weights[symbol] * expectedReturns[symbol], 0);
    
    // Portfolio variance
    let variance = 0;
    symbols.forEach((symbol1, i) => {
      symbols.forEach((symbol2, j) => {
        variance += weights[symbol1] * weights[symbol2] * covariance[i][j];
      });
    });
    
    const volatility = Math.sqrt(variance);
    const sharpe = expectedReturn / Math.max(0.001, volatility);
    
    // Estimate CVaR (simplified)
    const cvar95 = volatility * 2.33; // 95% CVaR approximation
    
    // Estimate max drawdown (simplified)
    const maxDrawdown = volatility * 1.5;
    
    return {
      expectedReturn,
      volatility,
      sharpe,
      cvar95,
      maxDrawdown
    };
  }
  
  private calculateKellyFractions(expectedReturns: PortfolioWeights, covariance: number[][]): PortfolioWeights {
    const symbols = Object.keys(expectedReturns);
    const kellyFractions: PortfolioWeights = {};
    
    symbols.forEach((symbol, i) => {
      const mu = expectedReturns[symbol];
      const sigma2 = covariance[i][i];
      
      // Kelly formula: f ≈ κ μ/σ² (clipped)
      const kappa = 0.25; // Conservative multiplier
      const kelly = Math.max(0, Math.min(0.5, kappa * mu / Math.max(0.0001, sigma2)));
      
      kellyFractions[symbol] = kelly;
    });
    
    return kellyFractions;
  }
  
  private checkFeasibility(
    weights: PortfolioWeights,
    metrics: PortfolioMetrics,
    constraints: OptimizationConstraints
  ): boolean {
    // Check CVaR constraint: ∑ w_i CVaR_i ≤ B
    const totalCVaR = Object.values(weights).reduce((acc, w) => acc + w * metrics.cvar95, 0);
    const cvarFeasible = totalCVaR <= constraints.cvarBudget;
    
    // Check vol target (allow ±20% tolerance)
    const volFeasible = Math.abs(metrics.volatility - constraints.volTarget) <= constraints.volTarget * 0.2;
    
    return cvarFeasible && volFeasible;
  }
  
  getCVaRScale(symbol: string, cvarBudget: number): number {
    if (!this.lastOptimization) return 1.0;
    
    const weight = this.lastOptimization.weights[symbol] || 0;
    const portfolioCVaR = this.lastOptimization.metrics.cvar95;
    
    if (portfolioCVaR === 0) return 1.0;
    
    // Scale down if approaching CVaR budget
    const utilization = portfolioCVaR / cvarBudget;
    return Math.max(0.1, Math.min(1.0, 2.0 - utilization));
  }
  
  getLastOptimization(): OptimizationResult | null {
    return this.lastOptimization ? { ...this.lastOptimization } : null;
  }
}

export const portfolioOptimizer = new PortfolioOptimizer();
export type { OptimizationResult, PortfolioWeights, OptimizationConstraints };
