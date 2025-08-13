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
import { Router } from 'express';
import { microstructureFeatures } from '../services/microstructure/Features.js';

const router = Router();

// Get latest microstructure snapshot for symbol
router.get('/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    const snapshot = microstructureFeatures.getSnapshot(symbol);
    
    if (!snapshot) {
      return res.status(404).json({ error: 'No data available for symbol' });
    }
    
    res.json(snapshot);
  } catch (error) {
    console.error('Microstructure route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as microstructureRouter };
