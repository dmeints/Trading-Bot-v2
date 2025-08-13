import express from 'express';

const router = express.Router();

/**
 * Attribution & Risk Reporting API Routes
 */

// GET /api/report/alpha-pnl
router.get('/alpha-pnl', async (req, res) => {
  try {
    const { window = '7d' } = req.query;
    const report = {
      window,
      alphas: [
        { id: 'momentum', pnl: 0.034, contribution: 0.15 },
        { id: 'mean_revert', pnl: -0.012, contribution: -0.05 },
        { id: 'volatility', pnl: 0.087, contribution: 0.40 }
      ],
      totalPnl: 0.109,
      generatedAt: new Date().toISOString()
    };
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// GET /api/report/risk
router.get('/risk', async (req, res) => {
  try {
    const { window = '7d' } = req.query;
    const report = {
      window,
      var95: 0.023,
      cvar95: 0.045,
      maxDrawdown: 0.056,
      sharpe: 1.34,
      generatedAt: new Date().toISOString()
    };
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// GET /api/report/performance (New endpoint as per the intention, combining alpha and risk data)
router.get('/performance', async (req, res) => {
  try {
    const { window = '30d' } = req.query;

    // Mock data for alpha PnL
    const alphaPnLData = {
      window,
      alphas: [
        { id: 'momentum', pnl: 0.034, contribution: 0.15 },
        { id: 'mean_revert', pnl: -0.012, contribution: -0.05 },
        { id: 'volatility', pnl: 0.087, contribution: 0.40 }
      ],
      totalPnl: 0.109,
    };

    // Mock data for risk metrics
    const riskMetricsData = {
      window,
      var95: 0.023,
      cvar95: 0.045,
      maxDrawdown: 0.056,
      sharpe: 1.34,
    };

    const performanceReport = {
      window: window,
      alpha: {
        totalPnL: alphaPnLData.totalPnl,
        alphaCount: alphaPnLData.alphas.length,
        sharpeRatio: riskMetricsData.sharpe,
        // Assuming informationRatio can be derived or mocked similarly
        informationRatio: 0.85,
      },
      risk: {
        var95: riskMetricsData.var95,
        cvar95: riskMetricsData.cvar95,
        maxDrawdown: riskMetricsData.maxDrawdown,
      },
      execution: {
        avgSlippage: 2.5, // Mocked value
        turnover: 1.2, // Mocked value
        fillRate: 0.98
      },
      generatedAt: new Date().toISOString()
    };

    res.json(performanceReport);

  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});


export default router;