
/**
 * Reporting API Routes
 * Alpha PnL attribution and risk reporting
 */

import { Router } from 'express';
import { alphaRegistry } from '../services/alpha/Registry';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/report/alpha-pnl?window=7d
 * Get PnL attribution by alpha signal
 */
router.get('/alpha-pnl', (req, res) => {
  try {
    const windowParam = req.query.window as string || '7d';
    
    // Parse window parameter
    let windowDays = 7;
    if (windowParam.endsWith('d')) {
      windowDays = parseInt(windowParam.slice(0, -1)) || 7;
    } else if (windowParam.endsWith('h')) {
      windowDays = (parseInt(windowParam.slice(0, -1)) || 168) / 24;
    }
    
    // Clamp to reasonable range
    windowDays = Math.max(1, Math.min(90, windowDays));
    
    // Get alpha PnL attribution
    const alphaPnL = alphaRegistry.calculateAlphaPnL(windowDays);
    
    // Calculate summary statistics
    const totalPnL = Object.values(alphaPnL).reduce((sum, pnl) => sum + pnl, 0);
    const alphaCount = Object.keys(alphaPnL).length;
    const bestAlpha = Object.entries(alphaPnL).reduce((best, [id, pnl]) => 
      pnl > (best?.pnl || -Infinity) ? { id, pnl } : best, 
      null as { id: string; pnl: number } | null
    );
    const worstAlpha = Object.entries(alphaPnL).reduce((worst, [id, pnl]) => 
      pnl < (worst?.pnl || Infinity) ? { id, pnl } : worst,
      null as { id: string; pnl: number } | null
    );
    
    res.json({
      window_days: windowDays,
      summary: {
        total_pnl: totalPnL,
        alpha_count: alphaCount,
        best_alpha: bestAlpha,
        worst_alpha: worstAlpha,
        avg_pnl_per_alpha: alphaCount > 0 ? totalPnL / alphaCount : 0
      },
      alpha_pnl: alphaPnL,
      timestamp: new Date()
    });
    
  } catch (error) {
    logger.error('[Report] Error getting alpha PnL:', error);
    res.status(500).json({ error: 'Failed to get alpha PnL report' });
  }
});

/**
 * GET /api/report/risk?window=7d
 * Get risk metrics report
 */
router.get('/risk', (req, res) => {
  try {
    const windowParam = req.query.window as string || '7d';
    
    // Parse window parameter  
    let windowDays = 7;
    if (windowParam.endsWith('d')) {
      windowDays = parseInt(windowParam.slice(0, -1)) || 7;
    } else if (windowParam.endsWith('h')) {
      windowDays = (parseInt(windowParam.slice(0, -1)) || 168) / 24;
    }
    
    windowDays = Math.max(1, Math.min(90, windowDays));
    
    // Generate mock risk metrics (would use real data in production)
    const riskMetrics = generateMockRiskMetrics(windowDays);
    
    res.json({
      window_days: windowDays,
      risk_metrics: riskMetrics,
      timestamp: new Date()
    });
    
  } catch (error) {
    logger.error('[Report] Error getting risk report:', error);
    res.status(500).json({ error: 'Failed to get risk report' });
  }
});

/**
 * GET /api/report/attribution/summary
 * Get attribution summary across all trades
 */
router.get('/attribution/summary', (req, res) => {
  try {
    const attributions = alphaRegistry.getAllAttributions();
    
    if (attributions.length === 0) {
      return res.json({
        trade_count: 0,
        total_pnl: 0,
        attribution_coverage: 0,
        summary: {}
      });
    }
    
    // Calculate summary statistics
    const totalPnL = attributions.reduce((sum, attr) => sum + attr.pnl, 0);
    const avgPnL = totalPnL / attributions.length;
    const tradeCount = attributions.length;
    
    // Get all unique alpha IDs
    const allAlphaIds = new Set<string>();
    attributions.forEach(attr => {
      Object.keys(attr.shapley_values).forEach(id => allAlphaIds.add(id));
    });
    
    // Calculate per-alpha statistics
    const alphaStats: Record<string, any> = {};
    for (const alphaId of allAlphaIds) {
      const alphaPnLs = attributions
        .map(attr => attr.shapley_values[alphaId] || 0)
        .filter(pnl => pnl !== 0);
      
      if (alphaPnLs.length > 0) {
        const totalAlphaPnL = alphaPnLs.reduce((sum, pnl) => sum + pnl, 0);
        const avgAlphaPnL = totalAlphaPnL / alphaPnLs.length;
        const winRate = alphaPnLs.filter(pnl => pnl > 0).length / alphaPnLs.length;
        
        alphaStats[alphaId] = {
          total_pnl: totalAlphaPnL,
          avg_pnl: avgAlphaPnL,
          trade_count: alphaPnLs.length,
          win_rate: winRate,
          contribution_pct: totalPnL !== 0 ? (totalAlphaPnL / totalPnL) * 100 : 0
        };
      }
    }
    
    res.json({
      trade_count: tradeCount,
      total_pnl: totalPnL,
      avg_pnl: avgPnL,
      attribution_coverage: allAlphaIds.size,
      alpha_stats: alphaStats,
      timestamp: new Date()
    });
    
  } catch (error) {
    logger.error('[Report] Error getting attribution summary:', error);
    res.status(500).json({ error: 'Failed to get attribution summary' });
  }
});

/**
 * Generate mock risk metrics for demonstration
 */
function generateMockRiskMetrics(windowDays: number) {
  const annualizedVol = 0.4 + Math.random() * 0.3; // 40-70% annualized vol
  const sharpe = 0.5 + Math.random() * 1.5; // 0.5-2.0 Sharpe
  const maxDrawdown = 0.05 + Math.random() * 0.15; // 5-20% max drawdown
  const var95 = 0.02 + Math.random() * 0.03; // 2-5% daily VaR
  const cvar95 = var95 * 1.3; // CVaR typically 30% higher than VaR
  
  // Scale by window
  const dailyVol = annualizedVol / Math.sqrt(252);
  const periodVol = dailyVol * Math.sqrt(windowDays);
  
  return {
    realized_vol: periodVol,
    sharpe_ratio: sharpe,
    max_drawdown: maxDrawdown,
    var_95: var95,
    cvar_95: cvar95,
    turnover: 0.8 + Math.random() * 0.4, // 80-120% daily turnover
    avg_slippage_bps: 3 + Math.random() * 4, // 3-7 bps avg slippage
    hit_ratio: 0.45 + Math.random() * 0.2, // 45-65% hit ratio
    profit_factor: 1.1 + Math.random() * 0.4, // 1.1-1.5 profit factor
    calmar_ratio: sharpe * 0.7, // Approximate Calmar from Sharpe
    sortino_ratio: sharpe * 1.2 // Approximate Sortino from Sharpe
  };
}

export default router;
