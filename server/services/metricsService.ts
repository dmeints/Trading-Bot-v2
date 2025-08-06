import { storage } from '../storage';

interface SystemMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
  };
  trading: {
    totalTrades: number;
    successfulTrades: number;
    averageConfidence: number;
    totalPnL: number;
  };
  ai: {
    modelsActive: number;
    averageConfidence: number;
    predictionsToday: number;
    accuracyRate: number;
  };
  system: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    errorRate: number;
  };
}

interface AlertRule {
  id: string;
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  enabled: boolean;
}

class MetricsService {
  private requestMetrics: any[] = [];
  private tradingMetrics: any[] = [];
  private aiMetrics: any[] = [];
  private alertRules: AlertRule[] = [];
  private activeAlerts: any[] = [];

  constructor() {
    this.initializeDefaultAlertRules();
  }

  async recordRequest(method: string, path: string, statusCode: number, duration: number): Promise<void> {
    this.requestMetrics.push({
      timestamp: new Date(),
      method,
      path,
      statusCode,
      duration,
      successful: statusCode < 400
    });

    // Keep only last 10000 requests
    if (this.requestMetrics.length > 10000) {
      this.requestMetrics = this.requestMetrics.slice(-10000);
    }

    // Check for alerts
    this.checkRequestAlerts();
  }

  async recordTrade(trade: any): Promise<void> {
    this.tradingMetrics.push({
      timestamp: new Date(),
      symbol: trade.symbol,
      type: trade.type,
      quantity: trade.quantity,
      price: trade.executedPrice,
      pnl: trade.pnl,
      confidence: trade.confidence || 0.7,
      successful: trade.pnl > 0
    });

    // Keep only last 5000 trades
    if (this.tradingMetrics.length > 5000) {
      this.tradingMetrics = this.tradingMetrics.slice(-5000);
    }

    this.checkTradingAlerts();
  }

  async recordAIActivity(activity: any): Promise<void> {
    this.aiMetrics.push({
      timestamp: new Date(),
      agentType: activity.agentType,
      confidence: activity.confidence,
      action: activity.action,
      successful: activity.confidence > 0.6
    });

    // Keep only last 5000 activities
    if (this.aiMetrics.length > 5000) {
      this.aiMetrics = this.aiMetrics.slice(-5000);
    }

    this.checkAIAlerts();
  }

  async getMetrics(timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<SystemMetrics> {
    const cutoffTime = this.getCutoffTime(timeRange);
    
    const recentRequests = this.requestMetrics.filter(r => r.timestamp >= cutoffTime);
    const recentTrades = this.tradingMetrics.filter(t => t.timestamp >= cutoffTime);
    const recentAI = this.aiMetrics.filter(a => a.timestamp >= cutoffTime);

    return {
      requests: {
        total: recentRequests.length,
        successful: recentRequests.filter(r => r.successful).length,
        failed: recentRequests.filter(r => !r.successful).length,
        averageResponseTime: recentRequests.reduce((sum, r) => sum + r.duration, 0) / recentRequests.length || 0
      },
      trading: {
        totalTrades: recentTrades.length,
        successfulTrades: recentTrades.filter(t => t.successful).length,
        averageConfidence: recentTrades.reduce((sum, t) => sum + t.confidence, 0) / recentTrades.length || 0,
        totalPnL: recentTrades.reduce((sum, t) => sum + t.pnl, 0)
      },
      ai: {
        modelsActive: new Set(recentAI.map(a => a.agentType)).size,
        averageConfidence: recentAI.reduce((sum, a) => sum + a.confidence, 0) / recentAI.length || 0,
        predictionsToday: recentAI.length,
        accuracyRate: recentAI.filter(a => a.successful).length / recentAI.length || 0
      },
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        cpuUsage: process.cpuUsage().user / 1000000, // seconds
        errorRate: recentRequests.filter(r => !r.successful).length / recentRequests.length || 0
      }
    };
  }

  async getPrometheusMetrics(): Promise<string> {
    const metrics = await this.getMetrics();
    const timestamp = Date.now();

    return `
# HELP skippy_requests_total Total number of HTTP requests
# TYPE skippy_requests_total counter
skippy_requests_total{status="success"} ${metrics.requests.successful} ${timestamp}
skippy_requests_total{status="error"} ${metrics.requests.failed} ${timestamp}

# HELP skippy_request_duration_ms Average request duration in milliseconds
# TYPE skippy_request_duration_ms gauge
skippy_request_duration_ms ${metrics.requests.averageResponseTime} ${timestamp}

# HELP skippy_trades_total Total number of trades executed
# TYPE skippy_trades_total counter
skippy_trades_total ${metrics.trading.totalTrades} ${timestamp}

# HELP skippy_trades_pnl_total Total PnL from all trades
# TYPE skippy_trades_pnl_total gauge
skippy_trades_pnl_total ${metrics.trading.totalPnL} ${timestamp}

# HELP skippy_ai_confidence Average AI confidence score
# TYPE skippy_ai_confidence gauge
skippy_ai_confidence ${metrics.ai.averageConfidence} ${timestamp}

# HELP skippy_ai_accuracy AI prediction accuracy rate
# TYPE skippy_ai_accuracy gauge
skippy_ai_accuracy ${metrics.ai.accuracyRate} ${timestamp}

# HELP skippy_system_uptime_seconds System uptime in seconds
# TYPE skippy_system_uptime_seconds counter
skippy_system_uptime_seconds ${metrics.system.uptime} ${timestamp}

# HELP skippy_system_memory_mb Memory usage in megabytes
# TYPE skippy_system_memory_mb gauge
skippy_system_memory_mb ${metrics.system.memoryUsage} ${timestamp}

# HELP skippy_system_error_rate System error rate
# TYPE skippy_system_error_rate gauge
skippy_system_error_rate ${metrics.system.errorRate} ${timestamp}
    `.trim();
  }

  async addAlertRule(rule: Omit<AlertRule, 'id'>): Promise<string> {
    const alertRule: AlertRule = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...rule
    };
    
    this.alertRules.push(alertRule);
    return alertRule.id;
  }

  async removeAlertRule(id: string): Promise<boolean> {
    const index = this.alertRules.findIndex(rule => rule.id === id);
    if (index !== -1) {
      this.alertRules.splice(index, 1);
      return true;
    }
    return false;
  }

  async getActiveAlerts(): Promise<any[]> {
    return this.activeAlerts.slice();
  }

  async acknowledgeAlert(alertId: string): Promise<boolean> {
    const index = this.activeAlerts.findIndex(alert => alert.id === alertId);
    if (index !== -1) {
      this.activeAlerts[index].acknowledged = true;
      this.activeAlerts[index].acknowledgedAt = new Date();
      return true;
    }
    return false;
  }

  private initializeDefaultAlertRules(): void {
    this.alertRules = [
      {
        id: 'error_rate_high',
        metric: 'error_rate',
        threshold: 0.05,
        operator: 'gt',
        severity: 'high',
        description: 'Error rate above 5%',
        enabled: true
      },
      {
        id: 'response_time_high',
        metric: 'average_response_time',
        threshold: 2000,
        operator: 'gt',
        severity: 'medium',
        description: 'Average response time above 2 seconds',
        enabled: true
      },
      {
        id: 'ai_confidence_low',
        metric: 'ai_confidence',
        threshold: 0.4,
        operator: 'lt',
        severity: 'medium',
        description: 'AI confidence below 40%',
        enabled: true
      },
      {
        id: 'trading_pnl_negative',
        metric: 'daily_pnl',
        threshold: -1000,
        operator: 'lt',
        severity: 'high',
        description: 'Daily PnL below -$1000',
        enabled: true
      },
      {
        id: 'memory_usage_high',
        metric: 'memory_usage',
        threshold: 512,
        operator: 'gt',
        severity: 'medium',
        description: 'Memory usage above 512MB',
        enabled: true
      }
    ];
  }

  private getCutoffTime(timeRange: string): Date {
    const now = new Date();
    switch (timeRange) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  private async checkRequestAlerts(): Promise<void> {
    const recentRequests = this.requestMetrics.filter(r => 
      r.timestamp >= new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
    );

    const errorRate = recentRequests.filter(r => !r.successful).length / recentRequests.length;
    const avgResponseTime = recentRequests.reduce((sum, r) => sum + r.duration, 0) / recentRequests.length;

    this.evaluateAlertRule('error_rate', errorRate);
    this.evaluateAlertRule('average_response_time', avgResponseTime);
  }

  private async checkTradingAlerts(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaysTrades = this.tradingMetrics.filter(t => t.timestamp >= today);
    const dailyPnL = todaysTrades.reduce((sum, t) => sum + t.pnl, 0);

    this.evaluateAlertRule('daily_pnl', dailyPnL);
  }

  private async checkAIAlerts(): Promise<void> {
    const recentAI = this.aiMetrics.filter(a => 
      a.timestamp >= new Date(Date.now() - 60 * 60 * 1000) // Last hour
    );

    if (recentAI.length > 0) {
      const avgConfidence = recentAI.reduce((sum, a) => sum + a.confidence, 0) / recentAI.length;
      this.evaluateAlertRule('ai_confidence', avgConfidence);
    }
  }

  private evaluateAlertRule(metricName: string, value: number): void {
    const rule = this.alertRules.find(r => r.metric === metricName && r.enabled);
    if (!rule) return;

    const shouldAlert = this.checkThreshold(value, rule.threshold, rule.operator);
    
    if (shouldAlert) {
      const existingAlert = this.activeAlerts.find(
        alert => alert.ruleId === rule.id && !alert.resolved
      );

      if (!existingAlert) {
        const alert = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ruleId: rule.id,
          metric: rule.metric,
          value,
          threshold: rule.threshold,
          severity: rule.severity,
          description: rule.description,
          timestamp: new Date(),
          resolved: false,
          acknowledged: false
        };

        this.activeAlerts.push(alert);
        console.warn(`[MetricsService] Alert triggered: ${alert.description} (${value})`);
      }
    }
  }

  private checkThreshold(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case 'gt':
        return value > threshold;
      case 'lt':
        return value < threshold;
      case 'eq':
        return value === threshold;
      default:
        return false;
    }
  }
}

export const metricsService = new MetricsService();