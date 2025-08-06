import { StrategyPlugin, PluginConfig, PluginContext, PluginMetadata, MarketData, Portfolio, StrategySignal } from '../../plugins/types';
import { logger } from '../utils/logger';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';

export class PluginManager {
  private static instance: PluginManager;
  private plugins: Map<string, StrategyPlugin> = new Map();
  private pluginMetadata: Map<string, PluginMetadata> = new Map();
  private pluginContexts: Map<string, PluginContext> = new Map();

  static getInstance(): PluginManager {
    if (!this.instance) {
      this.instance = new PluginManager();
    }
    return this.instance;
  }

  /**
   * Load all plugins from the plugins directory
   */
  async loadPlugins(): Promise<void> {
    try {
      const pluginsDir = path.join(process.cwd(), 'plugins');
      const files = await fs.readdir(pluginsDir);
      
      for (const file of files) {
        if (file.endsWith('.ts') && !file.includes('types.') && !file.includes('README')) {
          try {
            await this.loadPlugin(file);
          } catch (error) {
            logger.error(`Failed to load plugin ${file}`, { error });
          }
        }
      }
      
      logger.info(`Loaded ${this.plugins.size} plugins`, {
        plugins: Array.from(this.plugins.keys())
      });
    } catch (error) {
      logger.error('Failed to load plugins directory', { error });
    }
  }

  /**
   * Load a specific plugin
   */
  async loadPlugin(filename: string): Promise<void> {
    try {
      const pluginPath = path.join(process.cwd(), 'plugins', filename);
      
      // Dynamic import of the plugin
      const module = await import(pluginPath);
      
      // Find the plugin class (assumes exported class ending with Plugin)
      const PluginClass = Object.values(module).find(
        (export_: any) => 
          typeof export_ === 'function' && 
          export_.name.endsWith('Plugin')
      ) as new () => StrategyPlugin;
      
      if (!PluginClass) {
        throw new Error(`No plugin class found in ${filename}`);
      }
      
      const plugin = new PluginClass();
      
      // Validate plugin interface
      if (!this.validatePluginInterface(plugin)) {
        throw new Error(`Plugin ${plugin.name} does not implement required interface`);
      }
      
      // Load plugin configuration from database or use defaults
      const config = await this.loadPluginConfig(plugin.name) || plugin.getDefaultConfig();
      
      // Create plugin context
      const context = this.createPluginContext(plugin.name);
      
      // Initialize plugin
      await plugin.initialize(config, context);
      
      // Store plugin and metadata
      this.plugins.set(plugin.name, plugin);
      this.pluginContexts.set(plugin.name, context);
      
      const metadata: PluginMetadata = {
        name: plugin.name,
        version: plugin.version,
        enabled: config.enabled,
        config,
        performance: {
          totalSignals: 0,
          successfulTrades: 0,
          totalReturn: 0,
          winRate: 0,
          sharpeRatio: 0
        },
        lastExecution: new Date(),
        errors: []
      };
      
      this.pluginMetadata.set(plugin.name, metadata);
      
      logger.info(`Plugin loaded successfully`, {
        name: plugin.name,
        version: plugin.version,
        enabled: config.enabled
      });
      
    } catch (error) {
      logger.error(`Failed to load plugin ${filename}`, { error });
      throw error;
    }
  }

  /**
   * Execute all enabled plugins
   */
  async executePlugins(marketData: MarketData[], portfolio: Portfolio): Promise<StrategySignal[]> {
    const allSignals: StrategySignal[] = [];
    
    for (const [name, plugin] of this.plugins) {
      const metadata = this.pluginMetadata.get(name);
      
      if (!metadata?.enabled) {
        continue;
      }
      
      try {
        const startTime = Date.now();
        const signals = await plugin.execute(marketData, portfolio);
        const executionTime = Date.now() - startTime;
        
        // Update metadata
        metadata.lastExecution = new Date();
        metadata.performance.totalSignals += signals.length;
        
        // Add plugin source to signals
        const enhancedSignals = signals.map(signal => ({
          ...signal,
          metadata: {
            ...signal.metadata,
            pluginName: name,
            pluginVersion: plugin.version,
            executionTime
          }
        }));
        
        allSignals.push(...enhancedSignals);
        
        // Log execution metrics
        const context = this.pluginContexts.get(name);
        context?.metrics.histogram('execution_time', executionTime);
        context?.metrics.gauge('signals_generated', signals.length);
        
        logger.debug(`Plugin ${name} executed`, {
          signals: signals.length,
          executionTime
        });
        
      } catch (error) {
        logger.error(`Plugin ${name} execution failed`, { error });
        
        // Track error in metadata
        const metadata = this.pluginMetadata.get(name);
        if (metadata) {
          metadata.errors.push({
            timestamp: new Date(),
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          });
          
          // Keep only last 10 errors
          if (metadata.errors.length > 10) {
            metadata.errors.splice(0, metadata.errors.length - 10);
          }
        }
        
        // Call plugin error handler if available
        try {
          await plugin.onError?.(error instanceof Error ? error : new Error(String(error)));
        } catch (handlerError) {
          logger.error(`Plugin ${name} error handler failed`, { handlerError });
        }
      }
    }
    
    return allSignals;
  }

  /**
   * Get plugin by name
   */
  getPlugin(name: string): StrategyPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Get plugin metadata
   */
  getPluginMetadata(name: string): PluginMetadata | undefined {
    return this.pluginMetadata.get(name);
  }

  /**
   * List all plugins
   */
  listPlugins(): PluginMetadata[] {
    return Array.from(this.pluginMetadata.values());
  }

  /**
   * Enable/disable a plugin
   */
  async setPluginEnabled(name: string, enabled: boolean): Promise<void> {
    const metadata = this.pluginMetadata.get(name);
    if (!metadata) {
      throw new Error(`Plugin ${name} not found`);
    }
    
    metadata.enabled = enabled;
    metadata.config.enabled = enabled;
    
    // Save to database
    await this.savePluginConfig(name, metadata.config);
    
    logger.info(`Plugin ${name} ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Update plugin configuration
   */
  async updatePluginConfig(name: string, config: Partial<PluginConfig>): Promise<void> {
    const plugin = this.plugins.get(name);
    const metadata = this.pluginMetadata.get(name);
    
    if (!plugin || !metadata) {
      throw new Error(`Plugin ${name} not found`);
    }
    
    const newConfig = { ...metadata.config, ...config };
    
    if (!plugin.validateConfig(newConfig)) {
      throw new Error(`Invalid configuration for plugin ${name}`);
    }
    
    metadata.config = newConfig;
    
    // Reinitialize plugin with new config
    const context = this.pluginContexts.get(name);
    if (context) {
      await plugin.initialize(newConfig, context);
    }
    
    // Save to database
    await this.savePluginConfig(name, newConfig);
    
    logger.info(`Plugin ${name} configuration updated`);
  }

  /**
   * Notify plugins of price updates
   */
  async notifyPriceUpdate(symbol: string, price: number): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      if (plugin.onPriceUpdate && this.pluginMetadata.get(name)?.enabled) {
        try {
          await plugin.onPriceUpdate(symbol, price);
        } catch (error) {
          logger.error(`Plugin ${name} price update handler failed`, { error, symbol, price });
        }
      }
    }
  }

  /**
   * Notify plugins of trade executions
   */
  async notifyTradeExecuted(trade: any): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      if (plugin.onTradeExecuted && this.pluginMetadata.get(name)?.enabled) {
        try {
          await plugin.onTradeExecuted(trade);
        } catch (error) {
          logger.error(`Plugin ${name} trade notification failed`, { error, trade });
        }
      }
    }
  }

  /**
   * Cleanup all plugins
   */
  async cleanup(): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      try {
        await plugin.cleanup();
      } catch (error) {
        logger.error(`Plugin ${name} cleanup failed`, { error });
      }
    }
    
    this.plugins.clear();
    this.pluginMetadata.clear();
    this.pluginContexts.clear();
  }

  private validatePluginInterface(plugin: any): plugin is StrategyPlugin {
    return (
      typeof plugin.name === 'string' &&
      typeof plugin.version === 'string' &&
      typeof plugin.initialize === 'function' &&
      typeof plugin.execute === 'function' &&
      typeof plugin.cleanup === 'function' &&
      typeof plugin.getDefaultConfig === 'function' &&
      typeof plugin.validateConfig === 'function'
    );
  }

  private createPluginContext(pluginName: string): PluginContext {
    return {
      logger: {
        info: (message: string, data?: any) => 
          logger.info(`[Plugin:${pluginName}] ${message}`, data),
        error: (message: string, error?: Error) => 
          logger.error(`[Plugin:${pluginName}] ${message}`, { error }),
        warn: (message: string, data?: any) => 
          logger.warn(`[Plugin:${pluginName}] ${message}`, data),
        debug: (message: string, data?: any) => 
          logger.debug(`[Plugin:${pluginName}] ${message}`, data)
      },
      metrics: {
        counter: (name: string, value = 1) => {
          // Implement metrics collection (Prometheus, etc.)
          logger.debug(`[Metrics:${pluginName}] ${name}: ${value}`);
        },
        gauge: (name: string, value: number) => {
          logger.debug(`[Metrics:${pluginName}] ${name}: ${value}`);
        },
        histogram: (name: string, value: number) => {
          logger.debug(`[Metrics:${pluginName}] ${name}: ${value}`);
        }
      },
      storage: {
        get: async (key: string) => {
          try {
            const result = await db.execute(sql`
              SELECT value FROM plugin_storage 
              WHERE plugin_name = ${pluginName} AND key = ${key}
            `);
            return result.rows[0]?.value ? JSON.parse(result.rows[0].value) : null;
          } catch {
            return null;
          }
        },
        set: async (key: string, value: any) => {
          await db.execute(sql`
            INSERT INTO plugin_storage (plugin_name, key, value)
            VALUES (${pluginName}, ${key}, ${JSON.stringify(value)})
            ON CONFLICT (plugin_name, key) 
            DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
          `);
        },
        delete: async (key: string) => {
          await db.execute(sql`
            DELETE FROM plugin_storage 
            WHERE plugin_name = ${pluginName} AND key = ${key}
          `);
        }
      },
      api: {
        getHistoricalData: async (symbol: string, days: number) => {
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - days);
          
          const result = await db.execute(sql`
            SELECT symbol, price, volume_24h, change_24h, timestamp
            FROM "marketData"
            WHERE symbol = ${symbol} 
              AND timestamp >= ${startDate.toISOString()}
            ORDER BY timestamp ASC
          `);
          
          return result.rows.map((row: any) => ({
            symbol: row.symbol,
            price: parseFloat(row.price),
            volume24h: parseFloat(row.volume_24h) || 0,
            change24h: parseFloat(row.change_24h) || 0,
            timestamp: new Date(row.timestamp)
          }));
        },
        getMarketData: async (symbols: string[]) => {
          const result = await db.execute(sql`
            SELECT DISTINCT ON (symbol) symbol, price, volume_24h, change_24h, timestamp
            FROM "marketData"
            WHERE symbol = ANY(${symbols})
            ORDER BY symbol, timestamp DESC
          `);
          
          return result.rows.map((row: any) => ({
            symbol: row.symbol,
            price: parseFloat(row.price),
            volume24h: parseFloat(row.volume_24h) || 0,
            change24h: parseFloat(row.change_24h) || 0,
            timestamp: new Date(row.timestamp)
          }));
        },
        executeTrade: async (signal: StrategySignal) => {
          // This would integrate with the actual trading engine
          logger.info(`[Plugin:${pluginName}] Trade signal`, signal);
          return true; // Placeholder
        },
        getPortfolio: async () => {
          // This would get actual portfolio data
          return {
            totalValue: 10000,
            totalPnl: 0,
            positions: [],
            availableBalance: 10000,
            riskScore: 'low' as const
          };
        }
      }
    };
  }

  private async loadPluginConfig(pluginName: string): Promise<PluginConfig | null> {
    try {
      const result = await db.execute(sql`
        SELECT config FROM plugin_configs WHERE name = ${pluginName}
      `);
      
      return result.rows[0]?.config ? JSON.parse(result.rows[0].config) : null;
    } catch {
      return null;
    }
  }

  private async savePluginConfig(pluginName: string, config: PluginConfig): Promise<void> {
    await db.execute(sql`
      INSERT INTO plugin_configs (name, config, updated_at)
      VALUES (${pluginName}, ${JSON.stringify(config)}, NOW())
      ON CONFLICT (name) 
      DO UPDATE SET config = EXCLUDED.config, updated_at = NOW()
    `);
  }
}

// Initialize plugin storage tables
export async function initializePluginTables(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS plugin_configs (
        name VARCHAR(255) PRIMARY KEY,
        config JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS plugin_storage (
        plugin_name VARCHAR(255) NOT NULL,
        key VARCHAR(255) NOT NULL,
        value JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (plugin_name, key)
      )
    `);
    
    logger.info('Plugin tables initialized');
  } catch (error) {
    logger.error('Failed to initialize plugin tables', { error });
  }
}