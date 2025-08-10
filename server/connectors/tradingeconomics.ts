/**
 * Trading Economics API Connector - Phase A Implementation
 * Fetches macro economic calendar events with rate limiting and provenance tracking
 */

import axios, { AxiosResponse } from 'axios';
import { db } from '../db';
import { macroEvents, connectorHealth, type InsertMacroEvent, type InsertConnectorHealth } from '@shared/schema';
import { logger } from '../utils/logger';
import { RateLimiter } from 'limiter';

export interface TradingEconomicsCalendarEvent {
  CalendarId: string;
  Date: string;
  Country: string;
  Category: string;
  Event: string;
  Reference: string;
  Source: string;
  Actual: string | null;
  Previous: string | null;
  Forecast: string | null;
  TEForecast: string | null;
  Importance: number; // 1-3
  LastUpdate: string;
  Revised: string | null;
  Currency: string;
  Unit: string;
  Ticker: string;
  Symbol: string;
}

export interface TradingEconomicsCountryResponse {
  Country: string;
  Category: string;
  DateTime: string;
  Value: number;
  Frequency: string;
  HistoricalDataSymbol: string;
  LastUpdate: string;
}

export class TradingEconomicsConnector {
  private apiKey: string | undefined;
  private baseUrl = 'https://api.tradingeconomics.com';
  private limiter: RateLimiter;
  private requestCount = 0;
  private errorCount = 0;
  private cryptoRelevantCountries: string[];
  private cryptoRelevantCategories: string[];

  constructor() {
    this.apiKey = process.env.TRADINGECONOMICS_API_KEY;
    // Rate limit: Varies by plan, conservative 60 requests per minute
    this.limiter = new RateLimiter({ tokensPerInterval: 60, interval: 60000 });
    
    // Countries with significant crypto markets/regulations
    this.cryptoRelevantCountries = [
      'United States',
      'China', 
      'European Union',
      'Japan',
      'South Korea',
      'Singapore',
      'United Kingdom',
      'Germany',
      'Switzerland',
      'Canada',
    ];

    // Economic categories that affect crypto markets
    this.cryptoRelevantCategories = [
      'Interest Rate',
      'Inflation Rate',
      'GDP Growth Rate', 
      'Central Bank Balance Sheet',
      'Currency',
      'Government Bond 10Y',
      'Stock Market',
      'Money Supply M2',
    ];
  }

  private async makeRequest<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    if (!this.apiKey) {
      throw new Error('Trading Economics API key not configured');
    }

    await this.limiter.removeTokens(1);
    this.requestCount++;

    const config = {
      baseURL: this.baseUrl,
      params: {
        c: this.apiKey,
        ...params,
      },
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

  async fetchCalendarEvents(days: number = 7): Promise<InsertMacroEvent[]> {
    const endpoint = '/calendar';
    const today = new Date();
    const futureDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    
    const params = {
      d1: today.toISOString().split('T')[0], // YYYY-MM-DD format
      d2: futureDate.toISOString().split('T')[0],
      importance: '2,3', // Medium and high importance only
    };

    try {
      const data = await this.makeRequest<TradingEconomicsCalendarEvent[]>(endpoint, params);
      
      if (!Array.isArray(data) || data.length === 0) {
        logger.info('No calendar events returned from Trading Economics');
        return [];
      }

      const macroEventsList: InsertMacroEvent[] = [];
      
      for (const event of data) {
        // Filter for crypto-relevant events
        if (!this.isCryptoRelevant(event)) {
          continue;
        }

        const importance = this.mapImportanceLevel(event.Importance);
        const timestamp = new Date(event.Date);

        macroEventsList.push({
          timestamp,
          name: `${event.Country}: ${event.Event}`,
          importance,
          windowBeforeMs: this.getWindowBeforeMs(importance),
          windowAfterMs: this.getWindowAfterMs(importance),
          provider: 'tradingeconomics',
          provenance: {
            provider: 'tradingeconomics',
            endpoint,
            fetchedAt: new Date().toISOString(),
            quotaCost: 1,
            calendar_id: event.CalendarId,
            country: event.Country,
            category: event.Category,
            importance_score: event.Importance,
            currency: event.Currency,
            unit: event.Unit,
            ticker: event.Ticker,
            actual: event.Actual,
            previous: event.Previous,
            forecast: event.Forecast,
            te_forecast: event.TEForecast,
          },
        });
      }

      logger.info(`Fetched ${macroEventsList.length} relevant calendar events from Trading Economics`);
      return macroEventsList;
      
    } catch (error) {
      logger.error('Failed to fetch calendar events from Trading Economics', error);
      if (error.message === 'Trading Economics API key not configured') {
        return []; // Return empty array instead of throwing for missing config
      }
      throw error;
    }
  }

  async fetchFedRateDecisions(): Promise<InsertMacroEvent[]> {
    const endpoint = '/calendar';
    const today = new Date();
    const futureDate = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000); // Next year
    
    const params = {
      c: 'united states',
      e: 'Interest Rate Decision',
      d1: today.toISOString().split('T')[0],
      d2: futureDate.toISOString().split('T')[0],
    };

    try {
      const data = await this.makeRequest<TradingEconomicsCalendarEvent[]>(endpoint, params);
      
      if (!Array.isArray(data)) {
        return [];
      }

      const macroEventsList: InsertMacroEvent[] = [];
      
      for (const event of data) {
        const timestamp = new Date(event.Date);
        
        macroEventsList.push({
          timestamp,
          name: `Fed Interest Rate Decision`,
          importance: 'high', // Fed decisions are always high importance
          windowBeforeMs: 4 * 60 * 60 * 1000, // 4 hours before
          windowAfterMs: 2 * 60 * 60 * 1000, // 2 hours after
          provider: 'tradingeconomics',
          provenance: {
            provider: 'tradingeconomics',
            endpoint,
            fetchedAt: new Date().toISOString(),
            quotaCost: 1,
            calendar_id: event.CalendarId,
            event_type: 'fed_rate_decision',
            country: event.Country,
            category: event.Category,
            actual: event.Actual,
            previous: event.Previous,
            forecast: event.Forecast,
          },
        });
      }

      logger.info(`Fetched ${macroEventsList.length} Fed rate decisions from Trading Economics`);
      return macroEventsList;
      
    } catch (error) {
      logger.error('Failed to fetch Fed rate decisions from Trading Economics', error);
      throw error;
    }
  }

  private isCryptoRelevant(event: TradingEconomicsCalendarEvent): boolean {
    // Check if country is crypto-relevant
    const isRelevantCountry = this.cryptoRelevantCountries.some(country => 
      event.Country.toLowerCase().includes(country.toLowerCase())
    );
    
    // Check if category is crypto-relevant
    const isRelevantCategory = this.cryptoRelevantCategories.some(category =>
      event.Category.toLowerCase().includes(category.toLowerCase()) ||
      event.Event.toLowerCase().includes(category.toLowerCase())
    );
    
    // Special keywords in event names
    const cryptoKeywords = ['inflation', 'rate', 'gdp', 'employment', 'cpi', 'ppi', 'fomc', 'ecb'];
    const hasRelevantKeyword = cryptoKeywords.some(keyword =>
      event.Event.toLowerCase().includes(keyword)
    );
    
    return (isRelevantCountry && isRelevantCategory) || hasRelevantKeyword;
  }

  private mapImportanceLevel(importance: number): 'low' | 'medium' | 'high' {
    if (importance >= 3) return 'high';
    if (importance >= 2) return 'medium';
    return 'low';
  }

  private getWindowBeforeMs(importance: 'low' | 'medium' | 'high'): number {
    switch (importance) {
      case 'high': return 4 * 60 * 60 * 1000; // 4 hours
      case 'medium': return 2 * 60 * 60 * 1000; // 2 hours  
      case 'low': return 1 * 60 * 60 * 1000; // 1 hour
    }
  }

  private getWindowAfterMs(importance: 'low' | 'medium' | 'high'): number {
    switch (importance) {
      case 'high': return 2 * 60 * 60 * 1000; // 2 hours
      case 'medium': return 1 * 60 * 60 * 1000; // 1 hour
      case 'low': return 30 * 60 * 1000; // 30 minutes
    }
  }

  async storeMacroEvents(events: InsertMacroEvent[]): Promise<void> {
    if (events.length === 0) return;

    try {
      // Use upsert to handle duplicate events
      await db.insert(macroEvents)
        .values(events)
        .onConflictDoUpdate({
          target: [macroEvents.name, macroEvents.timestamp],
          set: {
            importance: macroEvents.importance,
            windowBeforeMs: macroEvents.windowBeforeMs,
            windowAfterMs: macroEvents.windowAfterMs,
            provenance: macroEvents.provenance,
          },
        });

      logger.info(`Stored ${events.length} macro events from Trading Economics to database`);
    } catch (error) {
      logger.error('Failed to store Trading Economics macro events', error);
      throw error;
    }
  }

  private async updateHealthStatus(status: 'healthy' | 'degraded' | 'down', error: string | null): Promise<void> {
    const healthData: InsertConnectorHealth = {
      provider: 'tradingeconomics',
      status,
      lastSuccessfulFetch: status === 'healthy' ? new Date() : undefined,
      lastError: error,
      requestCount24h: this.requestCount,
      errorCount24h: this.errorCount,
      quotaUsed: this.requestCount,
      quotaLimit: 86400, // Varies by plan, conservative estimate
    };

    try {
      await db.insert(connectorHealth)
        .values(healthData)
        .onConflictDoUpdate({
          target: connectorHealth.provider,
          set: healthData,
        });
    } catch (error) {
      logger.error('Failed to update Trading Economics connector health', error);
    }
  }

  async getHealthStatus(): Promise<{ status: string; requestCount: number; errorCount: number; configured: boolean }> {
    const configured = !!this.apiKey;
    return {
      status: !configured ? 'down' : 
              this.errorCount / Math.max(this.requestCount, 1) > 0.1 ? 'degraded' : 'healthy',
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      configured,
    };
  }

  resetDailyCounters(): void {
    this.requestCount = 0;
    this.errorCount = 0;
  }
}

// Export singleton instance
export const tradingEconomicsConnector = new TradingEconomicsConnector();