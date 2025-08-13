import { Router } from 'express';
import { strategyRouter } from '../services/StrategyRouter.js';
import { executionRouter } from '../services/ExecutionRouter.js';
import { dataQuality } from '../services/DataQuality.js';
import { riskGuards } from '../services/RiskGuards.js';
import { metaMonitor } from '../services/MetaMonitor.js';

const router = Router();

// Simple Prometheus metrics counter
class MetricsCounter {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();

  increment(name: string, value: number = 1): void {
    this.counters.set(name, (this.counters.get(name) || 0) + value);
  }

  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  getCounters(): Map<string, number> {
    return this.counters;
  }

  getGauges(): Map<string, number> {
    return this.gauges;
  }
}

const metrics = new MetricsCounter();

// Update metrics periodically
setInterval(() => {
  updateMetrics();
}, 30000); // Every 30 seconds

function updateMetrics(): void {
  // Strategy Router metrics
  const policies = strategyRouter.getPolicies();
  metrics.setGauge('router_active_policies', policies.size);

  let totalUpdates = 0;
  for (const policy of policies.values()) {
    totalUpdates += policy.updateCount;
  }
  metrics.setGauge('router_total_updates', totalUpdates);

  // Execution metrics
  const execRecords = executionRouter.getExecutionRecords();
  metrics.setGauge('execution_total_count', execRecords.length);

  const blockedCount = execRecords.filter(r => r.side === 'hold').length;
  metrics.setGauge('execution_blocked_total', blockedCount);

  // Data Quality metrics
  const dqStats = dataQuality.getStats();
  metrics.setGauge('data_quality_total_candles', dqStats.totalCandles);
  metrics.setGauge('data_quality_quarantined_candles', dqStats.quarantinedCandles);
  metrics.setGauge('data_quality_schema_violations', dqStats.schemaViolations);
  metrics.setGauge('data_quality_spike_detections', dqStats.spikeDetections);

  // Risk Guards metrics
  const guardState = riskGuards.getState();
  metrics.setGauge('risk_guards_total_notional', guardState.totalNotional);
  metrics.setGauge('risk_guards_drawdown_breaker_active', guardState.drawdownBreaker.active ? 1 : 0);

  // Meta Monitor metrics
  const quality = metaMonitor.getQuality();
  metrics.setGauge('meta_monitor_brier_score', quality.brierScore);
  metrics.setGauge('meta_monitor_regret_vs_hold', quality.regretVsHold);
  metrics.setGauge('meta_monitor_calibration', quality.calibration);

  // Price stream metrics (mock)
  metrics.setGauge('price_stream_connected', 1);
  metrics.setGauge('ohlcv_last_sync_ts_seconds', Math.floor(Date.now() / 1000));
}

router.get('/', (req, res) => {
  try {
    updateMetrics();

    let output = '';

    // Export counters
    for (const [name, value] of metrics.getCounters().entries()) {
      output += `# TYPE ${name} counter\n`;
      output += `${name} ${value}\n`;
    }

    // Export gauges
    for (const [name, value] of metrics.getGauges().entries()) {
      output += `# TYPE ${name} gauge\n`;
      output += `${name} ${value}\n`;
    }

    // Add timestamp
    output += `# TYPE metrics_generation_timestamp_seconds gauge\n`;
    output += `metrics_generation_timestamp_seconds ${Math.floor(Date.now() / 1000)}\n`;

    res.set('Content-Type', 'text/plain');
    res.send(output);
  } catch (error) {
    res.status(500).send('Error generating metrics');
  }
});

// Helper function to increment counters from other services
export function incrementCounter(name: string, value: number = 1): void {
  metrics.increment(name, value);
}

export default router;