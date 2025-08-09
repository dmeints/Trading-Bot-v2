/**
 * Main App Interface - Safe integration point for Stevie with the main trading platform
 * This is the ONLY file that the main app should import from the Stevie package
 */

import { StevieCore, StevieResponse, StevieStatus, StevieConfig } from '../core/StevieCore';
import { logger } from '../../utils/logger';

/**
 * Singleton Stevie instance manager
 * Provides safe, isolated access to Stevie functionality
 */
class StevieManager {
  private static instance: StevieManager;
  private stevieCore: StevieCore | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  
  private constructor() {}
  
  static getInstance(): StevieManager {
    if (!StevieManager.instance) {
      StevieManager.instance = new StevieManager();
    }
    return StevieManager.instance;
  }
  
  /**
   * Initialize Stevie with configuration
   */
  async initialize(config?: Partial<StevieConfig>): Promise<void> {
    if (this.isInitialized) return;
    
    if (this.initPromise) {
      return this.initPromise;
    }
    
    this.initPromise = this.doInitialize(config);
    await this.initPromise;
  }
  
  private async doInitialize(config?: Partial<StevieConfig>): Promise<void> {
    try {
      logger.info('[StevieManager] Initializing Stevie Algorithm Package');
      
      this.stevieCore = new StevieCore(config);
      await this.stevieCore.initialize();
      
      this.isInitialized = true;
      logger.info('[StevieManager] Stevie Algorithm Package initialized successfully');
      
    } catch (error) {
      logger.error('[StevieManager] Failed to initialize Stevie', { error });
      this.stevieCore = null;
      this.isInitialized = false;
      throw error;
    }
  }
  
  /**
   * Process user message through Stevie
   */
  async processMessage(userId: string, message: string, context?: any): Promise<StevieResponse> {
    await this.ensureInitialized();
    
    if (!this.stevieCore) {
      throw new Error('Stevie is not properly initialized');
    }
    
    return await this.stevieCore.processMessage(userId, message, context);
  }
  
  /**
   * Get market analysis from Stevie
   */
  async analyzeMarket(symbol: string): Promise<any> {
    await this.ensureInitialized();
    
    if (!this.stevieCore) {
      throw new Error('Stevie is not properly initialized');
    }
    
    return await this.stevieCore.analyzeMarket(symbol);
  }
  
  /**
   * Get trading suggestion from Stevie
   */
  async suggestTrade(userId: string, symbol: string, context?: any): Promise<any> {
    await this.ensureInitialized();
    
    if (!this.stevieCore) {
      throw new Error('Stevie is not properly initialized');
    }
    
    return await this.stevieCore.suggestTrade(userId, symbol, context);
  }
  
  /**
   * Get Stevie's current status
   */
  getStatus(): StevieStatus | null {
    if (!this.isInitialized || !this.stevieCore) {
      return null;
    }
    
    return this.stevieCore.getStatus();
  }
  
  /**
   * Update Stevie's configuration (hot-reload)
   */
  async updateConfiguration(newConfig: Partial<StevieConfig>): Promise<void> {
    await this.ensureInitialized();
    
    if (!this.stevieCore) {
      throw new Error('Stevie is not properly initialized');
    }
    
    logger.info('[StevieManager] Hot-reloading Stevie configuration');
    await this.stevieCore.updateConfig(newConfig);
    logger.info('[StevieManager] Configuration updated successfully');
  }
  
  /**
   * Switch to experimental version
   */
  async enableExperimentalMode(version: string): Promise<void> {
    await this.ensureInitialized();
    
    if (!this.stevieCore) {
      throw new Error('Stevie is not properly initialized');
    }
    
    logger.warn('[StevieManager] Enabling experimental mode', { version });
    await this.stevieCore.switchToExperimentalVersion(version);
  }
  
  /**
   * Rollback to stable version
   */
  async rollbackToStable(): Promise<void> {
    await this.ensureInitialized();
    
    if (!this.stevieCore) {
      throw new Error('Stevie is not properly initialized');
    }
    
    logger.warn('[StevieManager] Rolling back to stable version');
    await this.stevieCore.rollbackToStable();
  }
  
  /**
   * Gracefully shutdown Stevie
   */
  async shutdown(): Promise<void> {
    if (this.stevieCore) {
      logger.info('[StevieManager] Shutting down Stevie Algorithm Package');
      await this.stevieCore.shutdown();
      this.stevieCore = null;
    }
    
    this.isInitialized = false;
    this.initPromise = null;
  }
  
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
}

/**
 * Main App API - These are the ONLY functions the main app should use
 */

// Initialize Stevie (call this on app startup)
export const initializeStevie = async (config?: Partial<StevieConfig>): Promise<void> => {
  return await StevieManager.getInstance().initialize(config);
};

// Process user messages
export const processStevieMessage = async (userId: string, message: string, context?: any): Promise<StevieResponse> => {
  return await StevieManager.getInstance().processMessage(userId, message, context);
};

// Get market analysis
export const getStevieMarketAnalysis = async (symbol: string): Promise<any> => {
  return await StevieManager.getInstance().analyzeMarket(symbol);
};

// Get trading suggestions
export const getStevieTradeAdvice = async (userId: string, symbol: string, context?: any): Promise<any> => {
  return await StevieManager.getInstance().suggestTrade(userId, symbol, context);
};

// Get status
export const getStevieStatus = (): StevieStatus | null => {
  return StevieManager.getInstance().getStatus();
};

// Configuration management
export const updateStevieConfig = async (config: Partial<StevieConfig>): Promise<void> => {
  return await StevieManager.getInstance().updateConfiguration(config);
};

// Experimental features
export const enableStevieExperimentalMode = async (version: string): Promise<void> => {
  return await StevieManager.getInstance().enableExperimentalMode(version);
};

export const rollbackStevieToStable = async (): Promise<void> => {
  return await StevieManager.getInstance().rollbackToStable();
};

// Shutdown
export const shutdownStevie = async (): Promise<void> => {
  return await StevieManager.getInstance().shutdown();
};

/**
 * Types for main app usage
 */
export type { StevieResponse, StevieStatus, StevieConfig };