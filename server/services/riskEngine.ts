import { storage } from '../storage';
import type { User, Position, InsertRiskMetrics } from '@shared/schema';

export interface RiskAssessment {
  userId: string;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number; // 0-1 scale
  metrics: RiskMetrics;
  recommendations: string[];
  positionSizing: PositionSizingRecommendation;
}

export interface RiskMetrics {
  varDaily: number; // Value at Risk (1 day, 95% confidence)
  varWeekly: number; // Value at Risk (1 week, 95% confidence)
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  beta: number;
  alpha: number;
  diversificationScore: number;
  concentrationRisk: number;
  liquidityRisk: number;
}

export interface PositionSizingRecommendation {
  maxPositionSize: number; // Percentage of portfolio
  kellyOptimal: number; // Kelly Criterion optimal size
  riskAdjusted: number; // Risk-adjusted size
  reasoning: string;
}

export class RiskEngine {
  async assessPortfolioRisk(userId: string): Promise<RiskAssessment> {
    const user = await storage.getUser(userId);
    const positions = await storage.getUserPositions(userId);
    const portfolioHistory = []; // Placeholder until portfolio history is implemented
    
    if (!user || !positions) {
      throw new Error('User or position data not available');
    }

    const metrics = await this.calculateRiskMetrics(userId, positions, portfolioHistory);
    const overallRisk = this.categorizeRisk(metrics);
    const recommendations = this.generateRecommendations(metrics, user);
    const positionSizing = this.calculateOptimalPositionSizing(metrics, user);

    // Store risk metrics (placeholder until storage method is implemented)
    // await storage.createRiskMetrics(...);

    return {
      userId,
      overallRisk,
      riskScore: this.calculateOverallRiskScore(metrics),
      metrics,
      recommendations,
      positionSizing
    };
  }

  private async calculateRiskMetrics(userId: string, positions: Position[], portfolioHistory: any[]): Promise<RiskMetrics> {
    const returns = this.calculateReturns(portfolioHistory);
    const portfolioValue = this.calculatePortfolioValue(positions);
    
    return {
      varDaily: this.calculateVaR(returns, 1, 0.95),
      varWeekly: this.calculateVaR(returns, 7, 0.95),
      maxDrawdown: this.calculateMaxDrawdown(portfolioHistory),
      sharpeRatio: this.calculateSharpeRatio(returns),
      sortinoRatio: this.calculateSortinoRatio(returns),
      beta: this.calculateBeta(returns),
      alpha: this.calculateAlpha(returns),
      diversificationScore: this.calculateDiversificationScore(positions),
      concentrationRisk: this.calculateConcentrationRisk(positions),
      liquidityRisk: this.calculateLiquidityRisk(positions)
    };
  }

  private calculateReturns(portfolioHistory: any[]): number[] {
    if (portfolioHistory.length < 2) return [0];
    
    return portfolioHistory.slice(1).map((current, index) => {
      const previous = portfolioHistory[index];
      const currentValue = parseFloat(current.totalValue || '0');
      const previousValue = parseFloat(previous.totalValue || '0');
      
      if (previousValue === 0) return 0;
      return (currentValue - previousValue) / previousValue;
    });
  }

  private calculatePortfolioValue(positions: Position[]): number {
    return positions.reduce((total, position) => {
      const quantity = parseFloat(position.quantity);
      const currentPrice = parseFloat(position.currentPrice);
      return total + (quantity * currentPrice);
    }, 0);
  }

  private calculateVaR(returns: number[], days: number, confidence: number): number {
    if (returns.length === 0) return 0;
    
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sortedReturns.length);
    const dailyVaR = sortedReturns[index] || 0;
    
    // Scale to desired time horizon
    return Math.abs(dailyVaR * Math.sqrt(days));
  }

  private calculateMaxDrawdown(portfolioHistory: any[]): number {
    if (portfolioHistory.length < 2) return 0;
    
    let maxValue = 0;
    let maxDrawdown = 0;
    
    portfolioHistory.forEach(snapshot => {
      const value = parseFloat(snapshot.totalValue || '0');
      maxValue = Math.max(maxValue, value);
      const drawdown = maxValue > 0 ? (maxValue - value) / maxValue : 0;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    });
    
    return maxDrawdown;
  }

  private calculateSharpeRatio(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    const riskFreeRate = 0.02 / 365; // Assume 2% annual risk-free rate
    return stdDev > 0 ? (avgReturn - riskFreeRate) / stdDev : 0;
  }

  private calculateSortinoRatio(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const negativeReturns = returns.filter(r => r < 0);
    
    if (negativeReturns.length === 0) return avgReturn > 0 ? 10 : 0; // Very high ratio if no downside
    
    const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length;
    const downsideDeviation = Math.sqrt(downsideVariance);
    
    const riskFreeRate = 0.02 / 365;
    return downsideDeviation > 0 ? (avgReturn - riskFreeRate) / downsideDeviation : 0;
  }

  private calculateBeta(returns: number[]): number {
    // For crypto, we'd typically use Bitcoin as the market benchmark
    // For simplicity, assuming market return correlation
    if (returns.length < 2) return 1;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    
    // Simplified beta calculation - in reality we'd need market returns
    return Math.min(Math.max(variance * 50, 0.5), 2.0); // Bounded between 0.5 and 2.0
  }

  private calculateAlpha(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const marketReturn = 0.0008; // Assume 0.08% daily market return
    const beta = this.calculateBeta(returns);
    const riskFreeRate = 0.02 / 365;
    
    return avgReturn - (riskFreeRate + beta * (marketReturn - riskFreeRate));
  }

  private calculateDiversificationScore(positions: Position[]): number {
    if (positions.length === 0) return 0;
    if (positions.length === 1) return 0.1; // Very low diversification
    
    const totalValue = this.calculatePortfolioValue(positions);
    if (totalValue === 0) return 0;
    
    // Calculate Herfindahl-Hirschman Index (HHI) for concentration
    const hhi = positions.reduce((sum, position) => {
      const positionValue = parseFloat(position.quantity) * parseFloat(position.currentPrice);
      const weight = positionValue / totalValue;
      return sum + Math.pow(weight, 2);
    }, 0);
    
    // Convert HHI to diversification score (1 - HHI gives diversification)
    return Math.max(0, 1 - hhi);
  }

  private calculateConcentrationRisk(positions: Position[]): number {
    if (positions.length === 0) return 0;
    
    const totalValue = this.calculatePortfolioValue(positions);
    if (totalValue === 0) return 0;
    
    // Find the largest position
    const maxPositionValue = Math.max(...positions.map(p => 
      parseFloat(p.quantity) * parseFloat(p.currentPrice)
    ));
    
    return maxPositionValue / totalValue;
  }

  private calculateLiquidityRisk(positions: Position[]): number {
    // Simplified liquidity risk based on asset types
    const liquidityScores = {
      'BTC': 0.9,
      'ETH': 0.85,
      'SOL': 0.7,
      'ADA': 0.6,
      'DOT': 0.6
    };
    
    if (positions.length === 0) return 0;
    
    const totalValue = this.calculatePortfolioValue(positions);
    if (totalValue === 0) return 1; // Maximum risk if no value
    
    let weightedLiquidity = 0;
    
    positions.forEach(position => {
      const symbol = position.symbol.split('/')[0]; // Extract base currency
      const positionValue = parseFloat(position.quantity) * parseFloat(position.currentPrice);
      const weight = positionValue / totalValue;
      const liquidity = (liquidityScores as any)[symbol] || 0.3; // Default low liquidity for unknown assets
      
      weightedLiquidity += weight * liquidity;
    });
    
    return 1 - weightedLiquidity; // Return risk (inverse of liquidity)
  }

  private categorizeRisk(metrics: RiskMetrics): 'low' | 'medium' | 'high' | 'critical' {
    const riskScore = this.calculateOverallRiskScore(metrics);
    
    if (riskScore < 0.25) return 'low';
    if (riskScore < 0.5) return 'medium';
    if (riskScore < 0.75) return 'high';
    return 'critical';
  }

  private calculateOverallRiskScore(metrics: RiskMetrics): number {
    // Weighted combination of risk metrics
    const weights = {
      varDaily: 0.2,
      maxDrawdown: 0.2,
      concentrationRisk: 0.15,
      liquidityRisk: 0.15,
      diversificationScore: -0.1, // Negative because higher diversification = lower risk
      sharpeRatio: -0.1, // Negative because higher Sharpe = lower risk-adjusted risk
      beta: 0.1
    };
    
    return Math.max(0, Math.min(1,
      weights.varDaily * metrics.varDaily +
      weights.maxDrawdown * metrics.maxDrawdown +
      weights.concentrationRisk * metrics.concentrationRisk +
      weights.liquidityRisk * metrics.liquidityRisk +
      weights.diversificationScore * (1 - metrics.diversificationScore) +
      weights.sharpeRatio * (metrics.sharpeRatio < 0 ? 1 : 0) +
      weights.beta * Math.max(0, metrics.beta - 1)
    ));
  }

  private generateRecommendations(metrics: RiskMetrics, user: User): string[] {
    const recommendations: string[] = [];
    
    if (metrics.concentrationRisk > 0.5) {
      recommendations.push("Consider diversifying your portfolio - your largest position represents more than 50% of your portfolio");
    }
    
    if (metrics.diversificationScore < 0.3) {
      recommendations.push("Increase diversification by adding positions in different cryptocurrencies or asset classes");
    }
    
    if (metrics.maxDrawdown > 0.2) {
      recommendations.push("Your portfolio has experienced significant drawdowns. Consider implementing stop-loss orders");
    }
    
    if (metrics.liquidityRisk > 0.4) {
      recommendations.push("Some of your positions may have liquidity risks. Consider allocating more to highly liquid assets");
    }
    
    if (metrics.sharpeRatio < 0.5) {
      recommendations.push("Your risk-adjusted returns could be improved. Review your trading strategy and risk management");
    }
    
    if (metrics.varDaily > 0.05) {
      recommendations.push("Your daily Value at Risk is high. Consider reducing position sizes or using hedging strategies");
    }
    
    return recommendations;
  }

  private calculateOptimalPositionSizing(metrics: RiskMetrics, user: User): PositionSizingRecommendation {
    // Kelly Criterion calculation (simplified)
    const winRate = 0.6; // Would be calculated from historical trades
    const avgWin = 0.08; // Average winning trade return
    const avgLoss = 0.05; // Average losing trade loss
    
    const kellyOptimal = (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin;
    const kellyPercentage = Math.max(0, Math.min(0.25, kellyOptimal)); // Cap at 25%
    
    // Risk-adjusted sizing based on user's risk tolerance
    const riskMultipliers = {
      'low': 0.5,
      'medium': 0.75,
      'high': 1.0
    };
    
    const riskMultiplier = (riskMultipliers as any)[user.riskTolerance || 'medium'];
    const riskAdjusted = kellyPercentage * riskMultiplier;
    
    // Further adjust based on current portfolio risk
    const portfolioRiskAdjustment = Math.max(0.5, 1 - metrics.concentrationRisk);
    const finalSize = riskAdjusted * portfolioRiskAdjustment;
    
    return {
      maxPositionSize: Math.min(0.2, finalSize), // Never more than 20% in a single position
      kellyOptimal: kellyPercentage,
      riskAdjusted: finalSize,
      reasoning: `Based on Kelly Criterion (${(kellyPercentage * 100).toFixed(1)}%), your risk tolerance (${user.riskTolerance}), and current portfolio concentration (${(metrics.concentrationRisk * 100).toFixed(1)}%)`
    };
  }
}

export const riskEngine = new RiskEngine();