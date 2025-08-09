# API Guardrails Implementation Plan
**Date**: August 9, 2025  
**Priority**: High - Resource Protection & Cost Management

## Executive Summary

With 8 professional API integrations now active ($149/month in API costs), implementing intelligent guardrails is critical for:
- **Cost Control**: Preventing runaway API usage charges
- **Rate Limit Protection**: Avoiding service interruptions
- **Testing Efficiency**: Conserving resources during development
- **Production Readiness**: Ensuring sustainable usage patterns

---

## Current API Resource Profile

### Professional Tier APIs (Cost Risk)
- **CoinGecko Pro**: $49/month, unlimited requests (low risk)
- **X (Twitter) API**: $100/month, 10K tweets/month limit (high risk)

### Free Tier APIs (Rate Limit Risk)
- **Binance**: 1200 requests/minute (medium risk)
- **Reddit**: 100 requests/minute (medium risk) 
- **Etherscan**: 5 requests/second (high risk)
- **CryptoPanic**: 3000 requests/day (low risk)

### No Limits (Safe)
- **Fear & Greed Index**: No documented limits
- **Blockchair**: 10 requests/second free tier

---

## Proposed Guardrail Architecture

### 1. Request Rate Governor
**Implementation**: Middleware-based rate limiting per API service

```typescript
// Rate limits per service
const API_LIMITS = {
  coingecko: { requests: 50, window: 60000 },     // 50/minute
  binance: { requests: 1000, window: 60000 },     // Conservative limit
  twitter: { requests: 100, window: 900000 },     // 100/15min
  reddit: { requests: 80, window: 60000 },        // 80/minute
  etherscan: { requests: 200, window: 60000 },    // 200/minute (conservative)
  cryptopanic: { requests: 100, window: 86400000 } // 100/day
};
```

### 2. Smart Caching Layer
**Purpose**: Reduce redundant API calls through intelligent caching

- **Market Data**: Cache for 30 seconds (balance freshness vs calls)
- **Sentiment Data**: Cache for 5 minutes (slower-changing data)
- **On-chain Data**: Cache for 2 minutes (block-based updates)
- **Historical Data**: Cache for 24 hours (static data)

### 3. Circuit Breaker Pattern
**Triggers**: 
- API error rate >10% over 5 minutes
- Rate limit hit (429 responses)
- Service downtime detection

**Actions**:
- Pause non-critical requests for 15 minutes
- Fall back to cached data with staleness warnings
- Log incidents for analysis

### 4. Usage Monitoring Dashboard
**Real-time Tracking**:
- Requests per minute by service
- Error rates and response times  
- Cache hit ratios
- Daily/monthly usage projections

---

## Implementation Strategy

### Phase 1: Core Protection (Day 1)
1. **Rate Limiting Middleware**: Implement per-service request governors
2. **Basic Caching**: Add Redis-like memory cache for 5 most expensive endpoints
3. **Emergency Circuit Breakers**: Auto-pause on 429 errors

### Phase 2: Intelligence Layer (Day 2-3)
1. **Smart Cache Invalidation**: Context-aware cache expiry
2. **Request Prioritization**: Critical vs nice-to-have requests
3. **Usage Analytics**: Real-time monitoring dashboard

### Phase 3: Advanced Optimization (Week 1)
1. **Predictive Caching**: Pre-load likely-needed data
2. **Batch Processing**: Group multiple requests efficiently
3. **A/B Testing Safe Mode**: Controlled resource allocation

---

## Testing Resource Conservation

### Development Mode Limits
- **Reduce polling frequency**: 60-second intervals vs 30-second production
- **Limit concurrent requests**: Max 2 per service simultaneously  
- **Smart test data**: Reuse cached responses for repeated tests
- **Feature flags**: Disable expensive integrations during UI testing

### API Call Budget System
- **Daily limits per feature**: Sentiment (100 calls), Market (500 calls), On-chain (50 calls)
- **Testing quotas**: Reserve 20% of daily limits for automated testing
- **Manual override**: Admin can temporarily lift limits for critical testing

---

## Specific Service Guardrails

### CoinGecko Pro (Unlimited - Low Risk)
- **Guardrail**: Respect server resources, limit to 100/minute
- **Caching**: 30-second market data, 1-hour historical data
- **Priority**: High (core market data)

### X (Twitter) API (10K/month - HIGH RISK)
- **Critical**: This is our biggest cost risk at $100/month
- **Guardrail**: Strict 300/day limit (10K/month ÷ 30 days = 333/day)
- **Smart usage**: Only fetch on market volatility spikes >5%
- **Cache**: 10-minute cache for sentiment aggregations
- **Emergency**: Auto-disable if approaching monthly limit

### Etherscan (5/second - HIGH RISK)  
- **Guardrail**: Conservative 3/second with 1-second spacing
- **Batch processing**: Group address/transaction lookups
- **Priority queue**: User-requested data first, background analysis second

### Reddit API (100/minute - MEDIUM RISK)
- **Guardrail**: 60/minute limit with burst allowance
- **Smart targeting**: Only scan top 10 posts from key subreddits
- **Cache**: 5-minute sentiment aggregations

### Binance (1200/minute - MEDIUM RISK)
- **Guardrail**: 800/minute conservative limit
- **WebSocket priority**: Use streams over REST where possible
- **Batch requests**: Multiple symbol data in single calls

---

## Emergency Procedures

### Cost Runaway Protection
1. **Daily spend alerts**: Email when >$10/day API usage
2. **Auto-shutoff**: Disable non-critical APIs at $50/day
3. **Manual override**: Require admin approval to resume

### Service Degradation Plan
1. **Tier 1**: Disable sentiment analysis (preserve core trading)
2. **Tier 2**: Reduce market data frequency to 2-minute intervals
3. **Tier 3**: Core survival mode - essential trading data only

### Rate Limit Recovery
1. **Exponential backoff**: 1min → 5min → 15min → 60min delays
2. **Smart retry**: Only retry requests that aren't cached
3. **User notifications**: Inform about temporary service limitations

---

## Code Implementation Points

### 1. API Service Wrapper
```typescript
// server/services/apiRateGuard.ts
class APIRateGuard {
  private rateLimits: Map<string, RateLimit>
  private circuitBreakers: Map<string, CircuitBreaker>
  private cache: Map<string, CachedResponse>
}
```

### 2. Middleware Integration
```typescript  
// server/middleware/apiGuardrails.ts
export const apiGuardrails = (service: string) => {
  return async (req, res, next) => {
    // Check rate limits, cache, circuit breaker status
  }
}
```

### 3. Monitoring Dashboard
```typescript
// New endpoint: /api/admin/api-usage
// Real-time usage statistics and controls
```

---

## Expected Benefits

### Cost Savings
- **Prevent overages**: X API monthly limit protection saves $100+ potential overrun charges
- **Efficient usage**: 60-80% reduction in redundant API calls through smart caching
- **Predictable costs**: Monthly API spend becomes controllable and budgetable

### Performance Improvements  
- **Faster responses**: Cache hits eliminate network latency
- **Higher reliability**: Circuit breakers prevent cascade failures
- **Better UX**: Graceful degradation vs hard failures

### Development Efficiency
- **Protected testing**: Developers can test without fear of burning through API limits
- **Resource awareness**: Clear visibility into API usage patterns
- **Debugging support**: Detailed logs for troubleshooting API issues

---

## Implementation Timeline

**Day 1 (Immediate)**:
- Rate limiting middleware for Twitter/X API (highest cost risk)
- Basic memory caching for market data
- Emergency circuit breakers

**Day 2-3**:  
- Full rate limiting across all services
- Comprehensive caching layer
- Usage monitoring dashboard

**Week 1**:
- Advanced features (predictive caching, batch processing)
- Testing resource allocation system
- Complete monitoring and alerting

This implementation protects your $149/month API investment while ensuring the system remains responsive and cost-effective during extensive testing phases.