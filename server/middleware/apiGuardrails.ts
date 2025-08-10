import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

// API Rate Limit Tracking
interface ApiUsageStats {
  used: number;
  limit: number;
  remaining: number;
  resetTime: number;
  lastUsed: number;
}

class ApiGuardrailManager {
  private usage: Map<string, ApiUsageStats> = new Map();

  constructor() {
    // Initialize API limits based on free tier restrictions
    this.initializeApiLimits();
  }

  private initializeApiLimits() {
    // Reddit API - 60 requests per minute, 1000 per day
    this.usage.set('reddit', {
      used: 0,
      limit: 800, // Conservative limit (80% of daily)
      remaining: 800,
      resetTime: this.getNextMidnight(),
      lastUsed: 0
    });

    // Etherscan API - 5 calls/sec, 100,000 per day (free tier)
    this.usage.set('etherscan', {
      used: 0,
      limit: 50000, // Conservative limit (50% of daily)
      remaining: 50000,
      resetTime: this.getNextMidnight(),
      lastUsed: 0
    });

    // CryptoPanic API - 1000 requests per day (free tier)
    this.usage.set('cryptopanic', {
      used: 0,
      limit: 800, // Conservative limit (80% of daily)
      remaining: 800,
      resetTime: this.getNextMidnight(),
      lastUsed: 0
    });

    logger.info('[API Guardrails] Initialized protection for Reddit, Etherscan, and CryptoPanic APIs');
  }

  private getNextMidnight(): number {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }

  // Reset daily counters if needed
  private checkAndResetDaily(apiKey: string): void {
    const stats = this.usage.get(apiKey);
    if (!stats) return;

    if (Date.now() >= stats.resetTime) {
      const originalLimit = apiKey === 'reddit' ? 800 :
                           apiKey === 'etherscan' ? 50000 : 800;

      stats.used = 0;
      stats.remaining = originalLimit;
      stats.resetTime = this.getNextMidnight();

      logger.info(`[API Guardrails] Daily reset for ${apiKey.toUpperCase()} API`, {
        api: apiKey,
        newLimit: originalLimit,
        resetTime: new Date(stats.resetTime).toISOString()
      });
    }
  }

  // Check if API call is allowed
  canMakeRequest(apiKey: string): boolean {
    this.checkAndResetDaily(apiKey);

    const stats = this.usage.get(apiKey);
    if (!stats) {
      logger.warn(`[API Guardrails] Unknown API key: ${apiKey}`);
      return false;
    }

    // Check rate limiting (1 second minimum between requests for safety)
    const now = Date.now();
    if (now - stats.lastUsed < 1000) {
      logger.warn(`[API Guardrails] Rate limit protection - ${apiKey.toUpperCase()} API`, {
        api: apiKey,
        timeSinceLastCall: now - stats.lastUsed,
        minimumGap: 1000
      });
      return false;
    }

    // Check daily limit
    if (stats.remaining <= 0) {
      logger.error(`[API Guardrails] Daily limit exhausted - ${apiKey.toUpperCase()} API`, {
        api: apiKey,
        used: stats.used,
        limit: stats.limit,
        resetTime: new Date(stats.resetTime).toISOString()
      });
      return false;
    }

    // Check emergency buffer (10% remaining = warning)
    if (stats.remaining <= stats.limit * 0.1) {
      logger.warn(`[API Guardrails] Emergency buffer reached - ${apiKey.toUpperCase()} API`, {
        api: apiKey,
        remaining: stats.remaining,
        total: stats.limit,
        warningThreshold: '10% remaining'
      });
    }

    return true;
  }

  // Record API usage
  recordUsage(apiKey: string): void {
    const stats = this.usage.get(apiKey);
    if (!stats) return;

    stats.used += 1;
    stats.remaining = Math.max(0, stats.remaining - 1);
    stats.lastUsed = Date.now();

    logger.info(`[API Guardrails] Request recorded - ${apiKey.toUpperCase()} API`, {
      api: apiKey,
      used: stats.used,
      remaining: stats.remaining,
      utilizationPercent: Math.round((stats.used / stats.limit) * 100)
    });
  }

  // Get usage statistics
  getStats(apiKey?: string): any {
    if (apiKey) {
      this.checkAndResetDaily(apiKey);
      return this.usage.get(apiKey);
    }

    const allStats: any = {};
    for (const [key, stats] of this.usage.entries()) {
      this.checkAndResetDaily(key);
      allStats[key] = {
        ...stats,
        utilizationPercent: Math.round((stats.used / stats.limit) * 100),
        status: stats.remaining > stats.limit * 0.2 ? 'safe' :
                stats.remaining > stats.limit * 0.1 ? 'warning' : 'critical'
      };
    }
    return allStats;
  }

  // Emergency disable API
  disableApi(apiKey: string, reason: string): void {
    const stats = this.usage.get(apiKey);
    if (!stats) return;

    stats.remaining = 0;

    logger.error(`[API Guardrails] EMERGENCY DISABLE - ${apiKey.toUpperCase()} API`, {
      api: apiKey,
      reason,
      used: stats.used,
      limit: stats.limit,
      timestamp: new Date().toISOString()
    });
  }
}

// Singleton instance
export const apiGuardrailManager = new ApiGuardrailManager();

// Middleware factory for specific API protection
export function createApiGuardMiddleware(apiKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!apiGuardrailManager.canMakeRequest(apiKey)) {
      const stats = apiGuardrailManager.getStats(apiKey);

      return res.status(429).json({
        error: `${apiKey.toUpperCase()} API rate limit exceeded`,
        details: {
          api: apiKey,
          used: stats?.used || 0,
          limit: stats?.limit || 0,
          remaining: stats?.remaining || 0,
          resetTime: stats?.resetTime ? new Date(stats.resetTime).toISOString() : null
        },
        retryAfter: stats?.resetTime ? Math.ceil((stats.resetTime - Date.now()) / 1000) : 3600
      });
    }

    // Add usage recording to response locals for post-request tracking
    res.locals.apiKey = apiKey;
    next();
  };
}

// Middleware to record successful API usage
export const recordApiUsage = (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json;

  res.json = function(body: any) {
    // Record usage if API call was successful and we have an API key
    if (res.statusCode >= 200 && res.statusCode < 300 && res.locals.apiKey) {
      apiGuardrailManager.recordUsage(res.locals.apiKey);
    }

    return originalJson.call(this, body);
  };

  next();
};

// Reddit API specific middleware
export const redditApiGuard = createApiGuardMiddleware('reddit');

// Etherscan API specific middleware
export const etherscanApiGuard = createApiGuardMiddleware('etherscan');

// CryptoPanic API specific middleware
export const cryptoPanicApiGuard = createApiGuardMiddleware('cryptopanic');

// Get all API statistics
export const getAllApiStats = () => {
  return apiGuardrailManager.getStats();
};

// Get specific API statistics
export const getApiStats = (apiKey: string) => {
  return apiGuardrailManager.getStats(apiKey);
};

// Manual emergency disable (admin only)
export const emergencyDisableApi = (apiKey: string, reason: string) => {
  return apiGuardrailManager.disableApi(apiKey, reason);
};