
import type { Express } from "express";
import { runSMABacktest } from "../services/backtestEngine";

export function registerBacktestRoutes(app: Express, requireAuth: any) {
  app.post('/api/backtest/run', requireAuth, async (req, res) => {
    try {
      const { symbol, timeframe, from, to, fast, slow } = req.body;

      // Validation
      if (!symbol || !timeframe || !fast || !slow) {
        return res.status(400).json({ 
          error: 'Missing required parameters: symbol, timeframe, fast, slow' 
        });
      }

      if (typeof fast !== 'number' || typeof slow !== 'number') {
        return res.status(400).json({ 
          error: 'Fast and slow periods must be numbers' 
        });
      }

      if (fast >= slow) {
        return res.status(400).json({ 
          error: 'Fast period must be less than slow period' 
        });
      }

      if (fast < 1 || slow < 2) {
        return res.status(400).json({ 
          error: 'Periods must be positive integers (fast >= 1, slow >= 2)' 
        });
      }

      // Run backtest
      const result = await runSMABacktest({
        symbol,
        timeframe,
        from: from || '2024-01-01',
        to: to || '2024-01-03',
        fast,
        slow
      });

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Backtest error:', error);
      res.status(500).json({ 
        error: 'Backtest failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
