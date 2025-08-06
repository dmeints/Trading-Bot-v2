import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// Custom metrics
const wsConnectionRate = new Rate('ws_connection_success');
const wsMessageRate = new Rate('ws_message_success');
const wsMessageCounter = new Counter('ws_messages_sent');
const wsLatency = new Trend('ws_message_latency');

export let options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up to 20 users
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '2m', target: 100 },  // Stay at 100 users
    { duration: '1m', target: 50 },   // Ramp down to 50 users
    { duration: '30s', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    'ws_connection_success': ['rate>0.95'], // 95% of connections should succeed
    'ws_message_success': ['rate>0.99'],    // 99% of messages should succeed
    'ws_message_latency': ['p(95)<500'],    // 95% of messages should be under 500ms
  },
};

export default function () {
  const url = `ws://localhost:5000/ws`;
  const params = {
    tags: { my_tag: 'websocket_stress' },
  };
  
  const response = ws.connect(url, params, function (socket) {
    // Connection successful
    check(socket, {
      'WebSocket connection established': (s) => s !== null,
    });
    wsConnectionRate.add(true);
    
    // Subscribe to market data
    const subscribeMessage = JSON.stringify({
      type: 'subscribe',
      channels: ['prices', 'trades'],
      symbols: ['BTC', 'ETH', 'SOL', 'ADA', 'DOT']
    });
    
    socket.send(subscribeMessage);
    wsMessageCounter.add(1);
    
    let messageCount = 0;
    const startTime = Date.now();
    
    socket.on('message', function (message) {
      messageCount++;
      const latency = Date.now() - startTime;
      wsLatency.add(latency);
      
      const isValidMessage = check(message, {
        'Message is valid JSON': (msg) => {
          try {
            JSON.parse(msg);
            return true;
          } catch {
            return false;
          }
        },
        'Message contains expected data': (msg) => {
          try {
            const data = JSON.parse(msg);
            return data.type && (data.prices || data.trade || data.error);
          } catch {
            return false;
          }
        },
      });
      
      wsMessageRate.add(isValidMessage);
    });
    
    socket.on('error', function (e) {
      console.log('WebSocket error:', e);
      wsConnectionRate.add(false);
    });
    
    socket.on('close', function () {
      console.log('WebSocket connection closed');
    });
    
    // Simulate user activity - send periodic requests
    for (let i = 0; i < 10; i++) {
      sleep(Math.random() * 5 + 1); // Sleep 1-6 seconds
      
      if (socket.readyState === 1) { // OPEN
        const requestMessage = JSON.stringify({
          type: 'request',
          action: 'get_latest_prices',
          timestamp: Date.now()
        });
        
        socket.send(requestMessage);
        wsMessageCounter.add(1);
      }
    }
    
    // Keep connection alive for duration of test
    sleep(Math.random() * 10 + 5); // 5-15 seconds
    
    socket.close();
  });
  
  check(response, {
    'WebSocket connection attempt': (r) => r !== null,
  });
}

export function handleSummary(data) {
  return {
    'load-test-results/websocket-stress-summary.json': JSON.stringify(data, null, 2),
    'load-test-results/websocket-stress-summary.html': htmlReport(data),
  };
}

function htmlReport(data) {
  const metrics = data.metrics;
  
  return `
<!DOCTYPE html>
<html>
<head>
    <title>WebSocket Stress Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { margin: 10px 0; padding: 10px; border: 1px solid #ddd; }
        .pass { background-color: #d4edda; border-color: #c3e6cb; }
        .fail { background-color: #f8d7da; border-color: #f5c6cb; }
        .warn { background-color: #fff3cd; border-color: #ffeaa7; }
    </style>
</head>
<body>
    <h1>Skippy WebSocket Stress Test Results</h1>
    
    <h2>Test Configuration</h2>
    <ul>
        <li>Peak concurrent users: 100</li>
        <li>Test duration: ~7 minutes</li>
        <li>Target: WebSocket connections with market data streaming</li>
    </ul>
    
    <h2>Key Metrics</h2>
    
    <div class="metric ${metrics.ws_connection_success?.values?.rate > 0.95 ? 'pass' : 'fail'}">
        <strong>Connection Success Rate:</strong> ${(metrics.ws_connection_success?.values?.rate * 100 || 0).toFixed(2)}%
        <br><small>Target: >95%</small>
    </div>
    
    <div class="metric ${metrics.ws_message_success?.values?.rate > 0.99 ? 'pass' : 'fail'}">
        <strong>Message Success Rate:</strong> ${(metrics.ws_message_success?.values?.rate * 100 || 0).toFixed(2)}%
        <br><small>Target: >99%</small>
    </div>
    
    <div class="metric ${metrics.ws_message_latency?.values?.['p(95)'] < 500 ? 'pass' : 'fail'}">
        <strong>95th Percentile Latency:</strong> ${metrics.ws_message_latency?.values?.['p(95)']?.toFixed(2) || 'N/A'}ms
        <br><small>Target: <500ms</small>
    </div>
    
    <div class="metric">
        <strong>Total Messages Sent:</strong> ${metrics.ws_messages_sent?.values?.count || 0}
    </div>
    
    <div class="metric">
        <strong>Average Latency:</strong> ${metrics.ws_message_latency?.values?.avg?.toFixed(2) || 'N/A'}ms
    </div>
    
    <h2>Performance Summary</h2>
    <p>
        The WebSocket stress test simulated ${data.options?.stages?.map(s => s.target).reduce((max, curr) => Math.max(max, curr), 0) || 100} 
        concurrent users connecting to the Skippy trading platform's real-time market data feed.
    </p>
    
    <h3>Test Scenarios Covered:</h3>
    <ul>
        <li>WebSocket connection establishment</li>
        <li>Market data subscription (BTC, ETH, SOL, ADA, DOT)</li>
        <li>Real-time price streaming</li>
        <li>Periodic data requests</li>
        <li>Connection management and cleanup</li>
    </ul>
    
    <p><small>Generated on ${new Date().toISOString()}</small></p>
</body>
</html>
  `;
}