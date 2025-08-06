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
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  
  // Log error with context
  logger.withRequest(req.id).error('Request error', {
    error: message,
    statusCode,
    stack: env.NODE_ENV === 'development' ? error.stack : undefined,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  // Send error response
  const errorResponse: any = {
    error: true,
    message,
    timestamp: new Date().toISOString(),
    path: req.path,
    requestId: req.id
  };

  // Include stack trace in development
  if (env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
  }

  res.status(statusCode).json(errorResponse);
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