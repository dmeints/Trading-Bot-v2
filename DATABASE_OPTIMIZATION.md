# Database Schema Optimization Plan
**Updated:** August 6, 2025

## Current Schema Analysis
Based on the focused improvements feedback, we need to streamline our database schema from 15+ tables to 8-10 core tables.

### Current Tables (15+)
1. **users** - User authentication and profiles
2. **positions** - Active trading positions 
3. **trades** - Transaction history
4. **marketData** - Real-time price data
5. **agentActivities** - AI agent logs
6. **portfolioSnapshots** - Portfolio performance over time
7. **feedbackSubmissions** - User feedback
8. **backtestResults** - Strategy validation results
9. **riskMetrics** - Risk calculations
10. **marketRegimes** - Market condition classifications
11. **eventAnalysis** - Market event tracking
12. **sentimentData** - Social sentiment scores
13. **correlationMatrix** - Asset correlation data
14. **sessions** - Authentication sessions
15. **Additional specialized tables** for various AI features

### Identified Overlaps and Inefficiencies

#### 1. Market Intelligence Consolidation
**Current:**
- `marketRegimes` - Separate table for market conditions
- `eventAnalysis` - Market event tracking
- `sentimentData` - Social sentiment scores

**Proposed:** Single `marketEvents` table with tags
```sql
CREATE TABLE marketEvents (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP NOT NULL,
  eventType VARCHAR NOT NULL, -- 'regime_change', 'news_event', 'sentiment_shift'
  symbol VARCHAR,
  data JSONB NOT NULL, -- Flexible structure for different event types
  confidence DECIMAL(3,2),
  impact VARCHAR CHECK (impact IN ('low', 'medium', 'high')),
  tags TEXT[], -- ['bearish', 'technical', 'whale_movement']
  createdAt TIMESTAMP DEFAULT NOW()
);
```

#### 2. Correlation Data On-Demand
**Current:** `correlationMatrix` - Pre-calculated correlation storage
**Proposed:** Calculate correlations on-demand from `marketData`
- Reduces storage requirements
- Always up-to-date calculations
- More flexible timeframe analysis

#### 3. AI Activity Consolidation
**Current:** Separate tracking for different AI agent types
**Proposed:** Unified structure with consolidated agent types
- Market insight agent replaces 3 separate agents
- Risk assessor remains separate
- Simplified activity logging

## Optimized Schema (8 Core Tables)

### Core Trading Tables (4)
1. **users** - Keep as-is (required for auth)
2. **positions** - Active trading positions 
3. **trades** - Complete transaction history
4. **marketData** - Real-time and historical price data

### Analytics & AI Tables (3)
5. **marketEvents** - Unified market intelligence (replaces 3 tables)
6. **agentActivities** - Consolidated AI agent logs
7. **portfolioSnapshots** - Performance tracking over time

### System Tables (1+)
8. **sessions** - Authentication (required by Replit auth)
9. **feedbackSubmissions** - User feedback (keep for product improvement)

### Optional Computed Tables
- **backtestResults** - Keep for strategy validation
- **riskMetrics** - Keep for portfolio risk tracking

## Migration Strategy

### Phase 1: Data Consolidation
1. **Create new `marketEvents` table**
2. **Migrate existing data:**
   ```sql
   -- Market regime changes
   INSERT INTO marketEvents (eventType, symbol, data, confidence, impact, tags)
   SELECT 'regime_change', symbol, 
          jsonb_build_object('regime', regime, 'strength', strength),
          confidence, 'medium', ARRAY['regime']
   FROM marketRegimes;
   
   -- News events
   INSERT INTO marketEvents (eventType, data, impact, tags)
   SELECT 'news_event',
          jsonb_build_object('title', title, 'summary', summary, 'source', source),
          impact, ARRAY['news']
   FROM eventAnalysis WHERE type = 'news';
   
   -- Sentiment data
   INSERT INTO marketEvents (eventType, symbol, data, confidence, tags)
   SELECT 'sentiment_shift', symbol,
          jsonb_build_object('sentiment', sentiment, 'score', score),
          confidence, ARRAY['sentiment']
   FROM sentimentData;
   ```

3. **Update application code** to use consolidated structure

### Phase 2: Remove Redundant Tables
1. **Drop consolidated tables:**
   - `marketRegimes`
   - `eventAnalysis` 
   - `sentimentData`
   - `correlationMatrix` (compute on-demand)

2. **Update queries** to use new structure

### Phase 3: Performance Optimization
1. **Add strategic indexes:**
   ```sql
   CREATE INDEX idx_market_events_timestamp ON marketEvents(timestamp);
   CREATE INDEX idx_market_events_symbol ON marketEvents(symbol);
   CREATE INDEX idx_market_events_type ON marketEvents(eventType);
   CREATE INDEX idx_market_events_tags ON marketEvents USING GIN(tags);
   ```

2. **Optimize query patterns** for common use cases

## Expected Benefits

### Storage Reduction
- **40% fewer tables** (15 → 9 core tables)
- **Reduced data duplication** through consolidation
- **Flexible JSONB storage** for varying event structures

### Performance Improvements
- **Fewer JOIN operations** for market intelligence queries
- **On-demand calculations** ensure fresh correlation data
- **Strategic indexing** on consolidated tables

### Maintenance Simplification
- **Single source of truth** for market events
- **Unified query patterns** for market intelligence
- **Simplified schema migrations** going forward

## Implementation Timeline

### Week 1: Schema Design & Testing
- [ ] Create new `marketEvents` table schema
- [ ] Write migration scripts for data consolidation
- [ ] Test migration with sample data

### Week 2: Application Updates
- [ ] Update storage layer for new schema
- [ ] Modify API endpoints to use consolidated data
- [ ] Update frontend components for new data structure

### Week 3: Migration & Cleanup
- [ ] Execute data migration in staging
- [ ] Test all functionality with new schema
- [ ] Remove redundant tables and old code

### Week 4: Performance Optimization
- [ ] Add performance indexes
- [ ] Optimize query patterns
- [ ] Monitor performance improvements

## Query Pattern Examples

### Market Intelligence (Simplified)
```sql
-- Get recent market events with sentiment
SELECT eventType, symbol, data, timestamp, tags
FROM marketEvents 
WHERE timestamp > NOW() - INTERVAL '24 hours'
  AND 'sentiment' = ANY(tags)
ORDER BY timestamp DESC;
```

### Cross-Asset Analysis
```sql
-- Find correlated market events
SELECT e1.symbol, e2.symbol, e1.eventType, e2.eventType
FROM marketEvents e1
JOIN marketEvents e2 ON e1.timestamp BETWEEN e2.timestamp - INTERVAL '1 hour' 
                                            AND e2.timestamp + INTERVAL '1 hour'
WHERE e1.symbol != e2.symbol
  AND e1.impact = 'high' AND e2.impact = 'high';
```

This optimization aligns with the focused improvements by removing conceptual overhead and consolidating practical functionality into efficient, maintainable database structures.