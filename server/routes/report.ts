
/**
 * Attribution & Risk Reporting API Routes
 */

import { Router } from 'express';
import { alphaRegistry } from '../services/alpha/Registry';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/report/alpha-pnl?window=7d
 * Get per-alpha PnL contribution over time window
 */
router.get('/alpha-pnl', (req, res) => {
  try {
    const windowParam = req.query.window as string || '7d';
    const windowDays = parseWindowDays(windowParam);
    
    const alphaPnL = alphaRegistry.getAlphaPnL(windowDays);
    
    // Sort by absolute PnL contribution
    const sortedAlphas = Object.entries(alphaPnL)
      .map(([alphaId, pnl]) => ({ alphaId, pnl }))
      .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));

    const totalPnL = Object.values(alphaPnL).reduce((sum, pnl) => sum + pnl, 0);
    
    res.json({
      window: windowParam,
      windowDays,
      totalPnL,
      alphaContributions: sortedAlphas,
      topPerformers: sortedAlphas.filter(a => a.pnl > 0).slice(0, 5),
      worstPerformers: sortedAlphas.filter(a => a.pnl < 0).slice(0, 5),
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('[Report] Error getting alpha PnL:', error);
    res.status(500).json({ error: 'Failed to get alpha PnL report' });
  }
});

/**
 * GET /api/report/risk?window=7d
 * Get realized risk metrics over time window
 */
router.get('/risk', (req, res) => {
  try {
    const windowParam = req.query.window as string || '7d';
    const windowDays = parseWindowDays(windowParam);
    
    // Generate mock risk metrics (in real system would come from trade logs)
    const riskMetrics = generateMockRiskMetrics(windowDays);
    
    res.json({
      window: windowParam,
      windowDays,
      ...riskMetrics,
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('[Report] Error getting risk report:', error);
    res.status(500).json({ error: 'Failed to get risk report' });
  }
});

/**
 * GET /api/report/performance?window=30d
 * Get comprehensive performance report
 */
router.get('/performance', (req, res) => {
  try {
    const windowParam = req.query.window as string || '30d';
    const windowDays = parseWindowDays(windowParam);
    
    const alphaPnL = alphaRegistry.getAlphaPnL(windowDays);
    const riskMetrics = generateMockRiskMetrics(windowDays);
    
    const performance = {
      window: windowParam,
      windowDays,
      alpha: {
        totalPnL: Object.values(alphaPnL).reduce((sum, pnl) => sum + pnl, 0),
        alphaCount: Object.keys(alphaPnL).length,
        sharpeRatio: riskMetrics.sharpeRatio,
        informationRatio: riskMetrics.informationRatio
      },
      risk: riskMetrics,
      execution: {
        avgSlippage: riskMetrics.avgSlippage,
        turnover: riskMetrics.turnover,
        fillRate: 0.98
      },
      timestamp: new Date()
    };
    
    res.json(performance);

  } catch (error) {
    logger.error('[Report] Error getting performance report:', error);
    res.status(500).json({ error: 'Failed to get performance report' });
  }
});

/**
 * Parse window parameter into days
 */
function parseWindowDays(windowParam: string): number {
  const match = windowParam.match(/(\d+)([dwmy])/);
  if (!match) return 7; // Default 7 days

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'd': return value;
    case 'w': return value * 7;
    case 'm': return value * 30;
    case 'y': return value * 365;
    default: return value;
  }
}

/**
 * Generate mock risk metrics (replace with real calculation)
 */
function generateMockRiskMetrics(windowDays: number) {
  const baseVol = 0.02; // 2% daily volatility
  const scaleFactor = Math.sqrt(windowDays);
  
  return {
    realizedVolatility: baseVol * scaleFactor * (0.8 + Math.random() * 0.4),
    cvar95: -0.15 * Math.sqrt(windowDays / 365), // 95% CVaR
    cvar99: -0.25 * Math.sqrt(windowDays / 365), // 99% CVaR
    maxDrawdown: 0.08 * Math.sqrt(windowDays / 365),
    sharpeRatio: 0.8 + Math.random() * 0.6,
    informationRatio: 0.5 + Math.random() * 0.4,
    avgSlippage: 2.5 + Math.random() * 2, // bps
    turnover: 1.2 + Math.random() * 0.8, // daily turnover
    tradingDays: Math.min(windowDays, windowDays * 0.7), // Assume 70% trading days
    totalTrades: Math.floor(windowDays * 15 * Math.random()), // ~15 trades per day
    winRate: 0.52 + Math.random() * 0.16, // 52-68% win rate
    profitFactor: 1.1 + Math.random() * 0.4 // PF > 1.0
  };
}

export default router;
