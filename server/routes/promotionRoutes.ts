/**
 * Promotion Gate Routes
 * API endpoints for production readiness validation
 */

import { Router } from 'express';
import { runPromotionGates, PromotionResult } from '../features/promotion';
import { addProvenance } from '../middleware/provenanceGuard';
import { rateLimiters } from '../middleware/rateLimiter';

const router = Router();

/**
 * GET /api/promotion/validate - Run all promotion gates
 */
router.get('/validate', rateLimiters.default, async (req, res) => {
  try {
    const { symbol = 'BTC/USD' } = req.query;
    
    console.log(`[Promotion] Running validation gates for ${symbol}`);
    const startTime = Date.now();
    
    const result = await runPromotionGates(symbol as string);
    
    const duration = Date.now() - startTime;
    console.log(`[Promotion] Validation completed in ${duration}ms - Can promote: ${result.canPromote}`);
    
    if (!result.canPromote) {
      console.log(`[Promotion] Blockers:`, result.blockers);
    }
    
    res.json(addProvenance({
      ...result,
      validationDuration: duration,
      timestamp: new Date().toISOString()
    }, 'computation', `promotion_validation_${symbol}`));
    
  } catch (error: any) {
    console.error('[Promotion] Validation error:', error);
    res.status(500).json(addProvenance({
      error: 'Promotion validation failed',
      message: error.message,
      canPromote: false,
      timestamp: new Date().toISOString()
    }, 'computation'));
  }
});

/**
 * GET /api/promotion/gates - List available promotion gates
 */
router.get('/gates', (req, res) => {
  const gates = [
    {
      id: 'data_quality',
      name: 'Data Quality',
      description: 'Validates data integrity, authenticity, and completeness',
      required: true
    },
    {
      id: 'algorithm_validation',
      name: 'Algorithm Validation',
      description: 'Tests decision engine with known scenarios',
      required: true
    },
    {
      id: 'performance_benchmark',
      name: 'Performance Benchmark',
      description: 'Validates system performance under load',
      required: true
    },
    {
      id: 'security_audit',
      name: 'Security Audit',
      description: 'Checks for security vulnerabilities and best practices',
      required: true
    },
    {
      id: 'feature_completeness',
      name: 'Feature Completeness',
      description: 'Validates all required features are implemented',
      required: true
    }
  ];
  
  res.json(addProvenance({
    gates,
    totalGates: gates.length,
    requiredGates: gates.filter(g => g.required).length
  }, 'computation', 'promotion_gates_list'));
});

/**
 * GET /api/promotion/status - Get current promotion readiness status
 */
router.get('/status', rateLimiters.default, async (req, res) => {
  try {
    const result = await runPromotionGates();
    
    const status = {
      ready: result.canPromote,
      score: result.overallScore,
      lastValidated: new Date().toISOString(),
      summary: {
        totalGates: result.metadata.totalGates,
        passedGates: result.metadata.passedGates,
        blockers: result.blockers.length,
        warnings: result.warnings.length
      },
      nextSteps: result.canPromote 
        ? ['System is ready for promotion to production']
        : result.blockers.length > 0 
          ? ['Fix blocking issues', ...result.blockers.slice(0, 3)]
          : ['Address warnings and improve scores', ...result.warnings.slice(0, 3)]
    };
    
    res.json(addProvenance(status, 'computation', 'promotion_status'));
    
  } catch (error: any) {
    console.error('[Promotion] Status error:', error);
    res.status(500).json(addProvenance({
      ready: false,
      error: 'Failed to check promotion status',
      message: error.message
    }, 'computation'));
  }
});

export default router;