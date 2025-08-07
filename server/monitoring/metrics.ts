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