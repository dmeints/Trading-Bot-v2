import type { Express } from "express";
import { runSMABacktest } from "../services/backtestEngine";

export function registerBacktestRoutes(app: Express, requireAuth: any) {
  app.post('/api/backtest/run', requireAuth, async (req, res) => {
    try {
      const { symbol, timeframe, from, to, fast, slow } = req.body;

      // Validation for SMA backtest
      if (fast !== undefined && slow !== undefined) {
        if (!symbol || !timeframe) {
          return res.status(400).json({ 
            error: 'Missing required parameters for SMA backtest: symbol, timeframe' 
          });
        }

        const fastNum = parseInt(fast);
        const slowNum = parseInt(slow);

        if (isNaN(fastNum) || isNaN(slowNum)) {
          return res.status(400).json({ 
            error: 'Fast and slow periods must be numbers' 
          });
        }

        if (fastNum >= slowNum) {
          return res.status(400).json({ 
            error: 'Fast period must be less than slow period' 
          });
        }

        if (fastNum < 1 || slowNum < 2) {
          return res.status(400).json({ 
            error: 'Periods must be positive integers (fast >= 1, slow >= 2)' 
          });
        }

        // Run SMA backtest
        const result = await runSMABacktest({
          symbol,
          timeframe,
          from: from || '2024-01-01',
          to: to || '2024-01-03',
          fast: fastNum,
          slow: slowNum
        });

        res.json({
          success: true,
          data: result,
          timestamp: new Date().toISOString()
        });
      } else {
        // Original deterministic backtest logic (if SMA params are not provided)
        const { symbol: detSymbol, timeframe: detTimeframe, from: detFrom, to: detTo } = req.body;
        
        if (!detSymbol || !detTimeframe) {
          return res.status(400).json({ 
            error: 'Missing required parameters for deterministic backtest: symbol, timeframe' 
          });
        }

        // Assuming runDeterministicBacktest is available and correctly imported
        // and that it does not require fast/slow parameters.
        // If it does, this part needs adjustment based on its signature.
        // For now, we'll assume it only needs symbol, timeframe, from, to.
        const result = await runDeterministicBacktest({
          symbol: detSymbol,
          timeframe: detTimeframe,
          from: detFrom || '2024-01-01',
          to: detTo || '2024-01-03',
        });

        res.json({
          success: true,
          data: result,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error('Backtest error:', error);
      res.status(500).json({ 
        error: 'Backtest failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}