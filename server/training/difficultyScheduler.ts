/**
 * PHASE 3: DIFFICULTY SCHEDULER - PROGRESSIVE COMPLEXITY SCALING
 * Automatically bumps version and injects progressive market challenges
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';

export interface DifficultyConfig {
  version: string;
  baseVersion: string;
  days: number;
  marketShocks: number;
  noiseLevel: number;
  slippageRate: number;
  volatilityMultiplier: number;
  adversarialEvents: string[];
  regimeChanges: number;
  liquidityConstraints: boolean;
}

export interface DifficultyProgression {
  currentLevel: number;
  maxLevel: number;
  progressionRate: number;
  plateauThreshold: number;
  adaptiveScaling: boolean;
}

export class DifficultyScheduler {
  private readonly configPath = './benchmark-results/difficulty-config.json';
  private readonly progressionPath = './benchmark-results/difficulty-progression.json';
  
  private defaultProgression: DifficultyProgression = {
    currentLevel: 1,
    maxLevel: 10,
    progressionRate: 0.1,
    plateauThreshold: 0.005, // 0.5% improvement threshold
    adaptiveScaling: true
  };

  async initialize(): Promise<void> {
    try {
      // Ensure directories exist
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      
      // Initialize progression if doesn't exist
      if (!await this.fileExists(this.progressionPath)) {
        await this.saveProgression(this.defaultProgression);
        logger.info('✅ Difficulty progression initialized');
      }
    } catch (error) {
      logger.error('Failed to initialize difficulty scheduler:', error);
    }
  }

  async getNextVersion(currentVersion: string, performanceImprovement: number): Promise<string> {
    const progression = await this.loadProgression();
    
    // Parse current version (e.g., "1.2.3" -> [1, 2, 3])
    const versionParts = currentVersion.split('.').map(Number);
    
    if (performanceImprovement > progression.plateauThreshold) {
      // Significant improvement - increment minor version
      versionParts[1] += 1;
      
      // Reset patch version
      if (versionParts.length > 2) {
        versionParts[2] = 0;
      }
      
      logger.info(`📈 Performance improved by ${(performanceImprovement * 100).toFixed(2)}% - upgrading version`);
    } else {
      // Minor or no improvement - increment patch version
      if (versionParts.length === 2) {
        versionParts.push(1);
      } else {
        versionParts[2] += 1;
      }
      
      logger.info(`🔄 Minor improvement ${(performanceImprovement * 100).toFixed(2)}% - patch upgrade`);
    }

    return versionParts.join('.');
  }

  async generateDifficultyConfig(version: string, basePerformance: number): Promise<DifficultyConfig> {
    const progression = await this.loadProgression();
    const versionParts = version.split('.').map(Number);
    
    // Calculate difficulty level based on version
    const majorVersion = versionParts[0];
    const minorVersion = versionParts[1] || 0;
    const patchVersion = versionParts[2] || 0;
    
    const difficultyLevel = majorVersion + (minorVersion * 0.1) + (patchVersion * 0.01);
    const normalizedLevel = Math.min(difficultyLevel, progression.maxLevel);
    
    // Base configuration
    let config: DifficultyConfig = {
      version,
      baseVersion: this.getBaseVersion(version),
      days: 7, // Start with 1 week
      marketShocks: 0,
      noiseLevel: 5, // 5% base noise
      slippageRate: 0.1, // 0.1% base slippage
      volatilityMultiplier: 1.0,
      adversarialEvents: [],
      regimeChanges: 0,
      liquidityConstraints: false
    };

    // Progressive difficulty scaling
    if (normalizedLevel >= 1.1) {
      config.days = Math.min(30, Math.floor(7 + (normalizedLevel - 1) * 3));
      config.marketShocks = Math.floor(normalizedLevel - 1);
      config.noiseLevel = Math.min(20, 5 + (normalizedLevel - 1) * 2);
      config.slippageRate = Math.min(0.5, 0.1 + (normalizedLevel - 1) * 0.05);
    }

    if (normalizedLevel >= 1.5) {
      config.volatilityMultiplier = 1.0 + (normalizedLevel - 1.5) * 0.2;
      config.adversarialEvents = this.generateAdversarialEvents(normalizedLevel);
    }

    if (normalizedLevel >= 2.0) {
      config.regimeChanges = Math.floor((normalizedLevel - 2) * 2) + 1;
      config.liquidityConstraints = true;
    }

    // Adaptive scaling based on performance
    if (progression.adaptiveScaling && basePerformance > 0.7) {
      // If performance is high, increase difficulty
      config.noiseLevel *= 1.2;
      config.slippageRate *= 1.1;
      config.volatilityMultiplier *= 1.1;
      
      logger.info(`🎯 High performance detected (${(basePerformance * 100).toFixed(1)}%) - increasing difficulty`);
    } else if (progression.adaptiveScaling && basePerformance < 0.3) {
      // If performance is low, slightly reduce difficulty
      config.noiseLevel *= 0.9;
      config.slippageRate *= 0.95;
      
      logger.info(`⚠️ Low performance detected (${(basePerformance * 100).toFixed(1)}%) - reducing difficulty`);
    }

    await this.saveDifficultyConfig(config);
    
    logger.info('🎲 Generated difficulty configuration', {
      version: config.version,
      level: normalizedLevel.toFixed(2),
      days: config.days,
      shocks: config.marketShocks,
      noise: config.noiseLevel + '%',
      slippage: (config.slippageRate * 100).toFixed(2) + '%'
    });

    return config;
  }

  private generateAdversarialEvents(difficultyLevel: number): string[] {
    const events: string[] = [];
    
    const possibleEvents = [
      'flash_crash',
      'pump_dump',
      'whale_manipulation',
      'exchange_outage',
      'regulatory_news',
      'fork_uncertainty',
      'liquidity_crisis',
      'margin_calls',
      'coordinated_shorts',
      'fake_news_spike'
    ];

    const numEvents = Math.min(Math.floor(difficultyLevel), possibleEvents.length);
    
    // Select random events based on difficulty level
    const shuffled = possibleEvents.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, numEvents);
  }

  private getBaseVersion(version: string): string {
    const parts = version.split('.');
    return parts.length > 1 ? `${parts[0]}.${parts[1]}` : version;
  }

  async updateProgression(newLevel: number, performanceChange: number): Promise<void> {
    const progression = await this.loadProgression();
    
    progression.currentLevel = Math.max(progression.currentLevel, newLevel);
    
    // Adjust progression rate based on performance
    if (performanceChange > progression.plateauThreshold * 2) {
      progression.progressionRate = Math.min(0.2, progression.progressionRate * 1.1);
    } else if (performanceChange < progression.plateauThreshold) {
      progression.progressionRate = Math.max(0.05, progression.progressionRate * 0.9);
    }

    await this.saveProgression(progression);
    logger.info('📊 Updated difficulty progression', {
      level: progression.currentLevel,
      rate: progression.progressionRate,
      change: (performanceChange * 100).toFixed(2) + '%'
    });
  }

  async injectMarketShock(config: DifficultyConfig, shockType: string): Promise<any> {
    const shockConfig: any = {
      type: shockType,
      timestamp: Date.now(),
      duration: 60 * 60 * 1000, // 1 hour
      intensity: 1.0
    };

    switch (shockType) {
      case 'flash_crash':
        shockConfig.priceImpact = -0.15; // -15% sudden drop
        shockConfig.volumeSpike = 5.0;
        shockConfig.duration = 15 * 60 * 1000; // 15 minutes
        break;
        
      case 'pump_dump':
        shockConfig.phases = [
          { type: 'pump', priceImpact: 0.25, duration: 30 * 60 * 1000 },
          { type: 'dump', priceImpact: -0.30, duration: 15 * 60 * 1000 }
        ];
        break;
        
      case 'whale_manipulation':
        shockConfig.orderBookImpact = 0.8; // Remove 80% of liquidity
        shockConfig.priceImpact = Math.random() > 0.5 ? 0.08 : -0.08;
        break;
        
      case 'exchange_outage':
        shockConfig.tradingHalt = true;
        shockConfig.duration = 2 * 60 * 60 * 1000; // 2 hours
        shockConfig.liquidityImpact = 0.5;
        break;
        
      case 'regulatory_news':
        shockConfig.sentimentImpact = -0.7;
        shockConfig.volatilityMultiplier = 2.0;
        shockConfig.duration = 6 * 60 * 60 * 1000; // 6 hours
        break;
        
      default:
        shockConfig.priceImpact = (Math.random() - 0.5) * 0.1; // ±5%
        shockConfig.volatilityMultiplier = 1.5;
    }

    logger.info(`💥 Injected ${shockType} shock`, {
      impact: shockConfig.priceImpact ? (shockConfig.priceImpact * 100).toFixed(1) + '%' : 'N/A',
      duration: (shockConfig.duration / (60 * 1000)).toFixed(0) + 'min'
    });

    return shockConfig;
  }

  async getVersionHistory(): Promise<Array<{ version: string; timestamp: number; performance: number }>> {
    try {
      const historyPath = './benchmark-results/version-history.json';
      if (await this.fileExists(historyPath)) {
        const data = await fs.readFile(historyPath, 'utf8');
        return JSON.parse(data);
      }
      return [];
    } catch (error) {
      logger.error('Failed to load version history:', error);
      return [];
    }
  }

  async updateVersionHistory(version: string, performance: number): Promise<void> {
    try {
      const history = await this.getVersionHistory();
      history.push({
        version,
        timestamp: Date.now(),
        performance
      });

      // Keep only last 50 versions
      if (history.length > 50) {
        history.splice(0, history.length - 50);
      }

      const historyPath = './benchmark-results/version-history.json';
      await fs.writeFile(historyPath, JSON.stringify(history, null, 2));
    } catch (error) {
      logger.error('Failed to update version history:', error);
    }
  }

  private async fileExists(filepath: string): Promise<boolean> {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  private async loadProgression(): Promise<DifficultyProgression> {
    try {
      if (await this.fileExists(this.progressionPath)) {
        const data = await fs.readFile(this.progressionPath, 'utf8');
        return { ...this.defaultProgression, ...JSON.parse(data) };
      }
      return this.defaultProgression;
    } catch (error) {
      logger.error('Failed to load progression config:', error);
      return this.defaultProgression;
    }
  }

  private async saveProgression(progression: DifficultyProgression): Promise<void> {
    try {
      await fs.writeFile(this.progressionPath, JSON.stringify(progression, null, 2));
    } catch (error) {
      logger.error('Failed to save progression config:', error);
    }
  }

  private async saveDifficultyConfig(config: DifficultyConfig): Promise<void> {
    try {
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      logger.error('Failed to save difficulty config:', error);
    }
  }

  // Utility methods for CLI integration
  async getCurrentDifficulty(): Promise<{ level: number; version: string; config: DifficultyConfig | null }> {
    const progression = await this.loadProgression();
    
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      const config = JSON.parse(configData);
      
      return {
        level: progression.currentLevel,
        version: config.version,
        config
      };
    } catch {
      return {
        level: progression.currentLevel,
        version: '1.0',
        config: null
      };
    }
  }

  async resetProgression(): Promise<void> {
    await this.saveProgression(this.defaultProgression);
    logger.info('🔄 Difficulty progression reset to default');
  }
}

export const difficultyScheduler = new DifficultyScheduler();