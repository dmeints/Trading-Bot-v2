/**
 * Stevie Core - Main controller for Stevie's algorithm and personality
 * This is the single entry point that the main app interacts with
 */

import { 
  IStevieAlgorithm, 
  MarketData, 
  MarketAnalysis, 
  TradingSuggestion,
  AlgorithmConfig,
  AlgorithmPerformance
} from '../interfaces/IStevieAlgorithm';
import { ISteviePersonality, PersonalityConfig, PersonalityResponse } from '../interfaces/ISteviePersonality';
import { PersonalityEngine } from './PersonalityEngine';
import { DecisionEngine } from './DecisionEngine';
import { logger } from '../../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface StevieConfig {
  version: string;
  algorithm: AlgorithmConfig;
  personality: PersonalityConfig;
  experimental: boolean;
  fallbackVersion?: string;
}

export interface StevieResponse {
  message: string;
  tradingSuggestion?: TradingSuggestion;
  marketAnalysis?: MarketAnalysis;
  confidence: number;
  reasoning: string;
  personality: {
    tone: string;
    style: string;
  };
}

export interface StevieStatus {
  version: string;
  algorithm: {
    type: string;
    performance: AlgorithmPerformance;
    health: string;
  };
  personality: {
    traits: Record<string, number>;
    learning: boolean;
  };
  uptime: number;
  lastInteraction: Date;
}

/**
 * Main Stevie controller - isolates all Stevie functionality
 * The main app only interacts through this interface
 */
export class StevieCore {
  private config: StevieConfig;
  private algorithm: IStevieAlgorithm;
  private personality: ISteviePersonality;
  private decisionEngine: DecisionEngine;
  private startTime: Date;
  private lastInteraction: Date;
  private performanceHistory: AlgorithmPerformance[] = [];
  
  constructor(config?: Partial<StevieConfig>) {
    this.startTime = new Date();
    this.lastInteraction = new Date();
    this.config = this.mergeWithDefaults(config || {});
    this.initializeComponents();
  }

  /**
   * Main interface methods that the app uses
   */
  
  async processMessage(userId: string, message: string, context?: any): Promise<StevieResponse> {
    this.lastInteraction = new Date();
    
    try {
      logger.info('[StevieCore] Processing user message', { userId, messageLength: message.length });
      
      // Get personality response
      const personalityResponse = await this.personality.generateResponse(
        userId, 
        message, 
        context
      );
      
      // Check if this requires market analysis or trading suggestion
      const needsMarketData = this.shouldAnalyzeMarket(message);
      let marketAnalysis: MarketAnalysis | undefined;
      let tradingSuggestion: TradingSuggestion | undefined;
      
      if (needsMarketData && context?.marketData) {
        marketAnalysis = await this.algorithm.analyzeMarket(context.marketData);
        
        if (this.shouldSuggestTrade(message, marketAnalysis)) {
          tradingSuggestion = await this.algorithm.generateTradingSuggestion(
            userId,
            context.marketData,
            context
          );
        }
      }
      
      // Combine responses through decision engine
      const finalResponse = await this.decisionEngine.synthesizeResponse({
        personalityResponse,
        marketAnalysis,
        tradingSuggestion,
        userMessage: message,
        context
      });
      
      return finalResponse;
      
    } catch (error) {
      logger.error('[StevieCore] Error processing message', { error, userId });
      return this.getFallbackResponse(message);
    }
  }
  
  async analyzeMarket(symbol: string): Promise<MarketAnalysis> {
    this.lastInteraction = new Date();
    
    try {
      // This would get real market data - simplified for now
      const marketData: MarketData = await this.getCurrentMarketData(symbol);
      return await this.algorithm.analyzeMarket(marketData);
      
    } catch (error) {
      logger.error('[StevieCore] Error analyzing market', { error, symbol });
      throw new Error(`Failed to analyze market for ${symbol}`);
    }
  }
  
  async suggestTrade(userId: string, symbol: string, context?: any): Promise<TradingSuggestion> {
    this.lastInteraction = new Date();
    
    try {
      const marketData = await this.getCurrentMarketData(symbol);
      return await this.algorithm.generateTradingSuggestion(userId, marketData, context);
      
    } catch (error) {
      logger.error('[StevieCore] Error suggesting trade', { error, userId, symbol });
      throw new Error(`Failed to generate trade suggestion for ${symbol}`);
    }
  }
  
  getStatus(): StevieStatus {
    return {
      version: this.config.version,
      algorithm: {
        type: this.config.algorithm.type,
        performance: this.getLatestPerformance(),
        health: this.algorithm.getHealthStatus().status
      },
      personality: {
        traits: this.personality.getTraits(),
        learning: this.personality.isLearning()
      },
      uptime: Date.now() - this.startTime.getTime(),
      lastInteraction: this.lastInteraction
    };
  }

  /**
   * Configuration management - allows safe experimentation
   */
  
  async updateConfig(newConfig: Partial<StevieConfig>): Promise<void> {
    logger.info('[StevieCore] Updating configuration', { newConfig });
    
    try {
      const oldConfig = { ...this.config };
      this.config = { ...this.config, ...newConfig };
      
      // Validate new configuration
      if (!this.validateConfig(this.config)) {
        this.config = oldConfig;
        throw new Error('Invalid configuration - reverted to previous');
      }
      
      // Apply changes to components
      if (newConfig.algorithm) {
        await this.algorithm.updateConfig(this.config.algorithm);
      }
      
      if (newConfig.personality) {
        await this.personality.updateConfig(this.config.personality);
      }
      
      // Save configuration
      await this.saveConfig();
      
      logger.info('[StevieCore] Configuration updated successfully');
      
    } catch (error) {
      logger.error('[StevieCore] Failed to update configuration', { error });
      throw error;
    }
  }
  
  async loadConfigFromFile(configPath: string): Promise<void> {
    try {
      const configFile = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configFile);
      await this.updateConfig(config);
      
    } catch (error) {
      logger.error('[StevieCore] Failed to load config from file', { error, configPath });
      throw error;
    }
  }

  /**
   * Experimentation and A/B testing support
   */
  
  async switchToExperimentalVersion(version: string): Promise<void> {
    logger.warn('[StevieCore] Switching to experimental version', { version });
    
    const experimentalConfig = await this.loadExperimentalConfig(version);
    experimentalConfig.experimental = true;
    experimentalConfig.fallbackVersion = this.config.version;
    
    await this.updateConfig(experimentalConfig);
  }
  
  async rollbackToStable(): Promise<void> {
    if (!this.config.experimental || !this.config.fallbackVersion) {
      throw new Error('No stable version to rollback to');
    }
    
    logger.warn('[StevieCore] Rolling back to stable version', { 
      from: this.config.version, 
      to: this.config.fallbackVersion 
    });
    
    const stableConfig = await this.loadStableConfig(this.config.fallbackVersion);
    await this.updateConfig(stableConfig);
  }
  
  async comparePerformance(otherVersion: string, testData: MarketData[]): Promise<any> {
    // This would implement algorithm comparison
    // Return performance metrics comparison
    return {
      currentVersion: this.config.version,
      otherVersion,
      winner: 'current', // Based on actual performance
      metrics: {}
    };
  }

  /**
   * Private implementation methods
   */
  
  private mergeWithDefaults(config: Partial<StevieConfig>): StevieConfig {
    return {
      version: config.version || '1.0.0',
      algorithm: config.algorithm || this.getDefaultAlgorithmConfig(),
      personality: config.personality || this.getDefaultPersonalityConfig(),
      experimental: config.experimental || false,
      fallbackVersion: config.fallbackVersion
    };
  }
  
  private async initializeComponents(): Promise<void> {
    try {
      // Initialize personality engine
      this.personality = new PersonalityEngine(this.config.personality);
      await this.personality.initialize();
      
      // Initialize decision engine
      this.decisionEngine = new DecisionEngine({
        personality: this.personality,
        algorithmConfig: this.config.algorithm
      });
      
      // Algorithm initialization would depend on the factory pattern
      // For now, this is a placeholder
      logger.info('[StevieCore] Components initialized successfully');
      
    } catch (error) {
      logger.error('[StevieCore] Failed to initialize components', { error });
      throw error;
    }
  }
  
  private shouldAnalyzeMarket(message: string): boolean {
    const marketKeywords = [
      'price', 'trade', 'buy', 'sell', 'market', 'analysis', 
      'btc', 'eth', 'crypto', 'chart', 'trend'
    ];
    
    return marketKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }
  
  private shouldSuggestTrade(message: string, analysis: MarketAnalysis): boolean {
    const tradeKeywords = ['should i', 'recommend', 'suggest', 'buy', 'sell'];
    return tradeKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    ) && analysis.confidence > 0.6;
  }
  
  private async getCurrentMarketData(symbol: string): Promise<MarketData> {
    // This would integrate with the main app's market data service
    // Placeholder for now
    return {
      symbol,
      price: 50000, // Would be real data
      volume: 1000000,
      timestamp: new Date()
    };
  }
  
  private getFallbackResponse(message: string): StevieResponse {
    return {
      message: "I'm having some technical difficulties right now. Let me get back to you in a moment!",
      confidence: 0.1,
      reasoning: "Fallback response due to system error",
      personality: {
        tone: "apologetic",
        style: "brief"
      }
    };
  }
  
  private validateConfig(config: StevieConfig): boolean {
    // Implement configuration validation logic
    return true;
  }
  
  private async saveConfig(): Promise<void> {
    const configPath = path.join(__dirname, '../config/current.json');
    await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));
  }
  
  private getDefaultAlgorithmConfig(): AlgorithmConfig {
    return {
      version: '1.0.0',
      type: 'ensemble_hybrid',
      parameters: {},
      riskSettings: {},
      enabled: true
    };
  }
  
  private getDefaultPersonalityConfig(): PersonalityConfig {
    return {
      version: '1.0.0',
      traits: {},
      learning: true,
      adaptation_rate: 0.1
    };
  }
  
  private getLatestPerformance(): AlgorithmPerformance {
    if (this.performanceHistory.length === 0) {
      return {
        sharpeRatio: 0,
        totalReturn: 0,
        winRate: 0,
        maxDrawdown: 0,
        trades: 0,
        accuracy: 0,
        lastUpdated: new Date()
      };
    }
    return this.performanceHistory[this.performanceHistory.length - 1];
  }
  
  private async loadExperimentalConfig(version: string): Promise<StevieConfig> {
    // Load experimental configuration
    return this.config; // Placeholder
  }
  
  private async loadStableConfig(version: string): Promise<StevieConfig> {
    // Load stable configuration
    return this.config; // Placeholder
  }
}