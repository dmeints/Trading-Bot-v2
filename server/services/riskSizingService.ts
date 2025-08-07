/**
 * DYNAMIC POSITION SIZING SERVICE
 * Kelly Criterion & volatility-scaled position sizing with advanced risk management
 */

import { db } from '../db';

interface PositionSizeInput {
  symbol: string;
  portfolioValue: number;
  winRate: number; // 0-1
  avgWin: number; // Average winning trade %
  avgLoss: number; // Average losing trade % (positive)
  currentVolatility: number; // Current volatility %
  confidence: number; // Signal confidence 0-1
  marketRegime: 'bull' | 'bear' | 'sideways' | 'volatile';
  correlationRisk: number; // 0-1, portfolio correlation exposure
  maxPositionLimit?: number; // Maximum position as % of portfolio
}

interface PositionSizeResult {
  recommendedSize: number; // Position size as % of portfolio
  maxRiskAmount: number; // Dollar amount at risk
  positionValue: number; // Total position value in dollars
  strategy: 'kelly' | 'fixed_fractional' | 'volatility_scaled' | 'conservative';
  reasoning: string;
  riskMetrics: {
    sharpeEstimate: number;
    maxDrawdownRisk: number;
    portfolioHeatLevel: number; // 0-100
    diversificationBonus: number; // -1 to 1
  };
  stopLoss: number; // Recommended stop loss %
  takeProfit: number; // Recommended take profit %
}

interface RiskProfile {
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  maxPortfolioRisk: number; // % of portfolio at risk at any time
  maxSinglePositionSize: number; // % of portfolio in single position
  maxCorrelatedExposure: number; // % in correlated positions
  volatilityPreference: 'low' | 'medium' | 'high';
  drawdownTolerance: number; // Maximum acceptable drawdown %
}

export class RiskSizingService {
  private defaultRiskProfile: RiskProfile = {
    riskTolerance: 'moderate',
    maxPortfolioRisk: 2.0, // 2% max portfolio risk per trade
    maxSinglePositionSize: 10.0, // 10% max position size
    maxCorrelatedExposure: 25.0, // 25% max in correlated assets
    volatilityPreference: 'medium',
    drawdownTolerance: 20.0 // 20% max drawdown
  };

  calculateOptimalPositionSize(input: PositionSizeInput, riskProfile?: RiskProfile): PositionSizeResult {
    const profile = riskProfile || this.defaultRiskProfile;
    
    // Calculate Kelly Criterion
    const kelly = this.calculateKellyPosition(input);
    
    // Calculate volatility-adjusted size
    const volatilityAdjusted = this.calculateVolatilityScaledSize(input, profile);
    
    // Calculate fixed fractional size
    const fixedFractional = this.calculateFixedFractionalSize(input, profile);
    
    // Choose optimal strategy based on conditions
    const { strategy, size, reasoning } = this.selectOptimalStrategy(
      kelly, volatilityAdjusted, fixedFractional, input, profile
    );

    // Apply risk controls and limits
    const finalSize = this.applyRiskControls(size, input, profile);
    
    // Calculate risk metrics
    const riskMetrics = this.calculateRiskMetrics(finalSize, input, profile);
    
    // Calculate stop loss and take profit levels
    const { stopLoss, takeProfit } = this.calculateExitLevels(input, finalSize);

    return {
      recommendedSize: Math.round(finalSize * 100) / 100, // Round to 2 decimals
      maxRiskAmount: (finalSize / 100) * input.portfolioValue * (stopLoss / 100),
      positionValue: (finalSize / 100) * input.portfolioValue,
      strategy,
      reasoning,
      riskMetrics,
      stopLoss,
      takeProfit
    };
  }

  private calculateKellyPosition(input: PositionSizeInput): { size: number; kelly: number } {
    const { winRate, avgWin, avgLoss } = input;
    
    // Kelly formula: f* = (bp - q) / b
    // where b = odds received (avgWin/avgLoss), p = win probability, q = loss probability
    const b = avgWin / avgLoss;
    const p = winRate;
    const q = 1 - p;
    
    const kelly = (b * p - q) / b;
    
    // Apply fractional Kelly (typically 0.25 to 0.5 of full Kelly for safety)
    const fractionalKelly = Math.max(0, kelly * 0.25);
    
    // Convert to position size percentage (Kelly gives fraction of capital to risk)
    // Position size = kelly / stop loss percentage
    const positionSize = fractionalKelly * 100; // Assuming 1% stop loss base
    
    return { size: Math.max(0, Math.min(50, positionSize)), kelly };
  }

  private calculateVolatilityScaledSize(input: PositionSizeInput, profile: RiskProfile): number {
    const { currentVolatility, portfolioValue } = input;
    const baseSize = profile.maxSinglePositionSize;
    
    // Adjust position size inversely to volatility
    const volatilityAdjustment = Math.max(0.2, Math.min(2.0, 20 / currentVolatility));
    
    // Scale based on risk tolerance
    const riskMultiplier = {
      'conservative': 0.5,
      'moderate': 1.0,
      'aggressive': 1.5
    }[profile.riskTolerance];

    const volatilityScaledSize = baseSize * volatilityAdjustment * riskMultiplier;
    
    return Math.max(0.5, Math.min(profile.maxSinglePositionSize, volatilityScaledSize));
  }

  private calculateFixedFractionalSize(input: PositionSizeInput, profile: RiskProfile): number {
    // Simple fixed percentage of portfolio based on confidence and market regime
    const baseSize = profile.maxPortfolioRisk * 2; // Base 4% for moderate risk
    
    const confidenceMultiplier = 0.5 + (input.confidence * 0.5); // 0.5x to 1.0x
    
    const marketMultiplier = {
      'bull': 1.2,
      'sideways': 1.0,
      'bear': 0.8,
      'volatile': 0.6
    }[input.marketRegime];

    return baseSize * confidenceMultiplier * marketMultiplier;
  }

  private selectOptimalStrategy(
    kelly: { size: number; kelly: number },
    volatilityAdjusted: number,
    fixedFractional: number,
    input: PositionSizeInput,
    profile: RiskProfile
  ): { strategy: PositionSizeResult['strategy']; size: number; reasoning: string } {
    
    // Conservative approach for high volatility or low confidence
    if (input.currentVolatility > 50 || input.confidence < 0.4) {
      return {
        strategy: 'conservative',
        size: Math.min(fixedFractional, volatilityAdjusted) * 0.5,
        reasoning: 'Conservative sizing due to high volatility or low confidence'
      };
    }
    
    // Kelly if we have good historical data and reasonable Kelly value
    if (kelly.kelly > 0.05 && kelly.kelly < 0.5 && input.confidence > 0.6) {
      return {
        strategy: 'kelly',
        size: kelly.size,
        reasoning: `Kelly Criterion optimal sizing (${(kelly.kelly * 100).toFixed(1)}% Kelly)`
      };
    }
    
    // Volatility-scaled for normal market conditions
    if (input.currentVolatility < 30) {
      return {
        strategy: 'volatility_scaled',
        size: volatilityAdjusted,
        reasoning: 'Volatility-adjusted sizing for current market conditions'
      };
    }
    
    // Default to fixed fractional
    return {
      strategy: 'fixed_fractional',
      size: fixedFractional,
      reasoning: 'Fixed fractional sizing based on risk profile'
    };
  }

  private applyRiskControls(
    size: number,
    input: PositionSizeInput,
    profile: RiskProfile
  ): number {
    let adjustedSize = size;
    
    // Maximum single position limit
    adjustedSize = Math.min(adjustedSize, profile.maxSinglePositionSize);
    
    // Custom position limit if provided
    if (input.maxPositionLimit) {
      adjustedSize = Math.min(adjustedSize, input.maxPositionLimit);
    }
    
    // Correlation risk adjustment
    if (input.correlationRisk > 0.7) {
      adjustedSize *= (1 - input.correlationRisk * 0.3); // Reduce size for high correlation
    }
    
    // Market regime risk control
    const regimeMultiplier = {
      'bull': 1.0,
      'sideways': 0.9,
      'bear': 0.8,
      'volatile': 0.7
    }[input.marketRegime];
    
    adjustedSize *= regimeMultiplier;
    
    // Minimum position size
    adjustedSize = Math.max(0.1, adjustedSize);
    
    return adjustedSize;
  }

  private calculateRiskMetrics(
    positionSize: number,
    input: PositionSizeInput,
    profile: RiskProfile
  ): PositionSizeResult['riskMetrics'] {
    const { winRate, avgWin, avgLoss, currentVolatility, correlationRisk } = input;
    
    // Estimate Sharpe ratio
    const expectedReturn = winRate * avgWin - (1 - winRate) * avgLoss;
    const returnVolatility = Math.sqrt(
      winRate * Math.pow(avgWin, 2) + (1 - winRate) * Math.pow(avgLoss, 2)
    );
    const sharpeEstimate = returnVolatility > 0 ? expectedReturn / returnVolatility : 0;
    
    // Maximum drawdown risk estimate
    const maxDrawdownRisk = (positionSize / 100) * avgLoss * 1.5; // Conservative estimate
    
    // Portfolio heat level (how much of total risk budget is used)
    const portfolioHeatLevel = (positionSize / profile.maxSinglePositionSize) * 100;
    
    // Diversification bonus/penalty
    const diversificationBonus = correlationRisk > 0.7 ? -0.3 : correlationRisk < 0.3 ? 0.2 : 0;
    
    return {
      sharpeEstimate: Math.round(sharpeEstimate * 100) / 100,
      maxDrawdownRisk: Math.round(maxDrawdownRisk * 100) / 100,
      portfolioHeatLevel: Math.round(portfolioHeatLevel),
      diversificationBonus: Math.round(diversificationBonus * 100) / 100
    };
  }

  private calculateExitLevels(
    input: PositionSizeInput,
    positionSize: number
  ): { stopLoss: number; takeProfit: number } {
    const { currentVolatility, avgWin, avgLoss } = input;
    
    // Base stop loss on volatility and average loss
    const baseStopLoss = Math.max(1.5, currentVolatility * 0.7);
    const stopLoss = Math.max(baseStopLoss, avgLoss * 0.8);
    
    // Take profit based on risk-reward ratio
    const riskRewardRatio = avgWin / avgLoss;
    const targetRatio = Math.max(1.5, riskRewardRatio * 0.8); // Slightly conservative
    const takeProfit = stopLoss * targetRatio;
    
    return {
      stopLoss: Math.round(stopLoss * 10) / 10,
      takeProfit: Math.round(takeProfit * 10) / 10
    };
  }

  calculatePortfolioRisk(positions: Array<{
    symbol: string;
    positionSize: number; // % of portfolio
    correlation: number; // correlation with portfolio
    volatility: number;
  }>): {
    totalRisk: number; // Portfolio volatility %
    concentrationRisk: number; // 0-100 risk score
    correlationRisk: number; // 0-100 risk score
    diversificationScore: number; // 0-100 score
  } {
    if (positions.length === 0) {
      return { totalRisk: 0, concentrationRisk: 0, correlationRisk: 0, diversificationScore: 100 };
    }

    // Calculate portfolio volatility using correlation matrix
    let portfolioVariance = 0;
    for (let i = 0; i < positions.length; i++) {
      const pos1 = positions[i];
      const weight1 = pos1.positionSize / 100;
      
      for (let j = 0; j < positions.length; j++) {
        const pos2 = positions[j];
        const weight2 = pos2.positionSize / 100;
        
        const correlation = i === j ? 1 : (pos1.correlation + pos2.correlation) / 2;
        const covariance = correlation * (pos1.volatility / 100) * (pos2.volatility / 100);
        
        portfolioVariance += weight1 * weight2 * covariance * 10000; // Scale up for percentage
      }
    }
    
    const totalRisk = Math.sqrt(portfolioVariance);
    
    // Concentration risk (Herfindahl index)
    const concentrationRisk = positions.reduce((sum, pos) => {
      const weight = pos.positionSize / 100;
      return sum + Math.pow(weight, 2);
    }, 0) * 100;
    
    // Correlation risk
    const avgCorrelation = positions.reduce((sum, pos) => sum + Math.abs(pos.correlation), 0) / positions.length;
    const correlationRisk = avgCorrelation * 100;
    
    // Diversification score (inverse of concentration and correlation)
    const diversificationScore = Math.max(0, 100 - concentrationRisk - correlationRisk * 0.3);
    
    return {
      totalRisk: Math.round(totalRisk * 10) / 10,
      concentrationRisk: Math.round(concentrationRisk),
      correlationRisk: Math.round(correlationRisk),
      diversificationScore: Math.round(diversificationScore)
    };
  }

  // Dynamic risk profile adjustment based on performance
  adjustRiskProfile(
    currentProfile: RiskProfile,
    recentPerformance: {
      winRate: number;
      avgReturn: number;
      maxDrawdown: number;
      sharpe: number;
      daysSinceLastLoss: number;
    }
  ): RiskProfile {
    const adjusted = { ...currentProfile };
    
    // Increase risk tolerance after good performance
    if (recentPerformance.sharpe > 1.5 && recentPerformance.maxDrawdown < 10) {
      adjusted.maxSinglePositionSize = Math.min(20, adjusted.maxSinglePositionSize * 1.1);
      adjusted.maxPortfolioRisk = Math.min(5, adjusted.maxPortfolioRisk * 1.1);
    }
    
    // Decrease risk after poor performance
    if (recentPerformance.maxDrawdown > 15 || recentPerformance.sharpe < 0.5) {
      adjusted.maxSinglePositionSize = Math.max(2, adjusted.maxSinglePositionSize * 0.9);
      adjusted.maxPortfolioRisk = Math.max(0.5, adjusted.maxPortfolioRisk * 0.9);
    }
    
    // Adjust based on recent win rate
    if (recentPerformance.winRate < 0.4) {
      adjusted.riskTolerance = 'conservative';
      adjusted.maxSinglePositionSize = Math.min(5, adjusted.maxSinglePositionSize);
    } else if (recentPerformance.winRate > 0.7) {
      if (adjusted.riskTolerance === 'conservative') adjusted.riskTolerance = 'moderate';
      if (adjusted.riskTolerance === 'moderate') adjusted.riskTolerance = 'aggressive';
    }
    
    return adjusted;
  }

  // Backtesting position sizing strategies
  async backtestSizingStrategy(
    historicalTrades: Array<{
      symbol: string;
      winRate: number;
      avgWin: number;
      avgLoss: number;
      volatility: number;
      actualReturn: number;
    }>,
    strategy: 'kelly' | 'fixed' | 'volatility' | 'adaptive'
  ): Promise<{
    totalReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
    winRate: number;
    avgPositionSize: number;
  }> {
    let portfolioValue = 100000; // Start with $100k
    let peakValue = portfolioValue;
    let maxDrawdown = 0;
    let totalTrades = 0;
    let winningTrades = 0;
    const returns: number[] = [];
    const positionSizes: number[] = [];
    
    for (const trade of historicalTrades) {
      const input: PositionSizeInput = {
        symbol: trade.symbol,
        portfolioValue,
        winRate: trade.winRate,
        avgWin: trade.avgWin,
        avgLoss: trade.avgLoss,
        currentVolatility: trade.volatility,
        confidence: 0.7,
        marketRegime: 'sideways',
        correlationRisk: 0.5
      };
      
      let positionSize: number;
      
      switch (strategy) {
        case 'kelly':
          positionSize = this.calculateKellyPosition(input).size;
          break;
        case 'fixed':
          positionSize = 5; // Fixed 5%
          break;
        case 'volatility':
          positionSize = this.calculateVolatilityScaledSize(input, this.defaultRiskProfile);
          break;
        case 'adaptive':
          const result = this.calculateOptimalPositionSize(input);
          positionSize = result.recommendedSize;
          break;
        default:
          positionSize = 5;
      }
      
      positionSizes.push(positionSize);
      
      // Apply the trade result
      const positionValue = (positionSize / 100) * portfolioValue;
      const tradeReturn = trade.actualReturn / 100;
      const pnl = positionValue * tradeReturn;
      
      portfolioValue += pnl;
      returns.push((pnl / (portfolioValue - pnl)) * 100);
      
      if (tradeReturn > 0) winningTrades++;
      totalTrades++;
      
      // Track drawdown
      if (portfolioValue > peakValue) {
        peakValue = portfolioValue;
      } else {
        const currentDrawdown = ((peakValue - portfolioValue) / peakValue) * 100;
        if (currentDrawdown > maxDrawdown) {
          maxDrawdown = currentDrawdown;
        }
      }
    }
    
    const totalReturn = ((portfolioValue - 100000) / 100000) * 100;
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const returnStd = Math.sqrt(
      returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / (returns.length - 1)
    );
    const sharpeRatio = returnStd > 0 ? avgReturn / returnStd * Math.sqrt(252) : 0; // Annualized
    
    return {
      totalReturn: Math.round(totalReturn * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      winRate: Math.round((winningTrades / totalTrades) * 10000) / 100,
      avgPositionSize: Math.round((positionSizes.reduce((a, b) => a + b, 0) / positionSizes.length) * 100) / 100
    };
  }
}

export const riskSizingService = new RiskSizingService();