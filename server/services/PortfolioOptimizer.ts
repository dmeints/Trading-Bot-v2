import { logger } from '../utils/logger.js';

interface Asset {
  symbol: string;
  weight: number;
  expectedReturn: number;
  volatility: number;
  beta: number;
}

interface OptimizationResult {
  optimalWeights: Map<string, number>;
  expectedReturn: number;
  expectedVolatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

interface PositionSizeResult {
  recommendedSize: number;
  kellyFraction: number;
  riskAdjustedSize: number;
  rationale: string;
}

export class PortfolioOptimizer {
  private assets: Map<string, Asset>;
  private correlationMatrix: Map<string, Map<string, number>>;
  private riskFreeRate: number;

  constructor() {
    this.assets = new Map();
    this.correlationMatrix = new Map();
    this.riskFreeRate = 0.02; // 2% risk-free rate

    this.initializeAssets();
    logger.info('[PortfolioOptimizer] Initialized with Modern Portfolio Theory optimization');
  }

  private initializeAssets() {
    const defaultAssets: Asset[] = [
      {
        symbol: 'BTC',
        weight: 0.4,
        expectedReturn: 0.25,
        volatility: 0.6,
        beta: 1.2
      },
      {
        symbol: 'ETH',
        weight: 0.3,
        expectedReturn: 0.3,
        volatility: 0.7,
        beta: 1.5
      },
      {
        symbol: 'SOL',
        weight: 0.2,
        expectedReturn: 0.4,
        volatility: 0.8,
        beta: 1.8
      },
      {
        symbol: 'ADA',
        weight: 0.1,
        expectedReturn: 0.2,
        volatility: 0.5,
        beta: 0.9
      }
    ];

    defaultAssets.forEach(asset => {
      this.assets.set(asset.symbol, asset);
    });

    this.initializeCorrelationMatrix();
  }

  private initializeCorrelationMatrix() {
    const symbols = Array.from(this.assets.keys());
    
    // Mock correlation data - in production would calculate from historical data
    const correlations = {
      'BTC': { 'BTC': 1.0, 'ETH': 0.8, 'SOL': 0.6, 'ADA': 0.5 },
      'ETH': { 'BTC': 0.8, 'ETH': 1.0, 'SOL': 0.7, 'ADA': 0.6 },
      'SOL': { 'BTC': 0.6, 'ETH': 0.7, 'SOL': 1.0, 'ADA': 0.4 },
      'ADA': { 'BTC': 0.5, 'ETH': 0.6, 'SOL': 0.4, 'ADA': 1.0 }
    };

    symbols.forEach(symbol1 => {
      const correlationMap = new Map<string, number>();
      symbols.forEach(symbol2 => {
        correlationMap.set(symbol2, correlations[symbol1]?.[symbol2] || 0);
      });
      this.correlationMatrix.set(symbol1, correlationMap);
    });
  }

  async calculateOptimalSize(signal: any, maxSize: number): Promise<number> {
    try {
      // Extract symbol from signal or default to BTC
      const symbol = signal.symbol || 'BTC';
      const asset = this.assets.get(symbol);
      
      if (!asset) {
        logger.warn(`[PortfolioOptimizer] Unknown asset: ${symbol}, using default sizing`);
        return Math.min(maxSize, maxSize * 0.5);
      }

      // Calculate Kelly Criterion
      const kellyResult = this.calculateKellyCriterion(signal, asset);
      
      // Apply risk adjustments
      const riskAdjusted = this.applyRiskAdjustments(kellyResult, signal, asset);
      
      // Respect maximum size limit
      const finalSize = Math.min(riskAdjusted.recommendedSize, maxSize);

      logger.info('[PortfolioOptimizer] Position size calculated:', {
        symbol,
        kellyFraction: kellyResult.kellyFraction,
        riskAdjusted: riskAdjusted.recommendedSize,
        finalSize,
        rationale: riskAdjusted.rationale
      });

      return finalSize;

    } catch (error) {
      logger.error('[PortfolioOptimizer] Error calculating optimal size:', error);
      return Math.min(maxSize, maxSize * 0.3); // Conservative fallback
    }
  }

  private calculateKellyCriterion(signal: any, asset: Asset): PositionSizeResult {
    // Kelly Criterion: f = (bp - q) / b
    // f = fraction of capital to wager
    // b = odds received (reward/risk ratio)
    // p = probability of winning
    // q = probability of losing (1-p)
    
    const winProbability = signal.confidence || 0.5;
    const lossProbability = 1 - winProbability;
    const rewardRiskRatio = 2.0; // Assume 2:1 reward/risk ratio
    
    const kellyFraction = (rewardRiskRatio * winProbability - lossProbability) / rewardRiskRatio;
    
    // Cap Kelly fraction at reasonable levels
    const cappedKelly = Math.max(0, Math.min(kellyFraction, 0.25)); // Max 25%
    
    const recommendedSize = cappedKelly * 100000; // Assume $100k portfolio
    
    return {
      recommendedSize,
      kellyFraction: cappedKelly,
      riskAdjustedSize: recommendedSize,
      rationale: `Kelly Criterion: ${(cappedKelly * 100).toFixed(1)}% based on ${(winProbability * 100).toFixed(1)}% confidence`
    };
  }

  private applyRiskAdjustments(kellyResult: PositionSizeResult, signal: any, asset: Asset): PositionSizeResult {
    let adjustmentFactor = 1.0;
    let rationale = kellyResult.rationale;

    // Volatility adjustment
    const volatilityAdjustment = Math.min(1.0, 0.3 / asset.volatility); // Reduce for high volatility
    adjustmentFactor *= volatilityAdjustment;
    
    if (volatilityAdjustment < 1.0) {
      rationale += `, reduced ${((1 - volatilityAdjustment) * 100).toFixed(1)}% for high volatility`;
    }

    // Signal strength adjustment
    const strengthAdjustment = signal.strength || 0.5;
    adjustmentFactor *= strengthAdjustment;
    rationale += `, scaled by ${(strengthAdjustment * 100).toFixed(1)}% signal strength`;

    // Beta adjustment (systematic risk)
    const betaAdjustment = Math.min(1.0, 1.0 / Math.max(asset.beta, 0.5));
    adjustmentFactor *= betaAdjustment;
    
    if (betaAdjustment < 1.0) {
      rationale += `, reduced ${((1 - betaAdjustment) * 100).toFixed(1)}% for high beta`;
    }

    const adjustedSize = kellyResult.recommendedSize * adjustmentFactor;

    return {
      recommendedSize: adjustedSize,
      kellyFraction: kellyResult.kellyFraction * adjustmentFactor,
      riskAdjustedSize: adjustedSize,
      rationale
    };
  }

  async optimizePortfolio(expectedReturns: Map<string, number>, riskTarget?: number): Promise<OptimizationResult> {
    try {
      // Mean-Variance Optimization using Markowitz approach
      const symbols = Array.from(this.assets.keys());
      const n = symbols.length;
      
      // Update expected returns
      symbols.forEach(symbol => {
        const asset = this.assets.get(symbol);
        if (asset && expectedReturns.has(symbol)) {
          asset.expectedReturn = expectedReturns.get(symbol)!;
          this.assets.set(symbol, asset);
        }
      });

      // Calculate optimal weights (simplified implementation)
      const optimalWeights = this.calculateEfficientFrontier(riskTarget);
      
      // Calculate portfolio metrics
      const portfolioReturn = this.calculatePortfolioReturn(optimalWeights);
      const portfolioVolatility = this.calculatePortfolioVolatility(optimalWeights);
      const sharpeRatio = (portfolioReturn - this.riskFreeRate) / portfolioVolatility;

      return {
        optimalWeights,
        expectedReturn: portfolioReturn,
        expectedVolatility: portfolioVolatility,
        sharpeRatio,
        maxDrawdown: this.estimateMaxDrawdown(optimalWeights)
      };

    } catch (error) {
      logger.error('[PortfolioOptimizer] Portfolio optimization failed:', error);
      
      // Return current weights as fallback
      const currentWeights = new Map<string, number>();
      this.assets.forEach((asset, symbol) => {
        currentWeights.set(symbol, asset.weight);
      });

      return {
        optimalWeights: currentWeights,
        expectedReturn: 0.15,
        expectedVolatility: 0.25,
        sharpeRatio: 0.6,
        maxDrawdown: 0.2
      };
    }
  }

  private calculateEfficientFrontier(riskTarget?: number): Map<string, number> {
    // Simplified mean-variance optimization
    // In production, would use quadratic programming solver
    
    const weights = new Map<string, number>();
    const symbols = Array.from(this.assets.keys());
    
    if (riskTarget) {
      // Risk parity approach for specific risk target
      const totalVolatility = Array.from(this.assets.values())
        .reduce((sum, asset) => sum + asset.volatility, 0);
      
      this.assets.forEach((asset, symbol) => {
        // Inverse volatility weighting
        const weight = (1 / asset.volatility) / (1 / totalVolatility);
        weights.set(symbol, weight);
      });
      
      // Normalize weights
      this.normalizeWeights(weights);
      
    } else {
      // Maximum Sharpe ratio portfolio
      this.assets.forEach((asset, symbol) => {
        // Simplified: weight by Sharpe ratio
        const assetSharpe = (asset.expectedReturn - this.riskFreeRate) / asset.volatility;
        weights.set(symbol, Math.max(0, assetSharpe));
      });
      
      this.normalizeWeights(weights);
    }

    return weights;
  }

  private normalizeWeights(weights: Map<string, number>): void {
    const total = Array.from(weights.values()).reduce((sum, weight) => sum + weight, 0);
    
    if (total > 0) {
      weights.forEach((weight, symbol) => {
        weights.set(symbol, weight / total);
      });
    }
  }

  private calculatePortfolioReturn(weights: Map<string, number>): number {
    let portfolioReturn = 0;
    
    weights.forEach((weight, symbol) => {
      const asset = this.assets.get(symbol);
      if (asset) {
        portfolioReturn += weight * asset.expectedReturn;
      }
    });
    
    return portfolioReturn;
  }

  private calculatePortfolioVolatility(weights: Map<string, number>): number {
    let variance = 0;
    const symbols = Array.from(weights.keys());
    
    // Calculate portfolio variance using correlation matrix
    for (const symbol1 of symbols) {
      const weight1 = weights.get(symbol1) || 0;
      const asset1 = this.assets.get(symbol1);
      
      if (!asset1) continue;
      
      for (const symbol2 of symbols) {
        const weight2 = weights.get(symbol2) || 0;
        const asset2 = this.assets.get(symbol2);
        
        if (!asset2) continue;
        
        const correlation = this.correlationMatrix.get(symbol1)?.get(symbol2) || 0;
        variance += weight1 * weight2 * asset1.volatility * asset2.volatility * correlation;
      }
    }
    
    return Math.sqrt(variance);
  }

  private estimateMaxDrawdown(weights: Map<string, number>): number {
    // Simplified drawdown estimation
    // In production would use historical simulation
    const portfolioVolatility = this.calculatePortfolioVolatility(weights);
    return portfolioVolatility * 2; // Rough estimate: 2x volatility
  }

  async rebalancePortfolio(currentWeights: Map<string, number>, targetWeights: Map<string, number>): Promise<Map<string, number>> {
    const rebalanceActions = new Map<string, number>();
    
    targetWeights.forEach((targetWeight, symbol) => {
      const currentWeight = currentWeights.get(symbol) || 0;
      const difference = targetWeight - currentWeight;
      
      // Only rebalance if difference is significant (>1%)
      if (Math.abs(difference) > 0.01) {
        rebalanceActions.set(symbol, difference);
      }
    });

    logger.info('[PortfolioOptimizer] Rebalance recommendations:', 
      Object.fromEntries(rebalanceActions)
    );

    return rebalanceActions;
  }

  async getDiversificationMetrics(): Promise<any> {
    const weights = new Map<string, number>();
    this.assets.forEach((asset, symbol) => {
      weights.set(symbol, asset.weight);
    });

    return {
      concentration: this.calculateConcentration(weights),
      effectiveAssets: this.calculateEffectiveAssets(weights),
      correlationRisk: this.calculateCorrelationRisk(),
      diversificationRatio: this.calculateDiversificationRatio(weights)
    };
  }

  private calculateConcentration(weights: Map<string, number>): number {
    // Herfindahl-Hirschman Index
    let hhi = 0;
    weights.forEach(weight => {
      hhi += weight * weight;
    });
    return hhi;
  }

  private calculateEffectiveAssets(weights: Map<string, number>): number {
    const hhi = this.calculateConcentration(weights);
    return 1 / hhi;
  }

  private calculateCorrelationRisk(): number {
    // Average pairwise correlation
    let totalCorrelation = 0;
    let pairCount = 0;
    
    const symbols = Array.from(this.assets.keys());
    
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const correlation = this.correlationMatrix.get(symbols[i])?.get(symbols[j]) || 0;
        totalCorrelation += correlation;
        pairCount++;
      }
    }
    
    return pairCount > 0 ? totalCorrelation / pairCount : 0;
  }

  private calculateDiversificationRatio(weights: Map<string, number>): number {
    // Ratio of weighted average volatility to portfolio volatility
    let weightedAvgVol = 0;
    
    weights.forEach((weight, symbol) => {
      const asset = this.assets.get(symbol);
      if (asset) {
        weightedAvgVol += weight * asset.volatility;
      }
    });
    
    const portfolioVol = this.calculatePortfolioVolatility(weights);
    return portfolioVol > 0 ? weightedAvgVol / portfolioVol : 1;
  }
}