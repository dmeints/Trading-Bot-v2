/**
 * EMERGENCY X API PROTECTION SYSTEM
 * Protects extremely limited 100 posts/month allocation
 * Only 3 requests/day maximum budget
 */

import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

// Emergency rate limiter - maximum 2 requests per day
const xApiLimiter = new RateLimiterMemory({
  keyPrefix: 'x-api-emergency',
  points: 2,                    // 2 requests per day
  duration: 86400,              // 24 hours
  blockDuration: 86400,         // 24 hour cooldown
});

// Monthly usage tracker
interface XApiUsage {
  month: string;
  count: number;
  lastReset: Date;
}

class XApiUsageTracker {
  private usage: XApiUsage = {
    month: new Date().toISOString().slice(0, 7), // YYYY-MM
    count: 0,
    lastReset: new Date()
  };

  private readonly MONTHLY_LIMIT = 90; // Emergency cutoff at 90/100

  getCurrentUsage(): XApiUsage {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    // Reset if new month
    if (this.usage.month !== currentMonth) {
      this.usage = {
        month: currentMonth,
        count: 0,
        lastReset: new Date()
      };
      logger.info('X API usage reset for new month', { month: currentMonth });
    }
    
    return this.usage;
  }

  canMakeRequest(): boolean {
    const current = this.getCurrentUsage();
    return current.count < this.MONTHLY_LIMIT;
  }

  incrementUsage(): void {
    this.usage.count += 1;
    logger.warn('X API request made', {
      count: this.usage.count,
      limit: this.MONTHLY_LIMIT,
      remaining: this.MONTHLY_LIMIT - this.usage.count
    });
  }

  getStats(): { used: number; limit: number; remaining: number; month: string } {
    const current = this.getCurrentUsage();
    return {
      used: current.count,
      limit: this.MONTHLY_LIMIT,
      remaining: this.MONTHLY_LIMIT - current.count,
      month: current.month
    };
  }
}

export const xApiUsageTracker = new XApiUsageTracker();

export interface XApiProtectionOptions {
  volatilityThreshold?: number; // Minimum volatility % to allow request
  manualOverride?: boolean;     // Allow manual override
}

export function createXApiProtection(options: XApiProtectionOptions = {}) {
  const { volatilityThreshold = 15, manualOverride = false } = options;

  return async (req: Request & { id?: string }, res: Response, next: NextFunction) => {
    try {
      // Check monthly limit first
      if (!xApiUsageTracker.canMakeRequest()) {
        const stats = xApiUsageTracker.getStats();
        logger.error('X API monthly limit exceeded', stats);
        
        return res.status(429).json({
          error: 'X API Monthly Limit Exceeded',
          message: `Used ${stats.used}/${stats.limit} requests this month. Service disabled to prevent complete cutoff.`,
          stats,
          nextReset: `${new Date().getFullYear()}-${String(new Date().getMonth() + 2).padStart(2, '0')}-01`
        });
      }

      // Apply daily rate limit
      const key = req.ip || 'x-api-global';
      await xApiLimiter.consume(key);

      // Check volatility threshold (if not manual override)
      if (!manualOverride && volatilityThreshold > 0) {
        const volatility = parseFloat(req.headers['x-market-volatility'] as string || '0');
        
        if (volatility < volatilityThreshold) {
          logger.info('X API request rejected - insufficient volatility', {
            current: volatility,
            required: volatilityThreshold
          });
          
          return res.status(403).json({
            error: 'X API Conservation Mode',
            message: `X API reserved for major market events (>${volatilityThreshold}% volatility). Current: ${volatility}%`,
            suggestion: 'Use cached sentiment data or try Reddit/CryptoPanic APIs'
          });
        }
      }

      // Log the precious request
      logger.warn('X API request approved - consuming precious allocation', {
        ip: req.ip,
        path: req.path,
        volatility: req.headers['x-market-volatility'],
        ...xApiUsageTracker.getStats()
      });

      // Increment usage counter
      xApiUsageTracker.incrementUsage();

      next();

    } catch (rateLimitError: any) {
      const secs = Math.round(rateLimitError.msBeforeNext / 1000) || 86400;
      
      logger.error('X API daily rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        retryAfter: secs,
        ...xApiUsageTracker.getStats()
      });

      res.set('Retry-After', String(secs));
      return res.status(429).json({
        error: 'X API Daily Limit Exceeded',
        message: 'Maximum 2 X API requests per day. This precious resource is heavily protected.',
        retryAfter: secs,
        stats: xApiUsageTracker.getStats()
      });
    }
  };
}

// Middleware instances
export const xApiEmergencyProtection = createXApiProtection();
export const xApiManualOverride = createXApiProtection({ manualOverride: true, volatilityThreshold: 0 });
export const xApiHighVolatility = createXApiProtection({ volatilityThreshold: 20 });

// Usage monitoring endpoint
export function getXApiUsageStats() {
  return xApiUsageTracker.getStats();
}