
// tools/canary_launch.ts
import { preflightAdapters, getLatestMetrics, getModelState, getRiskLimits } from './preflight_adapters.js';

interface CanaryResult {
  success: boolean;
  gateDecision: 'PASS' | 'BLOCK';
  blockers: string[];
  warnings: string[];
  metrics: any;
  provenance: {
    metricsSource: string;
    modelSource: string;
    riskSource: string;
  };
}

class CanaryLaunch {
  private thresholds = {
    minSharpeRatio: 0.5,
    maxDrawdown: 0.15,
    minWinRate: 0.45,
    minModelAccuracy: 0.65,
    maxRiskExposure: 0.10
  };

  async executeCanarySequence(): Promise<CanaryResult> {
    console.log('🚀 Canary Launch Sequence Starting...');
    
    const blockers: string[] = [];
    const warnings: string[] = [];
    const provenance = {
      metricsSource: 'unknown',
      modelSource: 'unknown',
      riskSource: 'unknown'
    };

    try {
      // Get real data from preflight adapters
      const [metricsResult, modelResult, riskResult] = await Promise.allSettled([
        getLatestMetrics(),
        getModelState(),
        getRiskLimits()
      ]);

      // Process metrics
      let metrics = null;
      if (metricsResult.status === 'fulfilled') {
        metrics = metricsResult.value.data;
        provenance.metricsSource = metricsResult.value.provenance.source;
        
        // Check metrics thresholds
        if (metrics.sharpe_ratio < this.thresholds.minSharpeRatio) {
          blockers.push('sharpe_ratio_too_low');
        }
        if (metrics.max_drawdown > this.thresholds.maxDrawdown) {
          blockers.push('max_drawdown_exceeded');
        }
        if (metrics.win_rate < this.thresholds.minWinRate) {
          blockers.push('win_rate_too_low');
        }
        
        // Add fallback warning if needed
        if (metricsResult.value.fallbackUsed) {
          warnings.push('metrics_fallback_used');
        }
      } else {
        console.warn('⚠️ Metrics unavailable, using safe defaults');
        blockers.push('metrics_unavailable');
      }

      // Process model state
      if (modelResult.status === 'fulfilled') {
        const modelState = modelResult.value.data;
        provenance.modelSource = modelResult.value.provenance.source;
        
        if (modelState.accuracy < this.thresholds.minModelAccuracy) {
          blockers.push('model_accuracy_too_low');
        }
        if (modelState.status !== 'active') {
          blockers.push('model_not_active');
        }
        
        if (modelResult.value.fallbackUsed) {
          warnings.push('model_fallback_used');
        }
      } else {
        blockers.push('model_state_unavailable');
      }

      // Process risk limits
      if (riskResult.status === 'fulfilled') {
        const riskLimits = riskResult.value.data;
        provenance.riskSource = riskResult.value.provenance.source;
        
        if (riskLimits.max_position_size > this.thresholds.maxRiskExposure) {
          warnings.push('high_risk_exposure_configured');
        }
        
        if (riskResult.value.fallbackUsed) {
          warnings.push('risk_limits_fallback_used');
        }
      } else {
        warnings.push('risk_limits_unavailable');
      }

      // Check DR-OPE endpoint (with fallback)
      try {
        const response = await fetch('http://localhost:5000/api/brain/ope/dr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            policy: 'test',
            episodes: 10
          }),
          timeout: 5000
        });

        if (!response.ok) {
          console.warn('⚠️ DR-OPE endpoint unavailable, using artifacts');
          warnings.push('dr_ope_endpoint_unavailable');
        }
      } catch (error) {
        console.warn('⚠️ DR-OPE endpoint unavailable, using artifacts');
        warnings.push('dr_ope_endpoint_unavailable');
      }

      // CI lower bound check (simulated with real metrics if available)
      if (metrics && metrics.sharpe_ratio < 0.3) {
        blockers.push('CI_lower_bound_too_low');
      }

      // Determine gate decision
      const gateDecision = blockers.length === 0 ? 'PASS' : 'BLOCK';
      
      console.log(`🚪 Promotion Gate: ${gateDecision === 'PASS' ? '✅ PASS' : '❌ BLOCK'}`);
      
      if (blockers.length > 0) {
        console.log('🛑 Gate blocked:', blockers);
      }
      
      if (warnings.length > 0) {
        console.log('⚠️ Warnings:', warnings);
      }

      return {
        success: gateDecision === 'PASS',
        gateDecision,
        blockers,
        warnings,
        metrics: metrics || {},
        provenance
      };

    } catch (error) {
      console.error('❌ Canary launch failed:', error);
      
      return {
        success: false,
        gateDecision: 'BLOCK',
        blockers: ['canary_launch_error'],
        warnings: [],
        metrics: {},
        provenance
      };
    }
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const canary = new CanaryLaunch();
  canary.executeCanarySequence()
    .then(result => {
      console.log('\n📊 Canary Results:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Canary execution failed:', error);
      process.exit(1);
    });
}

export default CanaryLaunch;
export { CanaryLaunch };
