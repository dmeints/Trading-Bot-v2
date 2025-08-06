/**
 * Lazy Initialization Service
 * 
 * Provides on-demand initialization of AI services to avoid expensive
 * startup operations during deployment. Services are initialized only
 * when first requested via API endpoints.
 */

import { rlEngine } from '../engine/rl';

interface InitializationState {
  rlEngine: boolean;
  aiOrchestrator: boolean;
  initialAnalysis: boolean;
}

class LazyInitService {
  private initialized: InitializationState = {
    rlEngine: false,
    aiOrchestrator: false,
    initialAnalysis: false
  };

  private initializationPromises: Map<string, Promise<void>> = new Map();
  private isProduction = process.env.NODE_ENV === 'production';
  private aiServicesEnabled = process.env.AI_SERVICES_ENABLED !== 'false';

  /**
   * Initialize RL Engine lazily
   */
  async initializeRLEngine(): Promise<void> {
    if (this.initialized.rlEngine) return;

    const key = 'rlEngine';
    if (this.initializationPromises.has(key)) {
      return this.initializationPromises.get(key);
    }

    const initPromise = (async () => {
      try {
        console.log('[LazyInit] Initializing RL Engine...');
        await rlEngine.loadModel();
        this.initialized.rlEngine = true;
        console.log('[LazyInit] RL Engine initialized successfully');
      } catch (error) {
        console.error('[LazyInit] RL Engine initialization failed:', error);
        // Don't throw - allow other services to continue
      }
    })();

    this.initializationPromises.set(key, initPromise);
    await initPromise;
    this.initializationPromises.delete(key);
  }

  /**
   * Initialize AI Orchestrator lazily
   */
  async initializeAIOrchestrator(): Promise<void> {
    if (this.initialized.aiOrchestrator) return;

    const key = 'aiOrchestrator';
    if (this.initializationPromises.has(key)) {
      return this.initializationPromises.get(key);
    }

    const initPromise = (async () => {
      try {
        console.log('[LazyInit] Initializing AI Orchestrator...');
        // Import is enough - the aiOrchestrator instance is created on import
        await import('./aiAgents');
        this.initialized.aiOrchestrator = true;
        console.log('[LazyInit] AI Orchestrator initialized successfully');
      } catch (error) {
        console.error('[LazyInit] AI Orchestrator initialization failed:', error);
        // Don't throw - allow other services to continue
      }
    })();

    this.initializationPromises.set(key, initPromise);
    await initPromise;
    this.initializationPromises.delete(key);
  }

  /**
   * Run initial AI analysis (only if not in production or if explicitly enabled)
   */
  async runInitialAnalysis(): Promise<void> {
    if (this.initialized.initialAnalysis) return;
    if (this.isProduction && !this.aiServicesEnabled) {
      console.log('[LazyInit] Skipping initial AI analysis in production');
      return;
    }

    const key = 'initialAnalysis';
    if (this.initializationPromises.has(key)) {
      return this.initializationPromises.get(key);
    }

    const initPromise = (async () => {
      try {
        console.log('[LazyInit] Running initial AI analysis...');
        
        // Ensure AI orchestrator is initialized first
        await this.initializeAIOrchestrator();
        
        const { aiOrchestrator } = await import('./aiAgents');
        const { storage } = await import('../storage');
        
        // Get current market data
        const allMarketData = await storage.getAllMarketData();
        
        if (allMarketData.length > 0) {
          // Run all AI agents with market data
          const results = await aiOrchestrator.runAllAgents({
            marketData: allMarketData,
            timestamp: new Date().toISOString()
          });
          
          console.log(`[LazyInit] AI analysis complete. ${results.length} agents processed data.`);
        } else {
          console.log('[LazyInit] No market data available for initial analysis');
        }
        
        this.initialized.initialAnalysis = true;
      } catch (error) {
        console.error('[LazyInit] Initial AI analysis failed:', error);
        // Don't throw - this is optional initialization
      }
    })();

    this.initializationPromises.set(key, initPromise);
    await initPromise;
    this.initializationPromises.delete(key);
  }

  /**
   * Initialize all AI services (for backward compatibility)
   */
  async initializeAllServices(): Promise<void> {
    if (!this.aiServicesEnabled) {
      console.log('[LazyInit] AI services disabled via environment variable');
      return;
    }

    await Promise.all([
      this.initializeRLEngine(),
      this.initializeAIOrchestrator()
    ]);

    // Run initial analysis last, as it depends on other services
    await this.runInitialAnalysis();
  }

  /**
   * Check if a service is initialized
   */
  isServiceInitialized(service: keyof InitializationState): boolean {
    return this.initialized[service];
  }

  /**
   * Get initialization status
   */
  getStatus(): InitializationState & { aiServicesEnabled: boolean; isProduction: boolean } {
    return {
      ...this.initialized,
      aiServicesEnabled: this.aiServicesEnabled,
      isProduction: this.isProduction
    };
  }

  /**
   * Reset initialization state (for testing)
   */
  reset(): void {
    this.initialized = {
      rlEngine: false,
      aiOrchestrator: false,
      initialAnalysis: false
    };
    this.initializationPromises.clear();
  }
}

export const lazyInitService = new LazyInitService();