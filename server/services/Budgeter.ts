
export interface BudgetStatus {
  provider: string;
  used: number;
  limit: number;
  resetAt: Date;
  available: boolean;
}

export class Budgeter {
  getStatus(): BudgetStatus[] {
    return [
      {
        provider: 'binance',
        used: 100,
        limit: 1000,
        resetAt: new Date(Date.now() + 3600000),
        available: true
      }
    ];
  }
}

export const budgeter = new Budgeter();
/**
 * Budgeter - API cost and rate limit management
 */

import { logger } from '../utils/logger';

export interface ProviderLimits {
  provider: string;
  maxCallsPerMinute: number;
  maxCostUSD: number;
  costPerCall: number;
}

export interface ProviderUsage {
  provider: string;
  calls: number;
  costUSD: number;
  rateRemaining: number;
  resetAt: number;
  lastCall: number;
}

export interface BudgetRequest {
  provider: string;
  kind: string;
  estimatedCost?: number;
}

export interface BudgetResult {
  allowed: boolean;
  reason?: string;
  delayMs?: number;
  fallbackProvider?: string;
}

export class Budgeter {
  private limits = new Map<string, ProviderLimits>();
  private usage = new Map<string, ProviderUsage>();
  private resetInterval?: NodeJS.Timeout;

  constructor() {
    this.initializeLimits();
    this.startResetScheduler();
  }

  private initializeLimits(): void {
    const providers: ProviderLimits[] = [
      { provider: 'binance', maxCallsPerMinute: 1200, maxCostUSD: 10, costPerCall: 0.001 },
      { provider: 'coinbase', maxCallsPerMinute: 600, maxCostUSD: 20, costPerCall: 0.002 },
      { provider: 'coingecko', maxCallsPerMinute: 50, maxCostUSD: 5, costPerCall: 0.01 },
      { provider: 'etherscan', maxCallsPerMinute: 300, maxCostUSD: 15, costPerCall: 0.005 },
      { provider: 'deribit', maxCallsPerMinute: 500, maxCostUSD: 25, costPerCall: 0.003 }
    ];

    for (const limit of providers) {
      this.limits.set(limit.provider, limit);
      this.usage.set(limit.provider, {
        provider: limit.provider,
        calls: 0,
        costUSD: 0,
        rateRemaining: limit.maxCallsPerMinute,
        resetAt: Date.now() + 60000,
        lastCall: 0
      });
    }

    logger.info('[Budgeter] Initialized limits for providers', { count: providers.length });
  }

  private startResetScheduler(): void {
    this.resetInterval = setInterval(() => {
      this.resetRateLimits();
    }, 60000); // Reset every minute
  }

  private resetRateLimits(): void {
    const now = Date.now();
    
    for (const [provider, usage] of this.usage) {
      if (now >= usage.resetAt) {
        const limits = this.limits.get(provider);
        if (limits) {
          usage.calls = 0;
          usage.rateRemaining = limits.maxCallsPerMinute;
          usage.resetAt = now + 60000;
        }
      }
    }
  }

  async request<T>(
    provider: string, 
    kind: string, 
    fn: () => Promise<T>
  ): Promise<T> {
    const budgetCheck = this.checkBudget({ provider, kind });
    
    if (!budgetCheck.allowed) {
      if (budgetCheck.delayMs) {
        logger.warn(`[Budgeter] Rate limited ${provider}, delaying ${budgetCheck.delayMs}ms`);
        await new Promise(resolve => setTimeout(resolve, budgetCheck.delayMs));
        return this.request(provider, kind, fn);
      }
      
      if (budgetCheck.fallbackProvider) {
        logger.warn(`[Budgeter] Falling back from ${provider} to ${budgetCheck.fallbackProvider}`);
        return this.request(budgetCheck.fallbackProvider, kind, fn);
      }
      
      throw new Error(`Budget exceeded for ${provider}: ${budgetCheck.reason}`);
    }

    try {
      const result = await fn();
      this.recordUsage(provider, kind, true);
      return result;
    } catch (error) {
      this.recordUsage(provider, kind, false);
      throw error;
    }
  }

  checkBudget(request: BudgetRequest): BudgetResult {
    const limits = this.limits.get(request.provider);
    const usage = this.usage.get(request.provider);
    
    if (!limits || !usage) {
      return { allowed: false, reason: 'Unknown provider' };
    }

    // Check rate limits
    if (usage.rateRemaining <= 0) {
      const delayMs = usage.resetAt - Date.now();
      if (delayMs > 0) {
        return { 
          allowed: false, 
          reason: 'Rate limit exceeded',
          delayMs: Math.min(delayMs, 5000) // Max 5s delay
        };
      }
    }

    // Check cost limits
    const estimatedCost = request.estimatedCost || limits.costPerCall;
    if (usage.costUSD + estimatedCost > limits.maxCostUSD) {
      const fallback = this.findFallbackProvider(request.provider, request.kind);
      return { 
        allowed: false, 
        reason: 'Cost budget exceeded',
        fallbackProvider: fallback
      };
    }

    return { allowed: true };
  }

  private findFallbackProvider(provider: string, kind: string): string | undefined {
    // Simple fallback logic
    const fallbacks: Record<string, string[]> = {
      'coingecko': ['coinbase', 'binance'],
      'binance': ['coinbase', 'deribit'],
      'coinbase': ['binance'],
      'etherscan': ['alchemy'], // Would need to implement
      'deribit': ['binance']
    };

    const candidates = fallbacks[provider] || [];
    
    for (const candidate of candidates) {
      const candidateUsage = this.usage.get(candidate);
      if (candidateUsage && candidateUsage.rateRemaining > 10) {
        return candidate;
      }
    }

    return undefined;
  }

  private recordUsage(provider: string, kind: string, success: boolean): void {
    const limits = this.limits.get(provider);
    const usage = this.usage.get(provider);
    
    if (!limits || !usage) return;

    usage.calls++;
    usage.rateRemaining = Math.max(0, usage.rateRemaining - 1);
    usage.costUSD += limits.costPerCall;
    usage.lastCall = Date.now();

    if (success) {
      logger.debug(`[Budgeter] Recorded successful ${kind} call to ${provider}`, {
        remaining: usage.rateRemaining,
        cost: usage.costUSD.toFixed(4)
      });
    }
  }

  getStatus(): ProviderUsage[] {
    return Array.from(this.usage.values());
  }

  getProviderStatus(provider: string): ProviderUsage | undefined {
    return this.usage.get(provider);
  }

  updateLimits(provider: string, updates: Partial<ProviderLimits>): void {
    const existing = this.limits.get(provider);
    if (existing) {
      Object.assign(existing, updates);
      logger.info(`[Budgeter] Updated limits for ${provider}`, updates);
    }
  }

  cleanup(): void {
    if (this.resetInterval) {
      clearInterval(this.resetInterval);
    }
  }
}

export const budgeter = new Budgeter();
import { logger } from '../utils/logger.js';

interface ProviderLimits {
  provider: string;
  rateLimit: number;
  costLimit: number;
  calls: number;
  costUSD: number;
  rateRemaining: number;
  resetAt: number;
  lastCall?: number;
}

interface BudgetRequest {
  provider: string;
  kind: string;
  estimatedCost?: number;
}

interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  fallbackProvider?: string;
  rateRemaining: number;
  costRemaining: number;
}

export class Budgeter {
  private providers: Map<string, ProviderLimits> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    const defaultProviders = [
      { provider: 'binance', rateLimit: 1200, costLimit: 50 },
      { provider: 'coinbase', rateLimit: 1000, costLimit: 40 },
      { provider: 'coingecko', rateLimit: 100, costLimit: 10 },
      { provider: 'kraken', rateLimit: 500, costLimit: 30 }
    ];

    for (const config of defaultProviders) {
      this.providers.set(config.provider, {
        ...config,
        calls: 0,
        costUSD: 0,
        rateRemaining: config.rateLimit,
        resetAt: Date.now() + 3600000 // 1 hour
      });
    }
  }

  checkBudget(request: BudgetRequest): BudgetCheckResult {
    const provider = this.providers.get(request.provider);
    if (!provider) {
      return {
        allowed: false,
        reason: 'Unknown provider',
        rateRemaining: 0,
        costRemaining: 0
      };
    }

    // Check rate limit
    if (provider.rateRemaining <= 0) {
      const fallback = this.findFallbackProvider(request.provider);
      return {
        allowed: false,
        reason: 'Rate limit exceeded',
        fallbackProvider: fallback,
        rateRemaining: 0,
        costRemaining: provider.costLimit - provider.costUSD
      };
    }

    // Check cost limit
    const estimatedCost = request.estimatedCost || 0.1;
    if (provider.costUSD + estimatedCost > provider.costLimit) {
      const fallback = this.findFallbackProvider(request.provider);
      return {
        allowed: false,
        reason: 'Cost budget exceeded',
        fallbackProvider: fallback,
        rateRemaining: provider.rateRemaining,
        costRemaining: 0
      };
    }

    return {
      allowed: true,
      rateRemaining: provider.rateRemaining,
      costRemaining: provider.costLimit - provider.costUSD
    };
  }

  async request<T>(provider: string, kind: string, fn: () => Promise<T>, cost = 0.1): Promise<T> {
    const budget = this.checkBudget({ provider, kind, estimatedCost: cost });
    
    if (!budget.allowed) {
      if (budget.fallbackProvider) {
        logger.warn(`[Budgeter] Using fallback ${budget.fallbackProvider} for ${provider}`);
        return this.request(budget.fallbackProvider, kind, fn, cost);
      }
      throw new Error(`Budget exceeded: ${budget.reason}`);
    }

    const providerData = this.providers.get(provider)!;
    
    try {
      const result = await fn();
      
      // Update usage
      providerData.calls++;
      providerData.rateRemaining--;
      providerData.costUSD += cost;
      providerData.lastCall = Date.now();
      
      return result;
    } catch (error) {
      // Still count failed requests against rate limit
      providerData.calls++;
      providerData.rateRemaining--;
      providerData.lastCall = Date.now();
      throw error;
    }
  }

  private findFallbackProvider(excludeProvider: string): string | undefined {
    const fallbacks: Record<string, string[]> = {
      'coingecko': ['coinbase', 'binance'],
      'binance': ['coinbase', 'kraken'],
      'coinbase': ['binance', 'kraken'],
      'kraken': ['binance', 'coinbase']
    };

    const candidates = fallbacks[excludeProvider] || [];
    for (const candidate of candidates) {
      const provider = this.providers.get(candidate);
      if (provider && provider.rateRemaining > 10) {
        return candidate;
      }
    }
    return undefined;
  }

  getStatus(): ProviderLimits[] {
    return Array.from(this.providers.values());
  }

  getProviderStatus(provider: string): ProviderLimits | null {
    return this.providers.get(provider) || null;
  }

  updateLimits(provider: string, updates: Partial<ProviderLimits>): void {
    const existing = this.providers.get(provider);
    if (existing) {
      Object.assign(existing, updates);
      logger.info(`[Budgeter] Updated limits for ${provider}`, updates);
    }
  }
}

export const budgeter = new Budgeter();
