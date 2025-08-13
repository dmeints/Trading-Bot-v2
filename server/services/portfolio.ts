
import { logger } from '../utils/logger.js';

export interface OptimizationRequest {
  symbols: string[];
  cvarBudget: number;
  volTarget: number;
}

export interface OptimizationResult {
  weights: Record<string, number>;
  achievedVol: number;
  cvarBudgetUsed: number;
  expectedReturn: number;
  success: boolean;
  iterations: number;
}

export class PortfolioOptimizer {
  optimize(request: OptimizationRequest): OptimizationResult {
    const { symbols, cvarBudget, volTarget } = request;

    // Get historical data for each symbol
    const historicalData = this.getHistoricalReturns(symbols);
    const assetStats = this.computeAssetStatistics(historicalData);

    // Initialize equal weights
    let weights = symbols.reduce((acc, symbol) => {
      acc[symbol] = 1.0 / symbols.length;
      return acc;
    }, {} as Record<string, number>);

    // Projected gradient descent optimization
    const result = this.projectedGradientOptimization(
      weights,
      assetStats,
      cvarBudget,
      volTarget
    );

    return result;
  }

  private getHistoricalReturns(symbols: string[]): Record<string, number[]> {
    // Mock historical returns for demonstration
    const data: Record<string, number[]> = {};

    for (const symbol of symbols) {
      const returns: number[] = [];
      let price = 100;

      // Generate 200 days of mock data
      for (let i = 0; i < 200; i++) {
        const volatility = this.getAssetVolatility(symbol);
        const return_ = (Math.random() - 0.5) * volatility * 2; // Random return within +/- volatility
        returns.push(return_);
        price *= (1 + return_);
      }

      data[symbol] = returns;
    }

    return data;
  }

  private getAssetVolatility(symbol: string): number {
    // Asset-specific volatilities (as daily percentage)
    if (symbol.includes('BTC')) return 0.04; // 4% daily vol
    if (symbol.includes('ETH')) return 0.05; // 5% daily vol
    if (symbol.includes('SOL')) return 0.07; // 7% daily vol
    return 0.03; // Default 3% daily vol
  }

  private computeAssetStatistics(historicalData: Record<string, number[]>) {
    const stats: Record<string, { mean: number; vol: number; cvar: number }> = {};

    for (const [symbol, returns] of Object.entries(historicalData)) {
      const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
      const vol = Math.sqrt(variance);
      const cvar = this.computeCVaR(returns, 0.05); // 5% CVaR

      stats[symbol] = { mean, vol, cvar };
    }

    return stats;
  }

  private computeCVaR(returns: number[], alpha: number): number {
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const cutoff = Math.floor(returns.length * alpha);
    const validCutoff = Math.min(cutoff, sortedReturns.length - 1);
    const tailReturns = sortedReturns.slice(0, validCutoff + 1);

    if (tailReturns.length === 0) return 0;

    return tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;
  }

  private projectedGradientOptimization(
    initialWeights: Record<string, number>,
    assetStats: Record<string, { mean: number; vol: number; cvar: number }>,
    cvarBudget: number,
    volTarget: number
  ): OptimizationResult {
    const symbols = Object.keys(initialWeights);
    let weights = { ...initialWeights };
    const maxIterations = 100;
    const learningRate = 0.01;
    const tolerance = 1e-6;

    let iteration = 0;
    let converged = false;

    while (iteration < maxIterations && !converged) {
      const gradient = this.computeGradient(weights, assetStats, cvarBudget, volTarget);
      const oldWeights = { ...weights };

      // Gradient step
      for (const symbol of symbols) {
        weights[symbol] -= learningRate * gradient[symbol];
      }

      // Project onto constraints
      weights = this.projectConstraints(weights);

      // Check convergence
      const change = Object.keys(weights).reduce((sum, symbol) => {
        return sum + Math.pow(weights[symbol] - oldWeights[symbol], 2);
      }, 0);

      converged = Math.sqrt(change) < tolerance;
      iteration++;
    }

    // Compute final metrics
    const achievedVol = this.computePortfolioVol(weights, assetStats);
    const cvarBudgetUsed = this.computePortfolioCVaR(weights, assetStats);
    const expectedReturn = this.computePortfolioReturn(weights, assetStats);

    return {
      weights,
      achievedVol,
      cvarBudgetUsed,
      expectedReturn,
      success: converged,
      iterations: iteration
    };
  }

  private computeGradient(
    weights: Record<string, number>,
    assetStats: Record<string, { mean: number; vol: number; cvar: number }>,
    cvarBudget: number,
    volTarget: number
  ): Record<string, number> {
    const gradient: Record<string, number> = {};
    const epsilon = 1e-6;

    for (const symbol of Object.keys(weights)) {
      // Finite difference approximation
      const weightsPlus = { ...weights };
      weightsPlus[symbol] += epsilon;
      const weightsPlus_proj = this.projectConstraints(weightsPlus);

      const weightsMinus = { ...weights };
      weightsMinus[symbol] -= epsilon;
      const weightsMinus_proj = this.projectConstraints(weightsMinus);

      const objectivePlus = this.objectiveFunction(weightsPlus_proj, assetStats, cvarBudget, volTarget);
      const objectiveMinus = this.objectiveFunction(weightsMinus_proj, assetStats, cvarBudget, volTarget);

      gradient[symbol] = (objectivePlus - objectiveMinus) / (2 * epsilon);
    }

    return gradient;
  }

  private objectiveFunction(
    weights: Record<string, number>,
    assetStats: Record<string, { mean: number; vol: number; cvar: number }>,
    cvarBudget: number,
    volTarget: number
  ): number {
    const portfolioVol = this.computePortfolioVol(weights, assetStats);
    const portfolioCVaR = this.computePortfolioCVaR(weights, assetStats);
    const portfolioReturn = this.computePortfolioReturn(weights, assetStats);

    // Objective: maximize return, penalize vol deviation, penalize CVaR violation
    const volPenalty = Math.pow(portfolioVol - volTarget, 2);
    const cvarPenalty = Math.max(0, portfolioCVaR - cvarBudget) * 1000; // Heavy penalty for CVaR violation

    return portfolioReturn - 10 * volPenalty - cvarPenalty;
  }

  private computePortfolioVol(
    weights: Record<string, number>,
    assetStats: Record<string, { mean: number; vol: number; cvar: number }>
  ): number {
    // Simplified: assume zero correlation (diagonal covariance)
    let portfolioVariance = 0;

    for (const [symbol, weight] of Object.entries(weights)) {
      if (assetStats[symbol]) {
        const vol = assetStats[symbol].vol;
        portfolioVariance += weight * weight * vol * vol;
      }
    }

    return Math.sqrt(portfolioVariance);
  }

  private computePortfolioCVaR(
    weights: Record<string, number>,
    assetStats: Record<string, { mean: number; vol: number; cvar: number }>
  ): number {
    // Linear approximation: weighted sum of individual CVaRs
    let portfolioCVaR = 0;

    for (const [symbol, weight] of Object.entries(weights)) {
      if (assetStats[symbol]) {
        portfolioCVaR += weight * assetStats[symbol].cvar;
      }
    }

    return portfolioCVaR;
  }

  private computePortfolioReturn(
    weights: Record<string, number>,
    assetStats: Record<string, { mean: number; vol: number; cvar: number }>
  ): number {
    let portfolioReturn = 0;

    for (const [symbol, weight] of Object.entries(weights)) {
      if (assetStats[symbol]) {
        portfolioReturn += weight * assetStats[symbol].mean;
      }
    }

    return portfolioReturn;
  }

  private projectConstraints(weights: Record<string, number>): Record<string, number> {
    const symbols = Object.keys(weights);
    const projected = { ...weights };

    // Non-negativity constraints
    for (const symbol of symbols) {
      projected[symbol] = Math.max(0, projected[symbol]);
    }

    // Sum to 1 constraint (normalize)
    const sum = Object.values(projected).reduce((s, w) => s + w, 0);
    if (sum > 0) {
      for (const symbol of symbols) {
        projected[symbol] /= sum;
      }
    } else {
      // If all weights are zero, return equal weights
      const numSymbols = symbols.length;
      if (numSymbols > 0) {
        for (const symbol of symbols) {
          projected[symbol] = 1.0 / numSymbols;
        }
      }
    }

    return projected;
  }
}

export const portfolioOptimizer = new PortfolioOptimizer();
