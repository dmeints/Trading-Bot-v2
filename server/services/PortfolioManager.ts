import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';

interface Asset {
  symbol: string;
  name: string;
  sector: string;
  marketCap: number;
  price: number;
  returns: number[];
  volatility: number;
  correlation: Record<string, number>;
}

interface PortfolioConfig {
  id: string;
  name: string;
  strategy: 'mean_variance' | 'risk_parity' | 'black_litterman' | 'equal_weight';
  constraints: {
    minWeight: number;
    maxWeight: number;
    maxSectorWeight: number;
    targetVolatility?: number;
    targetReturn?: number;
  };
  rebalanceFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  rebalanceThreshold: number; // Percentage deviation threshold
  assets: string[];
}

interface Portfolio {
  id: string;
  config: PortfolioConfig;
  weights: Record<string, number>;
  value: number;
  positions: Record<string, {
    symbol: string;
    quantity: number;
    value: number;
    weight: number;
  }>;
  performance: {
    totalReturn: number;
    annualizedReturn: number;
    volatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
    var95: number;
    cvar95: number;
  };
  analytics: {
    sectorAllocation: Record<string, number>;
    correlation: number[][];
    beta: number;
    alpha: number;
    informationRatio: number;
  };
  lastRebalance: Date;
  nextRebalance: Date;
}

interface OptimizationResult {
  weights: Record<string, number>;
  expectedReturn: number;
  expectedVolatility: number;
  sharpeRatio: number;
  efficient: boolean;
  constraints: {
    satisfied: boolean;
    violations: string[];
  };
}

interface RebalanceAction {
  symbol: string;
  currentWeight: number;
  targetWeight: number;
  trade: {
    side: 'buy' | 'sell';
    quantity: number;
    estimatedCost: number;
  };
}

export class PortfolioManager extends EventEmitter {
  private portfolios: Map<string, Portfolio>;
  private assets: Map<string, Asset>;
  private marketData: Map<string, number[]>; // Historical prices
  
  constructor() {
    super();
    this.portfolios = new Map();
    this.assets = new Map();
    this.marketData = new Map();
    
    // Initialize with common crypto assets
    this.initializeAssetUniverse();
    
    logger.info('[PortfolioManager] Initialized with advanced optimization capabilities');
  }

  private initializeAssetUniverse(): void {
    const cryptoAssets: Asset[] = [
      {
        symbol: 'BTC',
        name: 'Bitcoin',
        sector: 'Layer 1',
        marketCap: 1200000000000, // $1.2T
        price: 65000,
        returns: this.generateRealisticReturns(252, 0.02, 0.05), // 252 days, 2% drift, 5% vol
        volatility: 0.05,
        correlation: {}
      },
      {
        symbol: 'ETH',
        name: 'Ethereum',
        sector: 'Layer 1',
        marketCap: 400000000000, // $400B
        price: 3500,
        returns: this.generateRealisticReturns(252, 0.025, 0.06),
        volatility: 0.06,
        correlation: {}
      },
      {
        symbol: 'SOL',
        name: 'Solana',
        sector: 'Layer 1',
        marketCap: 80000000000, // $80B
        price: 180,
        returns: this.generateRealisticReturns(252, 0.03, 0.08),
        volatility: 0.08,
        correlation: {}
      },
      {
        symbol: 'MATIC',
        name: 'Polygon',
        sector: 'Layer 2',
        marketCap: 15000000000, // $15B
        price: 1.2,
        returns: this.generateRealisticReturns(252, 0.025, 0.07),
        volatility: 0.07,
        correlation: {}
      },
      {
        symbol: 'UNI',
        name: 'Uniswap',
        sector: 'DeFi',
        marketCap: 8000000000, // $8B
        price: 12,
        returns: this.generateRealisticReturns(252, 0.02, 0.09),
        volatility: 0.09,
        correlation: {}
      },
      {
        symbol: 'LINK',
        name: 'Chainlink',
        sector: 'Oracle',
        marketCap: 12000000000, // $12B
        price: 20,
        returns: this.generateRealisticReturns(252, 0.015, 0.06),
        volatility: 0.06,
        correlation: {}
      }
    ];

    // Calculate correlations between assets
    this.calculateCorrelations(cryptoAssets);

    // Store assets
    for (const asset of cryptoAssets) {
      this.assets.set(asset.symbol, asset);
      this.marketData.set(asset.symbol, this.generatePriceHistory(asset.price, asset.returns));
    }
  }

  private generateRealisticReturns(periods: number, drift: number, volatility: number): number[] {
    const returns: number[] = [];
    const annualizedDrift = drift / 252;
    const annualizedVol = volatility / Math.sqrt(252);
    
    for (let i = 0; i < periods; i++) {
      const randomShock = this.boxMullerRandom() * annualizedVol;
      const dailyReturn = annualizedDrift + randomShock;
      returns.push(dailyReturn);
    }
    
    return returns;
  }

  private boxMullerRandom(): number {
    // Box-Muller transformation for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  private generatePriceHistory(startPrice: number, returns: number[]): number[] {
    const prices = [startPrice];
    let currentPrice = startPrice;
    
    for (const dailyReturn of returns) {
      currentPrice *= (1 + dailyReturn);
      prices.push(currentPrice);
    }
    
    return prices;
  }

  private calculateCorrelations(assets: Asset[]): void {
    // Calculate correlation matrix between all assets
    for (let i = 0; i < assets.length; i++) {
      for (let j = 0; j < assets.length; j++) {
        if (i === j) {
          assets[i].correlation[assets[j].symbol] = 1.0;
        } else {
          const correlation = this.calculatePearsonCorrelation(
            assets[i].returns,
            assets[j].returns
          );
          assets[i].correlation[assets[j].symbol] = correlation;
        }
      }
    }
  }

  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    const xMean = x.slice(0, n).reduce((sum, val) => sum + val, 0) / n;
    const yMean = y.slice(0, n).reduce((sum, val) => sum + val, 0) / n;
    
    let numerator = 0;
    let xSumSquares = 0;
    let ySumSquares = 0;
    
    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;
      
      numerator += xDiff * yDiff;
      xSumSquares += xDiff * xDiff;
      ySumSquares += yDiff * yDiff;
    }
    
    const denominator = Math.sqrt(xSumSquares * ySumSquares);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  async createPortfolio(config: PortfolioConfig, initialValue: number = 100000): Promise<string> {
    try {
      // Validate configuration
      this.validatePortfolioConfig(config);
      
      // Run initial optimization
      const optimization = await this.optimizePortfolio(config);
      
      // Calculate initial positions
      const positions: Record<string, any> = {};
      let totalValue = 0;
      
      for (const symbol of config.assets) {
        const asset = this.assets.get(symbol);
        if (!asset) continue;
        
        const weight = optimization.weights[symbol] || 0;
        const value = initialValue * weight;
        const quantity = value / asset.price;
        
        positions[symbol] = {
          symbol,
          quantity,
          value,
          weight
        };
        
        totalValue += value;
      }

      // Create portfolio
      const portfolio: Portfolio = {
        id: config.id,
        config,
        weights: optimization.weights,
        value: totalValue,
        positions,
        performance: {
          totalReturn: 0,
          annualizedReturn: 0,
          volatility: optimization.expectedVolatility,
          sharpeRatio: optimization.sharpeRatio,
          maxDrawdown: 0,
          var95: 0,
          cvar95: 0
        },
        analytics: {
          sectorAllocation: this.calculateSectorAllocation(optimization.weights),
          correlation: this.getCorrelationMatrix(config.assets),
          beta: 1.0,
          alpha: 0,
          informationRatio: 0
        },
        lastRebalance: new Date(),
        nextRebalance: this.calculateNextRebalanceDate(config.rebalanceFrequency)
      };

      this.portfolios.set(config.id, portfolio);
      
      logger.info('[PortfolioManager] Portfolio created:', {
        portfolioId: config.id,
        strategy: config.strategy,
        assets: config.assets.length,
        expectedReturn: optimization.expectedReturn,
        expectedVolatility: optimization.expectedVolatility
      });

      this.emit('portfolioCreated', { portfolioId: config.id, portfolio });
      
      return config.id;

    } catch (error) {
      logger.error('[PortfolioManager] Failed to create portfolio:', error);
      throw error;
    }
  }

  async optimizePortfolio(config: PortfolioConfig): Promise<OptimizationResult> {
    try {
      let weights: Record<string, number> = {};
      
      switch (config.strategy) {
        case 'equal_weight':
          weights = this.equalWeightOptimization(config.assets);
          break;
        case 'mean_variance':
          weights = await this.meanVarianceOptimization(config);
          break;
        case 'risk_parity':
          weights = await this.riskParityOptimization(config);
          break;
        case 'black_litterman':
          weights = await this.blackLittermanOptimization(config);
          break;
        default:
          throw new Error(`Unknown optimization strategy: ${config.strategy}`);
      }

      // Apply constraints
      weights = this.applyConstraints(weights, config.constraints);
      
      // Calculate expected performance
      const expectedReturn = this.calculateExpectedReturn(weights);
      const expectedVolatility = this.calculateExpectedVolatility(weights);
      const sharpeRatio = expectedVolatility > 0 ? expectedReturn / expectedVolatility : 0;

      // Validate constraints
      const constraintValidation = this.validateConstraints(weights, config.constraints);

      const result: OptimizationResult = {
        weights,
        expectedReturn,
        expectedVolatility,
        sharpeRatio,
        efficient: constraintValidation.satisfied,
        constraints: constraintValidation
      };

      logger.info('[PortfolioManager] Portfolio optimization completed:', {
        strategy: config.strategy,
        expectedReturn: expectedReturn.toFixed(4),
        expectedVolatility: expectedVolatility.toFixed(4),
        sharpeRatio: sharpeRatio.toFixed(4)
      });

      return result;

    } catch (error) {
      logger.error('[PortfolioManager] Portfolio optimization failed:', error);
      throw error;
    }
  }

  private equalWeightOptimization(assets: string[]): Record<string, number> {
    const weight = 1 / assets.length;
    const weights: Record<string, number> = {};
    
    for (const asset of assets) {
      weights[asset] = weight;
    }
    
    return weights;
  }

  private async meanVarianceOptimization(config: PortfolioConfig): Promise<Record<string, number>> {
    // Simplified mean-variance optimization using analytical solution
    const assets = config.assets;
    const n = assets.length;
    
    // Get expected returns and covariance matrix
    const expectedReturns = assets.map(symbol => {
      const asset = this.assets.get(symbol);
      return asset ? asset.returns.reduce((sum, r) => sum + r, 0) / asset.returns.length * 252 : 0.1;
    });

    const covarianceMatrix = this.calculateCovarianceMatrix(assets);
    
    // Use simplified optimization - equal risk contribution with return bias
    const weights: Record<string, number> = {};
    let totalWeight = 0;
    
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      const expectedReturn = expectedReturns[i];
      const variance = covarianceMatrix[i][i];
      
      // Weight inversely proportional to variance, adjusted by expected return
      const weight = (expectedReturn / variance) || (1 / n);
      weights[asset] = weight;
      totalWeight += weight;
    }
    
    // Normalize weights
    for (const asset of assets) {
      weights[asset] /= totalWeight;
    }
    
    return weights;
  }

  private async riskParityOptimization(config: PortfolioConfig): Promise<Record<string, number>> {
    // Risk parity - equal risk contribution from each asset
    const assets = config.assets;
    const weights: Record<string, number> = {};
    let totalInverseVol = 0;
    
    // Calculate inverse volatility weights
    for (const symbol of assets) {
      const asset = this.assets.get(symbol);
      if (asset) {
        const inverseVol = 1 / asset.volatility;
        weights[symbol] = inverseVol;
        totalInverseVol += inverseVol;
      }
    }
    
    // Normalize weights
    for (const asset of assets) {
      if (weights[asset]) {
        weights[asset] /= totalInverseVol;
      }
    }
    
    return weights;
  }

  private async blackLittermanOptimization(config: PortfolioConfig): Promise<Record<string, number>> {
    // Simplified Black-Litterman model
    // Start with market capitalization weights as prior
    const assets = config.assets;
    const weights: Record<string, number> = {};
    let totalMarketCap = 0;
    
    // Calculate market cap weights as prior
    for (const symbol of assets) {
      const asset = this.assets.get(symbol);
      if (asset) {
        totalMarketCap += asset.marketCap;
      }
    }
    
    for (const symbol of assets) {
      const asset = this.assets.get(symbol);
      if (asset) {
        weights[symbol] = asset.marketCap / totalMarketCap;
      }
    }
    
    // Apply investor views (simplified - use momentum as view)
    for (const symbol of assets) {
      const asset = this.assets.get(symbol);
      if (asset && asset.returns.length >= 20) {
        const recentReturns = asset.returns.slice(-20);
        const momentum = recentReturns.reduce((sum, r) => sum + r, 0) / 20;
        
        // Adjust weight based on momentum (simple view)
        const adjustment = momentum * 0.1; // 10% max adjustment
        weights[symbol] *= (1 + adjustment);
      }
    }
    
    // Renormalize
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    for (const asset of assets) {
      weights[asset] /= totalWeight;
    }
    
    return weights;
  }

  private calculateCovarianceMatrix(assets: string[]): number[][] {
    const n = assets.length;
    const matrix: number[][] = [];
    
    for (let i = 0; i < n; i++) {
      matrix[i] = [];
      const assetI = this.assets.get(assets[i]);
      
      for (let j = 0; j < n; j++) {
        const assetJ = this.assets.get(assets[j]);
        
        if (assetI && assetJ) {
          if (i === j) {
            // Variance on diagonal
            matrix[i][j] = assetI.volatility * assetI.volatility;
          } else {
            // Covariance off-diagonal
            const correlation = assetI.correlation[assetJ.symbol] || 0;
            matrix[i][j] = correlation * assetI.volatility * assetJ.volatility;
          }
        } else {
          matrix[i][j] = i === j ? 0.01 : 0; // Default values
        }
      }
    }
    
    return matrix;
  }

  private applyConstraints(
    weights: Record<string, number>, 
    constraints: PortfolioConfig['constraints']
  ): Record<string, number> {
    const constrainedWeights = { ...weights };
    
    // Apply min/max weight constraints
    for (const [symbol, weight] of Object.entries(constrainedWeights)) {
      constrainedWeights[symbol] = Math.max(
        constraints.minWeight,
        Math.min(constraints.maxWeight, weight)
      );
    }
    
    // Renormalize to ensure weights sum to 1
    const totalWeight = Object.values(constrainedWeights).reduce((sum, w) => sum + w, 0);
    if (totalWeight > 0) {
      for (const symbol in constrainedWeights) {
        constrainedWeights[symbol] /= totalWeight;
      }
    }
    
    return constrainedWeights;
  }

  private validateConstraints(
    weights: Record<string, number>,
    constraints: PortfolioConfig['constraints']
  ): { satisfied: boolean; violations: string[] } {
    const violations: string[] = [];
    
    // Check individual weight constraints
    for (const [symbol, weight] of Object.entries(weights)) {
      if (weight < constraints.minWeight) {
        violations.push(`${symbol} weight ${weight.toFixed(4)} below minimum ${constraints.minWeight}`);
      }
      if (weight > constraints.maxWeight) {
        violations.push(`${symbol} weight ${weight.toFixed(4)} above maximum ${constraints.maxWeight}`);
      }
    }
    
    // Check sector concentration
    const sectorWeights = this.calculateSectorAllocation(weights);
    for (const [sector, weight] of Object.entries(sectorWeights)) {
      if (weight > constraints.maxSectorWeight) {
        violations.push(`${sector} sector weight ${weight.toFixed(4)} above maximum ${constraints.maxSectorWeight}`);
      }
    }
    
    return {
      satisfied: violations.length === 0,
      violations
    };
  }

  private calculateExpectedReturn(weights: Record<string, number>): number {
    let expectedReturn = 0;
    
    for (const [symbol, weight] of Object.entries(weights)) {
      const asset = this.assets.get(symbol);
      if (asset) {
        const assetReturn = asset.returns.reduce((sum, r) => sum + r, 0) / asset.returns.length * 252;
        expectedReturn += weight * assetReturn;
      }
    }
    
    return expectedReturn;
  }

  private calculateExpectedVolatility(weights: Record<string, number>): number {
    const assets = Object.keys(weights);
    const covMatrix = this.calculateCovarianceMatrix(assets);
    
    let portfolioVariance = 0;
    
    for (let i = 0; i < assets.length; i++) {
      for (let j = 0; j < assets.length; j++) {
        const weightI = weights[assets[i]] || 0;
        const weightJ = weights[assets[j]] || 0;
        portfolioVariance += weightI * weightJ * covMatrix[i][j];
      }
    }
    
    return Math.sqrt(portfolioVariance * 252); // Annualized
  }

  private calculateSectorAllocation(weights: Record<string, number>): Record<string, number> {
    const sectorWeights: Record<string, number> = {};
    
    for (const [symbol, weight] of Object.entries(weights)) {
      const asset = this.assets.get(symbol);
      if (asset) {
        sectorWeights[asset.sector] = (sectorWeights[asset.sector] || 0) + weight;
      }
    }
    
    return sectorWeights;
  }

  private getCorrelationMatrix(assets: string[]): number[][] {
    const matrix: number[][] = [];
    
    for (let i = 0; i < assets.length; i++) {
      matrix[i] = [];
      const assetI = this.assets.get(assets[i]);
      
      for (let j = 0; j < assets.length; j++) {
        const assetJ = this.assets.get(assets[j]);
        
        if (assetI && assetJ) {
          matrix[i][j] = assetI.correlation[assetJ.symbol] || (i === j ? 1 : 0);
        } else {
          matrix[i][j] = i === j ? 1 : 0;
        }
      }
    }
    
    return matrix;
  }

  private calculateNextRebalanceDate(frequency: PortfolioConfig['rebalanceFrequency']): Date {
    const now = new Date();
    const nextRebalance = new Date(now);
    
    switch (frequency) {
      case 'daily':
        nextRebalance.setDate(now.getDate() + 1);
        break;
      case 'weekly':
        nextRebalance.setDate(now.getDate() + 7);
        break;
      case 'monthly':
        nextRebalance.setMonth(now.getMonth() + 1);
        break;
      case 'quarterly':
        nextRebalance.setMonth(now.getMonth() + 3);
        break;
    }
    
    return nextRebalance;
  }

  private validatePortfolioConfig(config: PortfolioConfig): void {
    if (!config.id || !config.name) {
      throw new Error('Portfolio ID and name are required');
    }
    
    if (!config.assets || config.assets.length === 0) {
      throw new Error('Portfolio must contain at least one asset');
    }
    
    if (config.constraints.minWeight < 0 || config.constraints.maxWeight > 1) {
      throw new Error('Invalid weight constraints');
    }
    
    if (config.constraints.minWeight > config.constraints.maxWeight) {
      throw new Error('Minimum weight cannot be greater than maximum weight');
    }
  }

  async rebalancePortfolio(portfolioId: string): Promise<RebalanceAction[]> {
    try {
      const portfolio = this.portfolios.get(portfolioId);
      if (!portfolio) {
        throw new Error('Portfolio not found');
      }

      // Run new optimization
      const optimization = await this.optimizePortfolio(portfolio.config);
      
      // Calculate rebalancing actions
      const actions: RebalanceAction[] = [];
      const totalValue = portfolio.value;
      
      for (const symbol of portfolio.config.assets) {
        const currentWeight = portfolio.weights[symbol] || 0;
        const targetWeight = optimization.weights[symbol] || 0;
        const weightDiff = Math.abs(targetWeight - currentWeight);
        
        // Only rebalance if weight difference exceeds threshold
        if (weightDiff > portfolio.config.rebalanceThreshold) {
          const asset = this.assets.get(symbol);
          if (!asset) continue;
          
          const targetValue = totalValue * targetWeight;
          const currentValue = totalValue * currentWeight;
          const valueDiff = targetValue - currentValue;
          
          const action: RebalanceAction = {
            symbol,
            currentWeight,
            targetWeight,
            trade: {
              side: valueDiff > 0 ? 'buy' : 'sell',
              quantity: Math.abs(valueDiff) / asset.price,
              estimatedCost: Math.abs(valueDiff) * 0.001 // 0.1% transaction cost
            }
          };
          
          actions.push(action);
        }
      }

      // Update portfolio if rebalancing needed
      if (actions.length > 0) {
        portfolio.weights = optimization.weights;
        portfolio.lastRebalance = new Date();
        portfolio.nextRebalance = this.calculateNextRebalanceDate(portfolio.config.rebalanceFrequency);
        
        logger.info('[PortfolioManager] Portfolio rebalanced:', {
          portfolioId,
          actions: actions.length,
          totalCost: actions.reduce((sum, a) => sum + a.trade.estimatedCost, 0)
        });
        
        this.emit('portfolioRebalanced', { portfolioId, actions });
      }

      return actions;

    } catch (error) {
      logger.error('[PortfolioManager] Portfolio rebalancing failed:', error);
      throw error;
    }
  }

  async calculatePerformanceAttribution(portfolioId: string): Promise<{
    totalReturn: number;
    sectorContribution: Record<string, number>;
    securityContribution: Record<string, number>;
    allocationEffect: number;
    selectionEffect: number;
  }> {
    const portfolio = this.portfolios.get(portfolioId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    const sectorContribution: Record<string, number> = {};
    const securityContribution: Record<string, number> = {};
    let totalReturn = 0;

    // Calculate contributions
    for (const [symbol, position] of Object.entries(portfolio.positions)) {
      const asset = this.assets.get(symbol);
      if (!asset) continue;

      // Simulate recent return for the asset
      const recentReturn = asset.returns[asset.returns.length - 1] || 0;
      const contribution = position.weight * recentReturn;
      
      securityContribution[symbol] = contribution;
      sectorContribution[asset.sector] = (sectorContribution[asset.sector] || 0) + contribution;
      totalReturn += contribution;
    }

    return {
      totalReturn,
      sectorContribution,
      securityContribution,
      allocationEffect: totalReturn * 0.3, // Simplified allocation effect
      selectionEffect: totalReturn * 0.7   // Simplified selection effect
    };
  }

  getPortfolio(portfolioId: string): Portfolio | null {
    return this.portfolios.get(portfolioId) || null;
  }

  getAllPortfolios(): Portfolio[] {
    return Array.from(this.portfolios.values());
  }

  getAssetUniverse(): Asset[] {
    return Array.from(this.assets.values());
  }

  async deletePortfolio(portfolioId: string): Promise<boolean> {
    const deleted = this.portfolios.delete(portfolioId);
    if (deleted) {
      this.emit('portfolioDeleted', { portfolioId });
      logger.info('[PortfolioManager] Portfolio deleted:', { portfolioId });
    }
    return deleted;
  }
}