/**
 * Stevie Core Algorithm API Routes
 * Main endpoints for Stevie's trading engine and performance monitoring
 */

import { Router } from "express";
import { z } from "zod";
import { calculateUnifiedFeatures } from "../features";
import { scoreTrade } from "../strategy/scorecard";
import { defaultScoreConfig } from "../../shared/src/stevie/score_config";
import { evaluatePromotion, calculatePerformanceMetrics, defaultPromotionCriteria } from "../audit/promotionGate";
import { scanForMockData, verifyProvenance } from "../audit/antiMock";
import { routeOrder } from "../execution/router";
import { temperedKellyFraction } from "../sizing/temperedKelly";
import { varianceTargetMultiplier, rollingAnnualizedVolPct } from "../risk/varianceTarget";
import { calculatePSI, generateDriftReport } from "../monitoring/featureDrift";
import { logger } from "../utils/logger";

const router = Router();

// Request schemas
const tradeScoreRequestSchema = z.object({
  symbol: z.string(),
  entryTs: z.number(),
  exitTs: z.number(),
  entryPx: z.number(),
  exitPx: z.number(),
  qty: z.number(),
  equityAtEntry: z.number(),
  feeBps: z.number(),
  slippageRealizedBps: z.number(),
  ackMs: z.number(),
  mfeBps: z.number(),
  maeBps: z.number(),
  midAfter1sBps: z.number().optional(),
  tpBps: z.number().optional(),
  slBps: z.number().optional()
});

const executionRouteSchema = z.object({
  symbol: z.string(),
  side: z.enum(['buy', 'sell']),
  sizePct: z.number(),
  spread_bps: z.number(),
  depth_usd: z.number(),
  volatility_pct: z.number(),
  liquidity_tier: z.enum([1, 2, 3]).transform(Number),
  toxicity_score: z.number().optional()
});

const positionSizingSchema = z.object({
  edgeBps: z.number(),
  varBps2: z.number(),
  temper: z.number().min(0).max(1),
  score7d: z.number().optional(),
  closes: z.array(z.number()),
  timeframe: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']),
  volTarget: z.number().optional()
});

/**
 * POST /api/stevie-core/score-trade
 * Calculate comprehensive trade score with 8 scoring terms
 */
router.post('/score-trade', async (req, res) => {
  try {
    const tradeData = tradeScoreRequestSchema.parse(req.body);
    
    const score = scoreTrade(tradeData, defaultScoreConfig, {
      commit: process.env.GIT_COMMIT || 'dev',
      generatedAt: new Date().toISOString()
    });
    
    logger.info('[StevieCore] Trade scored', {
      symbol: tradeData.symbol,
      totalScore: score.total,
      terms: score.terms.length
    });
    
    res.json({
      success: true,
      score
    });
    
  } catch (error) {
    logger.error('[StevieCore] Trade scoring failed', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid trade data',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to score trade'
    });
  }
});

/**
 * POST /api/stevie-core/route-execution
 * Get intelligent execution routing recommendations
 */
router.post('/route-execution', async (req, res) => {
  try {
    const routeData = executionRouteSchema.parse(req.body);
    
    const orderRequest = {
      symbol: routeData.symbol,
      side: routeData.side,
      sizePct: routeData.sizePct,
      type: 'market' as const
    };
    
    const conditions = {
      spread_bps: routeData.spread_bps,
      depth_usd: routeData.depth_usd,
      volatility_pct: routeData.volatility_pct,
      liquidity_tier: routeData.liquidity_tier as 1 | 2 | 3,
      toxicity_score: routeData.toxicity_score
    };
    
    const uncertaintyScore = routeData.uncertaintyScore || 0;
    const plan = routeOrder(orderRequest, conditions, uncertaintyScore);
    
    logger.info('[StevieCore] Execution routed', {
      symbol: routeData.symbol,
      side: routeData.side,
      primaryType: plan.primary.type,
      expectedCost: plan.expectedCost_bps,
      uncertaintyAdjusted: plan.uncertaintyAdjusted
    });
    
    res.json({
      success: true,
      executionPlan: plan
    });
    
  } catch (error) {
    logger.error('[StevieCore] Execution routing failed', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid routing parameters',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to route execution'
    });
  }
});

/**
 * GET /api/uncertainty/coverage
 * Get conformal prediction coverage diagnostics
 */
router.get('/uncertainty/coverage', async (req, res) => {
  try {
    // Import conformal predictor (assuming it's available globally or through a service)
    const { ConformalPredictor } = await import('../brain/conformal');
    
    // Get or create global conformal predictor instance
    const conformalPredictor = global.conformalPredictor || new ConformalPredictor();
    
    const diagnostics = conformalPredictor.getDiagnostics();
    
    logger.info('[StevieCore] Uncertainty coverage requested', {
      calibrationSamples: diagnostics.calibrationSamples,
      empiricalCoverage: diagnostics.empiricalCoverage,
      coverageGap: diagnostics.coverageGap
    });
    
    res.json({
      success: true,
      coverage: {
        empiricalCoverage: diagnostics.empiricalCoverage,
        expectedCoverage: diagnostics.expectedCoverage,
        coverageGap: diagnostics.coverageGap,
        avgIntervalWidth: diagnostics.avgIntervalWidth,
        calibrationSamples: diagnostics.calibrationSamples,
        status: diagnostics.coverageGap < 0.05 ? 'good' : 
                diagnostics.coverageGap < 0.1 ? 'warning' : 'poor',
        recentNonconformityScores: diagnostics.recentNonconformityScores.slice(-10)
      }
    });
    
  } catch (error) {
    logger.error('[StevieCore] Uncertainty coverage failed', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get uncertainty coverage'
    });
  }
});

/**
 * POST /api/stevie-core/position-sizing
 * Calculate optimal position size using tempered Kelly and variance targeting
 */
router.post('/position-sizing', async (req, res) => {
  try {
    const sizingData = positionSizingSchema.parse(req.body);
    
    // Calculate variance targeting multiplier
    const volPcts = rollingAnnualizedVolPct(sizingData.closes, sizingData.timeframe, 20);
    const currentVol = volPcts[volPcts.length - 1];
    const vtMultiplier = varianceTargetMultiplier(currentVol, sizingData.volTarget);
    
    // Calculate tempered Kelly fraction
    const kellyFraction = temperedKellyFraction({
      edgeBps: sizingData.edgeBps,
      varBps2: sizingData.varBps2,
      temper: sizingData.temper,
      score7d: sizingData.score7d
    });
    
    // Combined sizing recommendation
    const finalSize = kellyFraction * vtMultiplier;
    
    logger.info('[StevieCore] Position sized', {
      kellyFraction,
      vtMultiplier,
      finalSize,
      currentVol
    });
    
    res.json({
      success: true,
      sizing: {
        kellyFraction,
        varianceTargetMultiplier: vtMultiplier,
        finalPositionSize: finalSize,
        currentVolatilityPct: currentVol,
        reasoning: `Kelly: ${(kellyFraction * 100).toFixed(2)}%, Vol Target: ${(vtMultiplier * 100).toFixed(0)}%, Final: ${(finalSize * 100).toFixed(2)}%`
      }
    });
    
  } catch (error) {
    logger.error('[StevieCore] Position sizing failed', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sizing parameters',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to calculate position size'
    });
  }
});

/**
 * GET /api/stevie-core/promotion-status
 * Check current promotion gate status for live trading transition
 */
router.get('/promotion-status', async (req, res) => {
  try {
    // Placeholder: In real implementation, fetch actual trade scores from database
    const mockTradeScores = [
      { total: 5.2, terms: [], provenance: { commit: 'abc123', generatedAt: new Date().toISOString() } },
      { total: 3.8, terms: [], provenance: { commit: 'abc123', generatedAt: new Date().toISOString() } },
      { total: -1.2, terms: [], provenance: { commit: 'abc123', generatedAt: new Date().toISOString() } },
    ];
    
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const endDate = new Date();
    
    const metrics = calculatePerformanceMetrics(mockTradeScores, startDate, endDate);
    const decision = evaluatePromotion(metrics, defaultPromotionCriteria);
    
    logger.info('[StevieCore] Promotion status checked', {
      approved: decision.approved,
      confidence: decision.confidence
    });
    
    res.json({
      success: true,
      promotionStatus: {
        metrics,
        decision,
        criteria: defaultPromotionCriteria
      }
    });
    
  } catch (error) {
    logger.error('[StevieCore] Promotion status check failed', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to check promotion status'
    });
  }
});

/**
 * POST /api/stevie-core/audit-data
 * Run anti-mock audit on provided data
 */
router.post('/audit-data', async (req, res) => {
  try {
    const { data, expectedEntropy } = req.body;
    
    if (!Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        error: 'Data must be an array'
      });
    }
    
    const auditResult = scanForMockData(data, expectedEntropy);
    
    logger.info('[StevieCore] Data audited', {
      suspicious: auditResult.suspicious,
      confidence: auditResult.confidence,
      entropy: auditResult.entropy
    });
    
    res.json({
      success: true,
      audit: auditResult
    });
    
  } catch (error) {
    logger.error('[StevieCore] Data audit failed', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to audit data'
    });
  }
});

/**
 * POST /api/stevie-core/drift-monitor
 * Monitor feature drift using PSI calculations
 */
router.post('/drift-monitor', async (req, res) => {
  try {
    const { featureName, baselineData, currentData } = req.body;
    
    if (!Array.isArray(baselineData) || !Array.isArray(currentData)) {
      return res.status(400).json({
        success: false,
        error: 'Baseline and current data must be arrays'
      });
    }
    
    const psiResult = calculatePSI(baselineData, currentData);
    
    const driftReport = generateDriftReport(
      featureName || 'unknown_feature',
      baselineData,
      currentData,
      { start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), end: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
      { start: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), end: new Date() }
    );
    
    logger.info('[StevieCore] Feature drift monitored', {
      feature: featureName,
      psiScore: psiResult.psi_score,
      riskLevel: psiResult.risk_level
    });
    
    res.json({
      success: true,
      driftReport
    });
    
  } catch (error) {
    logger.error('[StevieCore] Drift monitoring failed', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to monitor feature drift'
    });
  }
});

export default router;