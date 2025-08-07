# Skippy Plugin Development Guide

## Quick Start

Create your first Skippy plugin in 5 minutes:

```bash
# 1. Create plugin directory
mkdir my-first-plugin && cd my-first-plugin

# 2. Create manifest
cat > manifest.json << EOF
{
  "name": "my-first-plugin",
  "version": "1.0.0", 
  "description": "My first Skippy plugin",
  "author": "Your Name",
  "entry": "index.js"
}
EOF

# 3. Create plugin code
cat > index.js << EOF
async function register(context) {
  const { logger, registerStrategy } = context;
  
  logger.info('My first plugin loaded!');
  
  const strategy = {
    name: 'Simple Buy Hold',
    description: 'Always suggests buying and holding',
    parameters: { confidence: 0.6 },
    
    async execute({ marketData, timestamp }) {
      return {
        signals: [{
          type: 'buy',
          symbol: 'BTC',
          confidence: 0.6,
          reason: 'Simple buy and hold strategy'
        }],
        metadata: { timestamp: timestamp.toISOString() }
      };
    }
  };
  
  registerStrategy('simple-buy-hold', strategy);
}

module.exports = { register };
EOF

# 4. Install to Skippy
cp -r . ../skippy/plugins/my-first-plugin

# 5. Restart Skippy to load plugin
cd ../skippy && npm run dev
```

Your plugin is now loaded! Test it via the API:

```bash
curl -X POST http://localhost:5000/api/plugins/strategies/execute \
  -H "Content-Type: application/json" \
  -d '{
    "strategyName": "simple-buy-hold",
    "context": {
      "marketData": [],
      "timestamp": "2025-08-07T00:00:00Z"
    }
  }'
```

## Plugin Types

### 1. Trading Strategies

The most common plugin type. Generates trading signals based on market data.

```javascript
class TrendFollowingStrategy {
  constructor() {
    this.name = 'Trend Following';
    this.description = 'Follows market trends using moving averages';
    this.parameters = {
      fastMA: 10,
      slowMA: 20,
      confidence: 0.7
    };
  }

  async execute(context) {
    const { marketData, indicators, portfolio } = context;
    
    // Calculate moving averages
    const prices = marketData.map(candle => candle.close);
    const fastMA = this.calculateMA(prices, this.parameters.fastMA);
    const slowMA = this.calculateMA(prices, this.parameters.slowMA);
    
    const signals = [];
    
    // Generate buy signal when fast MA crosses above slow MA
    if (fastMA > slowMA) {
      signals.push({
        type: 'buy',
        symbol: 'BTC',
        confidence: this.parameters.confidence,
        reason: `Fast MA (${fastMA.toFixed(2)}) > Slow MA (${slowMA.toFixed(2)})`
      });
    }
    
    return { signals };
  }
  
  calculateMA(prices, period) {
    const recent = prices.slice(-period);
    return recent.reduce((sum, price) => sum + price, 0) / recent.length;
  }
}
```

### 2. Data Connectors

Integrate external data sources.

```javascript
class TwitterSentimentConnector {
  constructor() {
    this.name = 'Twitter Sentiment';
    this.description = 'Fetches cryptocurrency sentiment from Twitter';
    this.connected = false;
  }

  async connect() {
    // Initialize Twitter API connection
    this.api = new TwitterAPI({
      apiKey: process.env.TWITTER_API_KEY,
      apiSecret: process.env.TWITTER_API_SECRET
    });
    this.connected = true;
  }

  async fetchData(params = {}) {
    const { symbol = 'BTC', count = 100 } = params;
    
    if (!this.connected) {
      throw new Error('Connector not connected');
    }

    const tweets = await this.api.search(`$${symbol} crypto`, { count });
    
    return {
      source: 'twitter',
      symbol,
      sentiment: this.analyzeSentiment(tweets),
      volume: tweets.length,
      timestamp: new Date()
    };
  }

  analyzeSentiment(tweets) {
    // Simple sentiment analysis
    const positiveWords = ['bullish', 'moon', 'pump', 'buy'];
    const negativeWords = ['bearish', 'dump', 'sell', 'crash'];
    
    let score = 0;
    tweets.forEach(tweet => {
      const text = tweet.text.toLowerCase();
      positiveWords.forEach(word => {
        if (text.includes(word)) score += 1;
      });
      negativeWords.forEach(word => {
        if (text.includes(word)) score -= 1;
      });
    });
    
    return Math.max(-1, Math.min(1, score / tweets.length));
  }

  async disconnect() {
    this.connected = false;
  }
}
```

### 3. Signal Transformers

Process and enhance signals from other sources.

```javascript
class VolatilityAdjuster {
  constructor() {
    this.name = 'Volatility Adjuster';
    this.description = 'Adjusts signal confidence based on market volatility';
  }

  async transform(data) {
    if (!Array.isArray(data)) return data;
    
    return data.map(signal => {
      if (!signal.confidence) return signal;
      
      // Reduce confidence in high volatility periods
      const volatility = this.calculateVolatility(signal.marketData || []);
      const adjustment = Math.max(0.5, 1 - volatility);
      
      return {
        ...signal,
        confidence: signal.confidence * adjustment,
        metadata: {
          ...signal.metadata,
          originalConfidence: signal.confidence,
          volatilityAdjustment: adjustment,
          volatility
        }
      };
    });
  }

  calculateVolatility(prices) {
    if (prices.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }
}
```

### 4. UI Panels

Add custom dashboard components.

```javascript
// Register a custom dashboard panel
function register(context) {
  const { registerUIPanel } = context;
  
  registerUIPanel('sentiment-gauge', {
    name: 'Market Sentiment Gauge',
    component: 'SentimentGauge',
    position: 'dashboard',
    props: {
      refreshInterval: 60000, // Update every minute
      symbols: ['BTC', 'ETH', 'SOL']
    }
  });
}
```

## Advanced Features

### Database Access

Plugins can access the database directly:

```javascript
async function register(context) {
  const { db, registerStrategy } = context;
  
  const strategy = {
    async execute(context) {
      // Store custom data
      await db.execute(`
        INSERT INTO plugin_data (plugin_name, data, timestamp)
        VALUES ('my-plugin', $1, NOW())
      `, [JSON.stringify({ signal: 'buy' })]);
      
      // Query historical data
      const result = await db.execute(`
        SELECT * FROM trades 
        WHERE symbol = $1 
        ORDER BY created_at DESC 
        LIMIT 10
      `, ['BTC']);
      
      return { signals: [] };
    }
  };
  
  registerStrategy('db-strategy', strategy);
}
```

### External API Integration

Make HTTP requests to external services:

```javascript
class CoinGeckoConnector {
  async fetchData(params) {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const data = await response.json();
    
    return {
      symbol: 'BTC',
      price: data.bitcoin.usd,
      timestamp: new Date()
    };
  }
}
```

### Error Handling

Implement robust error handling:

```javascript
class RobustStrategy {
  async execute(context) {
    try {
      // Strategy logic here
      const signals = await this.generateSignals(context);
      return { signals };
      
    } catch (error) {
      context.logger.error('Strategy execution failed', { 
        error: error.message,
        stack: error.stack 
      });
      
      // Return safe fallback
      return { 
        signals: [],
        metadata: {
          error: error.message,
          fallbackUsed: true
        }
      };
    }
  }
  
  async generateSignals(context) {
    // Validate inputs
    if (!context.marketData || context.marketData.length === 0) {
      throw new Error('No market data available');
    }
    
    // Strategy implementation
    return [];
  }
}
```

### Configuration Management

Use environment variables for configuration:

```javascript
class ConfigurablePlugin {
  constructor() {
    this.config = {
      apiKey: process.env.PLUGIN_API_KEY,
      baseUrl: process.env.PLUGIN_BASE_URL || 'https://api.example.com',
      timeout: parseInt(process.env.PLUGIN_TIMEOUT) || 5000
    };
    
    // Validate required config
    if (!this.config.apiKey) {
      throw new Error('PLUGIN_API_KEY environment variable required');
    }
  }
}
```

## Testing Plugins

### Unit Testing

```javascript
// test/my-plugin.test.js
const { register } = require('../index');

describe('My Plugin', () => {
  let mockContext;
  let registeredStrategy;
  
  beforeEach(() => {
    mockContext = {
      db: { execute: jest.fn() },
      logger: { info: jest.fn(), error: jest.fn() },
      registerStrategy: jest.fn((name, strategy) => {
        registeredStrategy = strategy;
      })
    };
  });
  
  test('registers strategy correctly', async () => {
    await register(mockContext);
    
    expect(mockContext.registerStrategy).toHaveBeenCalledWith(
      'my-strategy',
      expect.any(Object)
    );
  });
  
  test('generates valid signals', async () => {
    await register(mockContext);
    
    const result = await registeredStrategy.execute({
      marketData: [
        { symbol: 'BTC', close: 50000 },
        { symbol: 'BTC', close: 51000 }
      ],
      timestamp: new Date()
    });
    
    expect(result.signals).toBeDefined();
    expect(Array.isArray(result.signals)).toBe(true);
  });
});
```

### Integration Testing

```javascript
// test/integration.test.js
const request = require('supertest');
const app = require('../server/app');

describe('Plugin Integration', () => {
  test('executes strategy via API', async () => {
    const response = await request(app)
      .post('/api/plugins/strategies/execute')
      .send({
        strategyName: 'my-strategy',
        context: {
          marketData: [{ symbol: 'BTC', close: 50000 }],
          timestamp: new Date().toISOString()
        }
      });
    
    expect(response.status).toBe(200);
    expect(response.body.data.signals).toBeDefined();
  });
});
```

## Plugin Distribution

### Creating a Plugin Package

```bash
# 1. Create tarball
tar -czf my-plugin-v1.0.0.tgz manifest.json index.js README.md

# 2. Or use npm pack
npm pack
```

### Publishing to Marketplace

```javascript
// marketplace-submit.js
const FormData = require('form-data');
const fs = require('fs');

const form = new FormData();
form.append('plugin', fs.createReadStream('my-plugin-v1.0.0.tgz'));
form.append('metadata', JSON.stringify({
  name: 'my-plugin',
  version: '1.0.0',
  category: 'strategies',
  price: 'free',
  description: 'Amazing plugin that does X, Y, and Z'
}));

// Submit to marketplace
const response = await fetch('https://marketplace.skippy.com/api/submit', {
  method: 'POST',
  body: form,
  headers: {
    'Authorization': `Bearer ${MARKETPLACE_API_KEY}`
  }
});
```

## Performance Optimization

### Caching

```javascript
class CachedStrategy {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 60000; // 1 minute
  }
  
  async execute(context) {
    const cacheKey = this.generateCacheKey(context);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.result;
    }
    
    const result = await this.generateSignals(context);
    
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
    
    return result;
  }
  
  generateCacheKey(context) {
    return `${context.symbol}-${context.timestamp}`;
  }
}
```

### Memory Management

```javascript
class MemoryEfficientPlugin {
  constructor() {
    this.dataBuffer = [];
    this.maxBufferSize = 1000;
  }
  
  addData(data) {
    this.dataBuffer.push(data);
    
    // Prevent memory leaks
    if (this.dataBuffer.length > this.maxBufferSize) {
      this.dataBuffer = this.dataBuffer.slice(-this.maxBufferSize);
    }
  }
  
  cleanup() {
    this.dataBuffer = [];
  }
}
```

## Troubleshooting

### Common Issues

1. **Plugin Not Loading**
   ```bash
   # Check plugin logs
   curl http://localhost:5000/api/plugins/my-plugin
   
   # Validate manifest
   npm run skippy plugins validate --dir ./my-plugin
   ```

2. **Permission Denied**
   ```json
   // Add required permissions to manifest.json
   {
     "permissions": ["market_data", "portfolio_access"]
   }
   ```

3. **Memory Leaks**
   ```javascript
   // Implement cleanup in plugin
   class CleanPlugin {
     async disconnect() {
       // Clean up resources
       this.cache.clear();
       this.intervals.forEach(clearInterval);
     }
   }
   ```

### Debugging

```javascript
async function register(context) {
  const { logger } = context;
  
  // Enable debug logging
  logger.info('Plugin starting...');
  
  try {
    // Plugin code
  } catch (error) {
    logger.error('Plugin error', { 
      error: error.message,
      stack: error.stack 
    });
    throw error;
  }
}
```

## Plugin Examples

### RSI Strategy

```javascript
class RSIStrategy {
  constructor() {
    this.name = 'RSI Strategy';
    this.parameters = {
      period: 14,
      overbought: 70,
      oversold: 30
    };
  }

  async execute(context) {
    const { marketData } = context;
    const prices = marketData.map(candle => candle.close);
    const rsi = this.calculateRSI(prices, this.parameters.period);
    
    const signals = [];
    const currentRSI = rsi[rsi.length - 1];
    
    if (currentRSI < this.parameters.oversold) {
      signals.push({
        type: 'buy',
        symbol: 'BTC',
        confidence: 0.8,
        reason: `RSI oversold: ${currentRSI.toFixed(2)}`
      });
    } else if (currentRSI > this.parameters.overbought) {
      signals.push({
        type: 'sell',
        symbol: 'BTC',
        confidence: 0.8,
        reason: `RSI overbought: ${currentRSI.toFixed(2)}`
      });
    }
    
    return { signals };
  }
  
  calculateRSI(prices, period) {
    // RSI calculation implementation
    const gains = [];
    const losses = [];
    
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    const rsi = [];
    let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;
    
    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
    
    return rsi;
  }
}
```

This guide provides everything you need to build powerful plugins for the Skippy platform. Start with the quick start example and gradually explore more advanced features as your needs grow.