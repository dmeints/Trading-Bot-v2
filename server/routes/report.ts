
import { Router } from 'express';

const router = Router();

// Mock data generators for reports
const generateAlphaPnL = (window: string) => {
  const days = window === '7d' ? 7 : window === '30d' ? 30 : 1;
  const alphas = ['momentum', 'mean_reversion', 'breakout', 'volatility'];
  
  return alphas.map(alpha => ({
    alpha,
    pnl: (Math.random() - 0.5) * 1000,
    contribution: Math.random() * 0.3 - 0.15,
    sharpe: Math.random() * 2 + 0.5,
    trades: Math.floor(Math.random() * 100) + 10,
    winRate: Math.random() * 0.4 + 0.4,
    avgWin: Math.random() * 50 + 20,
    avgLoss: Math.random() * 30 + 10
  }));
};

const generateRiskReport = (window: string) => {
  return {
    realizedVol: Math.random() * 0.3 + 0.1,
    targetVol: 0.2,
    cvar95: Math.random() * 0.15 + 0.05,
    maxDrawdown: Math.random() * 0.2 + 0.05,
    turnover: Math.random() * 2 + 0.5,
    avgSlippage: Math.random() * 0.002 + 0.001,
    riskAdjustedReturn: Math.random() * 0.15 + 0.05,
    betaToMarket: Math.random() * 0.4 + 0.8,
    trackingError: Math.random() * 0.05 + 0.02
  };
};

const generateVenueReport = (window: string) => {
  const venues = ['binance', 'coinbase', 'kraken', 'deribit'];
  
  return venues.map(venue => ({
    venue,
    winRate: Math.random() * 0.3 + 0.5,
    avgSlippage: Math.random() * 0.003 + 0.001,
    downtimeMinutes: Math.floor(Math.random() * 60),
    fillRate: Math.random() * 0.1 + 0.9,
    avgFillTime: Math.random() * 1000 + 200,
    totalVolume: Math.random() * 1000000 + 100000,
    commissionPaid: Math.random() * 1000 + 100
  }));
};

router.get('/alpha-pnl', (req, res) => {
  const window = req.query.window as string || '7d';
  const report = generateAlphaPnL(window);
  
  res.json({
    window,
    timestamp: Date.now(),
    alphas: report,
    totalPnL: report.reduce((sum, alpha) => sum + alpha.pnl, 0),
    bestAlpha: report.reduce((best, current) => 
      current.pnl > best.pnl ? current : best
    )
  });
});

router.get('/risk', (req, res) => {
  const window = req.query.window as string || '7d';
  const report = generateRiskReport(window);
  
  res.json({
    window,
    timestamp: Date.now(),
    ...report
  });
});

router.get('/venue', (req, res) => {
  const window = req.query.window as string || '7d';
  const report = generateVenueReport(window);
  
  res.json({
    window,
    timestamp: Date.now(),
    venues: report,
    bestVenue: report.reduce((best, current) => 
      current.winRate > best.winRate ? current : best
    )
  });
});

// Performance attribution report
router.get('/attribution', (req, res) => {
  const window = req.query.window as string || '7d';
  
  res.json({
    window,
    timestamp: Date.now(),
    attribution: {
      market: Math.random() * 0.1 - 0.05,
      selection: Math.random() * 0.15 - 0.075,
      timing: Math.random() * 0.1 - 0.05,
      interaction: Math.random() * 0.05 - 0.025
    },
    factors: {
      momentum: Math.random() * 0.08 - 0.04,
      value: Math.random() * 0.06 - 0.03,
      volatility: Math.random() * 0.1 - 0.05,
      size: Math.random() * 0.04 - 0.02
    }
  });
});

export default router;
