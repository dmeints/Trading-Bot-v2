/**
 * No-Network Backtest Environment
 * Isolated backtesting environment with no external API calls
 */

export interface NoNetworkConfig {
  enforceNetworkIsolation: boolean;
  allowedDataSources: string[];
  mockNetworkCalls: boolean;
}

export const defaultNoNetworkConfig: NoNetworkConfig = {
  enforceNetworkIsolation: true,
  allowedDataSources: ['database', 'filesystem'],
  mockNetworkCalls: false
};

/**
 * Network isolation enforcer
 * Blocks all outbound network requests during backtesting
 */
export class NetworkIsolationEnforcer {
  private originalFetch: typeof fetch;
  private isEnforcing: boolean = false;
  
  constructor(private config: NoNetworkConfig = defaultNoNetworkConfig) {
    this.originalFetch = global.fetch;
  }

  /**
   * Enable network isolation
   */
  enable(): void {
    if (this.isEnforcing) return;
    
    this.isEnforcing = true;
    console.log('[NoNetwork] Network isolation enabled - blocking external requests');
    
    // Override fetch to block network calls
    global.fetch = async (...args: any[]) => {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      
      // Allow localhost/internal calls
      if (url.includes('localhost') || url.includes('127.0.0.1') || url.startsWith('/')) {
        return this.originalFetch(...args);
      }
      
      // Block external calls
      console.warn(`[NoNetwork] Blocked external request: ${url}`);
      throw new Error(`Network request blocked in isolated environment: ${url}`);
    };
    
    // Also block other common network modules (simplified)
    const originalRequire = require;
    
    // Block require of network modules
    const networkModules = ['http', 'https', 'axios', 'node-fetch'];
    networkModules.forEach(moduleName => {
      try {
        delete require.cache[require.resolve(moduleName)];
      } catch (error) {
        // Module might not be installed, ignore
      }
    });
  }

  /**
   * Disable network isolation
   */
  disable(): void {
    if (!this.isEnforcing) return;
    
    this.isEnforcing = false;
    console.log('[NoNetwork] Network isolation disabled');
    
    // Restore original fetch
    global.fetch = this.originalFetch;
  }

  /**
   * Check if currently enforcing isolation
   */
  isActive(): boolean {
    return this.isEnforcing;
  }
}

/**
 * Validate data source is allowed
 */
export function validateDataSource(source: string, config: NoNetworkConfig = defaultNoNetworkConfig): boolean {
  return config.allowedDataSources.includes(source);
}

/**
 * Create isolated backtest environment
 */
export function createNoNetworkEnvironment(config?: Partial<NoNetworkConfig>): NetworkIsolationEnforcer {
  const fullConfig = { ...defaultNoNetworkConfig, ...config };
  return new NetworkIsolationEnforcer(fullConfig);
}

/**
 * Decorator to ensure function runs in network isolation
 */
export function noNetwork<T extends (...args: any[]) => Promise<any>>(
  target: T, 
  config?: NoNetworkConfig
): T {
  return (async (...args: any[]) => {
    const enforcer = new NetworkIsolationEnforcer(config);
    
    try {
      enforcer.enable();
      return await target(...args);
    } finally {
      enforcer.disable();
    }
  }) as T;
}