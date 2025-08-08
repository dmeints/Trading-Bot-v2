/**
 * DATA FAILOVER SYSTEM
 * Switch to backup sources on anomalies and emit alerts
 */

interface DataSource {
  name: string;
  priority: number;
  isActive: boolean;
  healthScore: number;
  lastError?: string;
  errorCount: number;
  endpoint?: string;
}

interface FailoverEvent {
  timestamp: number;
  primarySource: string;
  backupSource: string;
  reason: string;
  symbol?: string;
}

export class DataFailoverManager {
  private sources: Map<string, DataSource[]> = new Map();
  private activeSource: Map<string, string> = new Map();
  private failoverHistory: FailoverEvent[] = [];
  private slackWebhook?: string;

  constructor(slackWebhook?: string) {
    this.slackWebhook = slackWebhook;
    this.initializeDefaultSources();
  }

  private initializeDefaultSources(): void {
    const symbols = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT'];
    
    symbols.forEach(symbol => {
      this.sources.set(symbol, [
        {
          name: 'CoinGecko',
          priority: 1,
          isActive: true,
          healthScore: 1.0,
          errorCount: 0,
          endpoint: 'api.coingecko.com'
        },
        {
          name: 'Binance',
          priority: 2,
          isActive: true,
          healthScore: 1.0,
          errorCount: 0,
          endpoint: 'api.binance.com'
        },
        {
          name: 'Coinbase',
          priority: 3,
          isActive: true,
          healthScore: 1.0,
          errorCount: 0,
          endpoint: 'api.coinbase.com'
        }
      ]);
      
      this.activeSource.set(symbol, 'CoinGecko');
    });
  }

  /**
   * Trigger failover for a symbol
   */
  async triggerFailover(symbol: string, reason: string): Promise<boolean> {
    const sources = this.sources.get(symbol);
    const currentSource = this.activeSource.get(symbol);
    
    if (!sources || !currentSource) return false;

    // Mark current source as unhealthy
    const current = sources.find(s => s.name === currentSource);
    if (current) {
      current.healthScore = Math.max(0, current.healthScore - 0.2);
      current.errorCount++;
      current.lastError = reason;
    }

    // Find next best source
    const availableSources = sources
      .filter(s => s.isActive && s.name !== currentSource && s.healthScore > 0.3)
      .sort((a, b) => b.healthScore - a.healthScore || a.priority - b.priority);

    if (availableSources.length === 0) {
      await this.sendAlert(`CRITICAL: No backup sources available for ${symbol}`, 'critical');
      return false;
    }

    const newSource = availableSources[0];
    const previousSource = currentSource;
    
    // Switch to new source
    this.activeSource.set(symbol, newSource.name);
    
    // Record failover event
    const event: FailoverEvent = {
      timestamp: Date.now(),
      primarySource: previousSource,
      backupSource: newSource.name,
      reason,
      symbol
    };
    
    this.failoverHistory.push(event);
    
    // Send alert
    await this.sendAlert(
      `Failover executed for ${symbol}: ${previousSource} → ${newSource.name}. Reason: ${reason}`,
      'warning'
    );

    return true;
  }

  /**
   * Check source health and auto-failover if needed
   */
  async checkAndFailover(symbol: string, healthScore: number): Promise<void> {
    const currentSource = this.activeSource.get(symbol);
    if (!currentSource) return;

    const sources = this.sources.get(symbol);
    if (!sources) return;

    const current = sources.find(s => s.name === currentSource);
    if (!current) return;

    // Update health score
    current.healthScore = healthScore;

    // Trigger failover if health is too low
    if (healthScore < 0.5) {
      await this.triggerFailover(symbol, `Health score dropped to ${healthScore.toFixed(2)}`);
    }
  }

  /**
   * Restore source to healthy state
   */
  restoreSource(symbol: string, sourceName: string): void {
    const sources = this.sources.get(symbol);
    if (!sources) return;

    const source = sources.find(s => s.name === sourceName);
    if (source) {
      source.healthScore = 1.0;
      source.errorCount = 0;
      source.lastError = undefined;
    }
  }

  /**
   * Get current active source for symbol
   */
  getActiveSource(symbol: string): string | undefined {
    return this.activeSource.get(symbol);
  }

  /**
   * Send Slack alert
   */
  private async sendAlert(message: string, severity: 'info' | 'warning' | 'critical'): Promise<void> {
    if (!this.slackWebhook) return;

    const emoji = severity === 'critical' ? '🚨' : severity === 'warning' ? '⚠️' : 'ℹ️';
    const color = severity === 'critical' ? '#ff0000' : severity === 'warning' ? '#ff9900' : '#36a64f';

    const payload = {
      attachments: [{
        color,
        text: `${emoji} **Data Failover Alert**\n${message}`,
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    try {
      await fetch(this.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
    }
  }

  /**
   * Get failover statistics
   */
  getFailoverStats(): {
    activeSourcesBySymbol: Map<string, string>;
    sourceHealth: Map<string, DataSource[]>;
    failoverHistory: FailoverEvent[];
    totalFailovers: number;
  } {
    return {
      activeSourcesBySymbol: new Map(this.activeSource),
      sourceHealth: new Map(this.sources),
      failoverHistory: [...this.failoverHistory],
      totalFailovers: this.failoverHistory.length
    };
  }
}

export default DataFailoverManager;