
import { describe, it, expect, beforeEach } from 'vitest';
import { executionRouter } from '../server/services/ExecutionRouter.js';

describe('Execution Planner', () => {
  beforeEach(() => {
    // Reset any state
  });

  it('should create execution plan with uncertainty scaling', async () => {
    const context = {
      symbol: 'BTCUSDT',
      maxSize: 0.1,
      targetVol: 0.02
    };
    
    const plan = await executionRouter.plan(context);
    
    expect(plan).toBeDefined();
    expect(plan.symbol).toBe('BTCUSDT');
    expect(plan.targetSize).toBeTypeOf('number');
    expect(plan.estimatedCost).toBeGreaterThan(0);
    expect(plan.executionStyle).toBeOneOf(['immediate', 'twap', 'vwap', 'pov']);
  });

  it('should handle different signals correctly', async () => {
    const contexts = [
      { symbol: 'BTCUSDT', regime: 'bull' },
      { symbol: 'ETHUSDT', regime: 'bear' },
      { symbol: 'BTCUSDT', regime: 'sideways' }
    ];
    
    for (const context of contexts) {
      const plan = await executionRouter.plan(context);
      expect(plan.signal).toBeOneOf(['long', 'short', 'flat']);
    }
  });

  it('should execute plan and create record', async () => {
    const context = { symbol: 'BTCUSDT', maxSize: 0.01 };
    const plan = await executionRouter.plan(context);
    
    const execution = await executionRouter.execute(plan);
    
    expect(execution).toBeDefined();
    expect(execution.id).toMatch(/^exec_/);
    expect(execution.status).toBeOneOf(['filled', 'blocked', 'cancelled']);
  });

  it('should track sizing snapshots', async () => {
    const context = { symbol: 'BTCUSDT', maxSize: 0.05 };
    await executionRouter.plan(context);
    
    const sizing = executionRouter.getLastSizing();
    
    expect(sizing).toBeDefined();
    expect(sizing!.symbol).toBe('BTCUSDT');
    expect(sizing!.baseSize).toBe(0.05);
    expect(sizing!.finalSize).toBeGreaterThanOrEqual(0);
  });

  it('should handle risk guard blocking', async () => {
    const context = { symbol: 'BTCUSDT', maxSize: 10 }; // Large size
    const plan = await executionRouter.plan(context);
    
    // Should create large plan
    expect(Math.abs(plan.targetSize)).toBeGreaterThan(1);
    
    const execution = await executionRouter.execute(plan);
    
    // May be blocked by risk guards
    if (execution.status === 'blocked') {
      expect(execution.blockReason).toBeDefined();
    }
  });
});
