import { logger } from '../utils/logger';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import path from 'path';
import fs from 'fs/promises';

export interface PluginContext {
  db: typeof db;
  logger: typeof logger;
  registerDataConnector: (name: string, connector: DataConnector) => void;
  registerSignalTransformer: (name: string, transformer: SignalTransformer) => void;
  registerUIPanel: (name: string, panel: UIPanel) => void;
  registerStrategy: (name: string, strategy: Strategy) => void;
}

export interface DataConnector {
  name: string;
  description: string;
  connect: () => Promise<void>;
  fetchData: (params?: any) => Promise<any>;
  disconnect: () => Promise<void>;
}

export interface SignalTransformer {
  name: string;
  description: string;
  transform: (data: any) => Promise<any>;
  schema?: any;
}

export interface UIPanel {
  name: string;
  component: string;
  props?: Record<string, any>;
  position?: 'dashboard' | 'sidebar' | 'modal';
}

export interface Strategy {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (context: StrategyContext) => Promise<StrategyResult>;
}

export interface StrategyContext {
  marketData: any[];
  indicators: Record<string, number[]>;
  portfolio: any;
  timestamp: Date;
}

export interface StrategyResult {
  signals: Array<{
    type: 'buy' | 'sell' | 'hold';
    symbol: string;
    confidence: number;
    reason: string;
  }>;
  metadata?: Record<string, any>;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  dependencies?: string[];
  permissions?: string[];
  entry: string;
}

export class PluginManager {
  private static instance: PluginManager;
  private plugins: Map<string, any> = new Map();
  private dataConnectors: Map<string, DataConnector> = new Map();
  private signalTransformers: Map<string, SignalTransformer> = new Map();
  private uiPanels: Map<string, UIPanel> = new Map();
  private strategies: Map<string, Strategy> = new Map();
  private isInitialized = false;

  static getInstance(): PluginManager {
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager();
    }
    return PluginManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('Initializing Plugin Manager');
      await this.createPluginTables();
      await this.loadPlugins();
      this.isInitialized = true;
      logger.info('Plugin Manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Plugin Manager', { error });
      throw error;
    }
  }

  private async createPluginTables(): Promise<void> {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS plugins (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR UNIQUE NOT NULL,
          version VARCHAR NOT NULL,
          description TEXT,
          author VARCHAR,
          manifest JSONB NOT NULL,
          status VARCHAR DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'error')),
          installed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS plugin_executions (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          plugin_name VARCHAR NOT NULL,
          execution_type VARCHAR NOT NULL,
          input_data JSONB,
          output_data JSONB,
          execution_time INTEGER,
          status VARCHAR NOT NULL,
          error_message TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      logger.info('Plugin tables created successfully');
    } catch (error) {
      logger.error('Failed to create plugin tables', { error });
      throw error;
    }
  }

  async loadPlugins(): Promise<void> {
    try {
      const pluginsDir = path.join(process.cwd(), 'plugins');
      
      // Ensure plugins directory exists
      try {
        await fs.access(pluginsDir);
      } catch {
        await fs.mkdir(pluginsDir, { recursive: true });
        logger.info('Created plugins directory');
      }

      const pluginDirs = await fs.readdir(pluginsDir, { withFileTypes: true });
      const loadPromises = pluginDirs
        .filter(dirent => dirent.isDirectory())
        .map(dirent => this.loadPlugin(path.join(pluginsDir, dirent.name)));

      await Promise.all(loadPromises);
      logger.info(`Loaded ${this.plugins.size} plugins`);
    } catch (error) {
      logger.error('Failed to load plugins', { error });
      throw error;
    }
  }

  private async loadPlugin(pluginPath: string): Promise<void> {
    try {
      const manifestPath = path.join(pluginPath, 'manifest.json');
      const manifestData = await fs.readFile(manifestPath, 'utf-8');
      const manifest: PluginManifest = JSON.parse(manifestData);

      // Check if plugin is already loaded
      if (this.plugins.has(manifest.name)) {
        logger.warn(`Plugin ${manifest.name} already loaded, skipping`);
        return;
      }

      // Load the plugin entry point
      const entryPath = path.join(pluginPath, manifest.entry);
      delete require.cache[require.resolve(entryPath)]; // Clear cache for hot reloading
      const pluginModule = require(entryPath);

      if (!pluginModule.register || typeof pluginModule.register !== 'function') {
        throw new Error(`Plugin ${manifest.name} must export a 'register' function`);
      }

      // Create plugin context
      const context: PluginContext = {
        db,
        logger: logger.child({ plugin: manifest.name }),
        registerDataConnector: (name, connector) => this.registerDataConnector(name, connector),
        registerSignalTransformer: (name, transformer) => this.registerSignalTransformer(name, transformer),
        registerUIPanel: (name, panel) => this.registerUIPanel(name, panel),
        registerStrategy: (name, strategy) => this.registerStrategy(name, strategy)
      };

      // Register the plugin
      await pluginModule.register(context);

      this.plugins.set(manifest.name, {
        manifest,
        module: pluginModule,
        path: pluginPath
      });

      // Store in database
      await db.execute(sql`
        INSERT INTO plugins (name, version, description, author, manifest)
        VALUES (${manifest.name}, ${manifest.version}, ${manifest.description}, ${manifest.author}, ${JSON.stringify(manifest)})
        ON CONFLICT (name) DO UPDATE SET
          version = EXCLUDED.version,
          description = EXCLUDED.description,
          manifest = EXCLUDED.manifest,
          updated_at = NOW()
      `);

      logger.info(`Loaded plugin: ${manifest.name} v${manifest.version}`);
    } catch (error) {
      logger.error(`Failed to load plugin at ${pluginPath}`, { error });
    }
  }

  registerDataConnector(name: string, connector: DataConnector): void {
    this.dataConnectors.set(name, connector);
    logger.info(`Registered data connector: ${name}`);
  }

  registerSignalTransformer(name: string, transformer: SignalTransformer): void {
    this.signalTransformers.set(name, transformer);
    logger.info(`Registered signal transformer: ${name}`);
  }

  registerUIPanel(name: string, panel: UIPanel): void {
    this.uiPanels.set(name, panel);
    logger.info(`Registered UI panel: ${name}`);
  }

  registerStrategy(name: string, strategy: Strategy): void {
    this.strategies.set(name, strategy);
    logger.info(`Registered strategy: ${name}`);
  }

  // Getters for registered components
  getDataConnectors(): Map<string, DataConnector> {
    return this.dataConnectors;
  }

  getSignalTransformers(): Map<string, SignalTransformer> {
    return this.signalTransformers;
  }

  getUIPanel(name: string): UIPanel | undefined {
    return this.uiPanels.get(name);
  }

  getUIPanels(): Map<string, UIPanel> {
    return this.uiPanels;
  }

  getStrategy(name: string): Strategy | undefined {
    return this.strategies.get(name);
  }

  getStrategies(): Map<string, Strategy> {
    return this.strategies;
  }

  getPlugins(): Map<string, any> {
    return this.plugins;
  }

  async executeStrategy(name: string, context: StrategyContext): Promise<StrategyResult | null> {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      logger.error(`Strategy ${name} not found`);
      return null;
    }

    const startTime = Date.now();
    try {
      const result = await strategy.execute(context);
      const executionTime = Date.now() - startTime;

      // Log execution
      await db.execute(sql`
        INSERT INTO plugin_executions (plugin_name, execution_type, input_data, output_data, execution_time, status)
        VALUES (${name}, 'strategy', ${JSON.stringify(context)}, ${JSON.stringify(result)}, ${executionTime}, 'success')
      `);

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Log error
      await db.execute(sql`
        INSERT INTO plugin_executions (plugin_name, execution_type, input_data, execution_time, status, error_message)
        VALUES (${name}, 'strategy', ${JSON.stringify(context)}, ${executionTime}, 'error', ${error instanceof Error ? error.message : String(error)})
      `);

      logger.error(`Strategy execution failed: ${name}`, { error });
      return null;
    }
  }

  async reloadPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} not found`);
    }

    // Remove from registries
    this.dataConnectors.delete(name);
    this.signalTransformers.delete(name);
    this.uiPanels.delete(name);
    this.strategies.delete(name);

    // Reload plugin
    await this.loadPlugin(plugin.path);
    logger.info(`Reloaded plugin: ${name}`);
  }

  async installPlugin(pluginUrl: string): Promise<void> {
    // This would typically download and extract a plugin package
    // For now, we'll implement a simple file-based installation
    logger.info(`Installing plugin from: ${pluginUrl}`);
    // Implementation would go here for downloading and installing plugins
  }

  async uninstallPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} not found`);
    }

    // Remove from registries
    this.dataConnectors.delete(name);
    this.signalTransformers.delete(name);
    this.uiPanels.delete(name);
    this.strategies.delete(name);
    this.plugins.delete(name);

    // Remove from database
    await db.execute(sql`
      UPDATE plugins SET status = 'disabled' WHERE name = ${name}
    `);

    logger.info(`Uninstalled plugin: ${name}`);
  }
}

export const pluginManager = PluginManager.getInstance();