/**
 * Rate Limiting Middleware
 * 
 * Multi-tier rate limiting for different types of operations
 */

import { RateLimiterMemory } from 'rate-limiter-flexible';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import type { RequestWithId } from './requestId';

// General API rate limiter (100 requests per minute)
const generalLimiter = new RateLimiterMemory({
  keyPrefix: 'general',
  points: 100,
  duration: 60,
});

// Trading operations rate limiter (10 requests per minute)
const tradingLimiter = new RateLimiterMemory({
  keyPrefix: 'trading',
  points: 10, 
  duration: 60,
});

// Admin operations rate limiter (20 requests per minute)
const adminLimiter = new RateLimiterMemory({
  keyPrefix: 'admin',
  points: 20,
  duration: 60,
});

// AI operations rate limiter (15 requests per minute)
const aiLimiter = new RateLimiterMemory({
  keyPrefix: 'ai',
  points: 15,
  duration: 60,
});

function createRateLimitMiddleware(limiter: RateLimiterMemory, name: string) {
  return async (req: RequestWithId, res: Response, next: NextFunction) => {
    try {
      const key = req.ip || req.connection.remoteAddress || 'unknown';
      await limiter.consume(key);
      next();
    } catch (rejRes: any) {
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
      
      // Log rate limit violation
      logger.withRequest(req.id).warn('Rate limit exceeded', {
        limiter: name,
        ip: req.ip,
        path: req.path,
        retryAfter: secs
      });
      
      res.set('Retry-After', String(secs));
      res.status(429).json({
        error: 'Too Many Requests',
        retryAfter: secs,
        message: `Rate limit exceeded for ${name} operations`
      });
    }
  };
}

export const rateLimiters = {
  general: createRateLimitMiddleware(generalLimiter, 'general'),
  trading: createRateLimitMiddleware(tradingLimiter, 'trading'),
  admin: createRateLimitMiddleware(adminLimiter, 'admin'),
  ai: createRateLimitMiddleware(aiLimiter, 'ai'),
};