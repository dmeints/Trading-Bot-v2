import crypto from 'crypto';
import { analyticsLogger } from './analyticsLogger';

export interface WebhookTest {
  id: string;
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  payload: any;
  expectedStatusCode: number;
  secretKey?: string;
  timestamp: string;
}

export interface WebhookTestResult {
  id: string;
  success: boolean;
  statusCode: number;
  responseTime: number;
  responseBody: any;
  error?: string;
  signatureValid?: boolean;
  timestamp: string;
}

class WebhookTester {
  private testHistory: Map<string, WebhookTestResult> = new Map();

  async testWebhook(test: WebhookTest): Promise<WebhookTestResult> {
    const startTime = Date.now();
    
    try {
      // Generate signature if secret key provided
      let headers = { ...test.headers };
      if (test.secretKey) {
        const payload = JSON.stringify(test.payload);
        const signature = crypto
          .createHmac('sha256', test.secretKey)
          .update(payload)
          .digest('hex');
        
        // Add signature header based on endpoint type
        if (test.endpoint.includes('/trading')) {
          headers['x-trading-signature'] = `sha256=${signature}`;
        } else if (test.endpoint.includes('/market')) {
          headers['x-market-signature'] = `sha256=${signature}`;
        } else {
          headers['x-webhook-signature'] = `sha256=${signature}`;
        }
      }

      // Make the request
      const response = await fetch(`http://localhost:5000${test.endpoint}`, {
        method: test.method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(test.payload),
      });

      const responseTime = Date.now() - startTime;
      const responseBody = await response.json().catch(() => ({}));

      const result: WebhookTestResult = {
        id: test.id,
        success: response.status === test.expectedStatusCode,
        statusCode: response.status,
        responseTime,
        responseBody,
        signatureValid: test.secretKey ? response.status !== 401 : undefined,
        timestamp: new Date().toISOString(),
      };

      this.testHistory.set(test.id, result);

      // Log test result
      analyticsLogger.logAnalyticsEvent({
        timestamp: new Date().toISOString(),
        tradeId: `webhook-test-${test.id}`,
        strategy: 'webhook-testing',
        regime: 'sideways',
        type: 'scalp',
        risk: result.success ? 'low' : 'high',
        source: 'webhook-tester',
        pnl: 0,
        latencyMs: responseTime,
        signalStrength: result.success ? 1.0 : 0.0,
        confidence: result.success ? 1.0 : 0.0,
        metadata: {
          endpoint: test.endpoint,
          statusCode: result.statusCode,
          success: result.success,
        },
      });

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const result: WebhookTestResult = {
        id: test.id,
        success: false,
        statusCode: 0,
        responseTime,
        responseBody: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };

      this.testHistory.set(test.id, result);
      
      analyticsLogger.logError({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Webhook test failed',
        stack: error instanceof Error ? error.stack : undefined,
        metadata: { testId: test.id, endpoint: test.endpoint },
      });

      return result;
    }
  }

  generateTestCases(): WebhookTest[] {
    return [
      {
        id: 'trading-signal-test',
        endpoint: '/api/webhooks/trading',
        method: 'POST',
        headers: {},
        payload: {
          type: 'signal',
          data: {
            symbol: 'BTC/USD',
            action: 'buy',
            confidence: 0.85,
            price: 45000,
            quantity: 0.1,
          },
        },
        expectedStatusCode: 200,
        secretKey: process.env.TRADING_WEBHOOK_SECRET,
        timestamp: new Date().toISOString(),
      },
      {
        id: 'market-data-test',
        endpoint: '/api/webhooks/market',
        method: 'POST',
        headers: {},
        payload: {
          symbol: 'BTC/USD',
          price: 45000,
          timestamp: new Date().toISOString(),
        },
        expectedStatusCode: 200,
        secretKey: process.env.MARKET_WEBHOOK_SECRET,
        timestamp: new Date().toISOString(),
      },
      {
        id: 'generic-webhook-test',
        endpoint: '/api/webhooks/generic',
        method: 'POST',
        headers: {},
        payload: {
          source: 'test-system',
          event: 'health-check',
          data: { status: 'ok' },
        },
        expectedStatusCode: 200,
        secretKey: process.env.GENERIC_WEBHOOK_SECRET,
        timestamp: new Date().toISOString(),
      },
      {
        id: 'invalid-signature-test',
        endpoint: '/api/webhooks/trading',
        method: 'POST',
        headers: { 'x-trading-signature': 'sha256=invalid-signature' },
        payload: { test: true },
        expectedStatusCode: 401,
        timestamp: new Date().toISOString(),
      },
    ];
  }

  async runAllTests(): Promise<WebhookTestResult[]> {
    const tests = this.generateTestCases();
    const results = await Promise.all(
      tests.map(test => this.testWebhook(test))
    );
    
    console.log(`[WebhookTester] Completed ${results.length} tests`);
    return results;
  }

  getTestHistory(): WebhookTestResult[] {
    return Array.from(this.testHistory.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  getTestStats() {
    const results = this.getTestHistory();
    const totalTests = results.length;
    const successfulTests = results.filter(r => r.success).length;
    const averageResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / totalTests;
    
    return {
      totalTests,
      successfulTests,
      failedTests: totalTests - successfulTests,
      successRate: totalTests > 0 ? (successfulTests / totalTests) * 100 : 0,
      averageResponseTime: Math.round(averageResponseTime),
      lastTestRun: results[0]?.timestamp,
    };
  }

  clearHistory() {
    this.testHistory.clear();
  }
}

export const webhookTester = new WebhookTester();