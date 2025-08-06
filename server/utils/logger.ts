/**
 * Structured JSON Logger
 * 
 * Provides structured logging compatible with Replit's logging system
 * One-line-per-event JSON format for better observability
 */

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  requestId?: string;
  userId?: string;
  [key: string]: any;
}

class StructuredLogger {
  private log(level: LogEntry['level'], message: string, meta: Record<string, any> = {}) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta
    };

    // Output structured JSON to stdout for Replit compatibility
    console.log(JSON.stringify(entry));
  }

  info(message: string, meta?: Record<string, any>) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, any>) {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, any>) {
    this.log('error', message, meta);
  }

  debug(message: string, meta?: Record<string, any>) {
    this.log('debug', message, meta);
  }

  // Helper for request-scoped logging
  withRequest(requestId: string, userId?: string) {
    return {
      info: (message: string, meta?: Record<string, any>) => 
        this.info(message, { ...meta, requestId, userId }),
      warn: (message: string, meta?: Record<string, any>) => 
        this.warn(message, { ...meta, requestId, userId }),
      error: (message: string, meta?: Record<string, any>) => 
        this.error(message, { ...meta, requestId, userId }),
      debug: (message: string, meta?: Record<string, any>) => 
        this.debug(message, { ...meta, requestId, userId })
    };
  }
}

export const logger = new StructuredLogger();