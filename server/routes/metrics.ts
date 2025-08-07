import { Router } from 'express';
import { metricsService } from '../services/metricsService';
import { isAuthenticated } from '../replitAuth';
import { adminAuth } from '../middleware/adminAuth';
import { rateLimiters } from '../middleware/rateLimiter';

const isDevelopment = process.env.NODE_ENV === 'development';
const devBypass = (req: any, res: any, next: any) => {
  if (isDevelopment && !req.user) {
    req.user = { claims: { sub: 'dev-user-123' } };
  }
  next();
};

const router = Router();

// Prometheus-style metrics endpoint (public for monitoring tools)
router.get('/prometheus', async (req, res) => {
  try {
    const metrics = await metricsService.getPrometheusMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    console.error('[Metrics] Error generating Prometheus metrics:', error);
    res.status(500).send('# Error generating metrics\n');
  }
});

// Get system metrics with time range
router.get('/system', rateLimiters.admin, isDevelopment ? devBypass : adminAuth, async (req: any, res) => {
  try {
    const timeRange = req.query.range as '1h' | '24h' | '7d' | '30d' || '24h';
    const metrics = await metricsService.getMetrics(timeRange);
    res.json(metrics);
  } catch (error) {
    console.error('[Metrics] Error fetching system metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Get active alerts
router.get('/alerts', rateLimiters.admin, adminAuth, async (req: any, res) => {
  try {
    const alerts = await metricsService.getActiveAlerts();
    res.json(alerts);
  } catch (error) {
    console.error('[Metrics] Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Acknowledge an alert
router.put('/alerts/:alertId/acknowledge', rateLimiters.admin, adminAuth, async (req: any, res) => {
  try {
    const { alertId } = req.params;
    const success = await metricsService.acknowledgeAlert(alertId);
    
    if (success) {
      res.json({ success: true, message: 'Alert acknowledged' });
    } else {
      res.status(404).json({ error: 'Alert not found' });
    }
  } catch (error) {
    console.error('[Metrics] Error acknowledging alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// Add a new alert rule
router.post('/alert-rules', rateLimiters.admin, adminAuth, async (req: any, res) => {
  try {
    const { metric, threshold, operator, severity, description } = req.body;
    
    if (!metric || threshold === undefined || !operator || !severity || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const ruleId = await metricsService.addAlertRule({
      metric,
      threshold,
      operator,
      severity,
      description,
      enabled: true
    });

    res.json({ success: true, ruleId });
  } catch (error) {
    console.error('[Metrics] Error adding alert rule:', error);
    res.status(500).json({ error: 'Failed to add alert rule' });
  }
});

// Remove an alert rule
router.delete('/alert-rules/:ruleId', rateLimiters.admin, adminAuth, async (req: any, res) => {
  try {
    const { ruleId } = req.params;
    const success = await metricsService.removeAlertRule(ruleId);
    
    if (success) {
      res.json({ success: true, message: 'Alert rule removed' });
    } else {
      res.status(404).json({ error: 'Alert rule not found' });
    }
  } catch (error) {
    console.error('[Metrics] Error removing alert rule:', error);
    res.status(500).json({ error: 'Failed to remove alert rule' });
  }
});

// Personal metrics for authenticated users
router.get('/personal', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const timeRange = req.query.range as '1h' | '24h' | '7d' | '30d' || '24h';
    
    // Get user-specific metrics (simplified)
    const metrics = {
      timeRange,
      timestamp: new Date(),
      trading: {
        totalTrades: 0,
        winRate: 0,
        totalPnL: 0,
        avgTradeSize: 0
      },
      ai: {
        recommendationsFollowed: 0,
        avgConfidence: 0,
        successRate: 0
      }
    };

    res.json(metrics);
  } catch (error) {
    console.error('[Metrics] Error fetching personal metrics:', error);
    res.status(500).json({ error: 'Failed to fetch personal metrics' });
  }
});

export default router;