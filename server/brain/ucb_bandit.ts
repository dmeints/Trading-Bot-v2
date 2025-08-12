
/**
 * Upper Confidence Bound (UCB) Bandit for Strategy Selection
 * Balances exploration and exploitation in strategy allocation
 */

import { logger } from '../utils/logger';

export interface BanditArm {
  armId: string;
  name: string;
  totalReward: number;
  actionCount: number;
  averageReward: number;
  confidence: number;
  ucbScore: number;
  lastSelected: Date;
}

export interface BanditSelection {
  selectedArm: string;
  ucbScore: number;
  expectedReward: number;
  confidence: number;
  explorationBonus: number;
  allArmScores: Record<string, number>;
}

export interface UCBConfig {
  explorationConstant: number;  // UCB exploration parameter (typically √2)
  decayRate: number;           // Decay rate for old rewards
  minExplorationPeriod: number; // Minimum samples before exploitation
  confidenceLevel: number;     // Confidence level for bounds
  rewardWindow: number;        // Window for reward calculation
}

export class UCBBandit {
  private arms: Map<string, BanditArm> = new Map();
  private totalActions: number = 0;
  private selectionHistory: Array<{armId: string; reward: number; timestamp: Date}> = [];
  private config: UCBConfig;

  constructor(armIds: string[], config: Partial<UCBConfig> = {}) {
    this.config = {
      explorationConstant: Math.sqrt(2),
      decayRate: 0.99,
      minExplorationPeriod: 10,
      confidenceLevel: 0.95,
      rewardWindow: 100,
      ...config
    };

    // Initialize arms
    armIds.forEach(armId => {
      this.arms.set(armId, {
        armId,
        name: armId,
        totalReward: 0,
        actionCount: 0,
        averageReward: 0,
        confidence: 0,
        ucbScore: Infinity, // Start with infinite UCB to ensure exploration
        lastSelected: new Date(0)
      });
    });

    logger.info('[UCBBandit] Initialized bandit', {
      armCount: armIds.length,
      arms: armIds
    });
  }

  /**
   * Select arm using UCB strategy
   */
  selectArm(): BanditSelection {
    this.totalActions++;

    // During initial exploration, select arms round-robin
    if (this.totalActions <= this.arms.size * this.config.minExplorationPeriod) {
      return this.selectForExploration();
    }

    // Update UCB scores for all arms
    this.updateUCBScores();

    // Select arm with highest UCB score
    let bestArm: BanditArm | null = null;
    let bestScore = -Infinity;
    const allScores: Record<string, number> = {};

    for (const arm of this.arms.values()) {
      allScores[arm.armId] = arm.ucbScore;
      if (arm.ucbScore > bestScore) {
        bestScore = arm.ucbScore;
        bestArm = arm;
      }
    }

    if (!bestArm) {
      throw new Error('No valid arm found for selection');
    }

    const explorationBonus = this.calculateExplorationBonus(bestArm);

    const selection: BanditSelection = {
      selectedArm: bestArm.armId,
      ucbScore: bestArm.ucbScore,
      expectedReward: bestArm.averageReward,
      confidence: bestArm.confidence,
      explorationBonus,
      allArmScores: allScores
    };

    // Update selection timestamp
    bestArm.lastSelected = new Date();

    logger.debug('[UCBBandit] Selected arm', {
      arm: bestArm.armId,
      ucbScore: bestScore.toFixed(4),
      avgReward: bestArm.averageReward.toFixed(4),
      actionCount: bestArm.actionCount,
      explorationBonus: explorationBonus.toFixed(4)
    });

    return selection;
  }

  private selectForExploration(): BanditSelection {
    // Find arm with least selections for round-robin exploration
    let leastSelectedArm: BanditArm | null = null;
    let minCount = Infinity;

    for (const arm of this.arms.values()) {
      if (arm.actionCount < minCount) {
        minCount = arm.actionCount;
        leastSelectedArm = arm;
      }
    }

    if (!leastSelectedArm) {
      leastSelectedArm = Array.from(this.arms.values())[0];
    }

    return {
      selectedArm: leastSelectedArm.armId,
      ucbScore: Infinity,
      expectedReward: 0,
      confidence: 0,
      explorationBonus: Infinity,
      allArmScores: {}
    };
  }

  private updateUCBScores(): void {
    for (const arm of this.arms.values()) {
      if (arm.actionCount === 0) {
        arm.ucbScore = Infinity;
        continue;
      }

      // Apply decay to old rewards
      const decayedReward = this.calculateDecayedAverageReward(arm);
      
      // Calculate exploration bonus
      const explorationBonus = this.calculateExplorationBonus(arm);
      
      // UCB score = average reward + exploration bonus
      arm.ucbScore = decayedReward + explorationBonus;
      
      // Update confidence interval
      arm.confidence = this.calculateConfidenceInterval(arm);
    }
  }

  private calculateDecayedAverageReward(arm: BanditArm): number {
    // Get recent rewards for this arm
    const recentRewards = this.selectionHistory
      .filter(entry => entry.armId === arm.armId)
      .slice(-this.config.rewardWindow);

    if (recentRewards.length === 0) {
      return arm.averageReward;
    }

    // Apply exponential decay to rewards based on recency
    let weightedSum = 0;
    let totalWeight = 0;

    recentRewards.forEach((entry, index) => {
      const weight = Math.pow(this.config.decayRate, recentRewards.length - index - 1);
      weightedSum += entry.reward * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? weightedSum / totalWeight : arm.averageReward;
  }

  private calculateExplorationBonus(arm: BanditArm): number {
    if (arm.actionCount === 0 || this.totalActions === 0) {
      return Infinity;
    }

    // UCB exploration bonus
    return this.config.explorationConstant * 
           Math.sqrt(Math.log(this.totalActions) / arm.actionCount);
  }

  private calculateConfidenceInterval(arm: BanditArm): number {
    if (arm.actionCount < 2) {
      return 1.0; // Maximum uncertainty
    }

    // Hoeffding's inequality for confidence interval
    const t = Math.log(1 / (1 - this.config.confidenceLevel));
    return Math.sqrt(2 * t / arm.actionCount);
  }

  /**
   * Update arm with observed reward
   */
  updateReward(armId: string, reward: number): void {
    const arm = this.arms.get(armId);
    if (!arm) {
      throw new Error(`Unknown arm: ${armId}`);
    }

    // Update arm statistics
    arm.actionCount++;
    arm.totalReward += reward;
    arm.averageReward = arm.totalReward / arm.actionCount;

    // Store in history
    this.selectionHistory.push({
      armId,
      reward,
      timestamp: new Date()
    });

    // Maintain bounded history
    if (this.selectionHistory.length > this.config.rewardWindow * this.arms.size) {
      this.selectionHistory = this.selectionHistory.slice(-this.config.rewardWindow * this.arms.size);
    }

    logger.debug('[UCBBandit] Updated reward', {
      arm: armId,
      reward: reward.toFixed(4),
      avgReward: arm.averageReward.toFixed(4),
      actionCount: arm.actionCount
    });
  }

  /**
   * Add new arm to the bandit
   */
  addArm(armId: string, name?: string): void {
    if (this.arms.has(armId)) {
      logger.warn(`[UCBBandit] Arm ${armId} already exists`);
      return;
    }

    this.arms.set(armId, {
      armId,
      name: name || armId,
      totalReward: 0,
      actionCount: 0,
      averageReward: 0,
      confidence: 0,
      ucbScore: Infinity,
      lastSelected: new Date(0)
    });

    logger.info(`[UCBBandit] Added new arm: ${armId}`);
  }

  /**
   * Remove arm from the bandit
   */
  removeArm(armId: string): void {
    if (!this.arms.has(armId)) {
      logger.warn(`[UCBBandit] Arm ${armId} does not exist`);
      return;
    }

    this.arms.delete(armId);
    
    // Clean history
    this.selectionHistory = this.selectionHistory.filter(entry => entry.armId !== armId);
    
    logger.info(`[UCBBandit] Removed arm: ${armId}`);
  }

  /**
   * Get performance statistics for all arms
   */
  getArmStatistics(): BanditArm[] {
    return Array.from(this.arms.values())
      .sort((a, b) => b.averageReward - a.averageReward);
  }

  /**
   * Get bandit diagnostics
   */
  getDiagnostics(): {
    totalActions: number;
    armCount: number;
    bestArm: string;
    explorationRate: number;
    averageReward: number;
    rewardVariance: number;
  } {
    const armStats = this.getArmStatistics();
    const bestArm = armStats.length > 0 ? armStats[0].armId : 'none';
    
    // Calculate exploration rate (selections of non-best arm)
    const recentSelections = this.selectionHistory.slice(-50);
    const explorationSelections = recentSelections.filter(s => s.armId !== bestArm).length;
    const explorationRate = recentSelections.length > 0 ? explorationSelections / recentSelections.length : 0;
    
    // Calculate average reward and variance
    const recentRewards = recentSelections.map(s => s.reward);
    const averageReward = recentRewards.length > 0 
      ? recentRewards.reduce((sum, r) => sum + r, 0) / recentRewards.length 
      : 0;
    
    const rewardVariance = recentRewards.length > 1
      ? recentRewards.reduce((sum, r) => sum + (r - averageReward) ** 2, 0) / (recentRewards.length - 1)
      : 0;

    return {
      totalActions: this.totalActions,
      armCount: this.arms.size,
      bestArm,
      explorationRate,
      averageReward,
      rewardVariance
    };
  }

  /**
   * Reset bandit state
   */
  reset(): void {
    for (const arm of this.arms.values()) {
      arm.totalReward = 0;
      arm.actionCount = 0;
      arm.averageReward = 0;
      arm.confidence = 0;
      arm.ucbScore = Infinity;
      arm.lastSelected = new Date(0);
    }
    
    this.totalActions = 0;
    this.selectionHistory = [];
    
    logger.info('[UCBBandit] Reset bandit state');
  }
}

/**
 * Factory function for strategy selection bandit
 */
export function createStrategySelectionBandit(strategies: string[]): UCBBandit {
  return new UCBBandit(strategies, {
    explorationConstant: 1.414, // √2
    decayRate: 0.995,           // Slower decay for trading strategies
    minExplorationPeriod: 20,   // More exploration for strategies
    confidenceLevel: 0.95,      // High confidence
    rewardWindow: 200           // Larger window for strategy evaluation
  });
}
