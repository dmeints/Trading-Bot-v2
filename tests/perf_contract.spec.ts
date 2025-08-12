
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import fetch from 'node-fetch';

describe('Performance Contract Tests', () => {
  let serverProcess: ChildProcess;
  const baseUrl = 'http://localhost:5000';
  const latencyThresholds = {
    health: 100, // 100ms
    ohlcv: 500, // 500ms
    planAndExecute: 1000 // 1000ms
  };

  beforeAll(async () => {
    // Start server for testing
    serverProcess = spawn('npm', ['run', 'start'], {
      stdio: 'pipe',
      detached: false
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));
  });

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  });

  it('should meet health endpoint latency requirements', async () => {
    const start = Date.now();
    
    const response = await fetch(`${baseUrl}/api/health`);
    const duration = Date.now() - start;
    
    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(latencyThresholds.health);
    
    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('services');
  });

  it('should meet OHLCV endpoint latency requirements', async () => {
    const start = Date.now();
    
    const response = await fetch(`${baseUrl}/api/market/ohlcv?symbol=BTCUSDT&timeframe=1h&limit=100`);
    const duration = Date.now() - start;
    
    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(latencyThresholds.ohlcv);
    
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('should meet plan-and-execute endpoint latency requirements', async () => {
    const start = Date.now();
    
    const response = await fetch(`${baseUrl}/api/exec/plan-and-execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ symbol: 'BTCUSDT' })
    });
    const duration = Date.now() - start;
    
    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(latencyThresholds.planAndExecute);
    
    const data = await response.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('symbol');
    expect(data).toHaveProperty('policyId');
    expect(data).toHaveProperty('finalSize');
  });

  it('should validate response schemas', async () => {
    // Test health endpoint schema
    const healthResponse = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthResponse.json();
    
    expect(typeof healthData.status).toBe('string');
    expect(typeof healthData.timestamp).toBe('string');
    expect(typeof healthData.services).toBe('object');

    // Test execution endpoint schema
    const execResponse = await fetch(`${baseUrl}/api/exec/plan-and-execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: 'BTCUSDT' })
    });
    const execData = await execResponse.json();
    
    expect(typeof execData.id).toBe('string');
    expect(typeof execData.symbol).toBe('string');
    expect(typeof execData.policyId).toBe('string');
    expect(typeof execData.finalSize).toBe('number');
    expect(typeof execData.fillPrice).toBe('number');
  });

  it('should handle concurrent requests efficiently', async () => {
    const concurrentRequests = 10;
    const start = Date.now();
    
    const promises = Array.from({ length: concurrentRequests }, () =>
      fetch(`${baseUrl}/api/health`)
    );
    
    const responses = await Promise.all(promises);
    const duration = Date.now() - start;
    
    // All requests should complete within 2x the single request threshold
    expect(duration).toBeLessThan(latencyThresholds.health * 2);
    
    // All responses should be successful
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  });
});
