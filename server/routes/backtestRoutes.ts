/**
 * Backtest API Routes
 * Deterministic backtesting endpoints with artifact persistence
 */

import { Router } from 'express';
import { runDeterministicBacktest, BacktestConfig } from '../backtest/deterministic';
import { addProvenance } from '../middleware/provenanceGuard';
import { z } from 'zod';

const router = Router();

const backtestConfigSchema = z.object({
  symbol: z.string().min(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(), 
  initialBalance: z.number().positive().default(10000),
  timeframe: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).default('5m')
});

/**
 * POST /api/backtest/run - Run deterministic backtest
 */
router.post('/run', async (req, res) => {
  try {
    const config = backtestConfigSchema.parse(req.body);
    
    const backtestConfig: BacktestConfig = {
      ...config,
      startTime: new Date(config.startTime),
      endTime: new Date(config.endTime)
    };

    console.log(`[Backtest] Starting ${config.symbol} from ${config.startTime} to ${config.endTime}`);
    
    const result = await runDeterministicBacktest(backtestConfig);
    
    console.log(`[Backtest] Completed ${result.runId}: ${result.totalTrades} trades, ${(result.totalReturn * 100).toFixed(2)}% return`);
    
    res.json(addProvenance(result, { 
      runId: result.runId,
      datasetId: result.datasetId,
      commit: 'deterministic_backtest' 
    }));
    
  } catch (error: any) {
    console.error('[Backtest] Error:', error);
    res.status(500).json({
      error: 'Backtest failed',
      message: error.message,
      provenance: {
        commit: process.env.GIT_COMMIT || 'dev',
        generatedAt: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/backtest/runs - List backtest runs
 */
router.get('/runs', async (req, res) => {
  try {
    const { symbol, limit = 20 } = req.query;
    
    // This would query the backtestRuns table if it existed
    // For now return empty with proper provenance
    const runs: any[] = [];
    
    res.json(addProvenance({ runs, count: runs.length }, { 
      commit: 'backtest_history',
      runId: 'history_query',
      datasetId: 'backtest_runs'
    }));
    
  } catch (error: any) {
    console.error('[Backtest] List error:', error);
    res.status(500).json({
      error: 'Failed to list backtest runs',
      message: error.message,
      provenance: {
        commit: process.env.GIT_COMMIT || 'dev',
        generatedAt: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/backtest/run/:runId - Get backtest run details
 */
router.get('/run/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    
    // This would query the specific run details
    // For now return not found with proper provenance
    res.status(404).json({
      error: 'Run not found',
      runId,
      provenance: {
        commit: process.env.GIT_COMMIT || 'dev',
        generatedAt: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    console.error('[Backtest] Get run error:', error);
    res.status(500).json({
      error: 'Failed to get backtest run',
      message: error.message,
      provenance: {
        commit: process.env.GIT_COMMIT || 'dev',
        generatedAt: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/backtest/history - Alternative endpoint for training page compatibility
 */
router.get('/history', async (req, res) => {
  try {
    // Return empty backtest data in the format expected by the training page
    const backtests: any[] = [];
    
    res.json({
      success: true,
      data: backtests,
      count: backtests.length,
      provenance: {
        commit: process.env.GIT_COMMIT || 'dev',
        generatedAt: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    console.error('[Backtest] History error:', error);
    res.status(500).json({
      error: 'Failed to get backtest history',
      message: error.message,
      provenance: {
        commit: process.env.GIT_COMMIT || 'dev',
        generatedAt: new Date().toISOString()
      }
    });
  }
});

export default router;