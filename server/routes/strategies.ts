import { Router } from 'express';
import { logger } from '../utils/logger.js';

const strategiesRouter = Router();

// Import strategy services dynamically
let strategyEngine: any = null;
let riskManager: any = null;
let portfolioOptimizer: any = null;

async function initializeServices() {
  if (!strategyEngine) {
    try {
      const { StrategyEngine } = await import('../services/StrategyEngine.js');
      const { RiskManager } = await import('../services/RiskManager.js');
      const { PortfolioOptimizer } = await import('../services/PortfolioOptimizer.js');
      
      // Get exchange service if available
      let exchangeService = null;
      try {
        const exchangeModule = await import('../services/ExchangeService.js');
        exchangeService = exchangeModule.exchangeService;
        logger.info('[Strategies] Exchange service loaded successfully');
      } catch (error) {
        logger.warn('[Strategies] Exchange service not available, using mock', { error: String(error) });
      }

      strategyEngine = new StrategyEngine(exchangeService);
      riskManager = new RiskManager();
      portfolioOptimizer = new PortfolioOptimizer();
      
      logger.info('[Strategies] All services initialized successfully');
    } catch (error) {
      logger.error('[Strategies] Failed to initialize services:', { error: String(error) });
      throw error;
    }
  }
}

/**
 * GET /api/strategies/active
 * Get currently active trading strategies
 */
strategiesRouter.get('/active', async (req, res) => {
  try {
    await initializeServices();
    
    const activeStrategies = await strategyEngine.getActiveStrategies();
    
    res.json({
      success: true,
      data: {
        strategies: activeStrategies,
        count: activeStrategies.length,
        totalWeight: activeStrategies.reduce((sum: number, s: any) => sum + s.weight, 0)
      }
    });

  } catch (error) {
    logger.error('[Strategies] Error fetching active strategies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active strategies'
    });
  }
});

/**
 * GET /api/strategies/trading
 * Get all available trading strategies
 */
strategiesRouter.get('/trading', async (req, res) => {
  try {
    await initializeServices();
    
    const allStrategies = await strategyEngine.getAllStrategies();
    
    res.json({
      success: true,
      data: {
        strategies: allStrategies,
        summary: {
          total: allStrategies.length,
          active: allStrategies.filter((s: any) => s.active).length,
          totalPerformance: allStrategies.reduce((sum: number, s: any) => sum + s.performance.totalReturn, 0)
        }
      }
    });

  } catch (error) {
    logger.error('[Strategies] Error fetching all strategies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch strategies'
    });
  }
});

/**
 * GET /api/strategies/performance/:strategyId
 * Get performance metrics for a specific strategy
 */
strategiesRouter.get('/performance/:strategyId', async (req, res) => {
  try {
    await initializeServices();
    
    const { strategyId } = req.params;
    const performance = await strategyEngine.getStrategyPerformance(strategyId);
    
    if (!performance) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found'
      });
    }

    res.json({
      success: true,
      data: {
        strategy: performance,
        metrics: {
          riskAdjustedReturn: performance.performance.totalReturn / Math.max(performance.performance.maxDrawdown, 0.01),
          profitFactor: performance.performance.winRate / (1 - performance.performance.winRate),
          expectedValue: performance.performance.avgReturn * performance.performance.winRate
        }
      }
    });

  } catch (error) {
    logger.error('[Strategies] Error fetching strategy performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch strategy performance'
    });
  }
});

/**
 * POST /api/strategies/toggle
 * Toggle strategy active status
 */
strategiesRouter.post('/toggle', async (req, res) => {
  try {
    await initializeServices();
    
    const { strategyId, active } = req.body;
    
    if (!strategyId || typeof active !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Strategy ID and active status are required'
      });
    }

    const result = await strategyEngine.toggleStrategy(strategyId, active);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found'
      });
    }

    res.json({
      success: true,
      data: {
        strategyId,
        active,
        message: `Strategy ${active ? 'activated' : 'deactivated'} successfully`
      }
    });

  } catch (error) {
    logger.error('[Strategies] Error toggling strategy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle strategy'
    });
  }
});

/**
 * POST /api/strategies/weights
 * Update strategy allocation weights
 */
strategiesRouter.post('/weights', async (req, res) => {
  try {
    await initializeServices();
    
    const { weights } = req.body;
    
    if (!weights || typeof weights !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Weights object is required'
      });
    }

    // Validate weights sum to 1.0 or less
    const totalWeight = Object.values(weights).reduce((sum: number, weight: any) => sum + weight, 0);
    if (totalWeight > 1.0) {
      return res.status(400).json({
        success: false,
        error: 'Total weights cannot exceed 100%'
      });
    }

    const results = [];
    for (const [strategyId, weight] of Object.entries(weights)) {
      const result = await strategyEngine.updateStrategyWeight(strategyId, weight);
      results.push({ strategyId, weight, success: result });
    }

    res.json({
      success: true,
      data: {
        results,
        totalWeight,
        message: 'Strategy weights updated successfully'
      }
    });

  } catch (error) {
    logger.error('[Strategies] Error updating strategy weights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update strategy weights'
    });
  }
});

/**
 * GET /api/strategies/signals
 * Get current trading signals from all strategies
 */
strategiesRouter.get('/signals', async (req, res) => {
  try {
    await initializeServices();
    
    const limit = parseInt(req.query.limit as string) || 10;
    const signals = await strategyEngine.getCurrentSignals(limit);
    
    res.json({
      success: true,
      data: {
        signals,
        summary: {
          total: signals.length,
          buy: signals.filter((s: any) => s.type === 'BUY').length,
          sell: signals.filter((s: any) => s.type === 'SELL').length,
          hold: signals.filter((s: any) => s.type === 'HOLD').length,
          averageConfidence: signals.reduce((sum: number, s: any) => sum + s.confidence, 0) / signals.length || 0
        }
      }
    });

  } catch (error) {
    logger.error('[Strategies] Error fetching signals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trading signals'
    });
  }
});

/**
 * POST /api/strategies/process-market-data
 * Process market data and generate new signals
 */
strategiesRouter.post('/process-market-data', async (req, res) => {
  try {
    await initializeServices();
    
    const { marketData } = req.body;
    
    if (!marketData) {
      return res.status(400).json({
        success: false,
        error: 'Market data is required'
      });
    }

    const signals = await strategyEngine.processMarketData(marketData);
    
    res.json({
      success: true,
      data: {
        signals,
        processed: true,
        timestamp: new Date().toISOString(),
        signalCount: signals.length
      }
    });

  } catch (error) {
    logger.error('[Strategies] Error processing market data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process market data'
    });
  }
});

/**
 * GET /api/strategies/risk-metrics
 * Get current risk management metrics
 */
strategiesRouter.get('/risk-metrics', async (req, res) => {
  try {
    await initializeServices();
    
    const riskMetrics = await riskManager.getRiskMetrics();
    
    res.json({
      success: true,
      data: riskMetrics
    });

  } catch (error) {
    logger.error('[Strategies] Error fetching risk metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch risk metrics'
    });
  }
});

/**
 * GET /api/strategies/portfolio-optimization
 * Get portfolio optimization recommendations
 */
strategiesRouter.get('/portfolio-optimization', async (req, res) => {
  try {
    await initializeServices();
    
    const riskTarget = parseFloat(req.query.riskTarget as string);
    
    // Mock expected returns for demonstration
    const expectedReturns = new Map([
      ['BTC', 0.25],
      ['ETH', 0.30],
      ['SOL', 0.40],
      ['ADA', 0.20]
    ]);

    const optimization = await portfolioOptimizer.optimizePortfolio(expectedReturns, riskTarget);
    const diversificationMetrics = await portfolioOptimizer.getDiversificationMetrics();
    
    res.json({
      success: true,
      data: {
        optimization: {
          ...optimization,
          optimalWeights: Object.fromEntries(optimization.optimalWeights)
        },
        diversification: diversificationMetrics,
        recommendation: {
          action: optimization.sharpeRatio > 1.0 ? 'rebalance' : 'maintain',
          reason: optimization.sharpeRatio > 1.0 ? 
            'High Sharpe ratio indicates good risk-adjusted returns' : 
            'Current allocation appears reasonable'
        }
      }
    });

  } catch (error) {
    logger.error('[Strategies] Error fetching portfolio optimization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch portfolio optimization'
    });
  }
});

export { strategiesRouter };