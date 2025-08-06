/**
 * Policy Engine - Risk Management & Trade Throttling
 * 
 * Implements configurable trade throttling based on:
 * - Confidence thresholds
 * - Loss streak detection  
 * - Daily trade limits
 * - Risk factor assessment
 */

import { storage } from "../storage";

export interface PolicyConfig {
  confMinThreshold: number;      // Minimum confidence to allow trades
  maxLossStreak: number;         // Max consecutive losses before cooldown
  cooldownMinutes: number;       // Cooldown duration after loss streak
  dailyTradeCap: number;         // Max trades per user per day
  riskFactorThreshold: number;   // Max risk multiplier
}

export interface TradeDecision {
  allowed: boolean;
  reason?: string;
  cooldownUntil?: Date;
  remainingTrades?: number;
}

export interface PolicyStatus {
  isActive: boolean;
  currentStreak: number;
  dailyTradesUsed: number;
  cooldownUntil?: Date;
  lastRiskAssessment: number;
}

export class PolicyEngine {
  private config: PolicyConfig;
  private userCooldowns: Map<string, Date> = new Map();
  private userStreaks: Map<string, number> = new Map();

  constructor() {
    this.config = {
      confMinThreshold: parseFloat(process.env.CONF_MIN_THRESHOLD || '0.85'),
      maxLossStreak: parseInt(process.env.MAX_LOSS_STREAK || '3'),
      cooldownMinutes: parseInt(process.env.COOLDOWN_MINUTES || '60'),
      dailyTradeCap: parseInt(process.env.DAILY_TRADE_CAP || '15'),
      riskFactorThreshold: parseFloat(process.env.RISK_FACTOR_THRESHOLD || '2.5'),
    };
  }

  /**
   * Evaluate if a trade should be allowed based on policy rules
   */
  async evaluateTradeDecision(
    userId: string,
    confidence: number,
    riskFactor: number = 1.0
  ): Promise<TradeDecision> {
    try {
      // Check confidence threshold
      if (confidence < this.config.confMinThreshold) {
        return {
          allowed: false,
          reason: `Confidence ${confidence.toFixed(3)} below threshold ${this.config.confMinThreshold}`,
        };
      }

      // Check risk factor
      if (riskFactor > this.config.riskFactorThreshold) {
        return {
          allowed: false,
          reason: `Risk factor ${riskFactor.toFixed(2)} exceeds threshold ${this.config.riskFactorThreshold}`,
        };
      }

      // Check cooldown status
      const cooldownUntil = this.userCooldowns.get(userId);
      if (cooldownUntil && cooldownUntil > new Date()) {
        return {
          allowed: false,
          reason: 'User in cooldown period after loss streak',
          cooldownUntil,
        };
      }

      // Check daily trade limit
      const dailyTrades = await this.getDailyTradeCount(userId);
      if (dailyTrades >= this.config.dailyTradeCap) {
        return {
          allowed: false,
          reason: `Daily trade limit reached (${dailyTrades}/${this.config.dailyTradeCap})`,
          remainingTrades: 0,
        };
      }

      // Trade approved
      return {
        allowed: true,
        remainingTrades: this.config.dailyTradeCap - dailyTrades - 1,
      };
    } catch (error) {
      console.error('Policy evaluation error:', error);
      return {
        allowed: false,
        reason: 'Policy evaluation failed - defaulting to deny',
      };
    }
  }

  /**
   * Update user's loss streak and activate cooldown if needed
   */
  async updateLossStreak(userId: string, isLoss: boolean): Promise<void> {
    const currentStreak = this.userStreaks.get(userId) || 0;

    if (isLoss) {
      const newStreak = currentStreak + 1;
      this.userStreaks.set(userId, newStreak);

      // Activate cooldown if streak threshold reached
      if (newStreak >= this.config.maxLossStreak) {
        const cooldownUntil = new Date(Date.now() + this.config.cooldownMinutes * 60 * 1000);
        this.userCooldowns.set(userId, cooldownUntil);
        
        // Reset streak after activating cooldown
        this.userStreaks.set(userId, 0);
        
        console.log(`[Policy] User ${userId} entered cooldown until ${cooldownUntil.toISOString()} after ${newStreak} losses`);
      }
    } else {
      // Reset streak on successful trade
      this.userStreaks.set(userId, 0);
      
      // Clear any existing cooldown on successful trade
      this.userCooldowns.delete(userId);
    }
  }

  /**
   * Get current policy status for a user
   */
  async getPolicyStatus(userId: string): Promise<PolicyStatus> {
    const dailyTrades = await this.getDailyTradeCount(userId);
    const currentStreak = this.userStreaks.get(userId) || 0;
    const cooldownUntil = this.userCooldowns.get(userId);
    
    // Get latest risk assessment from recent trades
    const recentTrades = await storage.getUserTrades(userId);
    const lastTrade = recentTrades[0];
    const lastRiskAssessment = lastTrade?.confidence || 0;

    return {
      isActive: cooldownUntil ? cooldownUntil > new Date() : false,
      currentStreak,
      dailyTradesUsed: dailyTrades,
      cooldownUntil: cooldownUntil && cooldownUntil > new Date() ? cooldownUntil : undefined,
      lastRiskAssessment,
    };
  }

  /**
   * Emergency stop - activate immediate cooldown for user
   */
  async emergencyStop(userId: string, durationMinutes: number = 240): Promise<void> {
    const cooldownUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
    this.userCooldowns.set(userId, cooldownUntil);
    
    console.log(`[Policy] Emergency stop activated for user ${userId} until ${cooldownUntil.toISOString()}`);
  }

  /**
   * Admin override - clear all restrictions for user
   */
  async adminOverride(userId: string): Promise<void> {
    this.userCooldowns.delete(userId);
    this.userStreaks.set(userId, 0);
    
    console.log(`[Policy] Admin override applied for user ${userId} - all restrictions cleared`);
  }

  /**
   * Update policy configuration
   */
  updateConfig(newConfig: Partial<PolicyConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[Policy] Configuration updated:', this.config);
  }

  /**
   * Get current policy configuration
   */
  getConfig(): PolicyConfig {
    return { ...this.config };
  }

  /**
   * Get daily trade count for user
   */
  private async getDailyTradeCount(userId: string): Promise<number> {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      const trades = await storage.getUserTrades(userId);
      return trades.filter(trade => {
        const tradeDate = new Date(trade.executedAt);
        return tradeDate >= startOfDay;
      }).length;
    } catch (error) {
      console.error('Error getting daily trade count:', error);
      return 0;
    }
  }

  /**
   * Get system-wide policy statistics
   */
  async getSystemStats(): Promise<{
    totalUsersOnCooldown: number;
    avgLossStreak: number;
    dailyTradesBlocked: number;
    confidenceBlockRate: number;
  }> {
    const now = new Date();
    const activeCooldowns = Array.from(this.userCooldowns.values()).filter(date => date > now);
    const avgLossStreak = Array.from(this.userStreaks.values()).reduce((a, b) => a + b, 0) / 
                         Math.max(this.userStreaks.size, 1);

    return {
      totalUsersOnCooldown: activeCooldowns.length,
      avgLossStreak: Math.round(avgLossStreak * 100) / 100,
      dailyTradesBlocked: 0, // TODO: Implement blocked trade counter
      confidenceBlockRate: 0, // TODO: Implement confidence block rate tracking
    };
  }
}

// Global policy engine instance
export const policyEngine = new PolicyEngine();