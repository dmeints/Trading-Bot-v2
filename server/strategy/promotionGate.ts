/**
 * Promotion Gate System
 * Shadow vs Live performance validation
 */

import { logger } from '../utils/logger';
import { validateProvenance } from '../middleware/provenanceGuard';

export type GateMetrics = {
  sharpe: number;
  maxDrawdownPct: number;
  profitFactor: number;
  slippageErrBps: number;
};

export type GateThresholds = {
  minSharpeDelta: number;
  maxMddWorsenPct: number;
  maxSlippageErrBps: number;
  minProfitFactor: number;
  minTrades: number;
};

export function promotionDecision({
  live,
  shadow,
  shadowTrades,
  thresholds: t
}: {
  live: GateMetrics;
  shadow: GateMetrics;
  shadowTrades: number;
  thresholds: GateThresholds;
}) {
  const reasons: string[] = [];

  if (shadowTrades < t.minTrades) {
    reasons.push("insufficient_trades");
  }

  if ((shadow.sharpe - live.sharpe) < t.minSharpeDelta) {
    reasons.push("sharpe_delta_too_small");
  }

  if ((shadow.maxDrawdownPct - live.maxDrawdownPct) > t.maxMddWorsenPct) {
    reasons.push("drawdown_worse");
  }

  if (shadow.slippageErrBps > t.maxSlippageErrBps) {
    reasons.push("slippage_err_high");
  }

  if (shadow.profitFactor < t.minProfitFactor) {
    reasons.push("profit_factor_low");
  }

  return {
    allow: reasons.length === 0,
    reasons
  };
}

// Assuming the rest of the file contains the PromotionGate class and its methods
// For example:
// interface PromotionCheck {
//   name: string;
//   passed: boolean;
//   message: string;
//   details: Record<string, any>;
// }

// interface PromotionConfig {
//   requirePerformance: boolean;
//   // other config properties
// }

// class PromotionGate {
//   private config: PromotionConfig;

//   constructor(config: PromotionConfig) {
//     this.config = config;
//   }

  // Validate all requirements before promotion
//   async validate(): Promise<PromotionResult> {
//     const checks: PromotionCheck[] = [];

    // Provenance validation (always required)
//     const provenanceCheck = await this.validateProvenance();
//     checks.push(provenanceCheck);

    // Performance validation
//     if (this.config.requirePerformance) {
//       const perfCheck = await this.validatePerformance();
//       checks.push(perfCheck);
//     }
//     // ... other validations
//     return { checks };
//   }

//   private async validatePerformance(): Promise<PromotionCheck> {
//     // Placeholder for performance validation logic
//     return {
//       name: 'performance_validation',
//       passed: true,
//       message: 'Performance metrics within acceptable bounds',
//       details: {}
//     };
//   }

//   private async validateProvenance(): Promise<PromotionCheck> {
//     try {
//       const isValid = await validateProvenance();
//       return {
//         name: 'provenance_validation',
//         passed: isValid,
//         message: isValid ? 'All data sources verified' : 'Provenance validation failed',
//         details: { timestamp: Date.now() }
//       };
//     } catch (error) {
//       logger.error('[PromotionGate] Provenance validation error', { error });
//       return {
//         name: 'provenance_validation',
//         passed: false,
//         message: 'Provenance validation error',
//         details: { error: error.message }
//       };
//     }
//   }

//   private async validateRisk(): Promise<PromotionCheck> {
//     // Implementation depends on risk metrics available
//     return {
//       name: 'risk_compliance',
//       passed: true,
//       message: 'Risk metrics within acceptable bounds',
//       details: {}
//     };
//   }
// }

// interface PromotionResult {
//   checks: PromotionCheck[];
// }