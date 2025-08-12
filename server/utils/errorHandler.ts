/**
 * Global Error Handler
 * 
 * Centralized error handling with structured logging
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { env } from '../config/env';
import type { RequestWithId } from '../middleware/requestId';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export function createApiError(message: string, statusCode: number = 500): ApiError {
  return new ApiError(message, statusCode);
}

// Global error handler middleware
export function errorHandler(
  error: AppError,
  req: RequestWithId,
  res: Response,
  next: NextFunction
) {
  // Prevent duplicate error handling
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  
  // Enhanced error classification
  const errorType = classifyError(error, statusCode);
  const errorId = `srv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Enhanced error logging with additional context
  logger.withRequest(req.id).error('Request error', {
    errorId,
    errorType,
    error: message,
    statusCode,
    stack: env.NODE_ENV === 'development' ? error.stack : undefined,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    body: req.method !== 'GET' ? sanitizeRequestBody(req.body) : undefined,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    headers: sanitizeHeaders(req.headers),
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    nodeVersion: process.version
  });

  // Rate limiting for error responses to prevent spam
  const errorKey = `${req.ip}_${statusCode}`;
  if (shouldRateLimit(errorKey)) {
    return res.status(429).json({
      error: true,
      message: 'Too many errors from this client',
      timestamp: new Date().toISOString(),
      requestId: req.id
    });
  }

  // Enhanced error response
  const errorResponse: any = {
    error: true,
    message: getClientSafeMessage(error, statusCode),
    statusCode,
    timestamp: new Date().toISOString(),
    path: req.path,
    requestId: req.id,
    errorId,
    type: errorType
  };

  // Add retry information for recoverable errors
  if (isRecoverableError(statusCode)) {
    errorResponse.retryable = true;
    errorResponse.retryAfter = getRetryDelay(statusCode);
  }

  // Include additional info in development
  if (env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
    errorResponse.debug = {
      originalMessage: error.message,
      isOperational: error.isOperational
    };
  }

  res.status(statusCode).json(errorResponse);
}

// Helper functions for enhanced error handling
function classifyError(error: AppError, statusCode: number): string {
  if (statusCode >= 500) return 'server_error';
  if (statusCode >= 400) return 'client_error';
  if (statusCode === 429) return 'rate_limit';
  if (statusCode === 401 || statusCode === 403) return 'auth_error';
  return 'unknown';
}

function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') return body;
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'auth'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

function sanitizeHeaders(headers: any): any {
  const sanitized = { ...headers };
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
  
  for (const header of sensitiveHeaders) {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

function getClientSafeMessage(error: AppError, statusCode: number): string {
  // Don't expose internal error details to clients in production
  if (env.NODE_ENV === 'production' && statusCode >= 500) {
    return 'An internal server error occurred. Please try again later.';
  }
  
  return error.message || 'An error occurred';
}

function isRecoverableError(statusCode: number): boolean {
  return [408, 429, 500, 502, 503, 504].includes(statusCode);
}

function getRetryDelay(statusCode: number): number {
  switch (statusCode) {
    case 429: return 60; // Rate limit - retry after 1 minute
    case 503: return 30; // Service unavailable - retry after 30 seconds
    case 504: return 10; // Gateway timeout - retry after 10 seconds
    default: return 5;   // Default retry after 5 seconds
  }
}

// Simple in-memory rate limiting for error responses
const errorRateLimits = new Map<string, { count: number; resetTime: number }>();

function shouldRateLimit(key: string): boolean {
  const now = Date.now();
  const limit = errorRateLimits.get(key);
  
  if (!limit || now > limit.resetTime) {
    errorRateLimits.set(key, { count: 1, resetTime: now + 60000 }); // Reset every minute
    return false;
  }
  
  if (limit.count >= 10) { // Max 10 errors per minute per IP
    return true;
  }
  
  limit.count++;
  return false;
}

// 404 handler
export function notFoundHandler(req: RequestWithId, res: Response) {
  const message = `Route ${req.method} ${req.path} not found`;
  
  logger.withRequest(req.id).warn('Route not found', {
    method: req.method,
    path: req.path,
    ip: req.ip
  });

  res.status(404).json({
    error: true,
    message,
    timestamp: new Date().toISOString(),
    path: req.path,
    requestId: req.id
  });
}

// Async error wrapper
export function asyncHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<any>
) {
  return (req: T, res: U, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}