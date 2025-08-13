
/**
 * Models Routes - Model registry management
 */

import { Router } from 'express';
import { modelRegistry } from '../services/modelRegistry';
import { logger } from '../utils/logger';

const router = Router();

// Get all models
router.get('/', (req, res) => {
  try {
    const { type } = req.query;
    
    let models;
    if (type) {
      models = modelRegistry.getByType(type as any);
    } else {
      models = modelRegistry.getAll();
    }
    
    res.json(models);
  } catch (error) {
    logger.error('[ModelsRoutes] Failed to get models:', error);
    res.status(500).json({ error: 'Failed to get models' });
  }
});

// Get current model
router.get('/current', (req, res) => {
  try {
    const current = modelRegistry.getCurrent();
    res.json(current);
  } catch (error) {
    logger.error('[ModelsRoutes] Failed to get current model:', error);
    res.status(500).json({ error: 'Failed to get current model' });
  }
});

// Get model by ID
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const model = modelRegistry.getById(id);
    
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    res.json(model);
  } catch (error) {
    logger.error('[ModelsRoutes] Failed to get model:', error);
    res.status(500).json({ error: 'Failed to get model' });
  }
});

// Promote model
router.post('/promote', (req, res) => {
  try {
    const { id, reason, approver } = req.body;
    
    if (!id || !reason || !approver) {
      return res.status(400).json({ error: 'id, reason, and approver required' });
    }
    
    const model = modelRegistry.promote({ id, reason, approver });
    res.json(model);
  } catch (error) {
    logger.error('[ModelsRoutes] Failed to promote model:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to promote model' });
  }
});

// Rollback model
router.post('/rollback', (req, res) => {
  try {
    const { reason, targetId, approver } = req.body;
    
    if (!reason || !approver) {
      return res.status(400).json({ error: 'reason and approver required' });
    }
    
    const model = modelRegistry.rollback({ reason, targetId, approver });
    res.json(model);
  } catch (error) {
    logger.error('[ModelsRoutes] Failed to rollback model:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to rollback model' });
  }
});

// Get deployment history
router.get('/history/deployments', (req, res) => {
  try {
    const { limit } = req.query;
    const history = modelRegistry.getDeploymentHistory(parseInt(limit as string) || 20);
    res.json(history);
  } catch (error) {
    logger.error('[ModelsRoutes] Failed to get deployment history:', error);
    res.status(500).json({ error: 'Failed to get deployment history' });
  }
});

// Get stats
router.get('/stats/summary', (req, res) => {
  try {
    const stats = modelRegistry.getStats();
    res.json(stats);
  } catch (error) {
    logger.error('[ModelsRoutes] Failed to get stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export { router as modelsRoutes };
