
import express from 'express';
import { volatilityModels } from '../services/volatility/Models.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// GET /api/vol/forecast/:symbol?h=60
router.get('/forecast/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const horizonMins = parseInt(req.query.h as string) || 60;
    
    // Generate synthetic data if no real data available
    if (!volatilityModels['priceHistory'] || !volatilityModels['priceHistory'].get(symbol.toUpperCase())) {
      volatilityModels.generateSyntheticHistory(symbol.toUpperCase(), 100);
      logger.info(`Generated synthetic price history for ${symbol}`);
    }
    
    const forecast = volatilityModels.forecastVol(symbol.toUpperCase(), horizonMins);
    
    res.json({
      symbol: symbol.toUpperCase(),
      horizonMins,
      timestamp: Date.now(),
      ...forecast
    });
    
  } catch (error) {
    logger.error('Error forecasting volatility:', { error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/vol/update-price - Update price data for vol models
router.post('/update-price', async (req, res) => {
  try {
    const { symbol, open, high, low, close } = req.body;
    
    if (!symbol || !open || !high || !low || !close) {
      return res.status(400).json({ error: 'Missing required price data' });
    }
    
    volatilityModels.addPriceData(symbol.toUpperCase(), {
      timestamp: Date.now(),
      open: parseFloat(open),
      high: parseFloat(high),
      low: parseFloat(low),
      close: parseFloat(close)
    });
    
    res.json({ status: 'success', message: `Updated price data for ${symbol}` });
    
  } catch (error) {
    logger.error('Error updating price data:', { error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
