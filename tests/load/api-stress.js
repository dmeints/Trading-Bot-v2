import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// Custom metrics
const apiSuccessRate = new Rate('api_success_rate');
const authSuccessRate = new Rate('auth_success_rate');
const apiLatency = new Trend('api_response_time');
const errorCounter = new Counter('api_errors');

export let options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 25 },   // Ramp up to 25 users
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 50 },   // Stay at 50 users
    { duration: '1m', target: 25 },   // Ramp down to 25 users
    { duration: '30s', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    'api_success_rate': ['rate>0.95'],           // 95% of requests should succeed
    'auth_success_rate': ['rate>0.99'],          // 99% of auth requests should succeed  
    'api_response_time': ['p(95)<1000'],         // 95% of requests should be under 1s
    'http_req_duration': ['p(90)<800'],          // 90% of requests should be under 800ms
    'http_req_failed': ['rate<0.05'],            // Less than 5% request failures
  },
};

const BASE_URL = 'http://localhost:5000';

export default function () {
  // Test suite: Critical API endpoints
  testAuthEndpoint();
  testHealthEndpoint();
  testMarketDataEndpoint();
  testPortfolioEndpoint();
  testTradingEndpoint();
  testAIEndpoints();
  
  sleep(Math.random() * 2 + 1); // Random sleep between 1-3 seconds
}

function testAuthEndpoint() {
  const response = http.get(`${BASE_URL}/api/auth/user`);
  
  const success = check(response, {
    'Auth endpoint responds': (r) => r.status !== 0,
    'Auth response time OK': (r) => r.timings.duration < 2000,
  });
  
  authSuccessRate.add(success);
  apiLatency.add(response.timings.duration);
  
  if (response.status >= 400) {
    errorCounter.add(1);
  }
}

function testHealthEndpoint() {
  const response = http.get(`${BASE_URL}/api/health`);
  
  const success = check(response, {
    'Health endpoint returns 200': (r) => r.status === 200,
    'Health response time OK': (r) => r.timings.duration < 1000,
    'Health returns valid JSON': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.status === 'healthy';
      } catch {
        return false;
      }
    },
  });
  
  apiSuccessRate.add(success);
  apiLatency.add(response.timings.duration);
}

function testMarketDataEndpoint() {
  const response = http.get(`${BASE_URL}/api/market/latest`);
  
  const success = check(response, {
    'Market data endpoint responds': (r) => r.status === 200,
    'Market data response time OK': (r) => r.timings.duration < 1500,
    'Market data is valid': (r) => {
      try {
        const data = JSON.parse(r.body);
        return Array.isArray(data) && data.length > 0;
      } catch {
        return false;
      }
    },
  });
  
  apiSuccessRate.add(success);
  apiLatency.add(response.timings.duration);
  
  if (response.status >= 400) {
    errorCounter.add(1);
  }
}

function testPortfolioEndpoint() {
  const response = http.get(`${BASE_URL}/api/portfolio/summary`);
  
  const success = check(response, {
    'Portfolio endpoint responds': (r) => r.status !== 0,
    'Portfolio response time OK': (r) => r.timings.duration < 2000,
  });
  
  apiSuccessRate.add(success);
  apiLatency.add(response.timings.duration);
  
  // Portfolio might return 401 for unauthenticated users - that's expected
  if (response.status >= 500) {
    errorCounter.add(1);
  }
}

function testTradingEndpoint() {
  // Test trading interface data
  const response = http.get(`${BASE_URL}/api/trading/trades`);
  
  const success = check(response, {
    'Trading endpoint responds': (r) => r.status !== 0,
    'Trading response time OK': (r) => r.timings.duration < 1500,
  });
  
  apiSuccessRate.add(success);
  apiLatency.add(response.timings.duration);
  
  if (response.status >= 500) {
    errorCounter.add(1);
  }
}

function testAIEndpoints() {
  // Test AI status
  const statusResponse = http.get(`${BASE_URL}/api/ai/status`);
  
  const statusSuccess = check(statusResponse, {
    'AI status endpoint responds': (r) => r.status === 200,
    'AI status response time OK': (r) => r.timings.duration < 1000,
  });
  
  apiSuccessRate.add(statusSuccess);
  apiLatency.add(statusResponse.timings.duration);
  
  // Test AI recommendations
  const recommendationsResponse = http.get(`${BASE_URL}/api/ai/recommendations`);
  
  const recommendationsSuccess = check(recommendationsResponse, {
    'AI recommendations endpoint responds': (r) => r.status === 200,
    'AI recommendations response time OK': (r) => r.timings.duration < 2000,
  });
  
  apiSuccessRate.add(recommendationsSuccess);
  apiLatency.add(recommendationsResponse.timings.duration);
}

export function handleSummary(data) {
  return {
    'load-test-results/api-stress-summary.json': JSON.stringify(data, null, 2),
    'load-test-results/api-stress-summary.html': htmlReport(data),
  };
}

function htmlReport(data) {
  const metrics = data.metrics;
  
  return `
<!DOCTYPE html>
<html>
<head>
    <title>API Stress Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { margin: 10px 0; padding: 10px; border: 1px solid #ddd; }
        .pass { background-color: #d4edda; border-color: #c3e6cb; }
        .fail { background-color: #f8d7da; border-color: #f5c6cb; }
        .warn { background-color: #fff3cd; border-color: #ffeaa7; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Skippy API Stress Test Results</h1>
    
    <h2>Test Configuration</h2>
    <ul>
        <li>Peak concurrent users: 50</li>
        <li>Test duration: ~6.5 minutes</li>
        <li>Target endpoints: Auth, Health, Market Data, Portfolio, Trading, AI</li>
    </ul>
    
    <h2>Key Metrics</h2>
    
    <div class="metric ${metrics.api_success_rate?.values?.rate > 0.95 ? 'pass' : 'fail'}">
        <strong>API Success Rate:</strong> ${(metrics.api_success_rate?.values?.rate * 100 || 0).toFixed(2)}%
        <br><small>Target: >95%</small>
    </div>
    
    <div class="metric ${metrics.auth_success_rate?.values?.rate > 0.99 ? 'pass' : 'fail'}">
        <strong>Auth Success Rate:</strong> ${(metrics.auth_success_rate?.values?.rate * 100 || 0).toFixed(2)}%
        <br><small>Target: >99%</small>
    </div>
    
    <div class="metric ${metrics.api_response_time?.values?.['p(95)'] < 1000 ? 'pass' : 'fail'}">
        <strong>95th Percentile Response Time:</strong> ${metrics.api_response_time?.values?.['p(95)']?.toFixed(2) || 'N/A'}ms
        <br><small>Target: <1000ms</small>
    </div>
    
    <div class="metric ${metrics.http_req_failed?.values?.rate < 0.05 ? 'pass' : 'fail'}">
        <strong>Request Failure Rate:</strong> ${(metrics.http_req_failed?.values?.rate * 100 || 0).toFixed(2)}%
        <br><small>Target: <5%</small>
    </div>
    
    <h2>Response Time Breakdown</h2>
    <table>
        <tr>
            <th>Metric</th>
            <th>Average</th>
            <th>90th Percentile</th>
            <th>95th Percentile</th>
            <th>99th Percentile</th>
        </tr>
        <tr>
            <td>API Response Time</td>
            <td>${metrics.api_response_time?.values?.avg?.toFixed(2) || 'N/A'}ms</td>
            <td>${metrics.api_response_time?.values?.['p(90)']?.toFixed(2) || 'N/A'}ms</td>
            <td>${metrics.api_response_time?.values?.['p(95)']?.toFixed(2) || 'N/A'}ms</td>
            <td>${metrics.api_response_time?.values?.['p(99)']?.toFixed(2) || 'N/A'}ms</td>
        </tr>
        <tr>
            <td>HTTP Request Duration</td>
            <td>${metrics.http_req_duration?.values?.avg?.toFixed(2) || 'N/A'}ms</td>
            <td>${metrics.http_req_duration?.values?.['p(90)']?.toFixed(2) || 'N/A'}ms</td>
            <td>${metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) || 'N/A'}ms</td>
            <td>${metrics.http_req_duration?.values?.['p(99)']?.toFixed(2) || 'N/A'}ms</td>
        </tr>
    </table>
    
    <h2>Error Summary</h2>
    <div class="metric">
        <strong>Total API Errors:</strong> ${metrics.api_errors?.values?.count || 0}
    </div>
    <div class="metric">
        <strong>Total HTTP Requests:</strong> ${metrics.http_reqs?.values?.count || 0}
    </div>
    <div class="metric">
        <strong>Virtual Users:</strong> ${metrics.vus?.values?.value || 0} (peak)
    </div>
    
    <h2>Endpoints Tested</h2>
    <ul>
        <li>/api/health - System health check</li>
        <li>/api/auth/user - User authentication</li>
        <li>/api/market/latest - Market data feed</li>
        <li>/api/portfolio/summary - Portfolio data</li>
        <li>/api/trading/trades - Trading history</li>
        <li>/api/ai/status - AI system status</li>
        <li>/api/ai/recommendations - AI recommendations</li>
    </ul>
    
    <p><small>Generated on ${new Date().toISOString()}</small></p>
</body>
</html>
  `;
}