
/**
 * Blue/Green Cutover Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { BlueGreen } from '../server/services/BlueGreen';

describe('Blue/Green Cutover', () => {
  let blueGreen: BlueGreen;

  beforeEach(() => {
    blueGreen = new BlueGreen();
  });

  afterEach(() => {
    blueGreen.cleanup();
  });

  it('should start in stable state with blue active', () => {
    const status = blueGreen.getStatus();
    
    expect(status.phase).toBe('stable');
    expect(status.activeStack).toBe('blue');
    expect(status.candidateStack).toBe(null);
    expect(status.trafficSplit.blue).toBe(100);
    expect(status.trafficSplit.green).toBe(0);
  });

  it('should deploy candidate successfully', () => {
    blueGreen.deployCandidate('green');
    const status = blueGreen.getStatus();
    
    expect(status.phase).toBe('candidate');
    expect(status.candidateStack).toBe('green');
  });

  it('should prevent deployment during active phase', () => {
    blueGreen.deployCandidate('green');
    
    expect(() => {
      blueGreen.deployCandidate('blue');
    }).toThrow(/Cannot deploy candidate during/);
  });

  it('should rollback on command', () => {
    blueGreen.deployCandidate('green');
    blueGreen.forceRollback('Test rollback');
    
    const status = blueGreen.getStatus();
    expect(status.phase).toBe('stable');
    expect(status.candidateStack).toBe(null);
    expect(status.trafficSplit.blue).toBe(100);
  });

  it('should update thresholds', () => {
    blueGreen.updateThresholds({
      maxP95Latency: 1000,
      maxErrorRate: 0.1
    });
    
    // Thresholds should be applied (internal state, can't verify directly)
    expect(() => {
      blueGreen.updateThresholds({ maxErrorRate: 0.05 });
    }).not.toThrow();
  });

  it('should emit events during lifecycle', (done) => {
    let eventsReceived = 0;
    
    blueGreen.on('candidateDeployed', () => {
      eventsReceived++;
    });
    
    blueGreen.on('rollback', () => {
      eventsReceived++;
      expect(eventsReceived).toBe(2);
      done();
    });
    
    blueGreen.deployCandidate('green');
    blueGreen.forceRollback('Test');
  });
});
