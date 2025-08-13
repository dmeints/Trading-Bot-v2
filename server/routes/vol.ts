
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
