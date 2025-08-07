# Vector Search & Memory System

## Overview
Skippy's vector-first memory system enables semantic search across historical trades, AI signals, and backtest results. The system uses OpenAI embeddings to create searchable memory layers for surfacing similar scenarios and contextual insights.

## Architecture

### Vector Service (`server/services/vectorService.ts`)
- **Embedding Generation**: Uses OpenAI `text-embedding-3-small` model
- **Vector Storage**: PostgreSQL with vector extension for similarity search
- **Indexing**: Automated hourly ingestion of new data
- **Search**: Cosine similarity search with configurable result limits

### Database Schema
```sql
-- Vector index metadata tracking
CREATE TABLE vector_index_metadata (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  index_type VARCHAR NOT NULL,
  last_indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_records INTEGER DEFAULT 0,
  version VARCHAR DEFAULT '1.0.0'
);

-- Vector records storage
CREATE TABLE vector_records (
  id VARCHAR PRIMARY KEY,
  type VARCHAR NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(1536),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## API Endpoints

### GET `/api/vector/similar`
Find similar records by ID or query text.

**Parameters:**
- `id` (string): Record ID to find similar items for
- `type` (string, optional): Filter by record type (trade, signal, backtest)
- `k` (number, optional): Number of results to return (default: 5)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "trade_123",
      "type": "trade",
      "content": "Trade: BTC buy 0.5 at $45000. PnL: $500. Strategy: momentum",
      "metadata": {
        "symbol": "BTC",
        "side": "buy",
        "quantity": 0.5,
        "price": 45000,
        "realized_pnl": 500
      },
      "timestamp": "2024-01-15T10:30:00Z",
      "similarity": 0.85
    }
  ]
}
```

### POST `/api/vector/query`
Search by text query.

**Body:**
```json
{
  "query": "Bitcoin trade with high profit",
  "type": "trade",
  "k": 5
}
```

### POST `/api/vector/reindex`
Trigger manual reindexing.

**Body:**
```json
{
  "type": "full" // or "trades", "signals", "backtests"
}
```

### GET `/api/vector/stats`
Get indexing statistics.

## CLI Commands

### Rebuild Complete Index
```bash
npm run skippy index:rebuild
```
Rebuilds the entire vector index from all historical data.

### Query Similar Records
```bash
npm run skippy index:query --id trade_123 --top 5
```
Find the 5 most similar records to a specific trade, signal, or backtest.

## UI Components

### FindSimilarButton
```tsx
import { FindSimilarButton } from "@/components/FindSimilarButton";

<FindSimilarButton 
  recordId="trade_123" 
  recordType="trade"
  variant="outline"
  size="sm"
/>
```

**Features:**
- Modal dialog with similar results
- Similarity scoring and color coding
- Metadata display (symbol, side, price, etc.)
- Responsive design with loading states

## Automated Indexing

### Hourly Cron Job
Vector indexing runs automatically every hour at minute 15:
- Indexes new trades since last run
- Indexes new AI signals and activities
- Indexes new backtest results
- Updates metadata timestamps

### Manual Triggering
```bash
# Via API
curl -X POST /api/vector/reindex \
  -H "Content-Type: application/json" \
  -d '{"type": "full"}'

# Via CLI
npm run skippy index:rebuild
```

## Performance Considerations

### Embedding Generation
- Uses OpenAI `text-embedding-3-small` (1536 dimensions)
- Batch processing for efficiency
- Error handling and retry logic

### Database Optimization
- Vector indexes for fast similarity search
- Partitioning by record type for large datasets
- Automatic cleanup of old vectors

### Memory Usage
- Lazy initialization of vector service
- Connection pooling for database access
- Efficient vector storage format

## Configuration

### Environment Variables
- `OPENAI_API_KEY`: Required for embedding generation
- `DATABASE_URL`: PostgreSQL connection with vector extension

### Indexing Schedule
- **Production**: Hourly indexing (*/15 * * * *)
- **Development**: Manual indexing only

## Troubleshooting

### Common Issues

1. **Vector extension not available**
   ```bash
   # Install pgvector extension
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. **OpenAI API errors**
   - Check API key configuration
   - Monitor rate limits and quotas
   - Implement exponential backoff

3. **Slow similarity searches**
   - Add vector indexes: `CREATE INDEX ON vector_records USING ivfflat (embedding vector_cosine_ops);`
   - Consider dimensionality reduction
   - Implement result caching

### Monitoring
- Track indexing job success/failure
- Monitor embedding generation latency
- Watch database storage growth
- Alert on similarity search timeouts

## Future Enhancements

### Planned Features
- Multi-modal embeddings (text + numerical data)
- Real-time streaming indexing
- Clustering and categorization
- Cross-strategy similarity analysis
- Temporal similarity weighting

### Scalability Improvements
- Distributed vector storage
- Approximate nearest neighbor search
- Hierarchical indexing
- Incremental updates