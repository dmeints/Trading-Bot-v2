
import { Router } from 'express';
import { provenanceTracker } from '../middleware/provenance';
import { logger } from '../utils/logger';

const router = Router();

// Get latest audit logs
router.get('/latest', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const logs = provenanceTracker.getAuditLogs(limit);
    res.json(logs);
  } catch (error) {
    logger.error('[Audit] Get latest error:', error);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

// Get specific audit record
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const log = provenanceTracker.getAuditById(id);
    
    if (!log) {
      return res.status(404).json({ error: 'Audit record not found' });
    }
    
    res.json(log);
  } catch (error) {
    logger.error('[Audit] Get by ID error:', error);
    res.status(500).json({ error: 'Failed to get audit record' });
  }
});

export default router;
