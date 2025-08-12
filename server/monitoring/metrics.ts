import promClient from 'prom-client';
import { logger } from '../utils/logger';

// Initialize Prometheus client
promClient.register.clear();
promClient.collectDefaultMetrics({
  prefix: 'skippy_',
  timeout: 5000,
});

// Custom metrics
export const httpRequestDuration = new promClient.Histogram({
  name: 'skippy_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const httpRequestTotal = new promClient.Counter({
  name: 'skippy_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const websocketConnections = new promClient.Gauge({
  name: 'skippy_websocket_connections_active',
  help: 'Number of active WebSocket connections',
});

export const websocketMessagesTotal = new promClient.Counter({
  name: 'skippy_websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['type', 'direction'], // direction: 'inbound' | 'outbound'
});

export const websocketErrors = new promClient.Counter({
  name: 'skippy_websocket_errors_total',
  help: 'Total number of WebSocket errors',
  labelNames: ['error_type'],
});

export const aiAgentInferences = new promClient.Counter({
  name: 'skippy_ai_agent_inferences_total',
  help: 'Total number of AI agent inferences',
  labelNames: ['agent_type', 'status'], // status: 'success' | 'error'
});

export const aiAgentLatency = new promClient.Histogram({
  name: 'skippy_ai_agent_latency_seconds',
  help: 'AI agent inference latency in seconds',
  labelNames: ['agent_type'],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2],
});

export const retrainEvents = new promClient.Counter({
  name: 'skippy_retrain_events_total',
  help: 'Total number of model retraining events',
  labelNames: ['model_type', 'trigger'], // trigger: 'scheduled' | 'drift' | 'manual'
});

export const driftDetections = new promClient.Counter({
  name: 'skippy_drift_detections_total',
  help: 'Total number of drift detections',
  labelNames: ['model_type', 'severity'], // severity: 'low' | 'medium' | 'high'
});

export const backtestDuration = new promClient.Histogram({
  name: 'skippy_backtest_duration_seconds',
  help: 'Backtest execution duration in seconds',
  labelNames: ['strategy_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

export const tradingOperations = new promClient.Counter({
  name: 'skippy_trading_operations_total',
  help: 'Total number of trading operations',
  labelNames: ['operation_type', 'status'], // operation_type: 'buy' | 'sell' | 'cancel', status: 'success' | 'error'
});

export const marketDataLatency = new promClient.Histogram({
  name: 'skippy_market_data_latency_seconds',
  help: 'Market data update latency in seconds',
  labelNames: ['symbol'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
});

export const databaseOperations = new promClient.Histogram({
  name: 'skippy_database_operations_duration_seconds',
  help: 'Database operation duration in seconds',
  labelNames: ['operation_type', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

export const systemResources = new promClient.Gauge({
  name: 'skippy_system_resources',
  help: 'System resource utilization',
  labelNames: ['resource_type'], // resource_type: 'cpu' | 'memory' | 'disk'
});

// Middleware to instrument HTTP requests
export function metricsMiddleware(req: any, res: any, next: any) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path || 'unknown';
    const method = req.method;
    const statusCode = res.statusCode.toString();
    
    httpRequestDuration
      .labels(method, route, statusCode)
      .observe(duration);
    
    httpRequestTotal
      .labels(method, route, statusCode)
      .inc();
  });
  
  next();
}

// Helper functions for common metric operations
export function recordAIInference(agentType: string, success: boolean, duration: number) {
  const status = success ? 'success' : 'error';
  aiAgentInferences.labels(agentType, status).inc();
  aiAgentLatency.labels(agentType).observe(duration / 1000);
}

export function recordWebSocketEvent(type: string, direction: 'inbound' | 'outbound') {
  websocketMessagesTotal.labels(type, direction).inc();
}

export function recordWebSocketError(errorType: string) {
  websocketErrors.labels(errorType).inc();
}

export function recordTradingOperation(operationType: string, success: boolean) {
  const status = success ? 'success' : 'error';
  tradingOperations.labels(operationType, status).inc();
}

export function recordBacktest(strategyType: string, duration: number) {
  backtestDuration.labels(strategyType).observe(duration / 1000);
}

export function recordDrift(modelType: string, severity: 'low' | 'medium' | 'high') {
  driftDetections.labels(modelType, severity).inc();
}

export function recordRetrain(modelType: string, trigger: 'scheduled' | 'drift' | 'manual') {
  retrainEvents.labels(modelType, trigger).inc();
}

export function recordMarketDataUpdate(symbol: string, latency: number) {
  marketDataLatency.labels(symbol).observe(latency / 1000);
}

export function recordDatabaseOperation(operationType: string, table: string, duration: number) {
  databaseOperations.labels(operationType, table).observe(duration / 1000);
}

export function updateSystemResources(resourceType: 'cpu' | 'memory' | 'disk', value: number) {
  systemResources.labels(resourceType).set(value);
}

// Health check metrics
export const healthChecks = new promClient.Gauge({
  name: 'skippy_health_check_status',
  help: 'Health check status (1 = healthy, 0 = unhealthy)',
  labelNames: ['service'],
});

export function updateHealthStatus(service: string, healthy: boolean) {
  healthChecks.labels(service).set(healthy ? 1 : 0);
}

// Export metrics endpoint
export function getMetrics(): Promise<string> {
  return promClient.register.metrics();
}

// Alert thresholds configuration
export const alertThresholds = {
  cpu_usage: 80, // percentage
  memory_usage: 80, // percentage
  error_rate: 1, // percentage
  response_time_p95: 1000, // milliseconds
  websocket_connection_errors: 10, // count per minute
  drift_detections_high: 5, // count per hour
};

// Function to check if metrics exceed thresholds
export async function checkAlertThresholds(): Promise<Array<{ metric: string; current: number; threshold: number }>> {
  const alerts: Array<{ metric: string; current: number; threshold: number }> = [];
  
  try {
    const metrics = await promClient.register.metrics();
    
    // Parse metrics and check thresholds
    // This is a simplified implementation - in production, you'd use a proper metrics query language
    
    // Example checks (you would implement proper metric parsing here)
    const cpuUsage = await getCpuUsage();
    if (cpuUsage > alertThresholds.cpu_usage) {
      alerts.push({
        metric: 'CPU Usage',
        current: cpuUsage,
        threshold: alertThresholds.cpu_usage
      });
    }
    
    const memoryUsage = await getMemoryUsage();
    if (memoryUsage > alertThresholds.memory_usage) {
      alerts.push({
        metric: 'Memory Usage',
        current: memoryUsage,
        threshold: alertThresholds.memory_usage
      });
    }
    
  } catch (error) {
    logger.error('Error checking alert thresholds', { error });
  }
  
  return alerts;
}

// Helper functions to get system metrics
async function getCpuUsage(): Promise<number> {
  // Simplified CPU usage calculation
  const startUsage = process.cpuUsage();
  await new Promise(resolve => setTimeout(resolve, 100));
  const endUsage = process.cpuUsage(startUsage);
  
  const totalUsage = endUsage.user + endUsage.system;
  const totalTime = 100 * 1000; // 100ms in microseconds
  
  return (totalUsage / totalTime) * 100;
}

async function getMemoryUsage(): Promise<number> {
  const usage = process.memoryUsage();
  const totalMemory = usage.heapTotal + usage.external;
  const usedMemory = usage.heapUsed;
  
  return (usedMemory / totalMemory) * 100;
}
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

interface MetricValue {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

interface Counter {
  name: string;
  help: string;
  value: number;
  labels: Record<string, string>;
}

interface Gauge {
  name: string;
  help: string;
  value: number;
  labels: Record<string, string>;
}

class MetricsCollector {
  private static instance: MetricsCollector;
  private counters: Map<string, Counter> = new Map();
  private gauges: Map<string, Gauge> = new Map();

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  constructor() {
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    // Counters
    this.counters.set('router_decisions_total', {
      name: 'router_decisions_total',
      help: 'Total number of strategy router decisions',
      value: 0,
      labels: {}
    });

    this.counters.set('exec_blocked_total', {
      name: 'exec_blocked_total',
      help: 'Total number of blocked executions',
      value: 0,
      labels: {}
    });

    this.counters.set('http_requests_total', {
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      value: 0,
      labels: {}
    });

    // Gauges
    this.gauges.set('price_stream_connected', {
      name: 'price_stream_connected',
      help: 'Price stream connection status (0=disconnected, 1=connected)',
      value: 1,
      labels: {}
    });

    this.gauges.set('ohlcv_last_sync_timestamp_seconds', {
      name: 'ohlcv_last_sync_timestamp_seconds',
      help: 'Last OHLCV sync timestamp in seconds',
      value: Math.floor(Date.now() / 1000),
      labels: {}
    });

    this.gauges.set('ws_clients_active', {
      name: 'ws_clients_active',
      help: 'Number of active WebSocket clients',
      value: 0,
      labels: {}
    });

    logger.info('[Metrics] Initialized with counters and gauges');
  }

  incrementCounter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    const key = this.getMetricKey(name, labels);
    const existing = this.counters.get(key);
    
    if (existing) {
      existing.value += value;
    } else {
      this.counters.set(key, {
        name,
        help: `Counter for ${name}`,
        value,
        labels
      });
    }
  }

  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, labels);
    const existing = this.gauges.get(key);
    
    if (existing) {
      existing.value = value;
    } else {
      this.gauges.set(key, {
        name,
        help: `Gauge for ${name}`,
        value,
        labels
      });
    }
  }

  private getMetricKey(name: string, labels: Record<string, string>): string {
    const labelPairs = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    return labelPairs ? `${name}{${labelPairs}}` : name;
  }

  generatePrometheusFormat(): string {
    let output = '';

    // Export counters
    for (const [key, counter] of this.counters.entries()) {
      output += `# HELP ${counter.name} ${counter.help}\n`;
      output += `# TYPE ${counter.name} counter\n`;
      
      const labelStr = Object.entries(counter.labels).length > 0
        ? `{${Object.entries(counter.labels).map(([k, v]) => `${k}="${v}"`).join(',')}}`
        : '';
      
      output += `${counter.name}${labelStr} ${counter.value}\n`;
    }

    // Export gauges
    for (const [key, gauge] of this.gauges.entries()) {
      output += `# HELP ${gauge.name} ${gauge.help}\n`;
      output += `# TYPE ${gauge.name} gauge\n`;
      
      const labelStr = Object.entries(gauge.labels).length > 0
        ? `{${Object.entries(gauge.labels).map(([k, v]) => `${k}="${v}"`).join(',')}}`
        : '';
      
      output += `${gauge.name}${labelStr} ${gauge.value}\n`;
    }

    return output;
  }

  getHealthMetrics(): any {
    return {
      'db.latencyMs': Math.random() * 50 + 10, // Mock DB latency
      'ws.clients': this.gauges.get('ws_clients_active')?.value || 0,
      'router.decisionsLastMin': Math.floor(Math.random() * 10),
      'exec.blockedLastMin': Math.floor(Math.random() * 3)
    };
  }
}

export const metricsCollector = MetricsCollector.getInstance();

// Middleware to track HTTP requests
export const metricsMiddleware = (req: Request, res: Response, next: Function) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    metricsCollector.incrementCounter('http_requests_total', {
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode.toString()
    });
  });
  
  next();
};

// Metrics endpoint handler
export const metricsHandler = (req: Request, res: Response) => {
  try {
    const metrics = metricsCollector.generatePrometheusFormat();
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  } catch (error) {
    logger.error('[Metrics] Error generating metrics:', error);
    res.status(500).send('Error generating metrics');
  }
};
