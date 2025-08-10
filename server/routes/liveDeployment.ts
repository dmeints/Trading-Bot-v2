
/**
 * Phase 5 - Live Deployment Routes
 * API endpoints for live deployment validation and management
 */

import { Router, Request, Response } from 'express';
import { rateLimiters } from '../middleware/rateLimiter';
import { liveDeploymentValidator } from '../services/liveDeploymentValidator';

const router = Router();

// Validate live deployment readiness
router.get('/validate', rateLimiters.features, async (req: Request, res: Response) => {
  try {
    const validation = await liveDeploymentValidator.validateLiveReadiness();
    res.json({ success: true, data: validation });
  } catch (error) {
    console.error('[LiveDeployment] Error validating readiness:', error);
    res.status(500).json({ success: false, error: 'Failed to validate live deployment readiness' });
  }
});

// Generate live deployment report
router.post('/generate-report', rateLimiters.features, async (req: Request, res: Response) => {
  try {
    const reportPath = await liveDeploymentValidator.generateLiveDeploymentReport();
    res.json({ success: true, data: { reportPath } });
  } catch (error) {
    console.error('[LiveDeployment] Error generating report:', error);
    res.status(500).json({ success: false, error: 'Failed to generate live deployment report' });
  }
});

// Live deployment checklist
router.get('/checklist', rateLimiters.features, async (req: Request, res: Response) => {
  try {
    const checklist = [
      {
        id: 'paper-trading-complete',
        title: 'Paper Trading Burn-In Complete',
        description: 'Minimum 50 paper trades with >45% win rate and >90% live parity',
        category: 'validation'
      },
      {
        id: 'risk-controls-active',
        title: 'Risk Controls Active',
        description: 'Position sizing, daily loss limits, and emergency controls tested',
        category: 'risk'
      },
      {
        id: 'api-connections-stable',
        title: 'API Connections Stable',
        description: 'All external data sources connected with <1% error rate',
        category: 'connectivity'
      },
      {
        id: 'monitoring-configured',
        title: 'Monitoring & Alerts Configured',
        description: 'Real-time monitoring, alerting, and dashboard systems active',
        category: 'monitoring'
      },
      {
        id: 'compliance-audit-complete',
        title: 'Compliance Audit Complete',
        description: 'All regulatory requirements verified and documented',
        category: 'compliance'
      },
      {
        id: 'emergency-procedures-tested',
        title: 'Emergency Procedures Tested',
        description: 'Kill switch, position closure, and incident response verified',
        category: 'emergency'
      },
      {
        id: 'backup-systems-ready',
        title: 'Backup Systems Ready',
        description: 'Data backup, disaster recovery, and failover systems tested',
        category: 'backup'
      }
    ];

    res.json({ success: true, data: checklist });
  } catch (error) {
    console.error('[LiveDeployment] Error getting checklist:', error);
    res.status(500).json({ success: false, error: 'Failed to get deployment checklist' });
  }
});

// System status for live deployment
router.get('/status', rateLimiters.features, async (req: Request, res: Response) => {
  try {
    const status = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.APP_VERSION || '1.0.0',
      deployment: {
        stage: process.env.DEPLOYMENT_STAGE || 'paper-trading',
        allowLiveTrading: process.env.ALLOW_LIVE_TRADING === 'true',
        emergencyMode: process.env.EMERGENCY_MODE === 'true'
      }
    };

    res.json({ success: true, data: status });
  } catch (error) {
    console.error('[LiveDeployment] Error getting status:', error);
    res.status(500).json({ success: false, error: 'Failed to get deployment status' });
  }
});

export default router;
