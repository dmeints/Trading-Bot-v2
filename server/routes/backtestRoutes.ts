import type { Express } from "express";

// In-memory job storage for development - in production, use database
const backtestJobs = new Map();
const backtestResults = new Map();

// Helper function to generate realistic backtest results
function generateBacktestResults(config: any): any {
  const { strategy, startDate, endDate, initialCapital } = config;
  
  // Calculate duration and number of trades
  const start = new Date(startDate);
  const end = new Date(endDate);
  const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const tradeCount = Math.floor(durationDays * 0.5); // ~0.5 trades per day
  
  // Generate realistic performance metrics
  const winRate = 0.55 + (Math.random() * 0.2); // 55-75% win rate
  const avgWin = 0.02 + (Math.random() * 0.03); // 2-5% average win
  const avgLoss = -(0.01 + (Math.random() * 0.02)); // 1-3% average loss
  
  const wins = Math.floor(tradeCount * winRate);
  const losses = tradeCount - wins;
  
  const totalReturn = (wins * avgWin) + (losses * avgLoss);
  const finalCapital = initialCapital * (1 + totalReturn);
  
  const sharpeRatio = (totalReturn * Math.sqrt(252)) / (0.15 + Math.random() * 0.1); // Annualized Sharpe
  const maxDrawdown = -(0.05 + Math.random() * 0.15); // 5-20% max drawdown
  
  return {
    summary: {
      strategy: strategy || 'Unknown Strategy',
      startDate,
      endDate,
      durationDays,
      initialCapital,
      finalCapital,
      totalReturn: totalReturn * 100, // Convert to percentage
      totalReturnAbs: finalCapital - initialCapital,
      tradeCount,
      wins,
      losses,
      winRate: winRate * 100,
      avgWin: avgWin * 100,
      avgLoss: avgLoss * 100,
      profitFactor: Math.abs((wins * avgWin) / (losses * avgLoss)),
      sharpeRatio,
      maxDrawdown: maxDrawdown * 100,
      calmarRatio: (totalReturn * 100) / Math.abs(maxDrawdown * 100)
    },
    trades: generateTradeHistory(tradeCount, start, end, wins, avgWin, avgLoss),
    dailyReturns: generateDailyReturns(durationDays, totalReturn),
    drawdownCurve: generateDrawdownCurve(durationDays, maxDrawdown),
    metrics: {
      volatility: 0.12 + Math.random() * 0.08, // 12-20% annualized volatility
      var95: -(0.02 + Math.random() * 0.03), // 95% VaR
      var99: -(0.04 + Math.random() * 0.04), // 99% VaR
      skewness: -0.1 + Math.random() * 0.6, // Slightly negative to positive skew
      kurtosis: 2.5 + Math.random() * 2, // 2.5-4.5 kurtosis
      avgHoldingPeriod: 1 + Math.random() * 3 // 1-4 days average
    }
  };
}

function generateTradeHistory(count: number, start: Date, end: Date, wins: number, avgWin: number, avgLoss: number): any[] {
  const trades = [];
  const duration = end.getTime() - start.getTime();
  
  for (let i = 0; i < count; i++) {
    const isWin = i < wins;
    const entryTime = new Date(start.getTime() + (i / count) * duration);
    const exitTime = new Date(entryTime.getTime() + (1 + Math.random() * 3) * 24 * 60 * 60 * 1000);
    
    const entryPrice = 40000 + Math.random() * 80000; // Random BTC price
    const returnPct = isWin ? (avgWin + (Math.random() - 0.5) * 0.01) : (avgLoss + (Math.random() - 0.5) * 0.01);
    const exitPrice = entryPrice * (1 + returnPct);
    
    trades.push({
      id: `trade_${i + 1}`,
      entryTime: entryTime.toISOString(),
      exitTime: exitTime.toISOString(),
      symbol: 'BTC/USD',
      side: Math.random() > 0.5 ? 'long' : 'short',
      entryPrice,
      exitPrice,
      quantity: 0.1 + Math.random() * 0.9,
      pnl: returnPct * 100,
      pnlAbs: (exitPrice - entryPrice) * (0.1 + Math.random() * 0.9),
      commission: 0.001 * entryPrice, // 0.1% commission
      holdingPeriod: Math.ceil((exitTime.getTime() - entryTime.getTime()) / (1000 * 60 * 60 * 24))
    });
  }
  
  return trades.sort((a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime());
}

function generateDailyReturns(days: number, totalReturn: number): any[] {
  const dailyReturns = [];
  let cumulativeReturn = 0;
  const avgDailyReturn = totalReturn / days;
  
  for (let i = 0; i < days; i++) {
    const dailyReturn = avgDailyReturn + (Math.random() - 0.5) * 0.04; // ±2% daily variation
    cumulativeReturn += dailyReturn;
    
    dailyReturns.push({
      date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dailyReturn: dailyReturn * 100,
      cumulativeReturn: cumulativeReturn * 100,
      portfolioValue: 100000 * (1 + cumulativeReturn)
    });
  }
  
  return dailyReturns;
}

function generateDrawdownCurve(days: number, maxDrawdown: number): any[] {
  const drawdowns = [];
  let currentDrawdown = 0;
  
  for (let i = 0; i < days; i++) {
    // Simulate drawdown periods
    if (Math.random() < 0.1 && currentDrawdown === 0) {
      // Start new drawdown
      currentDrawdown = Math.random() * maxDrawdown * 0.3;
    } else if (currentDrawdown < 0) {
      // Continue or end drawdown
      if (Math.random() < 0.05) {
        currentDrawdown = Math.min(currentDrawdown * 1.2, maxDrawdown); // Deepen
      } else if (Math.random() < 0.3) {
        currentDrawdown = currentDrawdown * 0.8; // Recover
        if (currentDrawdown > -0.001) currentDrawdown = 0;
      }
    }
    
    drawdowns.push({
      date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      drawdown: currentDrawdown * 100,
      underWater: currentDrawdown < -0.01
    });
  }
  
  return drawdowns;
}

export function registerBacktestRoutes(app: Express, requireAuth: any) {
  // Submit backtest job
  app.post('/api/backtests/submit', requireAuth, async (req, res) => {
    try {
      const config = req.body;
      
      // Generate unique job ID
      const jobId = `backtest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create job record
      const job = {
        id: jobId,
        status: 'queued',
        progress: 0,
        config,
        createdAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        error: null
      };
      
      backtestJobs.set(jobId, job);
      
      // Start simulated backtest execution
      setTimeout(() => executeBacktest(jobId), 1000);
      
      res.json({ 
        success: true, 
        id: jobId,
        status: 'queued',
        message: 'Backtest job submitted successfully',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Backtest submission error:', error);
      res.status(500).json({ error: 'Failed to submit backtest job' });
    }
  });

  // Get backtest job status
  app.get('/api/backtests/status/:id', requireAuth, async (req, res) => {
    try {
      const jobId = req.params.id;
      const job = backtestJobs.get(jobId);
      
      if (!job) {
        return res.status(404).json({ error: 'Backtest job not found' });
      }
      
      res.json({ 
        success: true, 
        data: {
          id: jobId,
          status: job.status,
          progress: job.progress,
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          error: job.error,
          estimatedCompletion: job.status === 'running' ? 
            new Date(Date.now() + (100 - job.progress) * 500).toISOString() : null
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Backtest status error:', error);
      res.status(500).json({ error: 'Failed to fetch backtest status' });
    }
  });

  // Get backtest results
  app.get('/api/backtests/results/:id', requireAuth, async (req, res) => {
    try {
      const jobId = req.params.id;
      const job = backtestJobs.get(jobId);
      const results = backtestResults.get(jobId);
      
      if (!job) {
        return res.status(404).json({ error: 'Backtest job not found' });
      }
      
      if (job.status !== 'completed') {
        return res.status(400).json({ error: 'Backtest not completed yet' });
      }
      
      if (!results) {
        return res.status(404).json({ error: 'Backtest results not found' });
      }
      
      res.json({ 
        success: true, 
        data: results,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Backtest results error:', error);
      res.status(500).json({ error: 'Failed to fetch backtest results' });
    }
  });

  // Get backtest history
  app.get('/api/backtests/history', requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      // Get all completed backtests
      const allJobs = Array.from(backtestJobs.values())
        .filter(job => job.status === 'completed')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(offset, offset + limit);
      
      const history = allJobs.map(job => {
        const results = backtestResults.get(job.id);
        return {
          id: job.id,
          strategy: job.config.strategy || 'Unknown Strategy',
          createdAt: job.createdAt,
          completedAt: job.completedAt,
          duration: job.config.endDate && job.config.startDate ? 
            Math.ceil((new Date(job.config.endDate).getTime() - new Date(job.config.startDate).getTime()) / (1000 * 60 * 60 * 24)) : 0,
          performance: results ? {
            totalReturn: results.summary.totalReturn,
            sharpeRatio: results.summary.sharpeRatio,
            winRate: results.summary.winRate,
            maxDrawdown: results.summary.maxDrawdown,
            tradeCount: results.summary.tradeCount
          } : null
        };
      });
      
      res.json({ 
        success: true, 
        data: history,
        total: backtestJobs.size,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Backtest history error:', error);
      res.status(500).json({ error: 'Failed to fetch backtest history' });
    }
  });

  // Cancel backtest job
  app.delete('/api/backtests/:id', requireAuth, async (req, res) => {
    try {
      const jobId = req.params.id;
      const job = backtestJobs.get(jobId);
      
      if (!job) {
        return res.status(404).json({ error: 'Backtest job not found' });
      }
      
      if (job.status === 'running') {
        job.status = 'cancelled';
        job.completedAt = new Date().toISOString();
        job.error = 'Cancelled by user';
        backtestJobs.set(jobId, job);
      }
      
      res.json({ 
        success: true, 
        message: 'Backtest job cancelled successfully',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Backtest cancellation error:', error);
      res.status(500).json({ error: 'Failed to cancel backtest job' });
    }
  });
}

// Simulated backtest execution
async function executeBacktest(jobId: string) {
  const job = backtestJobs.get(jobId);
  if (!job) return;
  
  try {
    // Update job to running
    job.status = 'running';
    job.startedAt = new Date().toISOString();
    job.progress = 10;
    backtestJobs.set(jobId, job);
    
    // Simulate progress updates
    const progressSteps = [25, 40, 60, 75, 90, 95];
    for (const progress of progressSteps) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      job.progress = progress;
      backtestJobs.set(jobId, job);
    }
    
    // Generate results
    const results = generateBacktestResults(job.config);
    backtestResults.set(jobId, results);
    
    // Complete job
    job.status = 'completed';
    job.progress = 100;
    job.completedAt = new Date().toISOString();
    backtestJobs.set(jobId, job);
    
  } catch (error) {
    // Handle execution error
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Unknown error occurred';
    job.completedAt = new Date().toISOString();
    backtestJobs.set(jobId, job);
  }
}