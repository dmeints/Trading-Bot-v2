
import { Router } from 'express';
import { policyGuard, PolicyState } from '../services/policyGuard.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/policies/status
 * Get status of all policies or a specific policy
 */
router.get('/status', async (req, res) => {
  try {
    const policyId = req.query.policyId as string;
    const status = policyGuard.getPolicyStatus(policyId);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error fetching policy status:', error);
    res.status(500).json({ error: 'Failed to fetch policy status' });
  }
});

/**
 * POST /api/policies/promote
 * Promote a policy to next stage
 */
router.post('/promote', async (req, res) => {
  try {
    const { policyId } = req.body;
    
    if (!policyId) {
      return res.status(400).json({ error: 'policyId is required' });
    }

    const success = policyGuard.promotePolicy(policyId);
    
    if (success) {
      const updatedStatus = policyGuard.getPolicyStatus(policyId);
      res.json({
        success: true,
        message: `Policy ${policyId} promoted successfully`,
        status: updatedStatus
      });
    } else {
      const status = policyGuard.getPolicyStatus(policyId);
      res.status(400).json({
        success: false,
        message: 'Policy promotion blocked',
        status,
        blockers: Array.isArray(status) ? [] : status.promotionBlocked
      });
    }
  } catch (error) {
    logger.error('Error promoting policy:', error);
    res.status(500).json({ error: 'Failed to promote policy' });
  }
});

/**
 * POST /api/policies/shadow-fill
 * Record a shadow fill for a policy
 */
router.post('/shadow-fill', async (req, res) => {
  try {
    const { policyId, price, quantity, pnl } = req.body;
    
    if (!policyId || typeof price !== 'number' || typeof quantity !== 'number' || typeof pnl !== 'number') {
      return res.status(400).json({ error: 'policyId, price, quantity, and pnl are required' });
    }

    policyGuard.recordShadowFill(policyId, { price, quantity, pnl });
    
    const status = policyGuard.getPolicyStatus(policyId);
    res.json({
      success: true,
      message: 'Shadow fill recorded',
      status
    });
  } catch (error) {
    logger.error('Error recording shadow fill:', error);
    res.status(500).json({ error: 'Failed to record shadow fill' });
  }
});

export default router;
