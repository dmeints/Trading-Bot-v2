# Skippy Platform Extensibility Guide

## Overview

Skippy's extensibility framework enables developers to extend the platform's capabilities through a comprehensive plugin architecture, low-code strategy builder, and marketplace ecosystem. This document provides a complete guide to building, deploying, and distributing extensions for the Skippy platform.

## Plugin Architecture

### Core Concepts

Skippy's plugin system is built around four primary extension points:

- **Data Connectors**: Custom data sources and feeds
- **Signal Transformers**: Data processing and analysis pipelines  
- **UI Panels**: Custom dashboard components and visualizations
- **Trading Strategies**: Automated trading algorithms and decision engines

### Plugin Structure

Every plugin must include:

```
plugin-name/
├── manifest.json      # Plugin metadata and configuration
├── index.js          # Main entry point with register() function
├── package.json      # Dependencies (optional)
└── README.md         # Documentation
```

### Manifest Schema

```json
{
  "name": "example-plugin",
  "version": "1.0.0",
  "description": "Plugin description",
  "author": "Developer Name",
  "dependencies": ["dependency1", "dependency2"],
  "permissions": ["market_data", "portfolio_access"],
  "entry": "index.js"
}
```

### Plugin Registration

```javascript
// index.js
async function register(context) {
  const { db, logger, registerStrategy, registerDataConnector } = context;
  
  // Register your extensions
  registerStrategy('my-strategy', new MyStrategy());
  registerDataConnector('my-data', new MyDataConnector());
}

module.exports = { register };
```

## Extension Points

### 1. Data Connectors

Create custom data sources:

```javascript
class CustomDataConnector {
  constructor() {
    this.name = 'Custom Data Source';
    this.description = 'Fetches data from custom API';
  }

  async connect() {
    // Initialize connection
  }

  async fetchData(params) {
    // Return formatted data
    return {
      timestamp: new Date(),
      data: [] 
    };
  }

  async disconnect() {
    // Cleanup
  }
}
```

### 2. Signal Transformers

Process and analyze data:

```javascript
class CustomTransformer {
  constructor() {
    this.name = 'Custom Transform';
    this.description = 'Applies custom analysis';
  }

  async transform(data) {
    // Process input data
    return transformedData;
  }
}
```

### 3. Trading Strategies

Implement custom trading logic:

```javascript
class CustomStrategy {
  constructor() {
    this.name = 'Custom Strategy';
    this.description = 'Custom trading algorithm';
    this.parameters = {
      riskLevel: 0.5,
      lookbackPeriod: 20
    };
  }

  async execute(context) {
    const { marketData, indicators, portfolio, timestamp } = context;
    
    // Generate trading signals
    return {
      signals: [{
        type: 'buy',
        symbol: 'BTC',
        confidence: 0.8,
        reason: 'Custom analysis indicates buy opportunity'
      }],
      metadata: {
        timestamp: timestamp.toISOString()
      }
    };
  }
}
```

### 4. UI Panels

Add custom dashboard components:

```javascript
// Register UI panel
registerUIPanel('my-panel', {
  name: 'Custom Panel',
  component: 'CustomPanelComponent',
  position: 'dashboard',
  props: {
    refreshInterval: 30000
  }
});
```

## Strategy Builder

### Visual Strategy Creation

The Strategy Builder provides a drag-and-drop interface for creating trading strategies without coding:

#### Components

1. **Signal Sources**: Entry point generators
   - Price Action
   - Technical Indicators (EMA, RSI, MACD)
   - Custom Signals

2. **Filters**: Signal refinement
   - Threshold Filters
   - Market Regime Filters  
   - Volume Filters
   - Time Filters

3. **Position Sizers**: Risk management
   - Fixed Size
   - Percentage of Equity
   - Kelly Criterion
   - Volatility-Based

4. **Exit Rules**: Position management
   - Profit Targets
   - Stop Losses
   - Trailing Stops
   - Time-Based Exits

#### Strategy Export

Strategies can be exported as TypeScript files:

```bash
# CLI export
npm run skippy builder export --file strategy.json --output MyStrategy.ts

# Programmatic export
const strategy = strategyBuilder.export();
```

## Plugin Marketplace

### Publishing Plugins

1. **Package Your Plugin**
   ```bash
   npm run skippy plugins package --dir ./my-plugin
   ```

2. **Validate Plugin**
   ```bash
   npm run skippy plugins validate --file plugin.zip
   ```

3. **Submit to Marketplace**
   - Upload to marketplace portal
   - Include documentation and examples
   - Specify pricing (free or paid)

### Plugin Categories

- **Data Sources**: Market data, news feeds, social sentiment
- **Indicators**: Technical analysis tools and custom indicators  
- **Strategies**: Pre-built trading algorithms
- **Risk Management**: Portfolio optimization and risk tools
- **Visualization**: Custom charts and dashboard widgets
- **Utilities**: Helper tools and integrations

## Development Workflow

### Local Development

1. **Create Plugin Structure**
   ```bash
   mkdir my-plugin
   cd my-plugin
   npm init -y
   ```

2. **Implement Plugin**
   ```javascript
   // index.js
   async function register(context) {
     // Plugin implementation
   }
   ```

3. **Test Locally**
   ```bash
   # Copy to plugins directory
   cp -r my-plugin ./plugins/
   
   # Restart server to load plugin
   npm run dev
   ```

4. **Validate and Package**
   ```bash
   npm run skippy plugins validate --dir ./my-plugin
   npm run skippy plugins package --dir ./my-plugin
   ```

### Hot Reloading

Plugins support hot reloading during development:

```bash
# Reload specific plugin
curl -X POST http://localhost:5000/api/plugins/my-plugin/reload
```

### Testing Framework

Use the built-in testing utilities:

```javascript
// test/my-plugin.test.js
const { pluginTester } = require('@skippy/plugin-testing');

describe('My Plugin', () => {
  it('should generate valid signals', async () => {
    const result = await pluginTester.executeStrategy('my-strategy', {
      marketData: mockData,
      timestamp: new Date()
    });
    
    expect(result.signals).toBeDefined();
  });
});
```

## API Integration

### Plugin API Endpoints

- `GET /api/plugins` - List installed plugins
- `POST /api/plugins/install` - Install plugin from marketplace
- `DELETE /api/plugins/{name}` - Uninstall plugin
- `POST /api/plugins/{name}/reload` - Reload plugin
- `POST /api/plugins/strategies/execute` - Execute strategy

### Authentication

Plugins run with the same permissions as the user:

```javascript
// Access authenticated endpoints
const response = await fetch('/api/trading/trades', {
  headers: {
    'Authorization': context.authToken
  }
});
```

## Performance Considerations

### Best Practices

1. **Async Operations**: Use async/await for all I/O operations
2. **Error Handling**: Implement comprehensive error handling
3. **Resource Management**: Clean up resources in disconnect()
4. **Caching**: Cache expensive computations
5. **Memory Usage**: Monitor memory consumption

### Monitoring

Plugin execution is automatically monitored:

- Execution time tracking
- Error logging
- Performance metrics
- Resource usage

```javascript
// View plugin metrics
GET /api/plugins/{name}/metrics
```

## Security

### Permissions System

Plugins declare required permissions:

```json
{
  "permissions": [
    "market_data",      // Read market data
    "portfolio_access", // Read portfolio info
    "trading",          // Execute trades
    "external_api"      // Make external API calls
  ]
}
```

### Sandboxing

Plugins run in controlled environments:

- Limited file system access
- Network request monitoring
- Resource usage limits
- API rate limiting

## CLI Tools

### Available Commands

```bash
# Plugin management
npm run skippy plugins list
npm run skippy plugins install <url>
npm run skippy plugins validate <path>
npm run skippy plugins package <dir>

# Strategy builder
npm run skippy builder export --file strategy.json
npm run skippy builder validate --file strategy.json
npm run skippy builder template --name "My Strategy"

# Development tools
npm run skippy dev hot-reload <plugin-name>
npm run skippy dev test <plugin-name>
```

## Documentation

### Plugin Documentation

Include comprehensive documentation:

```markdown
# Plugin Name

## Description
Brief description of plugin functionality

## Installation
\`\`\`bash
npm install skippy-plugin-name
\`\`\`

## Configuration
\`\`\`json
{
  "parameter1": "value1",
  "parameter2": "value2"
}
\`\`\`

## Usage Examples
\`\`\`javascript
// Example usage
\`\`\`

## API Reference
Detailed API documentation
```

### OpenAPI Documentation

Plugin APIs are automatically documented:

- Visit `/api/docs` for interactive documentation
- Download OpenAPI spec at `/api/openapi.json`
- Generated documentation includes plugin endpoints

## Examples

### Complete Plugin Example

See the `plugins/example-plugin/` directory for a complete working example that demonstrates:

- EMA crossover strategy implementation
- Custom data connector
- Signal transformer
- UI panel registration
- Error handling and logging

### Strategy Builder Examples

Pre-built strategy templates available:

- Basic momentum strategy
- Mean reversion strategy  
- Breakout strategy
- Risk parity portfolio

## Support

### Getting Help

- **Documentation**: Visit `/api/docs` for API documentation
- **Examples**: Check `plugins/` directory for working examples
- **Community**: Join the Skippy developer community
- **Issues**: Report bugs via GitHub issues

### Contributing

1. Fork the repository
2. Create feature branch
3. Implement plugin/feature
4. Add tests and documentation
5. Submit pull request

## Changelog

### v1.0.0 (August 2025)
- Initial plugin architecture
- Strategy builder implementation
- Marketplace integration
- CLI tools
- OpenAPI documentation
- Hot reloading support