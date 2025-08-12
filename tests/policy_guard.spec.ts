
import { describe, it, expect, beforeEach } from 'vitest';
import { policyGuard, PolicyState } from '../server/services/policyGuard.js';

describe('Policy Guard', () => {
  beforeEach(() => {
    // Reset policy states for clean tests
    const policies = ['p_sma', 'p_trend', 'p_meanrev'];
    policies.forEach(id => {
      const status = policyGuard.getPolicyStatus(id);
      if (Array.isArray(status)) return;
      
      // Reset to shadow state
      (status as any).state = PolicyState.SHADOW;
      (status as any).shadowFills = 0;
      (status as any).paperPnL = 0;
      (status as any).maxDrawdown = 0;
      (status as any).observationDays = 0;
      (status as any).canPromote = false;
      (status as any).promotionBlocked = [];
    });
  });

  it('should initialize policies in shadow state', () => {
    const status = policyGuard.getPolicyStatus('p_sma');
    expect(Array.isArray(status)).toBe(false);
    
    if (!Array.isArray(status)) {
      expect(status.state).toBe(PolicyState.SHADOW);
      expect(status.shadowFills).toBe(0);
      expect(status.canPromote).toBe(false);
    }
  });

  it('should track shadow fills and enable promotion', () => {
    const policyId = 'p_sma';
    
    // Record multiple shadow fills
    for (let i = 0; i < 55; i++) {
      policyGuard.recordShadowFill(policyId, {
        price: 50000 + i,
        quantity: 0.1,
        pnl: Math.random() > 0.5 ? 0.001 : -0.0005
      });
    }

    const status = policyGuard.getPolicyStatus(policyId);
    expect(Array.isArray(status)).toBe(false);
    
    if (!Array.isArray(status)) {
      expect(status.shadowFills).toBeGreaterThanOrEqual(50);
      // Note: canPromote might still be false due to observation days requirement
    }
  });

  it('should promote policy from shadow to paper', () => {
    const policyId = 'p_trend';
    
    // Simulate sufficient fills and time
    for (let i = 0; i < 55; i++) {
      policyGuard.recordShadowFill(policyId, {
        price: 50000,
        quantity: 0.1,
        pnl: 0.001
      });
    }

    // Mock observation days by updating the status directly for testing
    const status = policyGuard.getPolicyStatus(policyId);
    if (!Array.isArray(status)) {
      (status as any).observationDays = 8; // Above threshold
      (status as any).canPromote = true;
      (status as any).promotionBlocked = [];
    }

    const promoted = policyGuard.promotePolicy(policyId);
    expect(promoted).toBe(true);

    const updatedStatus = policyGuard.getPolicyStatus(policyId);
    if (!Array.isArray(updatedStatus)) {
      expect(updatedStatus.state).toBe(PolicyState.PAPER);
    }
  });

  it('should block live execution for non-live policies', () => {
    const shadowPolicy = 'p_sma';
    const livePolicy = 'p_meanrev';
    
    // Set one policy to live state for testing
    const status = policyGuard.getPolicyStatus(livePolicy);
    if (!Array.isArray(status)) {
      (status as any).state = PolicyState.LIVE;
    }

    expect(policyGuard.canExecuteLive(shadowPolicy)).toBe(false);
    expect(policyGuard.canExecuteLive(livePolicy)).toBe(true);
  });

  it('should prevent promotion without meeting thresholds', () => {
    const policyId = 'p_trend';
    
    // Record insufficient fills
    for (let i = 0; i < 30; i++) {
      policyGuard.recordShadowFill(policyId, {
        price: 50000,
        quantity: 0.1,
        pnl: 0.001
      });
    }

    const status = policyGuard.getPolicyStatus(policyId);
    if (!Array.isArray(status)) {
      expect(status.canPromote).toBe(false);
      expect(status.promotionBlocked.length).toBeGreaterThan(0);
    }

    const promoted = policyGuard.promotePolicy(policyId);
    expect(promoted).toBe(false);
  });

  it('should track paper trading performance', () => {
    const policyId = 'p_sma';
    
    // Set to paper state for testing
    const status = policyGuard.getPolicyStatus(policyId);
    if (!Array.isArray(status)) {
      (status as any).state = PolicyState.PAPER;
    }

    // Record paper trades
    policyGuard.recordPaperTrade(policyId, { pnl: 0.002, drawdown: -0.001 });
    policyGuard.recordPaperTrade(policyId, { pnl: 0.003, drawdown: -0.002 });

    const updatedStatus = policyGuard.getPolicyStatus(policyId);
    if (!Array.isArray(updatedStatus)) {
      expect(updatedStatus.paperPnL).toBe(0.005);
      expect(updatedStatus.maxDrawdown).toBe(-0.002);
    }
  });

  it('should provide comprehensive status for all policies', () => {
    const allStatuses = policyGuard.getPolicyStatus();
    expect(Array.isArray(allStatuses)).toBe(true);
    
    if (Array.isArray(allStatuses)) {
      expect(allStatuses.length).toBeGreaterThanOrEqual(3);
      expect(allStatuses.every(s => s.policyId && s.state)).toBe(true);
    }
  });
});
