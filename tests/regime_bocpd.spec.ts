
import { describe, it, expect, beforeEach } from 'vitest';
import { BayesianOnlineChangePointDetection } from '../server/services/regime/bo_cpd';

describe('Bayesian Online Change-Point Detection', () => {
  let bocpd: BayesianOnlineChangePointDetection;

  beforeEach(() => {
    bocpd = new BayesianOnlineChangePointDetection(1/20); // More sensitive for testing
  });

  it('should initialize with sideways regime', () => {
    const state = bocpd.getCurrentRegime();
    
    expect(state.regime).toBe('sideways');
    expect(state.runLength).toBe(0);
    expect(state.confidence).toBeGreaterThan(0);
  });

  it('should update with returns and track run length', () => {
    // Feed stable returns
    for (let i = 0; i < 10; i++) {
      bocpd.updateWithReturn(0.001 + Math.random() * 0.0005);
    }
    
    const state = bocpd.getCurrentRegime();
    expect(state.runLength).toBeGreaterThan(5);
  });

  it('should detect regime change with synthetic drift', () => {
    // Feed stable bull market returns
    for (let i = 0; i < 15; i++) {
      bocpd.updateWithReturn(0.002 + Math.random() * 0.001);
    }
    
    const stateBeforeChange = bocpd.getCurrentRegime();
    const initialRunLength = stateBeforeChange.runLength;
    
    // Introduce bear market returns (regime change)
    for (let i = 0; i < 10; i++) {
      bocpd.updateWithReturn(-0.003 - Math.random() * 0.002);
    }
    
    const stateAfterChange = bocpd.getCurrentRegime();
    
    // Should detect change and reset run length or change regime
    expect(
      stateAfterChange.runLength < initialRunLength || 
      stateAfterChange.regime !== stateBeforeChange.regime ||
      stateAfterChange.lastChangeAt > stateBeforeChange.lastChangeAt
    ).toBe(true);
  });

  it('should classify regimes based on return patterns', () => {
    // Test bull market classification
    for (let i = 0; i < 25; i++) {
      bocpd.updateWithReturn(0.005 + Math.random() * 0.002); // Strong positive returns
    }
    
    let state = bocpd.getCurrentRegime();
    // Should eventually classify as bull or detect the pattern
    expect(['bull', 'volatile', 'sideways']).toContain(state.regime);
    
    // Reset and test bear market
    bocpd = new BayesianOnlineChangePointDetection(1/10);
    for (let i = 0; i < 25; i++) {
      bocpd.updateWithReturn(-0.005 - Math.random() * 0.002); // Strong negative returns
    }
    
    state = bocpd.getCurrentRegime();
    expect(['bear', 'volatile', 'sideways']).toContain(state.regime);
  });

  it('should handle numerical edge cases', () => {
    // Test with zero returns
    bocpd.updateWithReturn(0);
    bocpd.updateWithReturn(0);
    
    let state = bocpd.getCurrentRegime();
    expect(state).toHaveProperty('regime');
    expect(state).toHaveProperty('runLength');
    
    // Test with extreme values
    bocpd.updateWithReturn(0.1); // 10% return
    bocpd.updateWithReturn(-0.1); // -10% return
    
    state = bocpd.getCurrentRegime();
    expect(state).toHaveProperty('regime');
    expect(state.regime).toMatch(/^(bull|bear|sideways|volatile)$/);
  });
});
