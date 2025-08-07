// Example EMA Crossover Strategy Plugin
const { calculateEMA } = require('./indicators');

class EMACrossoverStrategy {
  constructor(fastPeriod = 12, slowPeriod = 26) {
    this.fastPeriod = fastPeriod;
    this.slowPeriod = slowPeriod;
    this.name = 'EMA Crossover';
    this.description = 'Generates buy/sell signals based on EMA crossovers';
    this.parameters = {
      fastPeriod: this.fastPeriod,
      slowPeriod: this.slowPeriod
    };
  }

  async execute(context) {
    const { marketData, timestamp } = context;
    
    if (!marketData || marketData.length < this.slowPeriod) {
      return { signals: [] };
    }

    // Extract price data (assuming OHLCV format)
    const prices = marketData.map(candle => candle.close);
    
    // Calculate EMAs
    const fastEMA = calculateEMA(prices, this.fastPeriod);
    const slowEMA = calculateEMA(prices, this.slowPeriod);
    
    if (fastEMA.length < 2 || slowEMA.length < 2) {
      return { signals: [] };
    }

    const signals = [];
    const currentFast = fastEMA[fastEMA.length - 1];
    const currentSlow = slowEMA[slowEMA.length - 1];
    const prevFast = fastEMA[fastEMA.length - 2];
    const prevSlow = slowEMA[slowEMA.length - 2];

    // Detect crossovers
    if (prevFast <= prevSlow && currentFast > currentSlow) {
      // Bullish crossover
      signals.push({
        type: 'buy',
        symbol: marketData[marketData.length - 1].symbol || 'BTC',
        confidence: 0.75,
        reason: `Fast EMA (${this.fastPeriod}) crossed above Slow EMA (${this.slowPeriod})`
      });
    } else if (prevFast >= prevSlow && currentFast < currentSlow) {
      // Bearish crossover
      signals.push({
        type: 'sell',
        symbol: marketData[marketData.length - 1].symbol || 'BTC',
        confidence: 0.75,
        reason: `Fast EMA (${this.fastPeriod}) crossed below Slow EMA (${this.slowPeriod})`
      });
    }

    return {
      signals,
      metadata: {
        fastEMA: currentFast,
        slowEMA: currentSlow,
        trend: currentFast > currentSlow ? 'bullish' : 'bearish',
        timestamp: timestamp.toISOString()
      }
    };
  }
}

// Data connector example
class ExampleDataConnector {
  constructor() {
    this.name = 'Example Data Source';
    this.description = 'Demonstrates how to create a custom data connector';
    this.connected = false;
  }

  async connect() {
    this.connected = true;
    console.log('Example data connector connected');
  }

  async fetchData(params = {}) {
    if (!this.connected) {
      throw new Error('Data connector not connected');
    }

    // Mock data fetch
    return {
      timestamp: new Date(),
      data: [
        { symbol: 'BTC', price: 45000 + Math.random() * 1000 },
        { symbol: 'ETH', price: 3000 + Math.random() * 200 }
      ]
    };
  }

  async disconnect() {
    this.connected = false;
    console.log('Example data connector disconnected');
  }
}

// Signal transformer example
class PriceNormalizer {
  constructor() {
    this.name = 'Price Normalizer';
    this.description = 'Normalizes price data to a 0-1 range';
  }

  async transform(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return data;
    }

    const prices = data.map(item => item.price).filter(p => typeof p === 'number');
    if (prices.length === 0) return data;

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice;

    return data.map(item => ({
      ...item,
      normalizedPrice: range > 0 ? (item.price - minPrice) / range : 0.5
    }));
  }
}

// Plugin registration function
async function register(context) {
  const { logger, registerStrategy, registerDataConnector, registerSignalTransformer, registerUIPanel } = context;
  
  logger.info('Registering EMA Crossover Strategy Plugin');

  // Register strategy
  const strategy = new EMACrossoverStrategy();
  registerStrategy('ema-crossover', strategy);

  // Register data connector
  const dataConnector = new ExampleDataConnector();
  registerDataConnector('example-source', dataConnector);

  // Register signal transformer
  const transformer = new PriceNormalizer();
  registerSignalTransformer('price-normalizer', transformer);

  // Register UI panel
  registerUIPanel('ema-crossover-panel', {
    name: 'EMA Crossover Panel',
    component: 'EMACrossoverPanel',
    position: 'dashboard',
    props: {
      fastPeriod: 12,
      slowPeriod: 26
    }
  });

  logger.info('EMA Crossover Strategy Plugin registered successfully');
}

module.exports = {
  register,
  EMACrossoverStrategy,
  ExampleDataConnector,
  PriceNormalizer
};