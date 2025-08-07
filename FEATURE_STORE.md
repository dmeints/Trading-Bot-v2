# 🏪 Stevie v1.3 - Feature Store Documentation

The Feature Store is the central hub for Stevie's market intelligence, transforming raw data into ML-ready features for enhanced trading decisions.

## 🎯 Architecture Overview

The Feature Store follows a layered architecture designed for real-time performance and scalability:

```
┌─────────────────────────────────────────────────────┐
│                 API Layer                           │
│  /api/features  /api/sentiment  /api/analysis      │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│               Feature Service                       │
│  Feature Generation │ Caching │ Aggregation        │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│                Data Layer                           │
│  CSV Storage │ WebSocket │ API Integrations         │
└─────────────────────────────────────────────────────┘
```

## 📊 Feature Categories

### 1. Price & Volume Features (OHLCV)
**Source**: Exchange WebSocket streams  
**Update Frequency**: Real-time  
**Retention**: 50 most recent bars

```typescript
ohlcv: {
  open: number[];      // Opening prices
  high: number[];      // High prices
  low: number[];       // Low prices
  close: number[];     // Closing prices
  volume: number[];    // Trading volumes
}
```

**Engineering**:
- Normalized price changes: `(current - previous) / previous`
- Volume-weighted average price (VWAP)
- Price momentum over multiple timeframes
- Volatility calculations (rolling standard deviation)

### 2. Order Book Features
**Source**: Binance & Coinbase Pro WebSocket depth streams  
**Update Frequency**: 100ms snapshots  
**Depth**: Top 5 bid/ask levels

```typescript
orderBook: {
  bidDepth: number[];        // Bid volumes at top 5 levels
  askDepth: number[];        // Ask volumes at top 5 levels
  spread: number;            // Best bid-ask spread
  imbalance: number;         // Order book imbalance (-0.5 to 0.5)
  liquidityScore: number;    // Overall liquidity assessment
}
```

**Engineering**:
- Imbalance calculation: `(bidVol - askVol) / (bidVol + askVol)`
- Liquidity score: `totalDepth / midPrice`
- Spread normalization: `spread / midPrice`
- Depth-weighted averages

### 3. Technical Indicators
**Source**: Calculated from OHLCV data  
**Update Frequency**: Real-time with new price data  
**Indicators**: RSI, MACD, Bollinger Bands, Momentum

```typescript
technical: {
  rsi: number;                    // RSI (14-period)
  macd: number;                   // MACD line
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    position: number;             // Current price position (0-1)
  };
  volatility: number;             // 20-period annualized volatility
  momentum: number[];             // 1,3,7,14 day momentum
}
```

**Engineering**:
- RSI with 14-period smoothing
- MACD (12,26,9) configuration
- Bollinger Bands (20, 2) settings
- Momentum: `(current - previous) / previous`

### 4. Sentiment Features
**Source**: Fear & Greed Index, CoinGecko, social media  
**Update Frequency**: Every 2 minutes  
**Metrics**: Psychological indicators and social activity

```typescript
sentiment: {
  fearGreedIndex: number;         // 0-100 scale
  sentimentScore: number;         // -1 to +1 normalized score
  socialMentions: number;         // Recent mention count
  trendingRank: number;           // Trending position (0 or 1)
}
```

**Engineering**:
- Fear/Greed normalization: `(index - 50) / 50`
- Sentiment aggregation from multiple sources
- Trending boost factor (1.2x for trending coins)
- Social mention velocity tracking

### 5. On-Chain Features
**Source**: Blockchair (Bitcoin), Etherscan (Ethereum)  
**Update Frequency**: Every 5 minutes  
**Metrics**: Network health and activity indicators

```typescript
onChain: {
  // Bitcoin-specific
  difficulty?: number;            // Mining difficulty
  hashrate?: number;             // Network hashrate
  mempoolSize?: number;          // Mempool transaction count
  
  // Ethereum-specific
  gasPrice?: number;             // Standard gas price
  totalSupply?: number;          // Total ETH supply
  
  networkActivity: number;        // 0-1 normalized activity score
}
```

**Engineering**:
- Activity scoring for Bitcoin: `(hashrate + mempool + blocks) / 3`
- Activity scoring for Ethereum: `(gasPrice + supply) / 2`
- Normalization to handle different scales
- Network health composite scoring

### 6. Derivatives Features
**Source**: Binance Futures API  
**Update Frequency**: Every minute  
**Metrics**: Funding rates and open interest

```typescript
derivatives: {
  fundingRate: number;            // Current 8-hour funding rate
  openInterest: number;           // Total open interest
  fundingTrend: number;          // 8-hour trend in funding
  leverageRatio: number;         // Estimated leverage ratio
}
```

**Engineering**:
- Annualized funding rate: `rate * 365 * 3`
- Funding trend: `current - 8hourAverage`
- Leverage estimation: `min(10, abs(funding) * 10000)`
- Risk assessment from funding extremes

### 7. Macro Events Features
**Source**: Trading Economics Calendar  
**Update Frequency**: Every 15 minutes  
**Metrics**: Economic event proximity and impact

```typescript
macroEvents: {
  eventProximity: number;         // 0-1 (time until next major event)
  impactScore: number;           // Cumulative impact of upcoming events
  marketRegime: string;          // 'normal', 'event-driven', 'high-impact-event'
}
```

**Engineering**:
- Proximity calculation: `max(0, 1 - days_until_event / 7)`
- Impact scoring based on event importance and country
- Regime classification using thresholds
- Country impact multipliers (US: 1.5x, China/EU: 1.2x)

## 🎯 Feature Engineering Principles

### 1. Normalization Strategy
All features are normalized to common scales to prevent one metric from dominating others:

- **Price changes**: Percentage-based normalization
- **Technical indicators**: Scale-specific normalization (RSI: 0-100, others: centered)  
- **Volume**: Relative to average volume
- **Time-based**: Exponential decay for older data

### 2. Missing Data Handling
- **Forward fill**: Use last known value for short gaps
- **Zero fill**: Use neutral values for completely missing data
- **Interpolation**: Linear interpolation for longer gaps
- **Fallback**: Default values that don't bias decisions

### 3. Feature Validation
```typescript
// Automatic validation pipeline
interface FeatureValidation {
  range: [number, number];        // Expected value range
  nullPolicy: 'allow' | 'reject'; // How to handle nulls
  outlierThreshold: number;       // Z-score threshold for outliers
  freshness: number;              // Maximum age in milliseconds
}
```

## ⚡ Performance Optimizations

### 1. Caching Strategy
- **L1 Cache**: In-memory (30-second TTL)
- **L2 Cache**: Redis (5-minute TTL) - when available
- **L3 Cache**: File system (permanent storage)

### 2. Batch Processing
- **Bulk CSV reads**: Read entire files in chunks
- **Vectorized calculations**: Compute features in batches
- **Parallel processing**: Multi-threaded feature generation

### 3. Lazy Loading
- **On-demand computation**: Only calculate requested features
- **Progressive loading**: Start with lightweight features
- **Smart caching**: Cache expensive calculations longer

## 📈 Feature Quality Metrics

### 1. Completeness Score
```typescript
completeness = (non_null_features / total_features) * 100
```
**Target**: > 95% for all symbols

### 2. Freshness Score
```typescript
freshness = 1 - (age_in_minutes / max_age_minutes)
```
**Target**: > 0.8 for real-time features

### 3. Consistency Score
```typescript
consistency = (features_within_expected_range / total_features) * 100
```
**Target**: > 98% for all feature types

## 🔍 Feature Selection & Importance

### High-Impact Features (Correlation > 0.6)
1. **Technical RSI**: Strong reversal signals
2. **Funding Rate**: Leverage and sentiment indicator
3. **Order Book Imbalance**: Short-term direction predictor
4. **Fear/Greed Index**: Market psychology gauge
5. **Volume Profile**: Trend confirmation

### Medium-Impact Features (Correlation 0.3-0.6)
1. **MACD**: Trend changes and momentum
2. **Bollinger Position**: Overbought/oversold levels
3. **Network Activity**: Long-term health indicator
4. **Event Proximity**: Volatility timing
5. **Social Mentions**: Crowd behavior

### Supporting Features (Correlation < 0.3)
1. **Price Momentum**: Trend confirmation
2. **Volatility**: Risk assessment
3. **Market Hours**: Traditional market correlation
4. **Gas Prices**: Network congestion indicator

## 🛠️ Development & Testing

### Feature Development Workflow
1. **Design**: Define feature specification and engineering
2. **Implement**: Code feature extraction and normalization
3. **Validate**: Test with historical data and edge cases
4. **Backtest**: Evaluate feature impact on trading performance
5. **Deploy**: Add to production feature pipeline

### Testing Strategy
```typescript
// Feature unit tests
describe('FeatureService', () => {
  it('should generate valid RSI values', () => {
    expect(features.technical.rsi).toBeGreaterThan(0);
    expect(features.technical.rsi).toBeLessThan(100);
  });
  
  it('should handle missing data gracefully', () => {
    expect(features.ohlcv.close).toHaveLength.greaterThan(0);
  });
});
```

### Performance Testing
- **Load testing**: 1000 concurrent feature requests
- **Latency testing**: Sub-50ms response times
- **Memory testing**: Efficient memory usage under load
- **Data integrity**: Validate feature consistency over time

## 📊 Usage Examples

### Basic Feature Access
```typescript
const featureService = new FeatureService();

// Get current features
const features = await featureService.getFeatures('BTCUSDT');

// Check technical indicators
if (features.technical.rsi > 70) {
  console.log('Overbought condition detected');
}

// Analyze sentiment
if (features.sentiment.fearGreedIndex < 25) {
  console.log('Extreme fear - potential buying opportunity');
}
```

### Advanced Feature Analysis
```typescript
// Multi-timeframe analysis
const timeframes = [
  Date.now(),
  Date.now() - 60000,   // 1 minute ago
  Date.now() - 300000,  // 5 minutes ago
];

const analysis = await Promise.all(
  timeframes.map(ts => featureService.getFeatures('BTCUSDT', ts))
);

// Trend analysis
const rsiTrend = analysis.map(f => f.technical.rsi);
const isRsiRising = rsiTrend[0] > rsiTrend[1] && rsiTrend[1] > rsiTrend[2];
```

### Feature Store Monitoring
```typescript
// Health check endpoint
app.get('/api/features/health', async (req, res) => {
  const stats = {
    completeness: await calculateCompleteness(),
    freshness: await calculateFreshness(),
    latency: await measureLatency(),
    errorRate: await getErrorRate()
  };
  
  res.json({ healthy: stats.completeness > 0.95, stats });
});
```

## 🔮 Future Enhancements

### Planned Features
1. **Cross-asset correlations**: BTC-ETH, crypto-traditional markets
2. **Whale movement tracking**: Large transaction detection
3. **DeFi metrics**: TVL changes, yield farming activity
4. **News sentiment**: Real-time news impact scoring
5. **Options flow**: Unusual options activity detection

### Advanced Engineering
1. **Feature embeddings**: Vector representations of market states
2. **Dynamic feature selection**: ML-driven feature importance
3. **Anomaly detection**: Unusual market condition identification
4. **Regime detection**: Market phase classification
5. **Predictive features**: Forward-looking indicators

---

*Feature Store Version: 1.3*  
*Last Updated: August 7, 2025*  
*Performance Status: ✅ Optimal*