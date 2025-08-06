/**
 * Request Validation Utilities
 * 
 * Common validation functions for API endpoints
 */

import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import type { RequestWithId } from '../middleware/requestId';

// Common validation schemas
export const commonSchemas = {
  id: z.string().min(1, 'ID is required'),
  pagination: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
  }),
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
};

// Validation middleware factory
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: RequestWithId, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.withRequest(req.id).warn('Validation error', {
          path: req.path,
          errors: error.errors,
          body: req.body
        });
        
        res.status(400).json({
          error: 'Validation Error',
          details: error.errors,
          message: 'Request body validation failed'
        });
      } else {
        next(error);
      }
    }
  };
}

export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: RequestWithId, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.withRequest(req.id).warn('Query validation error', {
          path: req.path,
          errors: error.errors,
          query: req.query
        });
        
        res.status(400).json({
          error: 'Validation Error',
          details: error.errors,
          message: 'Query parameters validation failed'
        });
      } else {
        next(error);
      }
    }
  };
}

export function validateParams<T>(schema: z.ZodSchema<T>) {
  return (req: RequestWithId, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.params);
      req.params = validated as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.withRequest(req.id).warn('Params validation error', {
          path: req.path,
          errors: error.errors,
          params: req.params
        });
        
        res.status(400).json({
          error: 'Validation Error',
          details: error.errors,
          message: 'URL parameters validation failed'
        });
      } else {
        next(error);
      }
    }
  };
}