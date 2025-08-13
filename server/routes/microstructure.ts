import express from 'express';
import { FastPath } from '../services/microstructure/FastPath.js';

const router = express.Router();
const microstructure = new FastPath();

// GET /api/microstructure/:symbol
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const features = await microstructure.getFeatures(symbol);
    res.json(features);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;