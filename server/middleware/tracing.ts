import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';

export interface RequestWithTrace extends Request {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTime: number;
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, any>;
  logs: Array<{
    timestamp: number;
    message: string;
    level: string;
    data?: any;
  }>;
  status: 'success' | 'error' | 'timeout';
}

class DistributedTracer {
  private spans: Map<string, Span> = new Map();
  private activeSpans: Map<string, string> = new Map(); // traceId -> spanId

  createSpan(
    operationName: string,
    traceId?: string,
    parentSpanId?: string
  ): Span {
    const span: Span = {
      traceId: traceId || randomUUID(),
      spanId: randomUUID(),
      parentSpanId,
      operationName,
      startTime: Date.now(),
      tags: {},
      logs: [],
      status: 'success'
    };

    this.spans.set(span.spanId, span);
    this.activeSpans.set(span.traceId, span.spanId);

    return span;
  }

  finishSpan(spanId: string, status: 'success' | 'error' | 'timeout' = 'success'): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.endTime = Date.now();
      span.duration = span.endTime - span.startTime;
      span.status = status;
      
      // Log span completion
      logger.info('Span completed', {
        traceId: span.traceId,
        spanId: span.spanId,
        operationName: span.operationName,
        duration: span.duration,
        status: span.status,
        tags: span.tags
      });
      
      // Remove from active spans if this was the active span for the trace
      if (this.activeSpans.get(span.traceId) === spanId) {
        this.activeSpans.delete(span.traceId);
      }
    }
  }

  addTag(spanId: string, key: string, value: any): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.tags[key] = value;
    }
  }

  addLog(spanId: string, level: string, message: string, data?: any): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.logs.push({
        timestamp: Date.now(),
        level,
        message,
        data
      });
    }
  }

  getSpan(spanId: string): Span | undefined {
    return this.spans.get(spanId);
  }

  getActiveSpan(traceId: string): Span | undefined {
    const activeSpanId = this.activeSpans.get(traceId);
    return activeSpanId ? this.spans.get(activeSpanId) : undefined;
  }

  getTraceSpans(traceId: string): Span[] {
    return Array.from(this.spans.values()).filter(span => span.traceId === traceId);
  }

  // Export spans for external tracing systems (Jaeger, Zipkin, etc.)
  exportSpans(traceId: string): any[] {
    const spans = this.getTraceSpans(traceId);
    
    return spans.map(span => ({
      traceID: span.traceId,
      spanID: span.spanId,
      parentSpanID: span.parentSpanId,
      operationName: span.operationName,
      startTime: span.startTime * 1000, // Convert to microseconds
      duration: (span.duration || 0) * 1000,
      tags: Object.entries(span.tags).map(([key, value]) => ({
        key,
        type: typeof value === 'string' ? 'string' : 'number',
        value: value.toString()
      })),
      logs: span.logs.map(log => ({
        timestamp: log.timestamp * 1000,
        fields: [
          { key: 'level', value: log.level },
          { key: 'message', value: log.message },
          ...(log.data ? [{ key: 'data', value: JSON.stringify(log.data) }] : [])
        ]
      })),
      process: {
        serviceName: 'skippy-trading-platform',
        tags: [
          { key: 'version', value: process.env.BUILD_SHA || 'dev' },
          { key: 'environment', value: process.env.NODE_ENV || 'development' }
        ]
      }
    }));
  }

  // Clean up old spans to prevent memory leaks
  cleanup(maxAgeMs: number = 300000): void { // 5 minutes default
    const cutoff = Date.now() - maxAgeMs;
    
    for (const [spanId, span] of this.spans) {
      if (span.startTime < cutoff) {
        this.spans.delete(spanId);
      }
    }
  }
}

export const tracer = new DistributedTracer();

// Express middleware for automatic request tracing
export function tracingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const request = req as RequestWithTrace;
  
  // Extract trace context from headers (OpenTelemetry format)
  const traceParent = req.headers['traceparent'] as string;
  let traceId: string;
  let parentSpanId: string | undefined;
  
  if (traceParent) {
    const parts = traceParent.split('-');
    if (parts.length >= 3) {
      traceId = parts[1];
      parentSpanId = parts[2];
    } else {
      traceId = randomUUID();
    }
  } else {
    traceId = randomUUID();
  }
  
  // Create span for this request
  const span = tracer.createSpan(`${req.method} ${req.path}`, traceId, parentSpanId);
  
  // Add request information to span
  tracer.addTag(span.spanId, 'http.method', req.method);
  tracer.addTag(span.spanId, 'http.url', req.url);
  tracer.addTag(span.spanId, 'http.path', req.path);
  tracer.addTag(span.spanId, 'user.agent', req.headers['user-agent']);
  tracer.addTag(span.spanId, 'client.ip', req.ip);
  
  // Attach trace info to request
  request.traceId = traceId;
  request.spanId = span.spanId;
  request.parentSpanId = parentSpanId;
  request.startTime = span.startTime;
  
  // Add trace context to response headers
  res.setHeader('x-trace-id', traceId);
  
  // Override res.end to finish span
  const originalEnd = res.end;
  res.end = function(this: Response, ...args: any[]) {
    tracer.addTag(span.spanId, 'http.status_code', res.statusCode);
    tracer.addTag(span.spanId, 'response.size', res.get('content-length') || 0);
    
    const status = res.statusCode >= 400 ? 'error' : 'success';
    tracer.finishSpan(span.spanId, status);
    
    return originalEnd.apply(this, args);
  };
  
  // Handle errors
  res.on('error', (error) => {
    tracer.addLog(span.spanId, 'error', 'Response error', { error: error.message });
    tracer.finishSpan(span.spanId, 'error');
  });
  
  next();
}

// Helper function to create child spans in route handlers
export function createChildSpan(
  req: RequestWithTrace,
  operationName: string
): Span {
  return tracer.createSpan(operationName, req.traceId, req.spanId);
}

// Helper function to trace async operations
export async function traceAsyncOperation<T>(
  req: RequestWithTrace,
  operationName: string,
  operation: (span: Span) => Promise<T>
): Promise<T> {
  const span = createChildSpan(req, operationName);
  
  try {
    const result = await operation(span);
    tracer.finishSpan(span.spanId, 'success');
    return result;
  } catch (error) {
    tracer.addLog(span.spanId, 'error', 'Operation failed', { error });
    tracer.finishSpan(span.spanId, 'error');
    throw error;
  }
}

// WebSocket tracing support
export class WebSocketTracer {
  private connectionSpans: Map<string, Span> = new Map();
  
  traceConnection(connectionId: string, clientInfo: any): Span {
    const span = tracer.createSpan('websocket.connection');
    
    tracer.addTag(span.spanId, 'connection.id', connectionId);
    tracer.addTag(span.spanId, 'client.ip', clientInfo.ip);
    tracer.addTag(span.spanId, 'connection.type', 'websocket');
    
    this.connectionSpans.set(connectionId, span);
    return span;
  }
  
  traceMessage(connectionId: string, messageType: string, messageSize: number): Span | undefined {
    const connectionSpan = this.connectionSpans.get(connectionId);
    if (!connectionSpan) return undefined;
    
    const messageSpan = tracer.createSpan(
      `websocket.message.${messageType}`,
      connectionSpan.traceId,
      connectionSpan.spanId
    );
    
    tracer.addTag(messageSpan.spanId, 'message.type', messageType);
    tracer.addTag(messageSpan.spanId, 'message.size', messageSize);
    
    return messageSpan;
  }
  
  closeConnection(connectionId: string): void {
    const span = this.connectionSpans.get(connectionId);
    if (span) {
      tracer.finishSpan(span.spanId, 'success');
      this.connectionSpans.delete(connectionId);
    }
  }
}

export const wsTracer = new WebSocketTracer();

// Database operation tracing
export function traceDbOperation<T>(
  req: RequestWithTrace,
  operation: string,
  tableName: string,
  dbOperation: () => Promise<T>
): Promise<T> {
  return traceAsyncOperation(req, `db.${operation}`, async (span) => {
    tracer.addTag(span.spanId, 'db.operation', operation);
    tracer.addTag(span.spanId, 'db.table', tableName);
    tracer.addTag(span.spanId, 'db.type', 'postgresql');
    
    const startTime = Date.now();
    try {
      const result = await dbOperation();
      const duration = Date.now() - startTime;
      
      tracer.addTag(span.spanId, 'db.duration', duration);
      tracer.addLog(span.spanId, 'info', `Database ${operation} completed`, { duration });
      
      return result;
    } catch (error) {
      tracer.addLog(span.spanId, 'error', `Database ${operation} failed`, { error });
      throw error;
    }
  });
}

// API call tracing
export function traceApiCall<T>(
  req: RequestWithTrace,
  apiName: string,
  endpoint: string,
  apiOperation: () => Promise<T>
): Promise<T> {
  return traceAsyncOperation(req, `api.${apiName}`, async (span) => {
    tracer.addTag(span.spanId, 'api.name', apiName);
    tracer.addTag(span.spanId, 'api.endpoint', endpoint);
    
    const startTime = Date.now();
    try {
      const result = await apiOperation();
      const duration = Date.now() - startTime;
      
      tracer.addTag(span.spanId, 'api.duration', duration);
      tracer.addLog(span.spanId, 'info', `API call to ${apiName} completed`, { duration });
      
      return result;
    } catch (error) {
      tracer.addLog(span.spanId, 'error', `API call to ${apiName} failed`, { error });
      throw error;
    }
  });
}

// Start background cleanup
setInterval(() => {
  tracer.cleanup();
}, 60000); // Clean up every minute