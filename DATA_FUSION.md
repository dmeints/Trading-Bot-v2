# Data Fusion: On-Chain & Sentiment Analysis

## Overview
Skippy's data fusion system combines on-chain whale activity monitoring with social media sentiment analysis to provide comprehensive market context. This system surfaces whale transfers, large swaps, and sentiment trends to enhance trading decision-making.

## Architecture

### On-Chain Service (`server/services/onChainService.ts`)
- **Whale Transfer Monitoring**: Tracks large cryptocurrency movements
- **Event Classification**: Categorizes transfers, swaps, and bridge activity
- **Real-time Ingestion**: Fetches data every 30 minutes
- **Exchange Integration**: Identifies major exchange wallets

### Sentiment Service (`server/services/sentimentService.ts`)
- **Multi-Source Analysis**: Reddit, Twitter, news aggregation
- **Daily Scoring**: Normalized sentiment scores (-1 to +1)
- **Keyword Tracking**: Identifies trending topics
- **Historical Trends**: 7-day sentiment history

## Database Schema

### On-Chain Events
```sql
CREATE TABLE onchain_events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash VARCHAR UNIQUE NOT NULL,
  block_number BIGINT NOT NULL,
  token VARCHAR NOT NULL,
  amount DECIMAL(20, 8) NOT NULL,
  from_address VARCHAR NOT NULL,
  to_address VARCHAR NOT NULL,
  event_type VARCHAR NOT NULL CHECK (event_type IN ('whale_transfer', 'large_swap', 'bridge_activity')),
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL
);
```

### Daily Sentiment
```sql
CREATE TABLE daily_sentiment (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  score DECIMAL(5, 4) NOT NULL CHECK (score >= -1 AND score <= 1),
  source VARCHAR NOT NULL CHECK (source IN ('reddit', 'twitter', 'news', 'aggregate')),
  token VARCHAR,
  metadata JSONB DEFAULT '{}',
  UNIQUE(date, source, token)
);
```

## API Endpoints

### On-Chain Data

#### GET `/api/fusion/onchain/events`
Retrieve recent on-chain events.

**Parameters:**
- `hours` (number, optional): Hours of history (default: 24)
- `token` (string, optional): Filter by specific token

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "onchain_123",
      "tx_hash": "0xabc123...",
      "block_number": 18500000,
      "token": "BTC",
      "amount": 150.5,
      "from_address": "0x123...",
      "to_address": "0x456...",
      "event_type": "whale_transfer",
      "timestamp": "2024-01-15T10:30:00Z",
      "metadata": {
        "usd_value": 6750000,
        "exchange": "Binance"
      }
    }
  ]
}
```

#### POST `/api/fusion/onchain/fetch`
Trigger manual on-chain data ingestion.

### Sentiment Data

#### GET `/api/fusion/sentiment`
Retrieve sentiment data.

**Parameters:**
- `days` (number, optional): Days of history (default: 7)
- `token` (string, optional): Filter by specific token
- `source` (string, optional): Filter by source (reddit, twitter, news, aggregate)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "sentiment_123",
      "date": "2024-01-15",
      "score": 0.25,
      "source": "reddit",
      "token": "BTC",
      "metadata": {
        "positive_mentions": 450,
        "negative_mentions": 200,
        "neutral_mentions": 350,
        "total_mentions": 1000,
        "trending_keywords": ["bitcoin", "hodl", "moon"]
      }
    }
  ]
}
```

#### GET `/api/fusion/sentiment/aggregate`
Get aggregated sentiment summary.

#### POST `/api/fusion/sentiment/fetch`
Trigger manual sentiment data fetch.

### Market Context

#### GET `/api/fusion/market-context`
Combined on-chain and sentiment analysis.

**Parameters:**
- `token` (string, optional): Target token (default: BTC)
- `hours` (number, optional): Time window (default: 24)

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "BTC",
    "onchain_events": [...],
    "sentiment": [...],
    "summary": {
      "recent_whale_activity": 3,
      "avg_sentiment": 0.15,
      "total_mentions": 5000
    }
  }
}
```

## UI Components

### OnChainEvents
```tsx
import { OnChainEvents } from "@/components/OnChainEvents";

<OnChainEvents 
  token="BTC" 
  maxItems={5} 
/>
```

**Features:**
- Real-time whale transfer alerts
- Transaction details with links
- Exchange identification
- USD value calculation
- Responsive card layout

### SentimentIndicator
```tsx
import { SentimentIndicator } from "@/components/SentimentIndicator";

<SentimentIndicator 
  token="BTC"
  showSparkline={true}
  compact={false}
/>
```

**Features:**
- Sentiment scoring with visual indicators
- 7-day trend sparkline
- Trending keywords display
- Social media mention counts
- Compact mode for dashboards

## Automated Data Collection

### On-Chain Cron Job (Every 30 minutes)
```typescript
// server/jobs/onChainCron.ts
cron.schedule('*/30 * * * *', async () => {
  await onChainService.fetchWhaleTransfers();
});
```

### Sentiment Cron Job (Daily at midnight UTC)
```typescript
// server/jobs/sentimentCron.ts
cron.schedule('0 0 * * *', async () => {
  await sentimentService.fetchDailySentiment();
});
```

## Chart Integration

### Price Chart Overlays
On-chain events appear as vertical markers on price charts:
- **Whale transfers**: Blue markers with transfer amounts
- **Large swaps**: Green markers with swap details
- **Bridge activity**: Purple markers with cross-chain info

### Sentiment Sparklines
7-day sentiment trends display alongside price data:
- **Positive sentiment**: Green trend line
- **Negative sentiment**: Red trend line
- **Neutral sentiment**: Gray trend line

## Data Sources & Integration

### On-Chain APIs (Planned)
- **Etherscan API**: Ethereum whale transfers
- **Covalent API**: Multi-chain transaction data
- **Whale Alert**: Real-time large transaction monitoring
- **DefiPulse**: DeFi protocol activity

### Sentiment APIs (Planned)
- **Reddit API**: Subreddit sentiment analysis
- **Twitter API**: Crypto-related tweet sentiment
- **NewsAPI**: Cryptocurrency news sentiment
- **CoinTelegraph**: Professional news analysis

## Configuration

### Environment Variables
```bash
# Optional: External API keys for enhanced data
ETHERSCAN_API_KEY=your_key_here
TWITTER_API_KEY=your_key_here
REDDIT_API_KEY=your_key_here
NEWS_API_KEY=your_key_here
```

### Thresholds
```typescript
// Whale transfer thresholds
const WHALE_THRESHOLDS = {
  BTC: 50,    // 50+ BTC
  ETH: 1000,  // 1000+ ETH
  SOL: 10000, // 10000+ SOL
};

// Sentiment significance thresholds
const SENTIMENT_THRESHOLDS = {
  VERY_POSITIVE: 0.3,
  POSITIVE: 0.1,
  NEUTRAL: 0.1,
  NEGATIVE: -0.1,
  VERY_NEGATIVE: -0.3
};
```

## Performance & Scalability

### Caching Strategy
- **On-chain events**: 5-minute cache for recent events
- **Sentiment data**: 30-minute cache for current scores
- **Market context**: 10-minute cache for combined data

### Database Optimization
- Indexes on timestamp, token, and event_type
- Partitioning by date for historical data
- Automatic cleanup of old events (90+ days)

### Rate Limiting
- API endpoint rate limits per user
- External API quota management
- Graceful degradation when sources unavailable

## Monitoring & Alerts

### System Health
- On-chain data ingestion success rate
- Sentiment API response times
- Database storage growth
- Cache hit ratios

### Business Metrics
- Whale activity correlation with price movements
- Sentiment accuracy vs. market performance
- User engagement with fusion data
- Alert effectiveness measurement

## Troubleshooting

### Common Issues

1. **On-chain data gaps**
   - Check external API connectivity
   - Verify whale threshold configurations
   - Monitor blockchain node synchronization

2. **Sentiment scoring inconsistencies**
   - Validate sentiment model performance
   - Check for data source API changes
   - Review keyword filtering logic

3. **Performance degradation**
   - Monitor database query performance
   - Check cache invalidation patterns
   - Optimize data aggregation queries

### Debugging Commands
```bash
# Check on-chain service status
npm run skippy system status

# Manual data fetch
curl -X POST /api/fusion/onchain/fetch
curl -X POST /api/fusion/sentiment/fetch

# Database health check
npm run skippy db health
```

## Future Enhancements

### Planned Features
- **Real-time WebSocket updates** for whale alerts
- **Machine learning sentiment models** for improved accuracy
- **Cross-chain bridge monitoring** for multi-chain analysis
- **Social media influencer tracking** for alpha signals
- **Predictive modeling** combining on-chain and sentiment data

### Advanced Analytics
- **Correlation analysis** between whale activity and price movements
- **Sentiment momentum indicators** for trend prediction
- **Multi-timeframe analysis** for different trading strategies
- **Portfolio impact assessment** based on market context