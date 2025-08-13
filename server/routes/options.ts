import express from 'express';
import { Smile } from '../services/options/Smile.js';

const router = express.Router();
const optionsSmile = new Smile();

// POST /api/options/chain/:symbol
router.post('/chain/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { chain } = req.body;
    const result = await optionsSmile.calibrateChain(symbol, chain);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// GET /api/options/smile/:symbol
router.get('/smile/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const smile = await optionsSmile.getSmile(symbol);
    res.json(smile);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
import { Router } from 'express';
import { optionsSmile } from '../services/options/Smile.js';

const router = Router();

// Store option chain data
router.post('/chain/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    const { chain } = req.body;
    
    if (!Array.isArray(chain)) {
      return res.status(400).json({ error: 'Chain must be an array of options' });
    }
    
    optionsSmile.storeChain(symbol, chain);
    res.json({ success: true, count: chain.length });
  } catch (error) {
    console.error('Options chain storage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get smile metrics
router.get('/smile/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    const metrics = optionsSmile.getSmileMetrics(symbol);
    
    if (!metrics) {
      return res.status(404).json({ error: 'No option data available for symbol' });
    }
    
    res.json(metrics);
  } catch (error) {
    console.error('Options smile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as optionsRouter };
