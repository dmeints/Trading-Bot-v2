
import { Router } from 'express';
import { provenanceTracker } from '../middleware/provenance';

const router = Router();

router.get('/latest', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 5;
  const records = provenanceTracker.getRecords(limit);
  
  res.json(records);
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const record = provenanceTracker.getRecord(id);
  
  if (!record) {
    return res.status(404).json({ error: 'Record not found' });
  }
  
  res.json(record);
});

router.get('/hash/:hash', (req, res) => {
  const { hash } = req.params;
  const records = provenanceTracker.searchByHash(hash);
  
  res.json({
    hash,
    records,
    count: records.length
  });
});

router.get('/stats', (req, res) => {
  const stats = provenanceTracker.getStats();
  res.json(stats);
});

export default router;
