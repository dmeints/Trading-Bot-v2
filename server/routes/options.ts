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