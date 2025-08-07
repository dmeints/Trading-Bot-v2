# Skippy Trading Platform - Monitoring & Observability Guide

## Overview
Comprehensive monitoring and observability framework for production-ready operations, including metrics collection, distributed tracing, alerting, and performance analysis.

## Metrics Collection

### Prometheus Integration
The platform exposes metrics in Prometheus format at `/api/monitoring/metrics`:

```bash
# View metrics
curl http://localhost:5000/api/monitoring/metrics

# Key metrics include:
# - skippy_http_request_duration_seconds
# - skippy_websocket_connections_active
# - skippy_ai_agent_latency_seconds
# - skippy_trading_operations_total
```

### Custom Metrics
```javascript
import { 
  httpRequestDuration,
  websocketConnections,
  aiAgentLatency,
  recordAIInference,
  recordWebSocketEvent
} from '@/server/monitoring/metrics';

// Record AI inference
recordAIInference('market_insight', true, 150); // success, 150ms

// Record WebSocket event
recordWebSocketEvent('price_update', 'outbound');

// Update connection count
websocketConnections.inc(); // increment
websocketConnections.dec(); // decrement
```

## Distributed Tracing

### Telemetry Implementation
Every request gets a unique trace ID for end-to-end tracking:

```javascript
import { createSpan, instrumentAsyncFunction } from '@/server/monitoring/telemetry';

// Manual span creation
const span = createSpan('ai_prediction', { symbol: 'BTC/USD' });
try {
  const result = await aiService.predict(data);
  span.finish('ok');
  return result;
} catch (error) {
  span.finish('error', error);
  throw error;
}

// Automatic instrumentation
const result = await instrumentAsyncFunction(
  'backtest_execution',
  () => backtestEngine.run(strategy),
  { strategy: strategy.id }
);
```

### Trace Correlation
- **X-Trace-Id Header**: Propagated through all requests
- **Log Correlation**: Trace IDs included in all log entries
- **Cross-Service Tracking**: Maintains trace context across services

## Service Level Objectives (SLOs)

### SLO Dashboard
Access the Service Level dashboard at `/service-level` to monitor:

- **AI Prediction Latency**: 95th percentile < 200ms target
- **Backtest Duration**: 95th percentile < 1s target  
- **API Success Rate**: > 99% target
- **WebSocket Uptime**: > 99.5% target

### SLO Implementation
```javascript
import { sloTracker } from '@/server/monitoring/telemetry';

// Record measurements
sloTracker.recordMeasurement('prediction_latency_p95', latencyMs);
sloTracker.recordMeasurement('api_success_rate', successRate);

// Check violations
const violations = sloTracker.checkSLOViolations();
violations.forEach(violation => {
  logger.warn('SLO violation detected', violation);
});
```

## Alerting Framework

### Alert Configuration
```yaml
# Example alert rules (for Grafana/Prometheus)
groups:
  - name: skippy-alerts
    rules:
      - alert: HighCPUUsage
        expr: skippy_system_resources{resource_type="cpu"} > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage detected"
          
      - alert: HighErrorRate
        expr: rate(skippy_http_requests_total{status_code=~"5.."}[5m]) > 0.01
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          
      - alert: AIAgentDown
        expr: skippy_ai_agent_inferences_total{status="success"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "AI agent not responding"
```

### Real-time Alerts API
```bash
# Check active alerts
curl http://localhost:5000/api/monitoring/alerts

# Response format:
{
  "alerts": [
    {
      "metric": "CPU Usage",
      "current": 85.2,
      "threshold": 80
    }
  ],
  "alertsActive": true,
  "severityLevels": {
    "critical": 1,
    "warning": 0
  }
}
```

## Health Monitoring

### Health Check Endpoints
```bash
# Basic health check
curl http://localhost:5000/api/health

# Database health
curl http://localhost:5000/api/health/db

# Detailed system health
curl http://localhost:5000/api/monitoring/health/detailed
```

### Health Check Implementation
```javascript
// Custom health checks
app.get('/api/health/custom', async (req, res) => {
  const checks = {
    database: await checkDatabaseHealth(),
    external_apis: await checkExternalAPIs(),
    ai_services: await checkAIServices(),
    websocket: await checkWebSocketHealth()
  };
  
  const healthy = Object.values(checks).every(check => check.healthy);
  res.status(healthy ? 200 : 503).json({ healthy, checks });
});
```

## Performance Monitoring

### Real-time Telemetry
```bash
# Get system telemetry
curl http://localhost:5000/api/monitoring/telemetry

# Response includes:
{
  "system": {
    "memory": { "used": 128000000, "total": 512000000, "percentage": 25 },
    "cpu": { "user": 1234567, "system": 987654 },
    "uptime": 3600
  },
  "application": {
    "environment": "production",
    "buildSha": "abc123def",
    "startTime": "2025-01-07T10:00:00Z"
  }
}
```

### Performance Dashboards
The Service Level page (`/service-level`) provides:

1. **Performance Metrics Tab**: Response time trends, request volumes
2. **System Health Tab**: Component status and connectivity
3. **Active Alerts Tab**: Current alerts and severity levels
4. **Live Telemetry Tab**: Real-time system resources

## Log Management

### Structured Logging
```javascript
import { logger } from '@/server/utils/logger';

// Log with trace correlation
logger.info('AI prediction completed', {
  traceId: req.traceId,
  symbol: 'BTC/USD',
  latency: 150,
  result: 'bullish'
});

// Error logging with context
logger.error('Database connection failed', {
  traceId: req.traceId,
  error: error.message,
  stack: error.stack,
  operation: 'user_fetch'
});
```

### Log Aggregation
- **Centralized Logs**: All services log to structured format
- **Log Correlation**: Trace IDs link related log entries
- **Error Tracking**: Automatic error detection and grouping

## Chaos Engineering

### Chaos Testing
```bash
# Enable chaos mode
curl -X POST http://localhost:5000/api/monitoring/chaos/enable \
  -H "Content-Type: application/json" \
  -d '{"mode": "testing", "duration": 300}'

# Trigger specific chaos events
curl -X POST http://localhost:5000/api/monitoring/chaos/trigger \
  -H "Content-Type: application/json" \
  -d '{"event": "kill_websocket_service", "duration": 30}'

# Disable chaos mode
curl -X POST http://localhost:5000/api/monitoring/chaos/disable
```

### Chaos Events
- **Service Disruption**: Simulate service failures
- **Network Partitions**: Test connectivity issues  
- **Resource Exhaustion**: Simulate high CPU/memory load
- **Database Failures**: Test database connectivity issues

## Monitoring Best Practices

### Metric Design
- **High Cardinality**: Avoid too many label combinations
- **Meaningful Names**: Use descriptive metric names
- **Consistent Units**: Standardize on seconds, bytes, etc.
- **Rate vs Counter**: Use appropriate metric types

### Alert Design
- **Actionable Alerts**: Every alert should require action
- **Severity Levels**: Distinguish critical vs warning alerts
- **Alert Fatigue**: Avoid too many low-priority alerts
- **Escalation**: Define escalation procedures

### Dashboard Design
- **User-Focused**: Design for specific user roles
- **Actionable Information**: Include context for decision making
- **Performance**: Optimize dashboard query performance
- **Mobile Friendly**: Ensure mobile accessibility

## Troubleshooting

### Common Issues

1. **High Latency**
   ```bash
   # Check slow operations
   curl http://localhost:5000/api/monitoring/metrics | grep duration
   
   # Review distributed traces
   grep "duration.*ms" logs/application.log | sort -k3 -nr
   ```

2. **Memory Leaks**
   ```bash
   # Monitor memory trends
   curl http://localhost:5000/api/monitoring/telemetry | jq '.system.memory'
   
   # Check for growing metric counts
   curl http://localhost:5000/api/monitoring/metrics | grep -c ""
   ```

3. **WebSocket Issues**
   ```bash
   # Check connection metrics
   curl http://localhost:5000/api/monitoring/metrics | grep websocket
   
   # Test WebSocket connectivity
   wscat -c ws://localhost:5000/ws
   ```

### Diagnostic Commands
```bash
# System resource usage
top -p $(pgrep -f "npm run dev")

# Network connections
netstat -an | grep :5000

# Database connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Log analysis
tail -f logs/application.log | grep ERROR
```

## CLI Integration

### Monitoring Commands
```bash
# Check system health
./cli/skippy-cli.js monitor --health

# View metrics
./cli/skippy-cli.js monitor --metrics

# Check alerts
./cli/skippy-cli.js monitor --alerts

# SLO status
./cli/skippy-cli.js monitor --slo
```

## Integration Examples

### Grafana Dashboard
```json
{
  "dashboard": {
    "title": "Skippy Trading Platform",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(skippy_http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      }
    ]
  }
}
```

### DataDog Integration
```javascript
const StatsD = require('node-statsd');
const statsd = new StatsD();

// Custom metrics to DataDog
statsd.increment('skippy.ai.inference.count');
statsd.histogram('skippy.ai.inference.duration', latencyMs);
statsd.gauge('skippy.websocket.connections', connectionCount);
```

### Elastic APM Integration
```javascript
const apm = require('elastic-apm-node').start({
  serviceName: 'skippy-trading-platform',
  environment: process.env.NODE_ENV
});

// Automatic instrumentation
const span = apm.startSpan('ai_prediction');
const result = await aiService.predict(data);
span?.end();
```