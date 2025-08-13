
/**
 * Chaos Resilience Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { chaos } from '../server/services/Chaos';

describe('Chaos Resilience', () => {
  beforeEach(() => {
    chaos.enable();
    chaos.forceRecoverAll(); // Clean slate
  });

  afterEach(() => {
    chaos.forceRecoverAll();
  });

  it('should inject and recover from WebSocket flap', (done) => {
    let flapReceived = false;
    let recoveryReceived = false;

    chaos.on('wsFlap', () => {
      flapReceived = true;
    });

    chaos.on('chaosRecovered', (event) => {
      if (event.type === 'ws_flap') {
        recoveryReceived = true;
        expect(flapReceived).toBe(true);
        expect(event.impact.recoveryTime).toBeGreaterThan(0);
        done();
      }
    });

    chaos.inject({
      type: 'ws_flap',
      duration: 100, // Short duration for test
      parameters: { flapCount: 2, interval: 50 }
    });
  });

  it('should inject API timeout chaos', (done) => {
    chaos.on('apiTimeout', (data) => {
      expect(data.event.type).toBe('api_timeout');
      expect(data.timeoutMs).toBeGreaterThan(0);
      
      // Check global flag is set
      expect(global.chaosApiTimeout).toBe(true);
    });

    chaos.on('chaosRecovered', (event) => {
      if (event.type === 'api_timeout') {
        // Check global flag is cleared
        expect(global.chaosApiTimeout).toBe(false);
        done();
      }
    });

    chaos.inject({
      type: 'api_timeout',
      duration: 100,
      parameters: { timeoutMs: 5000 }
    });
  });

  it('should inject L2 gap and emit event', (done) => {
    chaos.on('l2Gap', (data) => {
      expect(data.event.type).toBe('l2_gap');
      expect(data.gapSize).toBe(50);
      expect(data.symbol).toBe('BTCUSDT');
      done();
    });

    chaos.inject({
      type: 'l2_gap',
      target: 'BTCUSDT',
      duration: 100,
      parameters: { gapSize: 50 }
    });
  });

  it('should track active events correctly', () => {
    const event1 = chaos.inject({ type: 'ws_flap', duration: 5000 });
    const event2 = chaos.inject({ type: 'api_timeout', duration: 5000 });

    const activeEvents = chaos.getActiveEvents();
    expect(activeEvents).toHaveLength(2);
    expect(activeEvents.map(e => e.id)).toContain(event1.id);
    expect(activeEvents.map(e => e.id)).toContain(event2.id);
  });

  it('should calculate system health correctly', () => {
    chaos.inject({ type: 'network_partition', duration: 5000 });
    chaos.inject({ type: 'depth_spike', duration: 5000 });

    const health = chaos.getSystemHealth();
    expect(health.healthy).toBe(false);
    expect(health.affectedSystems.length).toBeGreaterThan(0);
  });

  it('should force recover all events', () => {
    chaos.inject({ type: 'ws_flap', duration: 10000 });
    chaos.inject({ type: 'api_timeout', duration: 10000 });

    let activeCount = chaos.getActiveEvents().length;
    expect(activeCount).toBeGreaterThan(0);

    chaos.forceRecoverAll();

    activeCount = chaos.getActiveEvents().length;
    expect(activeCount).toBe(0);

    const health = chaos.getSystemHealth();
    expect(health.healthy).toBe(true);
  });

  it('should prevent injection in production mode', () => {
    chaos.disable();

    expect(() => {
      chaos.inject({ type: 'ws_flap' });
    }).toThrow(/disabled in production/);
  });
});
