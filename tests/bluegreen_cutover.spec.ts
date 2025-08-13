import { describe, it, expect, beforeEach } from '@jest/globals';
import { BlueGreen } from '../server/services/BlueGreen';

describe('Blue/Green Cutover', () => {
  let blueGreen: BlueGreen;

  beforeEach(() => {
    blueGreen = new BlueGreen();
  });

  it('should start with active deployment', () => {
    const status = blueGreen.getStatus();
    expect(status.state).toBe('active');
    expect(status.trafficPercent).toBe(100);
  });

  it('should deploy candidate and auto-promote', async () => {
    const version = '2.0.0';
    await blueGreen.deployCandidate(version);

    const status = blueGreen.getStatus();
    expect(status.version).toBe(version);
    expect(status.state).toBe('candidate');
    expect(status.trafficPercent).toBe(0);
  });

  it('should evaluate SLO health', () => {
    const status = blueGreen.getStatus();
    const slos = status.slos;

    expect(slos.p95LatencyMs).toBeGreaterThan(0);
    expect(slos.errorRate).toBeGreaterThanOrEqual(0);
    expect(slos.qosScore).toBeGreaterThanOrEqual(0);
    expect(slos.qosScore).toBeLessThanOrEqual(1);
  });

  it('should have proper rollback thresholds', () => {
    const status = blueGreen.getStatus();
    const thresholds = status.rollbackThreshold;

    expect(thresholds.maxErrorRate).toBeGreaterThan(0);
    expect(thresholds.maxLatencyMs).toBeGreaterThan(0);
    expect(thresholds.minQosScore).toBeGreaterThan(0);
    expect(thresholds.minQosScore).toBeLessThan(1);
  });

  it('should track metrics history', () => {
    const history = blueGreen.getMetricsHistory();
    expect(Array.isArray(history)).toBe(true);
  });
});