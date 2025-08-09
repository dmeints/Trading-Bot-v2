/**
 * Real Stevie Algorithm Benchmark Routes
 * Endpoints for testing actual trading performance vs UI fluff
 */

import { Router } from 'express';
import { stevieRealBenchmark } from '../services/stevieRealBenchmark';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Run real algorithm benchmark test
 */
router.post('/run-real-benchmark', async (req, res) => {
  try {
    const { 
      version = 'current',
      testPeriodDays = 30,
      initialCapital = 10000,
      symbols = ['BTC/USD', 'ETH/USD'],
      compareToVersion 
    } = req.body;

    logger.info('[RealBenchmark] Starting real algorithm test', {
      version,
      testPeriodDays,
      compareToVersion
    });

    const result = await stevieRealBenchmark.runRealAlgorithmBenchmark({
      version,
      testPeriodDays,
      initialCapital,
      symbols,
      compareToVersion
    });

    res.json({
      success: true,
      data: result,
      summary: {
        version: result.version,
        cashReserveScore: result.cashReserveGrowthScore,
        totalReturn: result.algorithmPerformance.totalReturn,
        sharpeRatio: result.algorithmPerformance.sharpeRatio,
        winRate: result.algorithmPerformance.winRate,
        maxDrawdown: result.algorithmPerformance.maxDrawdown,
        recommendations: result.recommendations
      }
    });

  } catch (error: any) {
    logger.error('[RealBenchmark] Test failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get benchmark history for version comparison
 */
router.get('/history', async (req, res) => {
  try {
    // Implementation to fetch previous benchmark results
    res.json({
      success: true,
      data: [],
      message: 'Benchmark history endpoint - to be implemented'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Compare two Stevie versions directly
 */
router.post('/compare-versions', async (req, res) => {
  try {
    const { version1, version2, testConfig } = req.body;
    
    // Run benchmark on both versions and compare
    const comparison = {
      version1Results: await stevieRealBenchmark.runRealAlgorithmBenchmark({
        ...testConfig,
        version: version1
      }),
      version2Results: await stevieRealBenchmark.runRealAlgorithmBenchmark({
        ...testConfig, 
        version: version2
      })
    };

    res.json({
      success: true,
      data: comparison
    });

  } catch (error: any) {
    logger.error('[RealBenchmark] Version comparison failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export { router as realBenchmarkRoutes };