/**
 * Trading Economics API Connector for Macro Economic Events
 * Fetches economic calendar events that impact cryptocurrency markets
 */

import axios, { AxiosResponse } from 'axios';
import { RateLimiter } from 'limiter';
import { logger } from '../utils/logger';
import { db } from '../db';
import { macroEventsExtended, connectorHealth } from '@shared/schema';
import type { InsertMacroEvent, InsertConnectorHealth } from '@shared/schema';

interface TradingEconomicsEvent {
  CalendarId: string;
  Date: string;
  Country: string;
  Category: string;
  Event: string;
  Reference: string;
  Source: string;
  SourceURL: string;
  Actual: string | null;
  Previous: string | null;
  Forecast: string | null;
  TEForecast: string | null;
  URL: string;
  Importance: number; // 1 = Low, 2 = Medium, 3 = High
  LastUpdate: string;
  Revised: string | null;
  Currency: string;
  Unit: string;
  Ticker: string;
  Symbol: string;
}

interface TradingEconomicsResponse {
  success: boolean;
  data?: TradingEconomicsEvent[];
  error?: string;
  message?: string;
}

export class TradingEconomicsConnector {
  private apiKey: string | undefined;
  private baseUrl = 'https://api.tradingeconomics.com';
  private limiter: RateLimiter;
  private requestCount = 0;
  private errorCount = 0;

  constructor() {
    this.apiKey = process.env.TRADING_ECONOMICS_API_KEY;
    // Rate limit: 100 requests per hour for free plan
    this.limiter = new RateLimiter({ tokensPerInterval: 100, interval: 60 * 60 * 1000 });
  }

  private async makeRequest<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    if (!this.apiKey) {
      throw new Error('Trading Economics API key not configured');
    }

    await this.limiter.removeTokens(1);
    this.requestCount++;

    const config = {
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      params,
      timeout: 15000,
    };

    try {
      const response: AxiosResponse<T> = await axios.get(endpoint, config);
      await this.updateHealthStatus('healthy', null);
      return response.data;
    } catch (error: any) {
      this.errorCount++;
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      await this.updateHealthStatus('degraded', errorMessage);
      
      logger.error('Trading Economics API error', {
        endpoint,
        error: errorMessage,
        status: error.response?.status,
      });

      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded');
      }
      
      throw error;
    }
  }

  async fetchEconomicCalendar(): Promise<InsertMacroEvent[]> {
    try {
      // Fetch events for the next 7 days
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);

      const startDate = today.toISOString().split('T')[0];
      const endDate = nextWeek.toISOString().split('T')[0];

      const endpoint = '/calendar';
      const params = {
        c: 'united states,china,european union,japan,united kingdom', // Major economies
        i: '3,2', // High and Medium importance only
        f: startDate,
        t: endDate,
      };

      // Note: Trading Economics free tier might have limitations
      // This is a mock implementation for demonstration
      const data = await this.makeRequest<TradingEconomicsEvent[]>(endpoint, params);
      
      if (!Array.isArray(data) || data.length === 0) {
        logger.warn('No economic events returned from Trading Economics');
        return [];
      }

      const events: InsertMacroEvent[] = [];

      for (const event of data) {
        // Skip events without proper data
        if (!event.Date || !event.Event || !event.Importance) {
          continue;
        }

        // Parse event date
        const eventDate = new Date(event.Date);
        if (isNaN(eventDate.getTime())) {
          logger.warn('Invalid event date', { event: event.Event, date: event.Date });
          continue;
        }

        // Map importance level
        const importanceMap: Record<number, string> = {
          1: 'low',
          2: 'medium',
          3: 'high',
        };

        const importance = importanceMap[event.Importance] || 'low';

        // Calculate impact windows for crypto markets
        const impactWindows = this.calculateImpactWindows(event.Category, importance);

        events.push({
          timestamp: eventDate,
          name: event.Event,
          importance,
          windowBeforeMs: impactWindows.beforeMs,
          windowAfterMs: impactWindows.afterMs,
          provider: 'trading_economics',
          provenance: {
            provider: 'trading_economics',
            fetchedAt: new Date().toISOString(),
            quotaCost: 1,
            calendarId: event.CalendarId,
            country: event.Country,
            category: event.Category,
            currency: event.Currency,
            unit: event.Unit,
            source: event.Source,
            actual: event.Actual,
            previous: event.Previous,
            forecast: event.Forecast,
            lastUpdate: event.LastUpdate,
          } as Record<string, any>,
        });
      }

      logger.info(`Fetched ${events.length} macro economic events from Trading Economics`);
      return events;
      
    } catch (error) {
      logger.error('Failed to fetch economic calendar', error);
      throw error;
    }
  }

  private calculateImpactWindows(category: string, importance: string): { beforeMs: number; afterMs: number } {
    // Define impact windows based on event category and importance
    const baseWindows = {
      high: { beforeMs: 2 * 60 * 60 * 1000, afterMs: 4 * 60 * 60 * 1000 }, // 2h before, 4h after
      medium: { beforeMs: 1 * 60 * 60 * 1000, afterMs: 2 * 60 * 60 * 1000 }, // 1h before, 2h after
      low: { beforeMs: 30 * 60 * 1000, afterMs: 1 * 60 * 60 * 1000 }, // 30m before, 1h after
    };

    // Category-specific adjustments
    const categoryMultipliers: Record<string, number> = {
      'Interest Rate': 2.0, // Fed meetings have extended impact
      'Inflation': 1.5, // CPI, PPI data important for crypto
      'Employment': 1.5, // Jobs data moves markets
      'GDP': 1.5, // Economic growth indicators
      'Central Banking': 2.0, // Fed speeches, policy decisions
      'Consumer': 1.2, // Consumer confidence, spending
      'Manufacturing': 1.0, // Manufacturing data
      'Housing': 0.8, // Housing market data
    };

    const multiplier = categoryMultipliers[category] || 1.0;
    const windows = baseWindows[importance as keyof typeof baseWindows] || baseWindows.low;

    return {
      beforeMs: Math.round(windows.beforeMs * multiplier),
      afterMs: Math.round(windows.afterMs * multiplier),
    };
  }

  async storeMacroEvents(events: InsertMacroEvent[]): Promise<void> {
    if (events.length === 0) return;

    try {
      await db.insert(macroEvents)
        .values(events)
        .onConflictDoUpdate({
          target: [macroEvents.name, macroEvents.timestamp, macroEvents.provider],
          set: {
            importance: macroEvents.importance,
            windowBeforeMs: macroEvents.windowBeforeMs,
            windowAfterMs: macroEvents.windowAfterMs,
            provenance: macroEvents.provenance,
            fetchedAt: new Date(),
          },
        });

      logger.info(`Stored ${events.length} macro economic events`);
    } catch (error) {
      logger.error('Failed to store macro economic events', error);
      throw error;
    }
  }

  private async updateHealthStatus(status: 'healthy' | 'degraded' | 'down', lastError: string | null): Promise<void> {
    try {
      await db.insert(connectorHealth).values({
        provider: 'trading_economics',
        status,
        requestCount: this.requestCount,
        errorCount: this.errorCount,
        lastError,
        quotaCost: this.requestCount,
      } as InsertConnectorHealth).onConflictDoUpdate({
        target: connectorHealth.provider,
        set: {
          status,
          requestCount: this.requestCount,
          errorCount: this.errorCount,
          lastError,
          quotaCost: this.requestCount,
          lastChecked: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to update Trading Economics connector health', error);
    }
  }

  async getHealthStatus(): Promise<any> {
    return {
      provider: 'trading_economics',
      status: this.errorCount > 10 ? 'degraded' : 'healthy',
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      hasCredentials: !!this.apiKey,
      rateLimitRemaining: this.limiter.getTokensRemaining(),
    };
  }
}