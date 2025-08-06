import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Request, Response, NextFunction } from 'express';
import { analyticsLogger } from '../services/analyticsLogger';

// Different rate limits for different endpoint types
const generalLimiter = new RateLimiterMemory({ 
  points: 100, // requests
  duration: 60, // seconds
});

const tradingLimiter = new RateLimiterMemory({ 
  points: 30, // trades per minute
  duration: 60,
});

const apiLimiter = new RateLimiterMemory({ 
  points: 60, // API calls per minute
  duration: 60,
});

const adminLimiter = new RateLimiterMemory({ 
  points: 20, // Admin actions per minute
  duration: 60,
});

export function createRateLimiter(type: 'general' | 'trading' | 'api' | 'admin' = 'general') {
  const limiter = {
    general: generalLimiter,
    trading: tradingLimiter,
    api: apiLimiter,
    admin: adminLimiter,
  }[type];

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = req.ip || req.headers['x-forwarded-for'] || 'global';
      await limiter.consume(key as string);
      next();
    } catch (rateLimiterRes: any) {
      // Log rate limit violation
      analyticsLogger.logError({
        timestamp: new Date().toISOString(),
        level: 'warn',
        message: `Rate limit exceeded for ${type} limiter`,
        endpoint: req.originalUrl,
        metadata: {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          type,
        },
      });

      const remainingPoints = rateLimiterRes?.remainingPoints || 0;
      const msBeforeNext = rateLimiterRes?.msBeforeNext || 60000;
      
      res.set({
        'Retry-After': Math.round(msBeforeNext / 1000),
        'X-RateLimit-Limit': limiter.points,
        'X-RateLimit-Remaining': remainingPoints,
        'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext).toISOString(),
      });
      
      res.status(429).json({ 
        error: 'rate_limited',
        message: `Too many ${type} requests. Please try again later.`,
        retryAfter: Math.round(msBeforeNext / 1000),
      });
    }
  };
}

export const generalRateLimit = createRateLimiter('general');
export const tradingRateLimit = createRateLimiter('trading');
export const apiRateLimit = createRateLimiter('api');
export const adminRateLimit = createRateLimiter('admin');