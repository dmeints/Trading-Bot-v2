/**
 * Advanced Risk Intelligence System
 * Intelligent risk management that adapts to market conditions
 */

import { db } from '../db';
import {
  riskMetrics,
  portfolioCorrelations,
  riskEvents,
  type RiskMetric,
  type PortfolioCorrelation,
  type RiskEvent
} from '../../shared/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';

interface RiskAssessment {
  overallRisk: number;
  positionRisk: number;
  portfolioRisk: number;
  liquidityRisk: number;
  correlationRisk: number;
  blackSwanProbability: number;
  recommendations: string[];
}

interface DynamicPositionSize {
  recommendedSize: number;
  maxSize: number;
  reasoning: string[];
  riskAdjustments: any;
}

interface BlackSwanSignal {
  probability: number;
  severity: 'low' | 'medium' | 'high' | 'extreme';
  indicators: string[];
  timeframe: string;
  recommendedAction: string;
}

export class AdvancedRiskService {
  private volatilityThreshold = 0.05;
  private correlationThreshold = 0.7;
  private liquidityThreshold = 0.3;
  private maxPortfolioRisk = 0.1;

  constructor() {}

  async assessOverallRisk(
    positions: any[],
    marketData: any,
    userRiskTolerance: number = 0.5
  ): Promise<RiskAssessment> {
    const [
      positionRisk,
      portfolioRisk,
      liquidityRisk,
      correlationRisk,
      blackSwanProb
    ] = await Promise.all([
      this.calculatePositionRisk(positions, marketData),
      this.calculatePortfolioRisk(positions),
      this.calculateLiquidityRisk(marketData),
      this.calculateCorrelationRisk(positions),
      this.assessBlackSwanProbability(marketData)
    ]);

    const overallRisk = this.calculateOverallRisk({
      positionRisk,
      portfolioRisk,
      liquidityRisk,
      correlationRisk,
      blackSwanProb
    });

    const recommendations = this.generateRiskRecommendations({
      positionRisk,
      portfolioRisk,
      liquidityRisk,
      correlationRisk,
      blackSwanProb,
      userRiskTolerance
    });

    // Record risk assessment
    await db.insert(riskMetrics).values({
      overallRisk,
      positionRisk,
      portfolioRisk,
      liquidityRisk,
      correlationRisk,
      blackSwanProbability: blackSwanProb,
      recommendations: recommendations.join('; '),
      marketData,
      timestamp: new Date()
    });

    return {
      overallRisk,
      positionRisk,
      portfolioRisk,
      liquidityRisk,
      correlationRisk,
      blackSwanProbability: blackSwanProb,
      recommendations
    };
  }

  async calculateDynamicPositionSize(
    symbol: string,
    confidence: number,
    marketConditions: any,
    currentPortfolio: any[],
    userRiskTolerance: number = 0.5
  ): Promise<DynamicPositionSize> {
    const baseSize = 0.02; // 2% base position size
    const adjustments: any = {};
    const reasoning: string[] = [];

    // Volatility adjustment
    const volatilityMultiplier = this.calculateVolatilityMultiplier(marketConditions.volatility);
    adjustments.volatility = volatilityMultiplier;
    reasoning.push(`Volatility adjustment: ${(volatilityMultiplier * 100).toFixed(0)}% (volatility: ${(marketConditions.volatility * 100).toFixed(1)}%)`);

    // Confidence adjustment
    const confidenceMultiplier = 0.5 + (confidence * 0.5);
    adjustments.confidence = confidenceMultiplier;
    reasoning.push(`Confidence adjustment: ${(confidenceMultiplier * 100).toFixed(0)}% (confidence: ${(confidence * 100).toFixed(0)}%)`);

    // Correlation adjustment
    const correlationMultiplier = await this.calculateCorrelationMultiplier(symbol, currentPortfolio);
    adjustments.correlation = correlationMultiplier;
    reasoning.push(`Correlation adjustment: ${(correlationMultiplier * 100).toFixed(0)}% (diversification benefit)`);

    // Liquidity adjustment
    const liquidityMultiplier = this.calculateLiquidityMultiplier(marketConditions.liquidity);
    adjustments.liquidity = liquidityMultiplier;
    reasoning.push(`Liquidity adjustment: ${(liquidityMultiplier * 100).toFixed(0)}% (market depth)`);

    // Risk tolerance adjustment
    const riskToleranceMultiplier = 0.5 + (userRiskTolerance * 0.5);
    adjustments.riskTolerance = riskToleranceMultiplier;

    // Calculate final size
    const recommendedSize = baseSize * 
      volatilityMultiplier * 
      confidenceMultiplier * 
      correlationMultiplier * 
      liquidityMultiplier * 
      riskToleranceMultiplier;

    const maxSize = Math.min(0.05, baseSize * 2 * riskToleranceMultiplier); // 5% absolute max

    return {
      recommendedSize: Math.min(recommendedSize, maxSize),
      maxSize,
      reasoning,
      riskAdjustments: adjustments
    };
  }

  async detectBlackSwanEvent(marketData: any): Promise<BlackSwanSignal> {
    const indicators: string[] = [];
    let probability = 0;

    // Extreme volatility spike
    if (marketData.volatility > this.volatilityThreshold * 3) {
      probability += 0.3;
      indicators.push(`Extreme volatility: ${(marketData.volatility * 100).toFixed(1)}%`);
    }

    // Unusual volume patterns
    if (marketData.volumeSpike > 5) {
      probability += 0.2;
      indicators.push(`Volume spike: ${marketData.volumeSpike}x normal`);
    }

    // Multiple correlation breakdowns
    const correlationBreakdowns = await this.detectCorrelationBreakdowns();
    if (correlationBreakdowns > 3) {
      probability += 0.3;
      indicators.push(`${correlationBreakdowns} correlation breakdowns detected`);
    }

    // Liquidity crunch
    if (marketData.liquidityRatio < 0.2) {
      probability += 0.2;
      indicators.push(`Liquidity crisis: ${(marketData.liquidityRatio * 100).toFixed(1)}% of normal`);
    }

    // News sentiment extreme
    if (marketData.fearGreedIndex < 10 || marketData.fearGreedIndex > 90) {
      probability += 0.1;
      indicators.push(`Extreme sentiment: Fear & Greed at ${marketData.fearGreedIndex}`);
    }

    // Determine severity and action
    let severity: 'low' | 'medium' | 'high' | 'extreme';
    let recommendedAction: string;

    if (probability < 0.2) {
      severity = 'low';
      recommendedAction = 'Continue normal operations with standard risk management';
    } else if (probability < 0.5) {
      severity = 'medium';
      recommendedAction = 'Reduce position sizes by 25%, tighten stop losses';
    } else if (probability < 0.8) {
      severity = 'high';
      recommendedAction = 'Reduce position sizes by 50%, consider hedging positions';
    } else {
      severity = 'extreme';
      recommendedAction = 'Emergency risk reduction: close non-essential positions immediately';
    }

    // Record black swan event
    if (probability > 0.3) {
      await db.insert(riskEvents).values({
        eventType: 'black_swan_signal',
        severity,
        probability,
        indicators: indicators.join('; '),
        marketData,
        recommendedAction,
        timestamp: new Date()
      });
    }

    return {
      probability,
      severity,
      indicators,
      timeframe: this.estimateEventTimeframe(probability),
      recommendedAction
    };
  }

  async updatePortfolioCorrelations(positions: any[]): Promise<void> {
    const symbols = positions.map(p => p.symbol);
    const correlationMatrix: any = {};

    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const correlation = await this.calculatePairCorrelation(symbols[i], symbols[j]);
        
        await db.insert(portfolioCorrelations).values({
          symbol1: symbols[i],
          symbol2: symbols[j],
          correlation,
          timeframe: '7d',
          timestamp: new Date()
        }).onConflictDoUpdate({
          target: [portfolioCorrelations.symbol1, portfolioCorrelations.symbol2],
          set: {
            correlation,
            timestamp: new Date()
          }
        });

        correlationMatrix[`${symbols[i]}_${symbols[j]}`] = correlation;
      }
    }
  }

  async getLiquidityAwareOrderSize(
    symbol: string,
    desiredSize: number,
    marketDepth: any
  ): Promise<{ recommendedSize: number; executionStrategy: string; estimatedSlippage: number }> {
    const availableLiquidity = marketDepth.bids.reduce((sum: number, bid: any) => sum + bid.quantity, 0);
    const maxLiquidSize = availableLiquidity * 0.1; // Max 10% of available liquidity

    let recommendedSize = Math.min(desiredSize, maxLiquidSize);
    let executionStrategy = 'market_order';
    let estimatedSlippage = 0;

    if (desiredSize > maxLiquidSize * 0.5) {
      // Large order - use TWAP
      executionStrategy = 'twap_5min';
      estimatedSlippage = this.calculateTWAPSlippage(desiredSize, marketDepth);
      reasoning: [`Large order detected, using TWAP execution over 5 minutes`];
    } else if (desiredSize > maxLiquidSize * 0.2) {
      // Medium order - use limit order
      executionStrategy = 'limit_order_aggressive';
      estimatedSlippage = this.calculateLimitOrderSlippage(desiredSize, marketDepth);
    } else {
      // Small order - market order is fine
      estimatedSlippage = this.calculateMarketOrderSlippage(desiredSize, marketDepth);
    }

    return {
      recommendedSize,
      executionStrategy,
      estimatedSlippage
    };
  }

  private async calculatePositionRisk(positions: any[], marketData: any): Promise<number> {
    if (positions.length === 0) return 0;

    const positionRisks = positions.map(position => {
      const size = Math.abs(position.size || 0);
      const volatility = marketData[position.symbol]?.volatility || 0.02;
      return size * volatility;
    });

    return positionRisks.reduce((sum, risk) => sum + risk, 0) / positions.length;
  }

  private async calculatePortfolioRisk(positions: any[]): Promise<number> {
    if (positions.length === 0) return 0;

    const totalValue = positions.reduce((sum, pos) => sum + Math.abs(pos.value || 0), 0);
    const concentration = Math.max(...positions.map(pos => Math.abs(pos.value || 0))) / totalValue;
    
    return Math.min(1, concentration + (positions.length > 5 ? 0 : (5 - positions.length) * 0.1));
  }

  private async calculateLiquidityRisk(marketData: any): Promise<number> {
    const averageLiquidity = Object.values(marketData)
      .map((data: any) => data.liquidity || 0.5)
      .reduce((sum: number, liq: number) => sum + liq, 0) / Object.keys(marketData).length;

    return 1 - averageLiquidity;
  }

  private async calculateCorrelationRisk(positions: any[]): Promise<number> {
    if (positions.length < 2) return 0;

    const correlations = await db
      .select()
      .from(portfolioCorrelations)
      .where(gte(portfolioCorrelations.timestamp, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));

    if (correlations.length === 0) return 0.5;

    const highCorrelations = correlations.filter(c => Math.abs(c.correlation) > this.correlationThreshold);
    return highCorrelations.length / correlations.length;
  }

  private async assessBlackSwanProbability(marketData: any): Promise<number> {
    let probability = 0;

    // Check for extreme conditions
    const volatilities = Object.values(marketData).map((data: any) => data.volatility || 0);
    const maxVolatility = Math.max(...volatilities);
    
    if (maxVolatility > this.volatilityThreshold * 2) {
      probability += 0.3;
    }

    return Math.min(1, probability);
  }

  private calculateOverallRisk(risks: any): number {
    const weights = {
      positionRisk: 0.3,
      portfolioRisk: 0.25,
      liquidityRisk: 0.2,
      correlationRisk: 0.15,
      blackSwanProb: 0.1
    };

    return (
      risks.positionRisk * weights.positionRisk +
      risks.portfolioRisk * weights.portfolioRisk +
      risks.liquidityRisk * weights.liquidityRisk +
      risks.correlationRisk * weights.correlationRisk +
      risks.blackSwanProb * weights.blackSwanProb
    );
  }

  private generateRiskRecommendations(risks: any): string[] {
    const recommendations: string[] = [];

    if (risks.positionRisk > 0.1) {
      recommendations.push('Consider reducing individual position sizes');
    }

    if (risks.portfolioRisk > 0.3) {
      recommendations.push('Diversify portfolio - high concentration detected');
    }

    if (risks.correlationRisk > 0.6) {
      recommendations.push('Reduce correlated positions to improve diversification');
    }

    if (risks.liquidityRisk > 0.4) {
      recommendations.push('Be cautious with position sizes in low liquidity conditions');
    }

    if (risks.blackSwanProb > 0.3) {
      recommendations.push('Consider hedging positions - elevated tail risk detected');
    }

    return recommendations;
  }

  private calculateVolatilityMultiplier(volatility: number): number {
    // Inverse relationship - higher volatility = smaller positions
    return Math.max(0.3, Math.min(1.5, 1 - (volatility - 0.02) * 10));
  }

  private async calculateCorrelationMultiplier(symbol: string, portfolio: any[]): Promise<number> {
    if (portfolio.length === 0) return 1;

    const correlations = await Promise.all(
      portfolio.map(pos => this.calculatePairCorrelation(symbol, pos.symbol))
    );

    const avgCorrelation = correlations.reduce((sum, corr) => sum + Math.abs(corr), 0) / correlations.length;
    return Math.max(0.5, 1 - avgCorrelation * 0.5); // Reduce size for highly correlated assets
  }

  private calculateLiquidityMultiplier(liquidity: number): number {
    return Math.max(0.5, Math.min(1.2, liquidity));
  }

  private async calculatePairCorrelation(symbol1: string, symbol2: string): Promise<number> {
    // In a real implementation, this would calculate correlation from price data
    // For now, return a reasonable default
    if (symbol1 === symbol2) return 1;
    
    // Simple heuristic based on asset types
    if ((symbol1.includes('BTC') && symbol2.includes('ETH')) ||
        (symbol1.includes('ETH') && symbol2.includes('BTC'))) {
      return 0.7; // High correlation between major cryptos
    }
    
    return 0.3; // Default moderate correlation
  }

  private async detectCorrelationBreakdowns(): Promise<number> {
    const recentCorrelations = await db
      .select()
      .from(portfolioCorrelations)
      .where(gte(portfolioCorrelations.timestamp, new Date(Date.now() - 24 * 60 * 60 * 1000)));

    const breakdowns = recentCorrelations.filter(c => 
      Math.abs(c.correlation) < 0.1 && 
      Math.abs(c.correlation) > 0.5 // Significant change from expected correlation
    );

    return breakdowns.length;
  }

  private estimateEventTimeframe(probability: number): string {
    if (probability > 0.8) return '1-6 hours';
    if (probability > 0.5) return '6-24 hours';
    if (probability > 0.3) return '1-3 days';
    return '3-7 days';
  }

  private calculateTWAPSlippage(size: number, marketDepth: any): number {
    // TWAP typically reduces slippage
    const baseSlippage = size / marketDepth.totalLiquidity;
    return baseSlippage * 0.3;
  }

  private calculateLimitOrderSlippage(size: number, marketDepth: any): number {
    const baseSlippage = size / marketDepth.totalLiquidity;
    return baseSlippage * 0.5;
  }

  private calculateMarketOrderSlippage(size: number, marketDepth: any): number {
    return size / marketDepth.totalLiquidity;
  }
}

export default AdvancedRiskService;