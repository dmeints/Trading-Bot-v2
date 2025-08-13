
import { describe, it, expect, beforeEach } from '@jest/globals';
import { Chaos } from '../server/services/Chaos';

describe('Chaos Resilience', () => {
  let chaos: Chaos;

  beforeEach(() => {
    chaos = new Chaos();
  });

  it('should only allow chaos in development', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      await chaos.inject('ws_flap');
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }

    process.env.NODE_ENV = originalEnv;
  });

  it('should inject WebSocket flaps', async () => {
    if (process.env.NODE_ENV === 'development') {
      const injectionId = await chaos.inject('ws_flap', { duration: 100 });
      
      expect(injectionId).toContain('ws_flap_');
      
      const active = chaos.getActiveInjections();
      expect(active.length).toBeGreaterThan(0);
      expect(active[0].type).toBe('ws_flap');
    }
  });

  it('should inject API timeouts', async () => {
    if (process.env.NODE_ENV === 'development') {
      const injectionId = await chaos.inject('api_timeout', { 
        duration: 100, 
        severity: 0.5 
      });
      
      expect(injectionId).toContain('api_timeout_');
      expect(global.chaosApiDelay).toBeGreaterThan(0);
    }
  });

  it('should track injection history', async () => {
    if (process.env.NODE_ENV === 'development') {
      await chaos.inject('l2_gap', { duration: 50 });
      
      const history = chaos.getInjectionHistory();
      expect(history.length).toBeGreaterThan(0);
      
      const latest = history[history.length - 1];
      expect(latest.type).toBe('l2_gap');
    }
  });

  it('should provide stats', () => {
    const stats = chaos.getStats();
    
    expect(stats.enabled).toBeDefined();
    expect(stats.activeInjections).toBeDefined();
    expect(stats.totalHistoryCount).toBeDefined();
    expect(Array.isArray(stats.injectionTypes)).toBe(true);
  });
});
