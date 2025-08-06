# Skippy Plugin Architecture

The Skippy Trading Platform supports extensible strategy plugins that can implement custom trading algorithms, indicators, and decision-making logic.

## Plugin Structure

```typescript
interface StrategyPlugin {
  name: string;
  version: string;
  description: string;
  author: string;
  
  // Plugin lifecycle
  initialize(config: PluginConfig): Promise<void>;
  execute(marketData: MarketData[], portfolio: Portfolio): Promise<StrategySignal[]>;
  cleanup(): Promise<void>;
  
  // Configuration
  getDefaultConfig(): PluginConfig;
  validateConfig(config: PluginConfig): boolean;
}
```

## Creating a Plugin

1. Create a new TypeScript file in the `/plugins` directory
2. Implement the `StrategyPlugin` interface
3. Register your plugin in the plugin registry
4. Test with the CLI: `npm run skippy plugin test <plugin-name>`

## Example Plugin

See `plugins/ema-crossover.ts` for a complete example implementation.

## Plugin API

Plugins have access to:
- Real-time market data
- Historical price data
- Portfolio state
- Risk management utilities
- Logging and metrics

## Plugin Deployment

Plugins can be:
- Loaded dynamically at runtime
- Hot-reloaded for development
- Versioned and rolled back
- A/B tested with feature flags

## Best Practices

1. **Error Handling**: Always wrap your logic in try-catch blocks
2. **Performance**: Use async/await for non-blocking operations
3. **State Management**: Keep plugins stateless when possible
4. **Testing**: Include unit tests for your strategy logic
5. **Documentation**: Document your parameters and expected behavior

## Plugin Configuration

```typescript
interface PluginConfig {
  enabled: boolean;
  parameters: Record<string, any>;
  riskLimits: {
    maxPositionSize: number;
    maxDailyLoss: number;
    allowedSymbols: string[];
  };
  schedule?: {
    enabled: boolean;
    cron: string;
  };
}
```

## Available Hooks

- `onMarketOpen()` - Called when markets open
- `onMarketClose()` - Called when markets close
- `onPriceUpdate(symbol, price)` - Called on every price update
- `onTradeExecuted(trade)` - Called after trade execution
- `onError(error)` - Called when errors occur

## Plugin Registry

```bash
# List available plugins
npm run skippy plugin list

# Install a plugin
npm run skippy plugin install <plugin-name>

# Enable/disable a plugin
npm run skippy plugin enable <plugin-name>
npm run skippy plugin disable <plugin-name>

# Test a plugin
npm run skippy plugin test <plugin-name>

# Deploy a plugin
npm run skippy plugin deploy <plugin-name>
```

## Development Workflow

1. Create plugin file: `plugins/my-strategy.ts`
2. Implement required interface methods
3. Test locally: `npm run skippy plugin test my-strategy`
4. Enable for paper trading: `npm run skippy plugin enable my-strategy --paper`
5. Monitor performance and metrics
6. Deploy to live trading: `npm run skippy plugin deploy my-strategy --live`

## Plugin Security

- Plugins run in a sandboxed environment
- Limited access to system resources
- All external API calls must be declared
- Code review required for production deployment