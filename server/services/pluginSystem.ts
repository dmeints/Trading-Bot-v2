import { EventEmitter } from 'events';
import { storage } from '../storage';

interface PluginConfig {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  type: 'data_source' | 'strategy' | 'dashboard' | 'connector';
  enabled: boolean;
  config: any;
  dependencies: string[];
  permissions: string[];
}

interface PluginAPI {
  storage: typeof storage;
  emit: (event: string, data: any) => void;
  on: (event: string, handler: Function) => void;
  log: (level: string, message: string, meta?: any) => void;
  config: any;
}

interface Plugin {
  config: PluginConfig;
  instance: any;
  api: PluginAPI;
  loaded: boolean;
  error?: string;
}

class PluginSystemService extends EventEmitter {
  private plugins: Map<string, Plugin> = new Map();
  private pluginHooks: Map<string, Function[]> = new Map();

  async loadPlugin(pluginConfig: PluginConfig): Promise<boolean> {
    console.log(`[PluginSystem] Loading plugin: ${pluginConfig.name}`);
    
    try {
      // Validate plugin config
      if (!this.validatePluginConfig(pluginConfig)) {
        throw new Error('Invalid plugin configuration');
      }

      // Check dependencies
      if (!this.checkDependencies(pluginConfig.dependencies)) {
        throw new Error('Plugin dependencies not met');
      }

      // Create plugin API
      const pluginAPI = this.createPluginAPI(pluginConfig);

      // Create plugin instance (simplified - in production would dynamically load)
      const pluginInstance = this.createPluginInstance(pluginConfig, pluginAPI);

      // Register plugin
      const plugin: Plugin = {
        config: pluginConfig,
        instance: pluginInstance,
        api: pluginAPI,
        loaded: true
      };

      this.plugins.set(pluginConfig.id, plugin);

      // Initialize plugin
      if (typeof pluginInstance.initialize === 'function') {
        await pluginInstance.initialize();
      }

      // Register plugin hooks
      this.registerPluginHooks(pluginConfig.id, pluginInstance);

      console.log(`[PluginSystem] Successfully loaded plugin: ${pluginConfig.name}`);
      this.emit('plugin:loaded', { pluginId: pluginConfig.id, plugin: pluginConfig });

      return true;
    } catch (error) {
      console.error(`[PluginSystem] Failed to load plugin ${pluginConfig.name}:`, error);
      
      // Store error info
      this.plugins.set(pluginConfig.id, {
        config: pluginConfig,
        instance: null,
        api: null as any,
        loaded: false,
        error: error instanceof Error ? error.message : String(error)
      });

      return false;
    }
  }

  async unloadPlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      console.warn(`[PluginSystem] Plugin ${pluginId} not found`);
      return false;
    }

    try {
      // Call plugin cleanup if available
      if (plugin.instance && typeof plugin.instance.cleanup === 'function') {
        await plugin.instance.cleanup();
      }

      // Unregister hooks
      this.unregisterPluginHooks(pluginId);

      // Remove plugin
      this.plugins.delete(pluginId);

      console.log(`[PluginSystem] Unloaded plugin: ${plugin.config.name}`);
      this.emit('plugin:unloaded', { pluginId });

      return true;
    } catch (error) {
      console.error(`[PluginSystem] Error unloading plugin ${pluginId}:`, error);
      return false;
    }
  }

  async enablePlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    plugin.config.enabled = true;
    
    if (plugin.instance && typeof plugin.instance.enable === 'function') {
      await plugin.instance.enable();
    }

    console.log(`[PluginSystem] Enabled plugin: ${plugin.config.name}`);
    this.emit('plugin:enabled', { pluginId });
    return true;
  }

  async disablePlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    plugin.config.enabled = false;
    
    if (plugin.instance && typeof plugin.instance.disable === 'function') {
      await plugin.instance.disable();
    }

    console.log(`[PluginSystem] Disabled plugin: ${plugin.config.name}`);
    this.emit('plugin:disabled', { pluginId });
    return true;
  }

  getLoadedPlugins(): PluginConfig[] {
    return Array.from(this.plugins.values())
      .filter(p => p.loaded)
      .map(p => p.config);
  }

  getPlugin(pluginId: string): Plugin | null {
    return this.plugins.get(pluginId) || null;
  }

  async executePluginHook(hookName: string, data: any): Promise<any[]> {
    const hooks = this.pluginHooks.get(hookName) || [];
    const results = [];

    for (const hook of hooks) {
      try {
        const result = await hook(data);
        results.push(result);
      } catch (error) {
        console.error(`[PluginSystem] Error in hook ${hookName}:`, error);
      }
    }

    return results;
  }

  registerHook(hookName: string, handler: Function, pluginId: string): void {
    if (!this.pluginHooks.has(hookName)) {
      this.pluginHooks.set(hookName, []);
    }
    
    const hooks = this.pluginHooks.get(hookName)!;
    hooks.push(handler);
    
    // Store plugin association for cleanup
    handler._pluginId = pluginId;
  }

  async installSamplePlugin(): Promise<PluginConfig> {
    // Create a sample volatility-based scalping strategy plugin
    const samplePlugin: PluginConfig = {
      id: 'volatility-scalper-v1',
      name: 'Volatility-Based Scalping Strategy',
      version: '1.0.0',
      description: 'A scalping strategy that trades based on short-term volatility spikes',
      author: 'Skippy AI Team',
      type: 'strategy',
      enabled: true,
      config: {
        volatilityThreshold: 0.02, // 2% volatility threshold
        timeframe: 300000, // 5 minutes
        maxPositionSize: 0.1, // 10% of portfolio
        stopLossPercent: 0.005, // 0.5%
        takeProfitPercent: 0.015 // 1.5%
      },
      dependencies: [],
      permissions: ['trading', 'market_data']
    };

    const success = await this.loadPlugin(samplePlugin);
    if (success) {
      console.log('[PluginSystem] Sample volatility scalping plugin installed successfully');
    }

    return samplePlugin;
  }

  async installSampleExchangeConnector(): Promise<PluginConfig> {
    // Create a sample exchange connector plugin
    const connectorPlugin: PluginConfig = {
      id: 'demo-exchange-connector',
      name: 'Demo Exchange Connector',
      version: '1.0.0',
      description: 'A demo connector for additional exchange integration',
      author: 'Skippy AI Team',
      type: 'connector',
      enabled: true,
      config: {
        apiUrl: 'https://api.demo-exchange.com',
        rateLimit: 1200, // requests per minute
        supportedSymbols: ['BTC/USD', 'ETH/USD', 'SOL/USD'],
        features: ['spot_trading', 'market_data', 'order_book']
      },
      dependencies: [],
      permissions: ['network', 'trading']
    };

    const success = await this.loadPlugin(connectorPlugin);
    if (success) {
      console.log('[PluginSystem] Sample exchange connector plugin installed successfully');
    }

    return connectorPlugin;
  }

  generatePluginCode(pluginConfig: PluginConfig): string {
    // Generate TypeScript plugin code template
    const template = `
// ${pluginConfig.name} v${pluginConfig.version}
// ${pluginConfig.description}
// Author: ${pluginConfig.author}

export interface ${this.toPascalCase(pluginConfig.id)}Config {
  ${Object.keys(pluginConfig.config || {}).map(key => 
    `${key}: ${typeof pluginConfig.config[key]};`
  ).join('\n  ')}
}

export class ${this.toPascalCase(pluginConfig.id)} {
  private config: ${this.toPascalCase(pluginConfig.id)}Config;
  private api: any;

  constructor(api: any, config: ${this.toPascalCase(pluginConfig.id)}Config) {
    this.api = api;
    this.config = config;
  }

  async initialize(): Promise<void> {
    this.api.log('info', '${pluginConfig.name} initializing...');
    
    // Plugin initialization logic here
    ${this.generateInitializationCode(pluginConfig)}
    
    this.api.log('info', '${pluginConfig.name} initialized successfully');
  }

  async cleanup(): Promise<void> {
    this.api.log('info', '${pluginConfig.name} cleaning up...');
    // Plugin cleanup logic here
  }

  async enable(): Promise<void> {
    this.api.log('info', '${pluginConfig.name} enabled');
  }

  async disable(): Promise<void> {
    this.api.log('info', '${pluginConfig.name} disabled');
  }

  ${this.generatePluginMethods(pluginConfig)}
}

export default ${this.toPascalCase(pluginConfig.id)};
`;

    return template.trim();
  }

  private validatePluginConfig(config: PluginConfig): boolean {
    const required = ['id', 'name', 'version', 'type'];
    return required.every(field => config[field] != null);
  }

  private checkDependencies(dependencies: string[]): boolean {
    // In production, would check if required plugins are loaded
    return true;
  }

  private createPluginAPI(config: PluginConfig): PluginAPI {
    return {
      storage,
      emit: (event: string, data: any) => this.emit(event, data),
      on: (event: string, handler: Function) => this.on(event, handler),
      log: (level: string, message: string, meta?: any) => {
        console.log(`[Plugin:${config.name}] ${level.toUpperCase()}: ${message}`, meta || '');
      },
      config: config.config
    };
  }

  private createPluginInstance(config: PluginConfig, api: PluginAPI): any {
    // Simplified plugin instance creation
    // In production, would dynamically import and instantiate plugin code
    
    const baseInstance = {
      config: config.config,
      api
    };

    if (config.type === 'strategy') {
      return {
        ...baseInstance,
        async initialize() {
          api.log('info', `Strategy ${config.name} initialized`);
        },
        async generateSignal(marketData: any) {
          // Sample signal generation
          const volatility = Math.random() * 0.05;
          if (volatility > (config.config.volatilityThreshold || 0.02)) {
            return {
              action: Math.random() > 0.5 ? 'buy' : 'sell',
              confidence: volatility * 10,
              reasoning: `Volatility spike detected: ${(volatility * 100).toFixed(2)}%`
            };
          }
          return null;
        }
      };
    } else if (config.type === 'connector') {
      return {
        ...baseInstance,
        async initialize() {
          api.log('info', `Connector ${config.name} initialized`);
        },
        async connect() {
          api.log('info', 'Connecting to exchange...');
          return true;
        },
        async getMarketData(symbol: string) {
          return {
            symbol,
            price: Math.random() * 50000 + 40000,
            volume: Math.random() * 1000000,
            timestamp: new Date()
          };
        }
      };
    }

    return baseInstance;
  }

  private registerPluginHooks(pluginId: string, instance: any): void {
    if (instance.onMarketData) {
      this.registerHook('market:data', instance.onMarketData.bind(instance), pluginId);
    }
    
    if (instance.onTradeExecuted) {
      this.registerHook('trade:executed', instance.onTradeExecuted.bind(instance), pluginId);
    }

    if (instance.onSignalGenerated) {
      this.registerHook('signal:generated', instance.onSignalGenerated.bind(instance), pluginId);
    }
  }

  private unregisterPluginHooks(pluginId: string): void {
    for (const [hookName, hooks] of this.pluginHooks.entries()) {
      const filtered = hooks.filter((h: any) => h._pluginId !== pluginId);
      this.pluginHooks.set(hookName, filtered);
    }
  }

  private toPascalCase(str: string): string {
    return str.replace(/(^|[-_])(.)/g, (_, __, char) => char.toUpperCase());
  }

  private generateInitializationCode(config: PluginConfig): string {
    if (config.type === 'strategy') {
      return `
    // Register for market data updates
    this.api.on('market:data', this.onMarketData.bind(this));
    
    // Set up trading parameters
    this.api.log('info', 'Strategy parameters configured');`;
    } else if (config.type === 'connector') {
      return `
    // Establish connection to exchange
    await this.connect();
    
    // Start market data feed
    this.api.log('info', 'Market data feed started');`;
    }
    
    return '// Custom initialization logic';
  }

  private generatePluginMethods(config: PluginConfig): string {
    if (config.type === 'strategy') {
      return `
  async onMarketData(data: any): Promise<void> {
    // Process market data and generate signals
    const signal = await this.generateSignal(data);
    if (signal) {
      this.api.emit('signal:generated', signal);
    }
  }

  async generateSignal(marketData: any): Promise<any> {
    // Strategy-specific signal generation logic
    return null;
  }`;
    } else if (config.type === 'connector') {
      return `
  async connect(): Promise<boolean> {
    // Exchange connection logic
    return true;
  }

  async getMarketData(symbol: string): Promise<any> {
    // Fetch market data from exchange
    return { symbol, price: 0, volume: 0 };
  }`;
    }
    
    return `
  // Plugin-specific methods
  async execute(params: any): Promise<any> {
    return params;
  }`;
  }
}

export const pluginSystem = new PluginSystemService();