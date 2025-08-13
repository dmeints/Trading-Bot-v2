
import express from 'express';
import { Models } from '../services/volatility/Models.js';

const router = express.Router();
const volModels = new Models();

// GET /api/vol/forecast/:symbol
router.get('/forecast/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { h } = req.query;
    const horizon = h ? parseInt(h as string) : 24;
    const forecast = await volModels.forecast(symbol, horizon);
    res.json(forecast);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
import { Router } from 'express';
import { volatilityModels } from '../services/volatility/Models.js';

const router = Router();

// Get volatility forecast for symbol
router.get('/forecast/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    const horizon = parseInt(req.query.h as string) || 60;
    
    const forecast = volatilityModels.forecastVol(symbol, horizon);
    
    if (!forecast) {
      return res.status(404).json({ error: 'Insufficient data for volatility forecast' });
    }
    
    res.json(forecast);
  } catch (error) {
    console.error('Volatility forecast error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as volRouter };
