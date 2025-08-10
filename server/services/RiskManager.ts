import { logger } from '../utils/logger.js';

interface RiskParameters {
  maxPositionSize: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  concentrationLimit: number;
  volatilityThreshold: number;
}

interface RiskApproval {
  approved: boolean;
  reason?: string;
  maxSize: number;
  riskScore: number;
}

interface PortfolioRisk {
  currentDrawdown: number;
  dailyPnl: number;
  portfolioValue: number;
  var95: number; // Value at Risk 95%
  sharpeRatio: number;
}

export class RiskManager {
  private riskParams: RiskParameters;
  private portfolioRisk: PortfolioRisk;

  constructor() {
    this.riskParams = {
      maxPositionSize: 0.1, // 10% of portfolio per position
      maxDailyLoss: 0.05, // 5% maximum daily loss
      maxDrawdown: 0.15, // 15% maximum drawdown
      concentrationLimit: 0.25, // 25% maximum concentration in single asset
      volatilityThreshold: 0.5 // 50% volatility threshold
    };

    this.portfolioRisk = {
      currentDrawdown: 0,
      dailyPnl: 0,
      portfolioValue: 100000, // Starting portfolio value
      var95: 0,
      sharpeRatio: 0
    };

    logger.info('[RiskManager] Initialized with comprehensive risk controls');
  }

  async checkTradeRisk(signal: any): Promise<RiskApproval> {
    try {
      const riskChecks = [
        this.checkPositionSize(signal),
        this.checkDailyLossLimit(signal),
        this.checkDrawdownLimit(signal),
        this.checkConcentrationRisk(signal),
        this.checkVolatilityRisk(signal),
        this.checkMarketConditions(signal)
      ];

      const results = await Promise.all(riskChecks);
      const failed = results.find(r => !r.approved);

      if (failed) {
        return failed;
      }

      // Calculate final position size based on risk
      const maxSize = Math.min(...results.map(r => r.maxSize));
      const avgRiskScore = results.reduce((sum, r) => sum + r.riskScore, 0) / results.length;

      return {
        approved: true,
        maxSize,
        riskScore: avgRiskScore
      };

    } catch (error) {
      logger.error('[RiskManager] Error in risk check:', error);
      return {
        approved: false,
        reason: 'Risk check failed due to system error',
        maxSize: 0,
        riskScore: 1.0
      };
    }
  }

  private async checkPositionSize(signal: any): Promise<RiskApproval> {
    const requestedSize = signal.strength * this.riskParams.maxPositionSize;
    const maxAllowedSize = this.portfolioRisk.portfolioValue * this.riskParams.maxPositionSize;

    if (requestedSize > maxAllowedSize) {
      return {
        approved: false,
        reason: `Position size exceeds maximum allowed (${this.riskParams.maxPositionSize * 100}%)`,
        maxSize: maxAllowedSize,
        riskScore: 0.9
      };
    }

    return {
      approved: true,
      maxSize: requestedSize,
      riskScore: requestedSize / maxAllowedSize
    };
  }

  private async checkDailyLossLimit(signal: any): Promise<RiskApproval> {
    const dailyLossPercent = Math.abs(this.portfolioRisk.dailyPnl) / this.portfolioRisk.portfolioValue;

    if (dailyLossPercent >= this.riskParams.maxDailyLoss) {
      return {
        approved: false,
        reason: `Daily loss limit reached (${(dailyLossPercent * 100).toFixed(2)}%)`,
        maxSize: 0,
        riskScore: 1.0
      };
    }

    // Reduce position size as we approach daily loss limit
    const remainingCapacity = (this.riskParams.maxDailyLoss - dailyLossPercent) / this.riskParams.maxDailyLoss;
    const adjustedSize = signal.strength * this.portfolioRisk.portfolioValue * 0.05 * remainingCapacity;

    return {
      approved: true,
      maxSize: adjustedSize,
      riskScore: 1 - remainingCapacity
    };
  }

  private async checkDrawdownLimit(signal: any): Promise<RiskApproval> {
    if (this.portfolioRisk.currentDrawdown >= this.riskParams.maxDrawdown) {
      return {
        approved: false,
        reason: `Maximum drawdown limit reached (${(this.portfolioRisk.currentDrawdown * 100).toFixed(2)}%)`,
        maxSize: 0,
        riskScore: 1.0
      };
    }

    // Reduce position size as drawdown increases
    const drawdownFactor = 1 - (this.portfolioRisk.currentDrawdown / this.riskParams.maxDrawdown);
    const adjustedSize = signal.strength * this.portfolioRisk.portfolioValue * 0.05 * drawdownFactor;

    return {
      approved: true,
      maxSize: adjustedSize,
      riskScore: this.portfolioRisk.currentDrawdown / this.riskParams.maxDrawdown
    };
  }

  private async checkConcentrationRisk(signal: any): Promise<RiskApproval> {
    // In a real implementation, this would check actual portfolio concentration
    const currentConcentration = 0.1; // Mock current concentration
    
    if (currentConcentration >= this.riskParams.concentrationLimit) {
      return {
        approved: false,
        reason: `Asset concentration limit reached (${(currentConcentration * 100).toFixed(2)}%)`,
        maxSize: 0,
        riskScore: 0.9
      };
    }

    const remainingCapacity = this.riskParams.concentrationLimit - currentConcentration;
    const maxSize = this.portfolioRisk.portfolioValue * remainingCapacity;

    return {
      approved: true,
      maxSize,
      riskScore: currentConcentration / this.riskParams.concentrationLimit
    };
  }

  private async checkVolatilityRisk(signal: any): Promise<RiskApproval> {
    // Mock volatility calculation - in production would use real market data
    const currentVolatility = 0.3; // 30% volatility
    
    if (currentVolatility > this.riskParams.volatilityThreshold) {
      // Reduce position size in high volatility
      const volatilityAdjustment = this.riskParams.volatilityThreshold / currentVolatility;
      const adjustedSize = signal.strength * this.portfolioRisk.portfolioValue * 0.05 * volatilityAdjustment;

      return {
        approved: true,
        maxSize: adjustedSize,
        riskScore: currentVolatility / this.riskParams.volatilityThreshold
      };
    }

    return {
      approved: true,
      maxSize: signal.strength * this.portfolioRisk.portfolioValue * 0.05,
      riskScore: currentVolatility / this.riskParams.volatilityThreshold
    };
  }

  private async checkMarketConditions(signal: any): Promise<RiskApproval> {
    // Check for extreme market conditions
    const marketStress = 0.2; // Mock market stress indicator
    
    if (marketStress > 0.8) {
      return {
        approved: false,
        reason: 'Extreme market conditions detected',
        maxSize: 0,
        riskScore: 1.0
      };
    }

    // Adjust for market stress
    const stressAdjustment = 1 - marketStress;
    const adjustedSize = signal.strength * this.portfolioRisk.portfolioValue * 0.05 * stressAdjustment;

    return {
      approved: true,
      maxSize: adjustedSize,
      riskScore: marketStress
    };
  }

  async updatePortfolioRisk(portfolioData: any): Promise<void> {
    this.portfolioRisk = {
      currentDrawdown: portfolioData.drawdown || 0,
      dailyPnl: portfolioData.dailyPnl || 0,
      portfolioValue: portfolioData.totalValue || this.portfolioRisk.portfolioValue,
      var95: this.calculateVaR(portfolioData),
      sharpeRatio: portfolioData.sharpeRatio || 0
    };

    logger.debug('[RiskManager] Portfolio risk updated:', this.portfolioRisk);
  }

  private calculateVaR(portfolioData: any): number {
    // Simplified VaR calculation - in production would be more sophisticated
    const volatility = portfolioData.volatility || 0.2;
    const portfolioValue = portfolioData.totalValue || this.portfolioRisk.portfolioValue;
    
    // 95% VaR assuming normal distribution
    return portfolioValue * volatility * 1.645;
  }

  async getRiskMetrics(): Promise<any> {
    return {
      parameters: this.riskParams,
      current: this.portfolioRisk,
      limits: {
        positionSizeUtilization: 0.6, // Mock utilization
        dailyLossUtilization: Math.abs(this.portfolioRisk.dailyPnl) / (this.portfolioRisk.portfolioValue * this.riskParams.maxDailyLoss),
        drawdownUtilization: this.portfolioRisk.currentDrawdown / this.riskParams.maxDrawdown,
        concentrationUtilization: 0.4 // Mock concentration utilization
      }
    };
  }

  async updateRiskParameters(newParams: Partial<RiskParameters>): Promise<void> {
    this.riskParams = { ...this.riskParams, ...newParams };
    logger.info('[RiskManager] Risk parameters updated:', newParams);
  }

  async getStopLossPrice(entryPrice: number, side: 'buy' | 'sell', volatility: number = 0.2): Promise<number> {
    // Dynamic stop loss based on volatility
    const stopDistance = volatility * 2; // 2x volatility for stop distance
    
    if (side === 'buy') {
      return entryPrice * (1 - stopDistance);
    } else {
      return entryPrice * (1 + stopDistance);
    }
  }

  async getTakeProfitPrice(entryPrice: number, side: 'buy' | 'sell', riskRewardRatio: number = 2): Promise<number> {
    const volatility = 0.2; // Mock volatility
    const stopDistance = volatility * 2;
    const profitDistance = stopDistance * riskRewardRatio;
    
    if (side === 'buy') {
      return entryPrice * (1 + profitDistance);
    } else {
      return entryPrice * (1 - profitDistance);
    }
  }
}