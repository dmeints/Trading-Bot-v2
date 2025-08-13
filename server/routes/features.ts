
import { Router } from 'express';
import { featureStore } from '../services/featureStore';

const router = Router();

router.get('/parity', (req, res) => {
  const report = featureStore.getParityReport();
  res.json(report);
});

router.get('/stats', (req, res) => {
  const stats = featureStore.getStats();
  res.json(stats);
});

router.get('/:symbol/window', (req, res) => {
  const { symbol } = req.params;
  const windowSizeMs = parseInt(req.query.window as string) || 3600000; // 1 hour default
  
  const window = featureStore.getWindow(symbol, windowSizeMs);
  res.json(window);
});

router.get('/:symbol/latest', (req, res) => {
  const { symbol } = req.params;
  const latest = featureStore.getLatest(symbol);
  
  if (!latest) {
    return res.status(404).json({ error: 'No features found for symbol' });
  }
  
  res.json(latest);
});

export default router;
