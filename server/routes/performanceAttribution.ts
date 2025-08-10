/**
 * Phase K - Performance Attribution API Routes
 */

import { Router } from "express";
import { z } from "zod";
import { performanceAttributionService } from "../services/PerformanceAttribution";
import { logger } from "../utils/logger";
import { isAuthenticated } from "../replitAuth";

const router = Router();

// Request validation schemas
const attributionRequestSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  benchmarkSymbol: z.string().optional().default('BTCUSDT')
});

const factorAnalysisSchema = z.object({
  period: z.enum(['7d', '30d', '90d', '1y']),
  factors: z.array(z.string()).optional()
});

/**
 * GET /api/attribution/analyze
 * Comprehensive performance attribution analysis
 */
router.get('/analyze', isAuthenticated, async (req, res) => {
  try {
    const { startDate, endDate, benchmarkSymbol } = attributionRequestSchema.parse(req.query);
    const userId = req.user?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    logger.info('[AttributionAPI] Starting performance attribution', {
      userId,
      startDate,
      endDate,
      benchmark: benchmarkSymbol
    });

    const analysis = await performanceAttributionService.calculatePerformanceAttribution(
      userId,
      new Date(startDate),
      new Date(endDate),
      benchmarkSymbol
    );

    res.json({
      success: true,
      analysis,
      metadata: {
        userId,
        period: `${startDate} to ${endDate}`,
        benchmark: benchmarkSymbol,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('[AttributionAPI] Analysis failed', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to perform attribution analysis'
    });
  }
});

/**
 * GET /api/attribution/factors
 * Get factor exposure analysis for specified period
 */
router.get('/factors', isAuthenticated, async (req, res) => {
  try {
    const { period } = factorAnalysisSchema.parse(req.query);
    const userId = req.user?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    const analysis = await performanceAttributionService.calculatePerformanceAttribution(
      userId,
      startDate,
      endDate
    );

    // Return focused factor analysis
    res.json({
      success: true,
      factors: analysis.factorAttributions,
      summary: {
        totalContribution: analysis.factorAttributions.reduce((sum, factor) => sum + factor.contribution, 0),
        dominantFactor: analysis.factorAttributions.reduce((max, factor) => 
          Math.abs(factor.contribution) > Math.abs(max.contribution) ? factor : max
        ),
        diversificationRatio: analysis.factorAttributions.length > 0 
          ? 1 - (Math.max(...analysis.factorAttributions.map(f => Math.abs(f.contribution))) / 
                 analysis.factorAttributions.reduce((sum, f) => sum + Math.abs(f.contribution), 0))
          : 0
      },
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        days: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      }
    });

  } catch (error) {
    logger.error('[AttributionAPI] Factor analysis failed', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to analyze factor exposure'
    });
  }
});

/**
 * GET /api/attribution/components
 * Strategy component performance breakdown
 */
router.get('/components', isAuthenticated, async (req, res) => {
  try {
    const { startDate, endDate } = attributionRequestSchema.parse(req.query);
    const userId = req.user?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const analysis = await performanceAttributionService.calculatePerformanceAttribution(
      userId,
      new Date(startDate),
      new Date(endDate)
    );

    // Enhanced component analysis with rankings
    const rankedComponents = analysis.componentAnalysis
      .sort((a, b) => b.sharpeRatio - a.sharpeRatio)
      .map((component, index) => ({
        ...component,
        rank: index + 1,
        riskAdjustedReturn: component.sharpeRatio * Math.sqrt(252), // Annualized
        efficiency: component.avgTrade / Math.max(Math.abs(component.maxDrawdown), 0.01),
        consistency: component.winRate * (1 - Math.abs(component.maxDrawdown))
      }));

    res.json({
      success: true,
      components: rankedComponents,
      summary: {
        totalComponents: rankedComponents.length,
        bestPerformer: rankedComponents[0],
        worstPerformer: rankedComponents[rankedComponents.length - 1],
        diversificationMetrics: {
          correlationMatrix: this.calculateComponentCorrelations(rankedComponents),
          concentrationRisk: this.calculateConcentrationRisk(rankedComponents)
        }
      },
      metadata: {
        period: `${startDate} to ${endDate}`,
        analysisDate: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('[AttributionAPI] Component analysis failed', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to analyze strategy components'
    });
  }
});

/**
 * GET /api/attribution/risk-decomposition
 * Risk factor decomposition and attribution
 */
router.get('/risk-decomposition', isAuthenticated, async (req, res) => {
  try {
    const { startDate, endDate, benchmarkSymbol } = attributionRequestSchema.parse(req.query);
    const userId = req.user?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const analysis = await performanceAttributionService.calculatePerformanceAttribution(
      userId,
      new Date(startDate),
      new Date(endDate),
      benchmarkSymbol
    );

    // Risk decomposition analysis
    const riskDecomposition = {
      totalRisk: analysis.riskMetrics.volatility,
      systematicRisk: Math.abs(analysis.beta) * 0.15, // Market volatility proxy
      specificRisk: Math.sqrt(Math.max(0, Math.pow(analysis.riskMetrics.volatility, 2) - Math.pow(Math.abs(analysis.beta) * 0.15, 2))),
      factorRisks: analysis.factorAttributions.map(factor => ({
        factor: factor.factor,
        riskContribution: Math.abs(factor.weight) * 0.1, // Simplified risk attribution
        diversificationBenefit: factor.weight < 0.5 ? factor.weight * 0.02 : 0
      }))
    };

    res.json({
      success: true,
      riskDecomposition,
      riskMetrics: analysis.riskMetrics,
      riskBudget: {
        systematic: (riskDecomposition.systematicRisk / riskDecomposition.totalRisk) * 100,
        specific: (riskDecomposition.specificRisk / riskDecomposition.totalRisk) * 100,
        factorBreakdown: riskDecomposition.factorRisks.map(risk => ({
          factor: risk.factor,
          allocation: (risk.riskContribution / riskDecomposition.totalRisk) * 100
        }))
      },
      recommendations: this.generateRiskRecommendations(riskDecomposition, analysis.riskMetrics)
    });

  } catch (error) {
    logger.error('[AttributionAPI] Risk decomposition failed', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to perform risk decomposition'
    });
  }
});

/**
 * GET /api/attribution/time-series
 * Time series performance data for charting
 */
router.get('/time-series', isAuthenticated, async (req, res) => {
  try {
    const { startDate, endDate, benchmarkSymbol } = attributionRequestSchema.parse(req.query);
    const userId = req.user?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const analysis = await performanceAttributionService.calculatePerformanceAttribution(
      userId,
      new Date(startDate),
      new Date(endDate),
      benchmarkSymbol
    );

    res.json({
      success: true,
      timeSeries: analysis.timeSeriesAnalysis,
      performance: {
        totalReturn: analysis.totalReturn,
        benchmarkReturn: analysis.benchmarkReturn,
        excessReturn: analysis.totalReturn - analysis.benchmarkReturn,
        informationRatio: analysis.riskMetrics.volatility > 0 
          ? (analysis.totalReturn - analysis.benchmarkReturn) / analysis.riskMetrics.volatility
          : 0
      },
      chartData: {
        portfolioCumulative: analysis.timeSeriesAnalysis.cumulativeReturns,
        drawdownSeries: analysis.timeSeriesAnalysis.drawdowns,
        volatilitySeries: analysis.timeSeriesAnalysis.rollingVolatility,
        dates: analysis.timeSeriesAnalysis.dates
      }
    });

  } catch (error) {
    logger.error('[AttributionAPI] Time series analysis failed', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate time series data'
    });
  }
});

// Helper methods for advanced analytics
function calculateComponentCorrelations(components: any[]): number[][] {
  // Simplified correlation matrix calculation
  const n = components.length;
  const correlations: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        correlations[i][j] = 1.0;
      } else {
        // Simplified correlation based on return similarity
        const returnDiff = Math.abs(components[i].returns - components[j].returns);
        correlations[i][j] = Math.max(0, 1 - returnDiff * 10); // Simplified
      }
    }
  }
  
  return correlations;
}

function calculateConcentrationRisk(components: any[]): number {
  if (components.length === 0) return 1.0;
  
  const totalReturn = components.reduce((sum, comp) => sum + Math.abs(comp.returns), 0);
  if (totalReturn === 0) return 0;
  
  const weights = components.map(comp => Math.abs(comp.returns) / totalReturn);
  const herfindahlIndex = weights.reduce((sum, weight) => sum + weight * weight, 0);
  
  return herfindahlIndex; // Higher values indicate more concentration
}

function generateRiskRecommendations(riskDecomposition: any, riskMetrics: any): string[] {
  const recommendations: string[] = [];
  
  if (riskDecomposition.systematicRisk / riskDecomposition.totalRisk > 0.7) {
    recommendations.push("High systematic risk exposure - consider diversification across uncorrelated assets");
  }
  
  if (riskMetrics.var95 < -0.05) {
    recommendations.push("High tail risk detected - implement stronger position sizing controls");
  }
  
  if (riskMetrics.calmarRatio < 1.0) {
    recommendations.push("Low risk-adjusted returns - review strategy efficiency and drawdown management");
  }
  
  if (riskDecomposition.specificRisk / riskDecomposition.totalRisk > 0.8) {
    recommendations.push("High idiosyncratic risk - consider factor-based diversification");
  }
  
  return recommendations.length > 0 ? recommendations : ["Risk profile appears well-balanced"];
}

export default router;