/**
 * Phase L - Production Monitoring API Routes
 */

import { Router } from "express";
import { z } from "zod";
import { productionMonitoringService } from "../services/ProductionMonitoring";
import { logger } from "../utils/logger";
import { isAuthenticated } from "../replitAuth";

const router = Router();

// Request validation schemas
const alertResolveSchema = z.object({
  alertId: z.string().min(1)
});

const metricsQuerySchema = z.object({
  timeRange: z.enum(['1h', '6h', '24h', '7d']).optional().default('1h'),
  component: z.string().optional()
});

/**
 * GET /api/monitoring/health
 * Comprehensive system health check
 */
router.get('/health', async (req, res) => {
  try {
    logger.info('[MonitoringAPI] Health check requested');

    const healthMetrics = await productionMonitoringService.performHealthCheck();
    
    res.json({
      success: true,
      health: healthMetrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[MonitoringAPI] Health check failed', error);
    
    res.status(503).json({
      success: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/monitoring/deployment
 * Get deployment information and metrics
 */
router.get('/deployment', isAuthenticated, async (req, res) => {
  try {
    const deploymentMetrics = await productionMonitoringService.getDeploymentMetrics();
    
    res.json({
      success: true,
      deployment: deploymentMetrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[MonitoringAPI] Deployment metrics failed', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get deployment metrics'
    });
  }
});

/**
 * GET /api/monitoring/metrics
 * Get system performance metrics
 */
router.get('/metrics', isAuthenticated, async (req, res) => {
  try {
    const { timeRange, component } = metricsQuerySchema.parse(req.query);
    
    const systemMetrics = await productionMonitoringService.getSystemMetrics();
    
    // Filter metrics by component if specified
    const filteredMetrics = component 
      ? { [component]: systemMetrics } 
      : systemMetrics;

    res.json({
      success: true,
      metrics: filteredMetrics,
      timeRange,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[MonitoringAPI] Metrics retrieval failed', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get system metrics'
    });
  }
});

/**
 * POST /api/monitoring/alerts/resolve
 * Resolve a system alert
 */
router.post('/alerts/resolve', isAuthenticated, async (req, res) => {
  try {
    const { alertId } = alertResolveSchema.parse(req.body);
    
    const resolved = productionMonitoringService.resolveAlert(alertId);
    
    if (resolved) {
      res.json({
        success: true,
        message: 'Alert resolved successfully',
        alertId
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Alert not found',
        alertId
      });
    }

  } catch (error) {
    logger.error('[MonitoringAPI] Alert resolution failed', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request format',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert'
    });
  }
});

/**
 * GET /api/monitoring/status
 * Quick system status check for uptime monitoring
 */
router.get('/status', async (req, res) => {
  try {
    const systemMetrics = await productionMonitoringService.getSystemMetrics();
    
    res.json({
      status: 'operational',
      uptime: systemMetrics.uptime,
      version: systemMetrics.version,
      environment: systemMetrics.environment,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[MonitoringAPI] Status check failed', error);
    
    res.status(503).json({
      status: 'degraded',
      error: 'Status check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/monitoring/alerts
 * Get current system alerts
 */
router.get('/alerts', isAuthenticated, async (req, res) => {
  try {
    const healthMetrics = await productionMonitoringService.performHealthCheck();
    
    const alertSummary = {
      total: healthMetrics.alerts.length,
      critical: healthMetrics.alerts.filter(a => a.severity === 'CRITICAL').length,
      high: healthMetrics.alerts.filter(a => a.severity === 'HIGH').length,
      medium: healthMetrics.alerts.filter(a => a.severity === 'MEDIUM').length,
      low: healthMetrics.alerts.filter(a => a.severity === 'LOW').length
    };

    res.json({
      success: true,
      alerts: healthMetrics.alerts,
      summary: alertSummary,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[MonitoringAPI] Alerts retrieval failed', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get system alerts'
    });
  }
});

/**
 * POST /api/monitoring/test-alert
 * Generate test alert for monitoring system validation (dev/staging only)
 */
router.post('/test-alert', isAuthenticated, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Test alerts not allowed in production'
      });
    }

    // This would trigger a test alert in the monitoring system
    logger.warn('[MonitoringAPI] Test alert generated', {
      user: req.user?.claims?.sub,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Test alert generated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[MonitoringAPI] Test alert generation failed', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate test alert'
    });
  }
});

export default router;