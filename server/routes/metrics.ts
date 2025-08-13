
import { Router } from 'express';

const router = Router();

// Simple metrics store
const metricsStore = {
  venue_score: new Map<string, number>(),
  l2_resyncs_total: 0,
  chaos_injections_total: 0,
  router_decisions_total: 0,
  exec_blocked_total: 0,
  price_stream_connected: 1,
  ohlcv_last_sync_ts_seconds: Math.floor(Date.now() / 1000)
};

// Update venue scores
const venues = ['binance', 'coinbase', 'kraken', 'deribit'];
venues.forEach(venue => {
  metricsStore.venue_score.set(venue, Math.random() * 0.3 + 0.7);
});

// Simulate some activity
setInterval(() => {
  metricsStore.l2_resyncs_total += Math.floor(Math.random() * 3);
  metricsStore.router_decisions_total += Math.floor(Math.random() * 20) + 5;
  metricsStore.exec_blocked_total += Math.floor(Math.random() * 2);
  metricsStore.ohlcv_last_sync_ts_seconds = Math.floor(Date.now() / 1000);
}, 60000);

router.get('/', (req, res) => {
  res.set('Content-Type', 'text/plain');
  
  let output = '';
  
  // Venue scores
  output += '# HELP venue_score Quality score for each venue\n';
  output += '# TYPE venue_score gauge\n';
  for (const [venue, score] of metricsStore.venue_score) {
    output += `venue_score{venue="${venue}"} ${score.toFixed(4)}\n`;
  }
  
  // L2 resyncs
  output += '\n# HELP l2_resyncs_total Total number of L2 book resyncs\n';
  output += '# TYPE l2_resyncs_total counter\n';
  output += `l2_resyncs_total ${metricsStore.l2_resyncs_total}\n`;
  
  // Chaos injections
  output += '\n# HELP chaos_injections_total Total number of chaos injections\n';
  output += '# TYPE chaos_injections_total counter\n';
  output += `chaos_injections_total ${metricsStore.chaos_injections_total}\n`;
  
  // Router decisions
  output += '\n# HELP router_decisions_total Total number of routing decisions made\n';
  output += '# TYPE router_decisions_total counter\n';
  output += `router_decisions_total ${metricsStore.router_decisions_total}\n`;
  
  // Execution blocked
  output += '\n# HELP exec_blocked_total Total number of blocked executions\n';
  output += '# TYPE exec_blocked_total counter\n';
  output += `exec_blocked_total ${metricsStore.exec_blocked_total}\n`;
  
  // Price stream status
  output += '\n# HELP price_stream_connected Price stream connection status\n';
  output += '# TYPE price_stream_connected gauge\n';
  output += `price_stream_connected ${metricsStore.price_stream_connected}\n`;
  
  // Last OHLCV sync
  output += '\n# HELP ohlcv_last_sync_ts_seconds Timestamp of last OHLCV sync\n';
  output += '# TYPE ohlcv_last_sync_ts_seconds gauge\n';
  output += `ohlcv_last_sync_ts_seconds ${metricsStore.ohlcv_last_sync_ts_seconds}\n`;
  
  // System metrics
  const memUsage = process.memoryUsage();
  output += '\n# HELP nodejs_heap_used_bytes Node.js heap used in bytes\n';
  output += '# TYPE nodejs_heap_used_bytes gauge\n';
  output += `nodejs_heap_used_bytes ${memUsage.heapUsed}\n`;
  
  output += '\n# HELP nodejs_heap_total_bytes Node.js heap total in bytes\n';
  output += '# TYPE nodejs_heap_total_bytes gauge\n';
  output += `nodejs_heap_total_bytes ${memUsage.heapTotal}\n`;
  
  output += '\n# HELP nodejs_process_uptime_seconds Node.js process uptime\n';
  output += '# TYPE nodejs_process_uptime_seconds gauge\n';
  output += `nodejs_process_uptime_seconds ${process.uptime()}\n`;
  
  res.send(output);
});

// Helper to increment chaos injections counter
export const incrementChaosInjections = () => {
  metricsStore.chaos_injections_total++;
};

export default router;
