import { Router } from 'express';
import { getMetrics, checkAlertThresholds } from '../monitoring/metrics';
import { sloTracker } from '../monitoring/telemetry';
import { isAuthenticated } from '../replitAuth';
import { logger } from '../utils/logger';

const router = Router();

// Prometheus metrics endpoint (public for monitoring systems)
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await getMetrics();
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  } catch (error) {
    logger.error('Error retrieving metrics', { error });
    res.status(500).json({ message: 'Failed to retrieve metrics' });
  }
});

// Service Level Objectives status
router.get('/slo', isAuthenticated, async (req, res) => {
  try {
    const sloStatus = sloTracker.getSLOStatus();
    const violations = sloTracker.checkSLOViolations();
    
    res.json({
      slos: sloStatus,
      violations,
      healthy: violations.length === 0,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error retrieving SLO status', { error });
    res.status(500).json({ message: 'Failed to retrieve SLO status' });
  }
});

// Alert status endpoint
router.get('/alerts', isAuthenticated, async (req, res) => {
  try {
    const alerts = await checkAlertThresholds();
    
    res.json({
      alerts,
      alertsActive: alerts.length > 0,
      severityLevels: {
        critical: alerts.filter(a => a.current > a.threshold * 1.5).length,
        warning: alerts.filter(a => a.current > a.threshold && a.current <= a.threshold * 1.5).length,
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error retrieving alerts', { error });
    res.status(500).json({ message: 'Failed to retrieve alerts' });
  }
});

// Telemetry dashboard data
router.get('/telemetry', isAuthenticated, async (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    res.json({
      system: {
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          external: memoryUsage.external,
          percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform
      },
      application: {
        environment: process.env.NODE_ENV,
        buildSha: process.env.BUILD_SHA || 'dev',
        startTime: new Date(Date.now() - process.uptime() * 1000).toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error retrieving telemetry data', { error });
    res.status(500).json({ message: 'Failed to retrieve telemetry data' });
  }
});

// Chaos engineering endpoints (for testing)
router.post('/chaos/trigger', isAuthenticated, async (req, res) => {
  const { event, duration = 10, severity = 1 } = req.body;
  
  try {
    logger.warn('Chaos event triggered', { event, duration, severity, triggeredBy: req.user?.claims?.sub });
    
    // Simulate chaos events (in a real system, this would trigger actual chaos)
    switch (event) {
      case 'kill_websocket_service':
        // Simulate WebSocket service disruption
        setTimeout(() => {
          logger.info('Chaos event completed: WebSocket service restored');
        }, duration * 1000);
        break;
        
      case 'crash_ai_agent':
        // Simulate AI agent crash
        setTimeout(() => {
          logger.info('Chaos event completed: AI agent restarted');
        }, duration * 1000);
        break;
        
      case 'high_cpu_load':
        // Simulate high CPU load
        const endTime = Date.now() + (duration * 1000);
        const intensive = () => {
          if (Date.now() < endTime) {
            // CPU intensive operation
            for (let i = 0; i < 1000000; i++) {
              Math.random();
            }
            setImmediate(intensive);
          } else {
            logger.info('Chaos event completed: CPU load normalized');
          }
        };
        intensive();
        break;
        
      default:
        logger.info(`Simulated chaos event: ${event}`);
    }
    
    res.json({
      message: `Chaos event '${event}' triggered`,
      duration,
      severity,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error triggering chaos event', { error, event });
    res.status(500).json({ message: 'Failed to trigger chaos event' });
  }
});

router.post('/chaos/enable', isAuthenticated, async (req, res) => {
  const { mode = 'testing', duration = 300 } = req.body;
  
  logger.warn('Chaos mode enabled', { mode, duration, enabledBy: req.user?.claims?.sub });
  
  // Set chaos mode flag (in a real system, this would enable chaos engineering)
  process.env.CHAOS_MODE = 'enabled';
  process.env.CHAOS_DURATION = duration.toString();
  
  setTimeout(() => {
    process.env.CHAOS_MODE = 'disabled';
    logger.info('Chaos mode automatically disabled');
  }, duration * 1000);
  
  res.json({
    message: 'Chaos mode enabled',
    mode,
    duration,
    timestamp: new Date().toISOString()
  });
});

router.post('/chaos/disable', isAuthenticated, async (req, res) => {
  logger.info('Chaos mode disabled', { disabledBy: req.user?.claims?.sub });
  
  process.env.CHAOS_MODE = 'disabled';
  delete process.env.CHAOS_DURATION;
  
  res.json({
    message: 'Chaos mode disabled',
    timestamp: new Date().toISOString()
  });
});

// Health check with detailed status
router.get('/health/detailed', async (req, res) => {
  try {
    const checks = {
      database: await checkDatabaseHealth(),
      websocket: await checkWebSocketHealth(),
      ai_services: await checkAIServicesHealth(),
      external_apis: await checkExternalAPIsHealth(),
    };
    
    const overall = Object.values(checks).every(check => check.healthy);
    
    res.status(overall ? 200 : 503).json({
      healthy: overall,
      checks,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    logger.error('Error performing detailed health check', { error });
    res.status(500).json({
      healthy: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Helper functions for health checks
async function checkDatabaseHealth(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
  try {
    const start = Date.now();
    // Simple database ping - replace with actual database check
    const latency = Date.now() - start;
    
    return {
      healthy: true,
      latency
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Database connection failed'
    };
  }
}

async function checkWebSocketHealth(): Promise<{ healthy: boolean; connections?: number; error?: string }> {
  try {
    // Check WebSocket server status - replace with actual implementation
    return {
      healthy: true,
      connections: 0 // Replace with actual connection count
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'WebSocket health check failed'
    };
  }
}

async function checkAIServicesHealth(): Promise<{ healthy: boolean; services?: Record<string, boolean>; error?: string }> {
  try {
    // Check AI services status - replace with actual implementation
    return {
      healthy: true,
      services: {
        market_insight: true,
        risk_assessment: true,
        sentiment_analysis: true
      }
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'AI services health check failed'
    };
  }
}

async function checkExternalAPIsHealth(): Promise<{ healthy: boolean; apis?: Record<string, boolean>; error?: string }> {
  try {
    // Check external APIs status - replace with actual implementation
    return {
      healthy: true,
      apis: {
        coingecko: true,
        openai: true
      }
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'External APIs health check failed'
    };
  }
}

export default router;