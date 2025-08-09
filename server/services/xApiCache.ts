/**
 * X API Response Caching System
 * 24-hour minimum cache to preserve precious API allocation
 */

import { logger } from '../utils/logger.js';

interface CachedResponse {
  data: any;
  timestamp: number;
  expiresAt: number;
  source: string;
}

class XApiCache {
  private cache = new Map<string, CachedResponse>();
  private readonly DEFAULT_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  private generateKey(params: any): string {
    return `x-api:${JSON.stringify(params)}`;
  }

  get(params: any): CachedResponse | null {
    const key = this.generateKey(params);
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      logger.info('X API cache expired', { key, age: Date.now() - cached.timestamp });
      return null;
    }

    logger.info('X API cache hit - precious request saved!', {
      key,
      age: Math.round((Date.now() - cached.timestamp) / 1000 / 60), // minutes
      expiresIn: Math.round((cached.expiresAt - Date.now()) / 1000 / 60) // minutes
    });

    return cached;
  }

  set(params: any, data: any, customDuration?: number): void {
    const key = this.generateKey(params);
    const duration = customDuration || this.DEFAULT_CACHE_DURATION;
    
    const cached: CachedResponse = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + duration,
      source: 'x-api'
    };

    this.cache.set(key, cached);
    
    logger.warn('X API response cached for 24 hours', {
      key,
      dataSize: JSON.stringify(data).length,
      expiresAt: new Date(cached.expiresAt).toISOString()
    });
  }

  // Force extend cache duration to preserve API calls
  extendCache(params: any, additionalHours: number = 24): boolean {
    const key = this.generateKey(params);
    const cached = this.cache.get(key);
    
    if (!cached) {
      return false;
    }

    cached.expiresAt = Date.now() + (additionalHours * 60 * 60 * 1000);
    this.cache.set(key, cached);
    
    logger.info('X API cache extended to preserve allocation', {
      key,
      newExpiration: new Date(cached.expiresAt).toISOString(),
      additionalHours
    });
    
    return true;
  }

  // Get cache stats
  getStats(): {
    totalEntries: number;
    oldestEntry: number | null;
    newestEntry: number | null;
    totalSavedRequests: number;
  } {
    if (this.cache.size === 0) {
      return { totalEntries: 0, oldestEntry: null, newestEntry: null, totalSavedRequests: 0 };
    }

    const timestamps = Array.from(this.cache.values()).map(c => c.timestamp);
    
    return {
      totalEntries: this.cache.size,
      oldestEntry: Math.min(...timestamps),
      newestEntry: Math.max(...timestamps),
      totalSavedRequests: this.cache.size // Each cache hit saves a precious API call
    };
  }

  // Clear expired entries
  cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, cached] of this.cache.entries()) {
      if (now > cached.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.info('X API cache cleanup completed', { 
        removed: cleanedCount, 
        remaining: this.cache.size 
      });
    }
  }
}

export const xApiCache = new XApiCache();

// Cleanup every hour
setInterval(() => {
  xApiCache.cleanup();
}, 60 * 60 * 1000);