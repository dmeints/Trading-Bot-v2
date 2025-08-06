import fs from 'fs';
import path from 'path';
import { parse } from 'json2csv';

const ANALYTICS_PATH = './logs/analytics.jsonl';
const ERRORS_PATH = './logs/errors.log';
const DAILY_SUMMARY_PATH = './logs/daily_summary.csv';

export interface AnalyticsEvent {
  timestamp: string;
  tradeId: string;
  strategy: string;
  regime: 'bull' | 'bear' | 'sideways';
  type: 'scalp' | 'swing' | 'breakout';
  risk: 'low' | 'medium' | 'high';
  source: string;
  pnl: number;
  latencyMs: number;
  signalStrength: number;
  confidence: number;
  userId?: string;
  symbol?: string;
  action?: 'buy' | 'sell' | 'hold';
  quantity?: number;
  price?: number;
  metadata?: any;
}

export interface ErrorEvent {
  timestamp: string;
  level: 'error' | 'warn' | 'info';
  message: string;
  stack?: string;
  userId?: string;
  endpoint?: string;
  metadata?: any;
}

class AnalyticsLogger {
  private ensureLogDirectories() {
    const dirs = ['logs', 'models', 'models/backup'];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[Analytics] Created directory: ${dir}`);
      }
    });
  }

  logAnalyticsEvent(event: AnalyticsEvent) {
    try {
      this.ensureLogDirectories();
      const logEntry = JSON.stringify({
        ...event,
        timestamp: event.timestamp || new Date().toISOString(),
      }) + '\n';
      
      fs.appendFileSync(ANALYTICS_PATH, logEntry, 'utf8');
      console.log(`[Analytics] Logged event: ${event.source} - ${event.type}`);
    } catch (error) {
      console.error('[Analytics] Failed to log analytics event:', error);
      this.logError({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Failed to log analytics event',
        stack: error instanceof Error ? error.stack : undefined,
        metadata: { originalEvent: event },
      });
    }
  }

  logError(event: ErrorEvent) {
    try {
      this.ensureLogDirectories();
      const logEntry = `${event.timestamp} [${event.level.toUpperCase()}] ${event.message}${
        event.stack ? '\n' + event.stack : ''
      }\n${event.metadata ? 'Metadata: ' + JSON.stringify(event.metadata) + '\n' : ''}---\n`;
      
      fs.appendFileSync(ERRORS_PATH, logEntry, 'utf8');
    } catch (error) {
      console.error('[Analytics] Failed to log error event:', error);
    }
  }

  getAnalyticsData(limit?: number): AnalyticsEvent[] {
    try {
      if (!fs.existsSync(ANALYTICS_PATH)) return [];
      
      const data = fs.readFileSync(ANALYTICS_PATH, 'utf8');
      const lines = data.trim().split('\n').filter(Boolean);
      const events = lines.map(line => JSON.parse(line));
      
      return limit ? events.slice(-limit) : events;
    } catch (error) {
      console.error('[Analytics] Failed to read analytics data:', error);
      return [];
    }
  }

  getErrorLogs(limit?: number): string {
    try {
      if (!fs.existsSync(ERRORS_PATH)) return '';
      
      const data = fs.readFileSync(ERRORS_PATH, 'utf8');
      if (limit) {
        const lines = data.trim().split('\n');
        return lines.slice(-limit).join('\n');
      }
      return data;
    } catch (error) {
      console.error('[Analytics] Failed to read error logs:', error);
      return '';
    }
  }

  generateDailySummary(): string | null {
    try {
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;
      const events = this.getAnalyticsData();
      
      const dailyEvents = events.filter(event => {
        const eventTime = new Date(event.timestamp).getTime();
        return now - eventTime < oneDayMs;
      });
      
      if (!dailyEvents.length) {
        console.log('[Analytics] No events in last 24h for daily summary');
        return null;
      }
      
      // Generate summary statistics
      const summary = {
        totalTrades: dailyEvents.length,
        totalPnL: dailyEvents.reduce((sum, e) => sum + e.pnl, 0),
        averageConfidence: dailyEvents.reduce((sum, e) => sum + e.confidence, 0) / dailyEvents.length,
        strategyBreakdown: this.getStrategyBreakdown(dailyEvents),
        riskBreakdown: this.getRiskBreakdown(dailyEvents),
        performanceByHour: this.getHourlyPerformance(dailyEvents),
      };
      
      // Create CSV data
      const csvData = dailyEvents.map(event => ({
        ...event,
        summaryStats: JSON.stringify(summary),
      }));
      
      const csv = parse(csvData);
      fs.writeFileSync(DAILY_SUMMARY_PATH, csv, 'utf8');
      
      console.log(`[Analytics] Generated daily summary with ${dailyEvents.length} events`);
      return DAILY_SUMMARY_PATH;
    } catch (error) {
      console.error('[Analytics] Failed to generate daily summary:', error);
      this.logError({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Failed to generate daily summary',
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  private getStrategyBreakdown(events: AnalyticsEvent[]) {
    const breakdown: Record<string, number> = {};
    events.forEach(event => {
      breakdown[event.strategy] = (breakdown[event.strategy] || 0) + 1;
    });
    return breakdown;
  }

  private getRiskBreakdown(events: AnalyticsEvent[]) {
    const breakdown: Record<string, number> = {};
    events.forEach(event => {
      breakdown[event.risk] = (breakdown[event.risk] || 0) + 1;
    });
    return breakdown;
  }

  private getHourlyPerformance(events: AnalyticsEvent[]) {
    const hourlyData: Record<number, { count: number; pnl: number }> = {};
    
    events.forEach(event => {
      const hour = new Date(event.timestamp).getHours();
      if (!hourlyData[hour]) {
        hourlyData[hour] = { count: 0, pnl: 0 };
      }
      hourlyData[hour].count++;
      hourlyData[hour].pnl += event.pnl;
    });
    
    return hourlyData;
  }

  clearLogs() {
    try {
      if (fs.existsSync(ANALYTICS_PATH)) fs.unlinkSync(ANALYTICS_PATH);
      if (fs.existsSync(ERRORS_PATH)) fs.unlinkSync(ERRORS_PATH);
      if (fs.existsSync(DAILY_SUMMARY_PATH)) fs.unlinkSync(DAILY_SUMMARY_PATH);
      console.log('[Analytics] Logs cleared');
    } catch (error) {
      console.error('[Analytics] Failed to clear logs:', error);
    }
  }

  getSystemStats() {
    try {
      const analyticsExists = fs.existsSync(ANALYTICS_PATH);
      const errorsExists = fs.existsSync(ERRORS_PATH);
      
      const analyticsSize = analyticsExists ? fs.statSync(ANALYTICS_PATH).size : 0;
      const errorsSize = errorsExists ? fs.statSync(ERRORS_PATH).size : 0;
      
      const totalEvents = this.getAnalyticsData().length;
      const last24hEvents = this.getAnalyticsData().filter(event => {
        const eventTime = new Date(event.timestamp).getTime();
        return Date.now() - eventTime < 24 * 60 * 60 * 1000;
      }).length;
      
      return {
        analyticsFileSize: analyticsSize,
        errorLogSize: errorsSize,
        totalEvents,
        last24hEvents,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[Analytics] Failed to get system stats:', error);
      return null;
    }
  }
}

export const analyticsLogger = new AnalyticsLogger();

// Trade event helper
export const logTradeEvent = (
  tradeId: string,
  userId: string,
  symbol: string,
  action: 'buy' | 'sell' | 'hold',
  pnl: number,
  confidence: number,
  strategy: string = 'ai-assisted',
  metadata?: any
) => {
  analyticsLogger.logAnalyticsEvent({
    timestamp: new Date().toISOString(),
    tradeId,
    userId,
    symbol,
    action,
    strategy,
    regime: 'sideways', // This should be determined by market analysis
    type: 'scalp', // This should be determined by trade characteristics
    risk: pnl > 1000 ? 'high' : pnl > 100 ? 'medium' : 'low',
    source: 'trading-engine',
    pnl,
    latencyMs: 0, // Should be measured
    signalStrength: confidence,
    confidence,
    metadata,
  });
};

// AI agent event helper
export const logAIEvent = (
  agentType: string,
  action: string,
  confidence: number,
  latencyMs: number,
  metadata?: any
) => {
  analyticsLogger.logAnalyticsEvent({
    timestamp: new Date().toISOString(),
    tradeId: `ai-${Date.now()}`,
    strategy: agentType,
    regime: 'sideways',
    type: 'breakout',
    risk: 'medium',
    source: 'ai-agent',
    pnl: 0,
    latencyMs,
    signalStrength: confidence,
    confidence,
    metadata: { action, ...metadata },
  });
};