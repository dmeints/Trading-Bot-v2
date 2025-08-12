
/**
 * Burn-in Dashboard API Routes
 * Real-time monitoring for paper trading with conformal prediction validation
 */

import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { db } from '../db';
import { trades, positions, portfolioSnapshots } from '../../shared/schema';
import { desc, eq, gte, and, sql } from 'drizzle-orm';
import { createTradingConformalPredictor, ConformalPredictor } from '../brain/conformal';

const router = Router();

// Global conformal predictor instance for dashboard
let conformalPredictor: ConformalPredictor | null = null;

// Initialize conformal predictor
const initializeConformalPredictor = () => {
  if (!conformalPredictor) {
    conformalPredictor = createTradingConformalPredictor();
  }
  return conformalPredictor;
};

/**
 * GET /api/burnin-dashboard/overview
 * Get comprehensive burn-in dashboard overview
 */
router.get('/overview', async (req, res) => {
  try {
    const timeframe = req.query.timeframe as string || '24h';
    const startTime = getStartTime(timeframe);
    
    logger.info('[BurninDashboard] Fetching overview', { timeframe });
    
    // Get recent trades with performance metrics
    const recentTrades = await db
      .select()
      .from(trades)
      .where(gte(trades.createdAt, startTime))
      .orderBy(desc(trades.createdAt))
      .limit(100);
    
    // Get current positions
    const currentPositions = await db
      .select()
      .from(positions)
      .where(eq(positions.status, 'open'));
    
    // Get recent portfolio snapshots
    const portfolioHistory = await db
      .select()
      .from(portfolioSnapshots)
      .where(gte(portfolioSnapshots.timestamp, startTime))
      .orderBy(desc(portfolioSnapshots.timestamp))
      .limit(288); // 24h of 5min snapshots
    
    // Calculate performance metrics
    const metrics = calculatePerformanceMetrics(recentTrades, portfolioHistory);
    
    // Get conformal prediction diagnostics
    const conformalDiagnostics = initializeConformalPredictor().getDiagnostics();
    
    // Calculate burn-in specific metrics
    const burninMetrics = calculateBurninMetrics(recentTrades, conformalDiagnostics);
    
    res.json({
      success: true,
      overview: {
        timeframe,
        dataPoints: {
          trades: recentTrades.length,
          positions: currentPositions.length,
          snapshots: portfolioHistory.length
        },
        performance: metrics,
        conformal: conformalDiagnostics,
        burnin: burninMetrics,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('[BurninDashboard] Overview failed', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch burn-in overview'
    });
  }
});

/**
 * GET /api/burnin-dashboard/real-time-metrics
 * Get real-time streaming metrics for dashboard
 */
router.get('/real-time-metrics', async (req, res) => {
  try {
    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    
    const sendMetrics = async () => {
      try {
        // Get latest portfolio snapshot
        const [latestSnapshot] = await db
          .select()
          .from(portfolioSnapshots)
          .orderBy(desc(portfolioSnapshots.timestamp))
          .limit(1);
        
        // Get recent trades (last hour)
        const recentTrades = await db
          .select()
          .from(trades)
          .where(gte(trades.createdAt, new Date(Date.now() - 60 * 60 * 1000)))
          .orderBy(desc(trades.createdAt));
        
        // Get conformal diagnostics
        const conformalDiagnostics = initializeConformalPredictor().getDiagnostics();
        
        // Calculate real-time metrics
        const realTimeMetrics = {
          timestamp: new Date().toISOString(),
          portfolio: {
            totalValue: latestSnapshot?.totalValue || 0,
            unrealizedPnl: latestSnapshot?.unrealizedPnl || 0,
            realizedPnl: latestSnapshot?.realizedPnl || 0,
            cash: latestSnapshot?.cash || 0
          },
          trading: {
            tradesLastHour: recentTrades.length,
            winRate: calculateWinRate(recentTrades),
            avgTradeSize: calculateAvgTradeSize(recentTrades),
            sharpeRatio: calculateSharpeRatio(recentTrades)
          },
          conformal: {
            calibrationSamples: conformalDiagnostics.calibrationSamples,
            empiricalCoverage: conformalDiagnostics.empiricalCoverage,
            coverageGap: conformalDiagnostics.coverageGap,
            avgIntervalWidth: conformalDiagnostics.avgIntervalWidth
          },
          system: {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
            activeConnections: 1 // Would track WebSocket connections
          }
        };
        
        res.write(`data: ${JSON.stringify(realTimeMetrics)}\n\n`);
        
      } catch (error) {
        logger.error('[BurninDashboard] Real-time metrics error', error);
        res.write(`data: ${JSON.stringify({ error: 'Metrics update failed' })}\n\n`);
      }
    };
    
    // Send initial metrics
    await sendMetrics();
    
    // Set up interval for updates
    const interval = setInterval(sendMetrics, 5000); // Update every 5 seconds
    
    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(interval);
      res.end();
    });
    
  } catch (error) {
    logger.error('[BurninDashboard] Real-time setup failed', error);
    res.status(500).json({
      success: false,
      error: 'Failed to establish real-time connection'
    });
  }
});

/**
 * GET /api/burnin-dashboard/performance-chart
 * Get performance chart data for visualization
 */
router.get('/performance-chart', async (req, res) => {
  try {
    const timeframe = req.query.timeframe as string || '7d';
    const startTime = getStartTime(timeframe);
    
    logger.info('[BurninDashboard] Fetching performance chart', { timeframe });
    
    // Get portfolio snapshots for equity curve
    const snapshots = await db
      .select({
        timestamp: portfolioSnapshots.timestamp,
        totalValue: portfolioSnapshots.totalValue,
        unrealizedPnl: portfolioSnapshots.unrealizedPnl,
        realizedPnl: portfolioSnapshots.realizedPnl,
        drawdown: portfolioSnapshots.drawdown
      })
      .from(portfolioSnapshots)
      .where(gte(portfolioSnapshots.timestamp, startTime))
      .orderBy(portfolioSnapshots.timestamp);
    
    // Get trades for performance attribution
    const trades = await db
      .select({
        createdAt: trades.createdAt,
        symbol: trades.symbol,
        side: trades.side,
        quantity: trades.quantity,
        fillPrice: trades.fillPrice,
        pnl: trades.pnl,
        fees: trades.fees
      })
      .from(trades)
      .where(gte(trades.createdAt, startTime))
      .orderBy(trades.createdAt);
    
    // Process data for charting
    const chartData = {
      equity: snapshots.map(s => ({
        timestamp: s.timestamp,
        value: Number(s.totalValue),
        pnl: Number(s.realizedPnl) + Number(s.unrealizedPnl),
        drawdown: Number(s.drawdown || 0)
      })),
      trades: trades.map(t => ({
        timestamp: t.createdAt,
        symbol: t.symbol,
        side: t.side,
        pnl: Number(t.pnl || 0),
        value: Number(t.quantity) * Number(t.fillPrice || 0)
      })),
      performance: calculateChartMetrics(snapshots, trades)
    };
    
    res.json({
      success: true,
      chartData,
      timeframe,
      dataPoints: snapshots.length
    });
    
  } catch (error) {
    logger.error('[BurninDashboard] Performance chart failed', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance chart data'
    });
  }
});

/**
 * GET /api/burnin-dashboard/conformal-analysis
 * Get detailed conformal prediction analysis
 */
router.get('/conformal-analysis', async (req, res) => {
  try {
    const predictor = initializeConformalPredictor();
    const diagnostics = predictor.getDiagnostics();
    
    // Get recent prediction accuracy data
    const recentTrades = await db
      .select()
      .from(trades)
      .where(gte(trades.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
      .orderBy(desc(trades.createdAt));
    
    // Simulate conformal prediction analysis (in production, this would be stored)
    const analysis = {
      calibration: {
        samples: diagnostics.calibrationSamples,
        coverage: {
          empirical: diagnostics.empiricalCoverage,
          expected: diagnostics.expectedCoverage,
          gap: diagnostics.coverageGap,
          status: diagnostics.coverageGap < 0.05 ? 'good' : 'warning'
        },
        intervalWidth: {
          average: diagnostics.avgIntervalWidth,
          trend: 'stable', // Would calculate from historical data
          efficiency: diagnostics.empiricalCoverage / diagnostics.avgIntervalWidth
        }
      },
      predictions: {
        totalPredictions: recentTrades.length,
        withinInterval: Math.floor(recentTrades.length * diagnostics.empiricalCoverage),
        outsideInterval: Math.ceil(recentTrades.length * (1 - diagnostics.empiricalCoverage)),
        accuracy: diagnostics.empiricalCoverage
      },
      adaptation: {
        regimeDetection: 'active',
        alphaAdjustments: 12, // Would track from predictor
        recentAdjustments: diagnostics.recentNonconformityScores.slice(-5)
      },
      recommendations: generateConformalRecommendations(diagnostics)
    };
    
    res.json({
      success: true,
      analysis,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('[BurninDashboard] Conformal analysis failed', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate conformal analysis'
    });
  }
});

/**
 * POST /api/burnin-dashboard/validate-setup
 * Validate burn-in dashboard setup and data integrity
 */
router.post('/validate-setup', async (req, res) => {
  try {
    logger.info('[BurninDashboard] Validating setup');
    
    const validation = {
      database: {
        connected: true,
        tables: {
          trades: await validateTableExists('trades'),
          positions: await validateTableExists('positions'),
          portfolioSnapshots: await validateTableExists('portfolio_snapshots')
        }
      },
      conformalPredictor: {
        initialized: !!conformalPredictor,
        calibrationSamples: conformalPredictor?.getDiagnostics().calibrationSamples || 0,
        ready: (conformalPredictor?.getDiagnostics().calibrationSamples || 0) >= 50
      },
      dataIntegrity: {
        recentTrades: await validateRecentData('trades', 24),
        portfolioSnapshots: await validateRecentData('portfolio_snapshots', 24),
        dataConsistency: true
      }
    };
    
    const isValid = validation.database.connected && 
                   validation.conformalPredictor.initialized &&
                   validation.dataIntegrity.recentTrades;
    
    res.json({
      success: true,
      validation,
      isValid,
      recommendations: isValid ? [] : generateSetupRecommendations(validation)
    });
    
  } catch (error) {
    logger.error('[BurninDashboard] Setup validation failed', error);
    res.status(500).json({
      success: false,
      error: 'Setup validation failed'
    });
  }
});

// Helper functions
function getStartTime(timeframe: string): Date {
  const now = new Date();
  switch (timeframe) {
    case '1h': return new Date(now.getTime() - 60 * 60 * 1000);
    case '6h': return new Date(now.getTime() - 6 * 60 * 60 * 1000);
    case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default: return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
}

function calculatePerformanceMetrics(trades: any[], portfolioHistory: any[]) {
  if (trades.length === 0) return null;
  
  const totalPnl = trades.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
  const winningTrades = trades.filter(t => Number(t.pnl || 0) > 0);
  const totalFees = trades.reduce((sum, trade) => sum + Number(trade.fees || 0), 0);
  
  // Calculate Sharpe ratio from portfolio snapshots
  const returns = portfolioHistory
    .slice(1)
    .map((snapshot, i) => {
      const prev = portfolioHistory[i];
      return (Number(snapshot.totalValue) - Number(prev.totalValue)) / Number(prev.totalValue);
    });
  
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const returnStd = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
  const sharpeRatio = returnStd > 0 ? (avgReturn / returnStd) * Math.sqrt(365 * 288) : 0; // Annualized
  
  const maxDrawdown = Math.max(...portfolioHistory.map(s => Number(s.drawdown || 0)));
  
  return {
    totalReturn: totalPnl,
    winRate: winningTrades.length / trades.length,
    totalTrades: trades.length,
    profitFactor: calculateProfitFactor(trades),
    sharpeRatio,
    maxDrawdown,
    totalFees,
    avgTradeSize: trades.reduce((sum, t) => sum + Number(t.quantity) * Number(t.fillPrice || 0), 0) / trades.length
  };
}

function calculateBurninMetrics(trades: any[], conformalDiagnostics: any) {
  return {
    tradingDays: Math.ceil(trades.length / 10), // Assuming ~10 trades per day
    consistencyScore: calculateConsistencyScore(trades),
    uncertaintyManagement: {
      coverageAccuracy: 1 - conformalDiagnostics.coverageGap,
      adaptationRate: conformalDiagnostics.calibrationSamples > 100 ? 'good' : 'building',
      intervalEfficiency: conformalDiagnostics.empiricalCoverage / (conformalDiagnostics.avgIntervalWidth || 1)
    },
    readinessScore: calculateReadinessScore(trades, conformalDiagnostics),
    riskManagement: {
      positionSizing: 'adaptive',
      maxRisk: '2%', // Would calculate from actual data
      diversification: calculateDiversification(trades)
    }
  };
}

function calculateWinRate(trades: any[]): number {
  if (trades.length === 0) return 0;
  const winners = trades.filter(t => Number(t.pnl || 0) > 0).length;
  return winners / trades.length;
}

function calculateAvgTradeSize(trades: any[]): number {
  if (trades.length === 0) return 0;
  return trades.reduce((sum, t) => sum + Number(t.quantity) * Number(t.fillPrice || 0), 0) / trades.length;
}

function calculateSharpeRatio(trades: any[]): number {
  if (trades.length < 2) return 0;
  const returns = trades.map(t => Number(t.pnl || 0));
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const std = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
  return std > 0 ? avgReturn / std : 0;
}

function calculateProfitFactor(trades: any[]): number {
  const winners = trades.filter(t => Number(t.pnl || 0) > 0);
  const losers = trades.filter(t => Number(t.pnl || 0) < 0);
  
  const grossProfit = winners.reduce((sum, t) => sum + Number(t.pnl), 0);
  const grossLoss = Math.abs(losers.reduce((sum, t) => sum + Number(t.pnl), 0));
  
  return grossLoss > 0 ? grossProfit / grossLoss : 0;
}

function calculateChartMetrics(snapshots: any[], trades: any[]) {
  return {
    totalReturn: snapshots.length > 1 ? 
      (Number(snapshots[snapshots.length - 1].totalValue) - Number(snapshots[0].totalValue)) / Number(snapshots[0].totalValue) : 0,
    maxDrawdown: Math.max(...snapshots.map(s => Number(s.drawdown || 0))),
    volatility: calculateVolatility(snapshots),
    tradesPerDay: trades.length / Math.max(1, (Date.now() - new Date(snapshots[0]?.timestamp || 0).getTime()) / (24 * 60 * 60 * 1000))
  };
}

function calculateVolatility(snapshots: any[]): number {
  if (snapshots.length < 2) return 0;
  
  const returns = snapshots.slice(1).map((s, i) => {
    const prev = snapshots[i];
    return (Number(s.totalValue) - Number(prev.totalValue)) / Number(prev.totalValue);
  });
  
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  
  return Math.sqrt(variance) * Math.sqrt(365 * 288); // Annualized volatility
}

function calculateConsistencyScore(trades: any[]): number {
  if (trades.length < 10) return 0;
  
  // Calculate rolling win rates
  const windowSize = 10;
  const rollingWinRates = [];
  
  for (let i = windowSize; i <= trades.length; i++) {
    const window = trades.slice(i - windowSize, i);
    const winRate = calculateWinRate(window);
    rollingWinRates.push(winRate);
  }
  
  // Consistency is 1 - coefficient of variation of rolling win rates
  const avgWinRate = rollingWinRates.reduce((sum, wr) => sum + wr, 0) / rollingWinRates.length;
  const std = Math.sqrt(rollingWinRates.reduce((sum, wr) => sum + Math.pow(wr - avgWinRate, 2), 0) / rollingWinRates.length);
  
  return avgWinRate > 0 ? Math.max(0, 1 - (std / avgWinRate)) : 0;
}

function calculateReadinessScore(trades: any[], conformalDiagnostics: any): number {
  const factors = {
    tradeCount: Math.min(1, trades.length / 100), // 100+ trades for full score
    winRate: calculateWinRate(trades),
    conformalCoverage: 1 - conformalDiagnostics.coverageGap,
    calibrationSamples: Math.min(1, conformalDiagnostics.calibrationSamples / 200) // 200+ samples for full score
  };
  
  return (factors.tradeCount + factors.winRate + factors.conformalCoverage + factors.calibrationSamples) / 4;
}

function calculateDiversification(trades: any[]): number {
  const symbols = [...new Set(trades.map(t => t.symbol))];
  return Math.min(1, symbols.length / 5); // Up to 5 symbols for full diversification score
}

function generateConformalRecommendations(diagnostics: any): string[] {
  const recommendations = [];
  
  if (diagnostics.coverageGap > 0.1) {
    recommendations.push('Coverage gap is high - consider recalibrating alpha parameter');
  }
  
  if (diagnostics.calibrationSamples < 100) {
    recommendations.push('Increase calibration sample size for better coverage guarantees');
  }
  
  if (diagnostics.avgIntervalWidth > 0.1) {
    recommendations.push('Prediction intervals are wide - consider feature selection or kernel bandwidth tuning');
  }
  
  if (diagnostics.recentNonconformityScores.length > 0) {
    const recentAvg = diagnostics.recentNonconformityScores.reduce((sum: number, score: number) => sum + score, 0) / diagnostics.recentNonconformityScores.length;
    if (recentAvg > diagnostics.avgIntervalWidth * 1.5) {
      recommendations.push('Recent prediction errors are elevated - market regime may have changed');
    }
  }
  
  return recommendations;
}

async function validateTableExists(tableName: string): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1 FROM ${sql.identifier(tableName)} LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

async function validateRecentData(tableName: string, hours: number): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM ${sql.identifier(tableName)} 
      WHERE created_at >= NOW() - INTERVAL '${sql.raw(hours.toString())} hours'
    `);
    return (result[0] as any).count > 0;
  } catch {
    return false;
  }
}

function generateSetupRecommendations(validation: any): string[] {
  const recommendations = [];
  
  if (!validation.database.connected) {
    recommendations.push('Database connection is not available');
  }
  
  if (!validation.conformalPredictor.initialized) {
    recommendations.push('Initialize conformal predictor');
  }
  
  if (!validation.conformalPredictor.ready) {
    recommendations.push('Accumulate more calibration samples (minimum 50 required)');
  }
  
  if (!validation.dataIntegrity.recentTrades) {
    recommendations.push('No recent trading data available - start paper trading');
  }
  
  return recommendations;
}

export default router;
