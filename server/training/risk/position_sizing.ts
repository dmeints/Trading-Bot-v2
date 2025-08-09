/**
 * Position Sizing and Risk Management
 * Implements Kelly Criterion, volatility scaling, and portfolio-level risk controls
 */

import { logger } from '../../utils/logger';

export interface PositionSizingConfig {
  max_position_pct: number;
  kelly_fraction_cap: number;
  daily_loss_limit: number;
  consecutive_loss_limit: number;
  volatility_scaling: boolean;
}

export interface TradeSignal {
  symbol: string;
  direction: 1 | -1;
  confidence: number;
  expected_return: number;
  win_probability: number;
  avg_win: number;
  avg_loss: number;
  volatility: number;
}

export interface RiskMetrics {
  current_positions: { [symbol: string]: number };
  portfolio_value: number;
  daily_pnl: number;
  consecutive_losses: number;
  max_drawdown: number;
  var_95: number; // Value at Risk 95%
}

export interface PositionSize {
  symbol: string;
  direction: 1 | -1;
  size_pct: number;
  size_usd: number;
  reasoning: string;
  risk_level: 'low' | 'medium' | 'high';
  kelly_fraction: number;
  volatility_adjustment: number;
}

export class PositionSizingEngine {
  private config: PositionSizingConfig;
  private readonly MAX_SINGLE_POSITION = 0.10; // Never more than 10% in any single position
  
  constructor(config: PositionSizingConfig) {
    this.config = config;
  }
  
  calculateOptimalSize(
    signal: TradeSignal,
    riskMetrics: RiskMetrics
  ): PositionSize | null {
    
    logger.debug('[PositionSizing] Calculating optimal size', { 
      symbol: signal.symbol,
      direction: signal.direction,
      confidence: signal.confidence
    });
    
    // Check risk controls first
    if (!this.passesRiskChecks(signal, riskMetrics)) {
      return null;
    }
    
    // Calculate base Kelly fraction
    const kellyFraction = this.calculateKellyFraction(signal);
    
    // Apply volatility scaling if enabled
    const volatilityAdjustment = this.config.volatility_scaling ? 
      this.calculateVolatilityAdjustment(signal.volatility) : 1.0;
    
    // Calculate raw position size
    let rawSize = kellyFraction * this.config.kelly_fraction_cap * volatilityAdjustment;
    
    // Apply position limits
    const finalSize = this.applyPositionLimits(rawSize, signal, riskMetrics);
    
    // Determine risk level
    const riskLevel = this.assessRiskLevel(finalSize, signal);
    
    const positionSize: PositionSize = {
      symbol: signal.symbol,
      direction: signal.direction,
      size_pct: finalSize,
      size_usd: finalSize * riskMetrics.portfolio_value,
      reasoning: this.generateReasoning(kellyFraction, volatilityAdjustment, finalSize),
      risk_level: riskLevel,
      kelly_fraction: kellyFraction,
      volatility_adjustment: volatilityAdjustment
    };
    
    logger.info('[PositionSizing] Position sized', {
      symbol: signal.symbol,
      direction: signal.direction === 1 ? 'BUY' : 'SELL',
      size_pct: (finalSize * 100).toFixed(2) + '%',
      size_usd: '$' + Math.round(positionSize.size_usd),
      risk_level: riskLevel,
      kelly: (kellyFraction * 100).toFixed(2) + '%'
    });
    
    return positionSize;
  }
  
  private calculateKellyFraction(signal: TradeSignal): number {
    // Kelly Criterion: f = (bp - q) / b
    // where b = avg_win/avg_loss, p = win_probability, q = 1-p
    
    const b = Math.abs(signal.avg_win / signal.avg_loss);
    const p = signal.win_probability;
    const q = 1 - p;
    
    if (b <= 0 || p <= 0 || p >= 1) {
      return 0; // Invalid parameters
    }
    
    const kellyFraction = (b * p - q) / b;
    
    // Kelly should be positive for a good bet
    return Math.max(0, kellyFraction);
  }
  
  private calculateVolatilityAdjustment(volatility: number): number {
    // Reduce position size in high volatility environments
    // Normal crypto volatility ~2-5%, extreme >10%
    
    if (volatility <= 0.02) {
      return 1.2; // Low vol: increase size by 20%
    } else if (volatility <= 0.05) {
      return 1.0; // Normal vol: no adjustment
    } else if (volatility <= 0.10) {
      return 0.7; // High vol: reduce by 30%
    } else {
      return 0.4; // Extreme vol: reduce by 60%
    }
  }
  
  private applyPositionLimits(
    rawSize: number, 
    signal: TradeSignal, 
    riskMetrics: RiskMetrics
  ): number {
    
    let limitedSize = rawSize;
    
    // Apply configuration maximum
    limitedSize = Math.min(limitedSize, this.config.max_position_pct);
    
    // Apply absolute maximum (safety)
    limitedSize = Math.min(limitedSize, this.MAX_SINGLE_POSITION);
    
    // Check current exposure to this symbol
    const currentExposure = Math.abs(riskMetrics.current_positions[signal.symbol] || 0);
    const newTotalExposure = currentExposure + limitedSize;
    
    if (newTotalExposure > this.MAX_SINGLE_POSITION) {
      limitedSize = Math.max(0, this.MAX_SINGLE_POSITION - currentExposure);
    }
    
    // Portfolio concentration limits
    const totalExposure = Object.values(riskMetrics.current_positions)
      .reduce((sum, pos) => sum + Math.abs(pos), 0);
    
    if (totalExposure + limitedSize > 0.8) { // Max 80% portfolio exposure
      limitedSize = Math.max(0, 0.8 - totalExposure);
    }
    
    return limitedSize;
  }
  
  private passesRiskChecks(signal: TradeSignal, riskMetrics: RiskMetrics): boolean {
    // Daily loss limit check
    if (riskMetrics.daily_pnl < -this.config.daily_loss_limit * riskMetrics.portfolio_value) {
      logger.warn('[PositionSizing] Daily loss limit exceeded', { 
        daily_pnl: riskMetrics.daily_pnl,
        limit: -this.config.daily_loss_limit * riskMetrics.portfolio_value
      });
      return false;
    }
    
    // Consecutive losses check
    if (riskMetrics.consecutive_losses >= this.config.consecutive_loss_limit) {
      logger.warn('[PositionSizing] Consecutive loss limit exceeded', {
        consecutive_losses: riskMetrics.consecutive_losses,
        limit: this.config.consecutive_loss_limit
      });
      return false;
    }
    
    // Minimum confidence threshold
    if (signal.confidence < 0.55) {
      logger.debug('[PositionSizing] Signal confidence too low', {
        symbol: signal.symbol,
        confidence: signal.confidence,
        threshold: 0.55
      });
      return false;
    }
    
    // Kelly fraction should be positive
    const kelly = this.calculateKellyFraction(signal);
    if (kelly <= 0) {
      logger.debug('[PositionSizing] Kelly fraction not positive', {
        symbol: signal.symbol,
        kelly: kelly
      });
      return false;
    }
    
    return true;
  }
  
  private assessRiskLevel(sizePercent: number, signal: TradeSignal): 'low' | 'medium' | 'high' {
    if (sizePercent <= 0.02 || signal.volatility <= 0.02) {
      return 'low';
    } else if (sizePercent <= 0.05 || signal.volatility <= 0.05) {
      return 'medium';
    } else {
      return 'high';
    }
  }
  
  private generateReasoning(
    kellyFraction: number, 
    volatilityAdjustment: number, 
    finalSize: number
  ): string {
    
    const components: string[] = [];
    
    components.push(`Kelly: ${(kellyFraction * 100).toFixed(1)}%`);
    components.push(`Cap: ${(this.config.kelly_fraction_cap * 100).toFixed(0)}%`);
    
    if (volatilityAdjustment !== 1.0) {
      components.push(`Vol adj: ${(volatilityAdjustment * 100).toFixed(0)}%`);
    }
    
    components.push(`Final: ${(finalSize * 100).toFixed(2)}%`);
    
    return components.join(', ');
  }
  
  // Advanced position sizing methods
  
  calculatePortfolioHeatMap(
    positions: { [symbol: string]: number },
    volatilities: { [symbol: string]: number }
  ): { symbol: string, risk_contribution: number, diversification_ratio: number }[] {
    
    const heatMap: { symbol: string, risk_contribution: number, diversification_ratio: number }[] = [];
    
    // Calculate total portfolio volatility
    let portfolioVariance = 0;
    const symbols = Object.keys(positions);
    
    for (const symbol1 of symbols) {
      for (const symbol2 of symbols) {
        const weight1 = positions[symbol1];
        const weight2 = positions[symbol2];
        const vol1 = volatilities[symbol1] || 0.02;
        const vol2 = volatilities[symbol2] || 0.02;
        
        // Assume correlation of 0.7 for crypto pairs, 1.0 for same asset
        const correlation = symbol1 === symbol2 ? 1.0 : 0.7;
        
        portfolioVariance += weight1 * weight2 * vol1 * vol2 * correlation;
      }
    }
    
    const portfolioVolatility = Math.sqrt(portfolioVariance);
    
    // Calculate risk contribution for each position
    for (const symbol of symbols) {
      const weight = positions[symbol];
      const vol = volatilities[symbol] || 0.02;
      
      // Risk contribution = weight * (marginal contribution to risk)
      let marginalContribution = 0;
      for (const otherSymbol of symbols) {
        const otherWeight = positions[otherSymbol];
        const otherVol = volatilities[otherSymbol] || 0.02;
        const correlation = symbol === otherSymbol ? 1.0 : 0.7;
        
        marginalContribution += otherWeight * vol * otherVol * correlation;
      }
      
      const riskContribution = weight * marginalContribution / (portfolioVolatility || 0.01);
      const diversificationRatio = (weight * vol) / (portfolioVolatility || 0.01);
      
      heatMap.push({
        symbol,
        risk_contribution: riskContribution,
        diversification_ratio: diversificationRatio
      });
    }
    
    return heatMap.sort((a, b) => b.risk_contribution - a.risk_contribution);
  }
  
  suggestRebalancing(
    currentPositions: { [symbol: string]: number },
    targetPositions: { [symbol: string]: number },
    portfolioValue: number
  ): { symbol: string, action: 'buy' | 'sell', amount_usd: number }[] {
    
    const rebalancingActions: { symbol: string, action: 'buy' | 'sell', amount_usd: number }[] = [];
    
    // Get all unique symbols
    const allSymbols = new Set([...Object.keys(currentPositions), ...Object.keys(targetPositions)]);
    
    for (const symbol of allSymbols) {
      const current = currentPositions[symbol] || 0;
      const target = targetPositions[symbol] || 0;
      const difference = target - current;
      
      // Only suggest rebalancing if difference is significant (>1%)
      if (Math.abs(difference) > 0.01) {
        const amountUSD = Math.abs(difference) * portfolioValue;
        
        rebalancingActions.push({
          symbol,
          action: difference > 0 ? 'buy' : 'sell',
          amount_usd: amountUSD
        });
      }
    }
    
    return rebalancingActions.sort((a, b) => b.amount_usd - a.amount_usd);
  }
  
  // Stress testing
  stressTestPortfolio(
    positions: { [symbol: string]: number },
    scenarios: { name: string, price_changes: { [symbol: string]: number } }[]
  ): { scenario: string, portfolio_return: number, max_individual_loss: number }[] {
    
    const stressResults: { scenario: string, portfolio_return: number, max_individual_loss: number }[] = [];
    
    for (const scenario of scenarios) {
      let portfolioReturn = 0;
      let maxIndividualLoss = 0;
      
      for (const symbol of Object.keys(positions)) {
        const weight = positions[symbol];
        const priceChange = scenario.price_changes[symbol] || 0;
        const contribution = weight * priceChange;
        
        portfolioReturn += contribution;
        
        if (contribution < maxIndividualLoss) {
          maxIndividualLoss = contribution;
        }
      }
      
      stressResults.push({
        scenario: scenario.name,
        portfolio_return: portfolioReturn,
        max_individual_loss: maxIndividualLoss
      });
    }
    
    return stressResults.sort((a, b) => a.portfolio_return - b.portfolio_return);
  }
}