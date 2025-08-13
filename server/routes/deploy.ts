
import { Router } from 'express';
import { blueGreen } from '../services/BlueGreen.js';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/deploy/status - Get current deployment status
router.get('/status', (req, res) => {
  try {
    const status = blueGreen.getStatus();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      deployment: {
        activeStack: status.activeStack,
        candidateStack: status.candidateStack,
        phase: status.phase,
        trafficSplit: status.trafficSplit,
        phaseElapsedMs: Date.now() - status.startTime,
        metrics: {
          blue: {
            stack: status.metrics.blue.stack,
            p95Latency: Math.round(status.metrics.blue.p95Latency),
            errorRate: parseFloat((status.metrics.blue.errorRate * 100).toFixed(3)),
            routerQoS: parseFloat(status.metrics.blue.routerQoS.toFixed(3)),
            health: parseFloat(status.metrics.blue.health.toFixed(3)),
            requestCount: status.metrics.blue.requestCount,
            successCount: status.metrics.blue.successCount,
            lastUpdate: new Date(status.metrics.blue.lastUpdate).toISOString()
          },
          green: {
            stack: status.metrics.green.stack,
            p95Latency: Math.round(status.metrics.green.p95Latency),
            errorRate: parseFloat((status.metrics.green.errorRate * 100).toFixed(3)),
            routerQoS: parseFloat(status.metrics.green.routerQoS.toFixed(3)),
            health: parseFloat(status.metrics.green.health.toFixed(3)),
            requestCount: status.metrics.green.requestCount,
            successCount: status.metrics.green.successCount,
            lastUpdate: new Date(status.metrics.green.lastUpdate).toISOString()
          }
        }
      }
    });
    
    logger.debug('[Deploy] Status retrieved successfully');
  } catch (error) {
    logger.error('[Deploy] Failed to get status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve deployment status',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/deploy/candidate - Deploy candidate to specified stack
router.post('/candidate', (req, res) => {
  try {
    const { targetStack } = req.body;
    
    if (!targetStack || !['blue', 'green'].includes(targetStack)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid targetStack. Must be "blue" or "green"',
        timestamp: new Date().toISOString()
      });
    }
    
    blueGreen.deployCandidate(targetStack);
    
    res.json({
      success: true,
      message: `Candidate deployment started to ${targetStack} stack`,
      targetStack,
      timestamp: new Date().toISOString()
    });
    
    logger.info(`[Deploy] Candidate deployment initiated to ${targetStack} stack`);
  } catch (error) {
    logger.error('[Deploy] Failed to deploy candidate:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to deploy candidate',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/deploy/rollback - Force rollback with reason
router.post('/rollback', (req, res) => {
  try {
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Rollback reason is required',
        timestamp: new Date().toISOString()
      });
    }
    
    blueGreen.forceRollback(reason);
    
    res.json({
      success: true,
      message: 'Rollback initiated successfully',
      reason,
      timestamp: new Date().toISOString()
    });
    
    logger.warn(`[Deploy] Manual rollback initiated: ${reason}`);
  } catch (error) {
    logger.error('[Deploy] Failed to rollback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate rollback',
      timestamp: new Date().toISOString()
    });
  }
});

// PUT /api/deploy/thresholds - Update cutover thresholds (admin only)
router.put('/thresholds', (req, res) => {
  try {
    const updates = req.body;
    
    blueGreen.updateThresholds(updates);
    
    res.json({
      success: true,
      message: 'Cutover thresholds updated successfully',
      updates,
      timestamp: new Date().toISOString()
    });
    
    logger.info('[Deploy] Cutover thresholds updated:', updates);
  } catch (error) {
    logger.error('[Deploy] Failed to update thresholds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update cutover thresholds',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
