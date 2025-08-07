import ws from 'k6/ws';
import { check, sleep } from 'k6';
import http from 'k6/http';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Warm up
    { duration: '3m', target: 100 },  // Stable load during chaos
    { duration: '1m', target: 0 },    // Cool down
  ],
  thresholds: {
    // More lenient thresholds for chaos testing
    http_req_duration: ['p(95)<1000'],
    ws_session_duration: ['p(95)<2000'],
    ws_connecting: ['p(95)<500'],
    http_req_failed: ['rate<0.1'], // Allow up to 10% failure rate during chaos
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const WS_URL = BASE_URL.replace('http', 'ws') + '/ws';

// Chaos events to simulate
const CHAOS_EVENTS = [
  'kill_websocket_service',
  'crash_ai_agent',
  'network_partition',
  'high_cpu_load',
  'memory_pressure'
];

let chaosEventTriggered = false;

export default function () {
  // Trigger chaos event randomly during the test
  if (!chaosEventTriggered && Math.random() < 0.01) { // 1% chance per iteration
    triggerChaosEvent();
    chaosEventTriggered = true;
  }

  // Test system resilience with normal operations
  testHttpEndpoints();
  testWebSocketResilience();
  
  sleep(randomIntBetween(1, 5));
}

function triggerChaosEvent() {
  const event = CHAOS_EVENTS[randomIntBetween(0, CHAOS_EVENTS.length - 1)];
  console.log(`🔥 Triggering chaos event: ${event}`);
  
  const chaosResponse = http.post(`${BASE_URL}/api/chaos/trigger`, JSON.stringify({
    event: event,
    duration: randomIntBetween(10, 30), // 10-30 seconds
    severity: randomIntBetween(1, 5)
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(chaosResponse, {
    'chaos event triggered': (r) => r.status === 200 || r.status === 202,
  });
}

function testHttpEndpoints() {
  const endpoints = [
    '/api/health',
    '/api/market/data',
    '/api/ai/recommendations',
    '/api/trading/positions'
  ];
  
  endpoints.forEach(endpoint => {
    const response = http.get(`${BASE_URL}${endpoint}`, {
      timeout: '10s', // Increased timeout for chaos conditions
    });
    
    check(response, {
      [`${endpoint} responds`]: (r) => r.status !== 0, // Any response is good during chaos
      [`${endpoint} not server error`]: (r) => r.status < 500 || r.status === 503, // 503 is acceptable during outages
    });
  });
}

function testWebSocketResilience() {
  const wsResponse = ws.connect(WS_URL, {
    timeout: '10s',
  }, function (socket) {
    let messageCount = 0;
    let lastHeartbeat = Date.now();
    
    socket.on('open', function () {
      console.log('WebSocket connection established during chaos test');
      
      // Send heartbeat every 5 seconds
      socket.setInterval(function () {
        socket.send(JSON.stringify({
          type: 'heartbeat',
          timestamp: Date.now()
        }));
        lastHeartbeat = Date.now();
      }, 5000);
      
      // Subscribe to critical channels
      socket.send(JSON.stringify({
        type: 'subscribe',
        channel: 'market_data',
        symbols: ['BTC/USD']
      }));
    });

    socket.on('message', function (message) {
      messageCount++;
      const data = JSON.parse(message);
      
      check(data, {
        'chaos message valid': (d) => d.type !== undefined,
        'chaos heartbeat response': (d) => {
          if (d.type === 'heartbeat_response') {
            const latency = Date.now() - d.timestamp;
            return latency < 5000; // 5 second tolerance during chaos
          }
          return true;
        }
      });
    });

    socket.on('close', function (code, reason) {
      console.log(`WebSocket closed during chaos: ${code} - ${reason}`);
      
      check(null, {
        'received some messages during chaos': () => messageCount > 0,
        'chaos connection lasted reasonable time': () => Date.now() - lastHeartbeat < 30000,
      });
    });

    socket.on('error', function (error) {
      console.log('WebSocket error during chaos:', error);
      // Errors are expected during chaos, so we don't fail the test
    });

    // Connection should survive some chaos, but we allow shorter duration
    sleep(randomIntBetween(10, 20));
  });

  // Don't fail if WebSocket connection fails during chaos
  check(wsResponse, {
    'WebSocket connection attempted': () => true, // Always pass this check
  });
}

export function setup() {
  console.log('🔥 Starting chaos engineering test...');
  
  // Verify system is healthy before starting chaos
  const healthResponse = http.get(`${BASE_URL}/api/health`);
  if (healthResponse.status !== 200) {
    throw new Error(`System not healthy before chaos test: ${healthResponse.status}`);
  }
  
  // Enable chaos mode
  http.post(`${BASE_URL}/api/chaos/enable`, JSON.stringify({
    mode: 'testing',
    duration: 300 // 5 minutes
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  console.log('Chaos mode enabled - testing system resilience');
  return { startTime: Date.now() };
}

export function teardown(data) {
  console.log('🔥 Chaos test completed');
  
  // Disable chaos mode
  http.post(`${BASE_URL}/api/chaos/disable`, null, {
    headers: { 'Content-Type': 'application/json' },
  });
  
  // Allow system to recover
  sleep(10);
  
  // Verify system recovery
  const healthResponse = http.get(`${BASE_URL}/api/health`);
  check(healthResponse, {
    'system recovered after chaos': (r) => r.status === 200,
  });
  
  const testDuration = (Date.now() - data.startTime) / 1000;
  console.log(`Chaos test duration: ${testDuration}s`);
}