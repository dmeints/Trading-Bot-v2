
import express from 'express';
import { microstructureFeatures } from '../services/microstructure/Features.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// GET /api/microstructure/:symbol - Get latest microstructure snapshot
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    let snapshot = microstructureFeatures.getSnapshot(symbol.toUpperCase());
    
    // Generate synthetic data if no real data available
    if (!snapshot) {
      snapshot = microstructureFeatures.generateSyntheticSnapshot(symbol.toUpperCase());
      logger.info(`Generated synthetic microstructure data for ${symbol}`);
    }
    
    res.json(snapshot);
  } catch (error) {
    logger.error('Error getting microstructure snapshot:', { error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/microstructure - Get all snapshots
router.get('/', async (req, res) => {
  try {
    const snapshots = microstructureFeatures.getAllSnapshots();
    
    // Generate synthetic data for common symbols if empty
    if (snapshots.length === 0) {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'];
      for (const symbol of symbols) {
        microstructureFeatures.generateSyntheticSnapshot(symbol);
      }
      const syntheticSnapshots = microstructureFeatures.getAllSnapshots();
      res.json(syntheticSnapshots);
    } else {
      res.json(snapshots);
    }
  } catch (error) {
    logger.error('Error getting all microstructure snapshots:', { error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
