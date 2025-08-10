import { Router } from 'express';
import { logger } from '../utils/logger.js';

const portfolioRouter = Router();

// Import portfolio manager service dynamically
let portfolioManager: any = null;

async function initializePortfolioManager() {
  if (!portfolioManager) {
    try {
      const { PortfolioManager } = await import('../services/PortfolioManager.js');
      portfolioManager = new PortfolioManager();
      logger.info('[Portfolio] PortfolioManager service initialized');
    } catch (error) {
      logger.error('[Portfolio] Failed to initialize PortfolioManager:', error);
      throw error;
    }
  }
}

/**
 * GET /api/portfolio/assets
 * Get available asset universe for portfolio construction
 */
portfolioRouter.get('/assets', async (req, res) => {
  try {
    await initializePortfolioManager();
    
    const assets = portfolioManager.getAssetUniverse();
    
    res.json({
      success: true,
      data: {
        assets,
        summary: {
          total: assets.length,
          sectors: [...new Set(assets.map((a: any) => a.sector))],
          totalMarketCap: assets.reduce((sum: number, a: any) => sum + a.marketCap, 0)
        }
      }
    });

  } catch (error) {
    logger.error('[Portfolio] Error getting asset universe:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get asset universe'
    });
  }
});

/**
 * POST /api/portfolio/create
 * Create a new optimized portfolio
 */
portfolioRouter.post('/create', async (req, res) => {
  try {
    await initializePortfolioManager();
    
    const {
      id,
      name,
      strategy = 'mean_variance',
      assets,
      constraints = {
        minWeight: 0.05,
        maxWeight: 0.5,
        maxSectorWeight: 0.6
      },
      rebalanceFrequency = 'monthly',
      rebalanceThreshold = 0.05,
      initialValue = 100000
    } = req.body;

    if (!id || !name || !assets || !Array.isArray(assets) || assets.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Portfolio ID, name, and assets array are required'
      });
    }

    if (!['mean_variance', 'risk_parity', 'black_litterman', 'equal_weight'].includes(strategy)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid strategy. Supported: mean_variance, risk_parity, black_litterman, equal_weight'
      });
    }

    const config = {
      id,
      name,
      strategy,
      assets,
      constraints,
      rebalanceFrequency,
      rebalanceThreshold
    };

    const portfolioId = await portfolioManager.createPortfolio(config, initialValue);

    res.json({
      success: true,
      data: {
        portfolioId,
        message: 'Portfolio created successfully'
      }
    });

  } catch (error) {
    logger.error('[Portfolio] Error creating portfolio:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create portfolio'
    });
  }
});

/**
 * GET /api/portfolio/list
 * Get all portfolios with summary information
 */
portfolioRouter.get('/list', async (req, res) => {
  try {
    await initializePortfolioManager();
    
    const portfolios = portfolioManager.getAllPortfolios();
    
    const summary = {
      totalPortfolios: portfolios.length,
      totalValue: portfolios.reduce((sum: number, p: any) => sum + p.value, 0),
      strategies: portfolios.reduce((acc: Record<string, number>, p: any) => {
        acc[p.config.strategy] = (acc[p.config.strategy] || 0) + 1;
        return acc;
      }, {}),
      avgReturn: portfolios.length > 0 ? 
        portfolios.reduce((sum: number, p: any) => sum + p.performance.totalReturn, 0) / portfolios.length : 0
    };

    res.json({
      success: true,
      data: {
        portfolios: portfolios.map((p: any) => ({
          id: p.id,
          name: p.config.name,
          strategy: p.config.strategy,
          value: p.value,
          performance: p.performance,
          lastRebalance: p.lastRebalance,
          nextRebalance: p.nextRebalance,
          assetCount: p.config.assets.length
        })),
        summary
      }
    });

  } catch (error) {
    logger.error('[Portfolio] Error getting portfolios:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get portfolios'
    });
  }
});

/**
 * GET /api/portfolio/:portfolioId
 * Get detailed portfolio information
 */
portfolioRouter.get('/:portfolioId', async (req, res) => {
  try {
    await initializePortfolioManager();
    
    const { portfolioId } = req.params;
    const portfolio = portfolioManager.getPortfolio(portfolioId);
    
    if (!portfolio) {
      return res.status(404).json({
        success: false,
        error: 'Portfolio not found'
      });
    }

    res.json({
      success: true,
      data: portfolio
    });

  } catch (error) {
    logger.error('[Portfolio] Error getting portfolio:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get portfolio'
    });
  }
});

/**
 * POST /api/portfolio/optimize
 * Run portfolio optimization for given configuration
 */
portfolioRouter.post('/optimize', async (req, res) => {
  try {
    await initializePortfolioManager();
    
    const {
      strategy = 'mean_variance',
      assets,
      constraints = {
        minWeight: 0.05,
        maxWeight: 0.5,
        maxSectorWeight: 0.6
      }
    } = req.body;

    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Assets array is required'
      });
    }

    const config = {
      id: 'temp_optimization',
      name: 'Temporary Optimization',
      strategy,
      assets,
      constraints,
      rebalanceFrequency: 'monthly' as const,
      rebalanceThreshold: 0.05
    };

    const optimization = await portfolioManager.optimizePortfolio(config);

    res.json({
      success: true,
      data: optimization
    });

  } catch (error) {
    logger.error('[Portfolio] Error optimizing portfolio:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to optimize portfolio'
    });
  }
});

/**
 * POST /api/portfolio/:portfolioId/rebalance
 * Rebalance a portfolio to target weights
 */
portfolioRouter.post('/:portfolioId/rebalance', async (req, res) => {
  try {
    await initializePortfolioManager();
    
    const { portfolioId } = req.params;
    const actions = await portfolioManager.rebalancePortfolio(portfolioId);

    res.json({
      success: true,
      data: {
        portfolioId,
        actions,
        summary: {
          tradesRequired: actions.length,
          totalCost: actions.reduce((sum: number, a: any) => sum + a.trade.estimatedCost, 0),
          largestTrade: actions.reduce((max: any, a: any) => 
            Math.abs(a.trade.quantity) > Math.abs(max?.trade?.quantity || 0) ? a : max, null
          )
        }
      }
    });

  } catch (error) {
    logger.error('[Portfolio] Error rebalancing portfolio:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to rebalance portfolio'
    });
  }
});

/**
 * GET /api/portfolio/:portfolioId/attribution
 * Get performance attribution analysis
 */
portfolioRouter.get('/:portfolioId/attribution', async (req, res) => {
  try {
    await initializePortfolioManager();
    
    const { portfolioId } = req.params;
    const attribution = await portfolioManager.calculatePerformanceAttribution(portfolioId);

    res.json({
      success: true,
      data: attribution
    });

  } catch (error) {
    logger.error('[Portfolio] Error calculating attribution:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate performance attribution'
    });
  }
});

/**
 * DELETE /api/portfolio/:portfolioId
 * Delete a portfolio
 */
portfolioRouter.delete('/:portfolioId', async (req, res) => {
  try {
    await initializePortfolioManager();
    
    const { portfolioId } = req.params;
    const deleted = await portfolioManager.deletePortfolio(portfolioId);

    if (deleted) {
      res.json({
        success: true,
        data: {
          portfolioId,
          message: 'Portfolio deleted successfully'
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Portfolio not found'
      });
    }

  } catch (error) {
    logger.error('[Portfolio] Error deleting portfolio:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete portfolio'
    });
  }
});

/**
 * GET /api/portfolio/:portfolioId/analytics
 * Get comprehensive portfolio analytics
 */
portfolioRouter.get('/:portfolioId/analytics', async (req, res) => {
  try {
    await initializePortfolioManager();
    
    const { portfolioId } = req.params;
    const portfolio = portfolioManager.getPortfolio(portfolioId);
    
    if (!portfolio) {
      return res.status(404).json({
        success: false,
        error: 'Portfolio not found'
      });
    }

    // Get additional analytics
    const attribution = await portfolioManager.calculatePerformanceAttribution(portfolioId);
    
    const analytics = {
      portfolio: {
        value: portfolio.value,
        performance: portfolio.performance,
        analytics: portfolio.analytics
      },
      attribution,
      riskMetrics: {
        volatility: portfolio.performance.volatility,
        var95: portfolio.performance.var95,
        cvar95: portfolio.performance.cvar95,
        maxDrawdown: portfolio.performance.maxDrawdown,
        sharpeRatio: portfolio.performance.sharpeRatio
      },
      allocation: {
        weights: portfolio.weights,
        sectorAllocation: portfolio.analytics.sectorAllocation,
        positions: portfolio.positions
      },
      rebalancing: {
        lastRebalance: portfolio.lastRebalance,
        nextRebalance: portfolio.nextRebalance,
        frequency: portfolio.config.rebalanceFrequency,
        threshold: portfolio.config.rebalanceThreshold
      }
    };

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    logger.error('[Portfolio] Error getting portfolio analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get portfolio analytics'
    });
  }
});

export { portfolioRouter };