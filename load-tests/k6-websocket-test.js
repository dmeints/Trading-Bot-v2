import ws from 'k6/ws';
import { check, sleep } from 'k6';
import http from 'k6/http';

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 100 },  // Ramp up to 100 users
    { duration: '1m', target: 500 },   // Ramp up to 500 users
    { duration: '2m', target: 500 },   // Stay at 500 users
    { duration: '1m', target: 1000 },  // Ramp up to 1000 users
    { duration: '2m', target: 1000 },  // Stay at 1000 users
    { duration: '30s', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% of requests should be below 200ms
    ws_session_duration: ['p(95)<500'], // 95% of WebSocket sessions should be below 500ms
    ws_connecting: ['p(95)<100'], // 95% of WebSocket connections should be below 100ms
    iteration_duration: ['p(95)<1000'], // 95% of iterations should be below 1s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const WS_URL = BASE_URL.replace('http', 'ws') + '/ws';

// Login and get session for authenticated requests
function authenticate() {
  const loginResponse = http.get(`${BASE_URL}/api/me`);
  return loginResponse.status === 200;
}

export default function () {
  // Test HTTP API endpoints
  const isAuthenticated = authenticate();
  
  if (isAuthenticated) {
    // Test market data endpoint
    const marketDataResponse = http.get(`${BASE_URL}/api/market/data`);
    check(marketDataResponse, {
      'market data status is 200': (r) => r.status === 200,
      'market data response time < 200ms': (r) => r.timings.duration < 200,
    });

    // Test AI recommendations endpoint
    const aiResponse = http.get(`${BASE_URL}/api/ai/recommendations`);
    check(aiResponse, {
      'AI recommendations status is 200': (r) => r.status === 200,
      'AI recommendations response time < 500ms': (r) => r.timings.duration < 500,
    });

    // Test trading operations
    const tradePayload = JSON.stringify({
      symbol: 'BTC/USD',
      type: 'market',
      side: 'buy',
      amount: Math.random() * 0.01, // Small random amount
    });

    const tradeResponse = http.post(`${BASE_URL}/api/trading/simulate`, tradePayload, {
      headers: { 'Content-Type': 'application/json' },
    });
    
    check(tradeResponse, {
      'trade simulation status is 200': (r) => r.status === 200,
      'trade simulation response time < 300ms': (r) => r.timings.duration < 300,
    });
  }

  // WebSocket connection test
  const wsResponse = ws.connect(WS_URL, function (socket) {
    socket.on('open', function () {
      console.log('WebSocket connection opened');
      
      // Subscribe to market data
      socket.send(JSON.stringify({
        type: 'subscribe',
        channel: 'market_data',
        symbols: ['BTC/USD', 'ETH/USD', 'SOL/USD']
      }));
      
      // Subscribe to AI updates
      socket.send(JSON.stringify({
        type: 'subscribe',
        channel: 'ai_updates'
      }));
    });

    socket.on('message', function (message) {
      const data = JSON.parse(message);
      
      check(data, {
        'message has type': (d) => d.type !== undefined,
        'message has valid timestamp': (d) => d.timestamp !== undefined && new Date(d.timestamp).getTime() > 0,
      });

      // Simulate user interaction based on message type
      if (data.type === 'price_update') {
        // Randomly send a trading signal
        if (Math.random() < 0.1) { // 10% chance
          socket.send(JSON.stringify({
            type: 'trade_signal',
            symbol: data.symbol,
            action: Math.random() > 0.5 ? 'buy' : 'sell',
            confidence: Math.random()
          }));
        }
      }
    });

    socket.on('close', function () {
      console.log('WebSocket connection closed');
    });

    socket.on('error', function (error) {
      console.log('WebSocket error:', error);
    });

    // Keep connection alive for 30-60 seconds
    const connectionDuration = 30 + Math.random() * 30;
    sleep(connectionDuration);
  });

  check(wsResponse, {
    'WebSocket connection successful': (r) => r && r.status === 101,
  });

  // Random sleep between iterations
  sleep(Math.random() * 5);
}

// Setup function to prepare test environment
export function setup() {
  console.log('Starting load test setup...');
  
  // Health check
  const healthResponse = http.get(`${BASE_URL}/api/health`);
  if (healthResponse.status !== 200) {
    throw new Error(`Health check failed: ${healthResponse.status}`);
  }
  
  console.log('Setup completed successfully');
  return { baseUrl: BASE_URL };
}

// Teardown function to clean up after tests
export function teardown(data) {
  console.log('Load test completed');
  
  // Optional: Send test completion metrics
  http.post(`${BASE_URL}/api/test/completed`, JSON.stringify({
    testType: 'load_test',
    timestamp: new Date().toISOString(),
    duration: __ITER * options.stages.reduce((sum, stage) => sum + parseInt(stage.duration), 0)
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}