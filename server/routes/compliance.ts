import { Router } from 'express';
import { logger } from '../utils/logger.js';

const complianceRouter = Router();

// Import compliance manager service dynamically
let complianceManager: any = null;

async function initializeComplianceManager() {
  if (!complianceManager) {
    try {
      const { ComplianceManager } = await import('../services/ComplianceManager.js');
      complianceManager = new ComplianceManager();
      logger.info('[Compliance] ComplianceManager service initialized');
    } catch (error) {
      logger.error('[Compliance] Failed to initialize ComplianceManager:', error);
      throw error;
    }
  }
}

/**
 * GET /api/compliance/events
 * Get compliance events with filtering options
 */
complianceRouter.get('/events', async (req, res) => {
  try {
    await initializeComplianceManager();
    
    const { severity, eventType, resolved, limit = 50 } = req.query;
    let events = complianceManager.getComplianceEvents();
    
    // Apply filters
    if (severity) {
      events = events.filter((e: any) => e.severity === severity);
    }
    if (eventType) {
      events = events.filter((e: any) => e.eventType === eventType);
    }
    if (resolved !== undefined) {
      events = events.filter((e: any) => e.resolved === (resolved === 'true'));
    }
    
    // Limit results and sort by timestamp
    events = events
      .sort((a: any, b: any) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, parseInt(limit as string));

    const summary = {
      total: events.length,
      bySeverity: events.reduce((acc: Record<string, number>, e: any) => {
        acc[e.severity] = (acc[e.severity] || 0) + 1;
        return acc;
      }, {}),
      resolved: events.filter((e: any) => e.resolved).length,
      unresolved: events.filter((e: any) => !e.resolved).length
    };

    res.json({
      success: true,
      data: {
        events,
        summary
      }
    });

  } catch (error) {
    logger.error('[Compliance] Error getting compliance events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get compliance events'
    });
  }
});

/**
 * POST /api/compliance/events
 * Record a new compliance event
 */
complianceRouter.post('/events', async (req, res) => {
  try {
    await initializeComplianceManager();
    
    const { eventType, severity, description, details = {}, userId } = req.body;

    if (!eventType || !severity || !description) {
      return res.status(400).json({
        success: false,
        error: 'eventType, severity, and description are required'
      });
    }

    if (!['trade', 'order', 'position', 'access', 'system'].includes(eventType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid eventType. Must be: trade, order, position, access, system'
      });
    }

    if (!['low', 'medium', 'high', 'critical'].includes(severity)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid severity. Must be: low, medium, high, critical'
      });
    }

    const eventId = await complianceManager.recordComplianceEvent(
      eventType,
      severity,
      description,
      details,
      userId
    );

    res.json({
      success: true,
      data: {
        eventId,
        message: 'Compliance event recorded successfully'
      }
    });

  } catch (error) {
    logger.error('[Compliance] Error recording compliance event:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record compliance event'
    });
  }
});

/**
 * GET /api/compliance/audit
 * Get audit trail records
 */
complianceRouter.get('/audit', async (req, res) => {
  try {
    await initializeComplianceManager();
    
    const { limit = 100 } = req.query;
    const auditRecords = complianceManager.getAuditTrail(parseInt(limit as string));

    // Verify audit integrity
    const integrityCheck = await complianceManager.verifyAuditIntegrity();

    res.json({
      success: true,
      data: {
        records: auditRecords,
        integrity: integrityCheck,
        summary: {
          totalRecords: auditRecords.length,
          latestRecord: auditRecords[auditRecords.length - 1]?.timestamp,
          integrityValid: integrityCheck.valid
        }
      }
    });

  } catch (error) {
    logger.error('[Compliance] Error getting audit trail:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get audit trail'
    });
  }
});

/**
 * POST /api/compliance/audit
 * Record audit event (for system use)
 */
complianceRouter.post('/audit', async (req, res) => {
  try {
    await initializeComplianceManager();
    
    const {
      action,
      resource,
      userId,
      details = {},
      ipAddress = req.ip || 'unknown',
      userAgent = req.get('User-Agent') || 'unknown'
    } = req.body;

    if (!action || !resource || !userId) {
      return res.status(400).json({
        success: false,
        error: 'action, resource, and userId are required'
      });
    }

    await complianceManager.recordAuditEvent(
      action,
      resource,
      userId,
      details,
      ipAddress,
      userAgent
    );

    res.json({
      success: true,
      data: {
        message: 'Audit event recorded successfully'
      }
    });

  } catch (error) {
    logger.error('[Compliance] Error recording audit event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record audit event'
    });
  }
});

/**
 * GET /api/compliance/surveillance/alerts
 * Get trade surveillance alerts
 */
complianceRouter.get('/surveillance/alerts', async (req, res) => {
  try {
    await initializeComplianceManager();
    
    const { status, severity, limit = 50 } = req.query;
    let alerts = complianceManager.getSurveillanceAlerts();

    // Apply filters
    if (status) {
      alerts = alerts.filter((a: any) => a.status === status);
    }
    if (severity) {
      alerts = alerts.filter((a: any) => a.severity === severity);
    }

    // Sort by timestamp and limit
    alerts = alerts
      .sort((a: any, b: any) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, parseInt(limit as string));

    const summary = {
      total: alerts.length,
      byStatus: alerts.reduce((acc: Record<string, number>, a: any) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      }, {}),
      bySeverity: alerts.reduce((acc: Record<string, number>, a: any) => {
        acc[a.severity] = (acc[a.severity] || 0) + 1;
        return acc;
      }, {}),
      avgRiskScore: alerts.length > 0 ? 
        alerts.reduce((sum: number, a: any) => sum + a.riskScore, 0) / alerts.length : 0
    };

    res.json({
      success: true,
      data: {
        alerts,
        summary
      }
    });

  } catch (error) {
    logger.error('[Compliance] Error getting surveillance alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get surveillance alerts'
    });
  }
});

/**
 * POST /api/compliance/surveillance/run
 * Run trade surveillance on a specific trade
 */
complianceRouter.post('/surveillance/run', async (req, res) => {
  try {
    await initializeComplianceManager();
    
    const {
      tradeId,
      userId,
      symbol,
      quantity,
      price,
      value,
      timestamp = new Date(),
      orderType = 'market'
    } = req.body;

    if (!tradeId || !userId || !symbol || !quantity || !price || !value) {
      return res.status(400).json({
        success: false,
        error: 'tradeId, userId, symbol, quantity, price, and value are required'
      });
    }

    const tradeData = {
      tradeId,
      userId,
      symbol,
      quantity: parseFloat(quantity),
      price: parseFloat(price),
      value: parseFloat(value),
      timestamp: new Date(timestamp),
      orderType
    };

    const alerts = await complianceManager.runTradeSurveillance(tradeData);

    res.json({
      success: true,
      data: {
        tradeId,
        alerts,
        summary: {
          alertsGenerated: alerts.length,
          highestRiskScore: alerts.length > 0 ? Math.max(...alerts.map(a => a.riskScore)) : 0,
          criticalAlerts: alerts.filter(a => a.severity === 'critical').length
        }
      }
    });

  } catch (error) {
    logger.error('[Compliance] Error running trade surveillance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run trade surveillance'
    });
  }
});

/**
 * GET /api/compliance/surveillance/rules
 * Get surveillance rules configuration
 */
complianceRouter.get('/surveillance/rules', async (req, res) => {
  try {
    await initializeComplianceManager();
    
    const rules = complianceManager.getSurveillanceRules();

    const summary = {
      total: rules.length,
      enabled: rules.filter((r: any) => r.enabled).length,
      byType: rules.reduce((acc: Record<string, number>, r: any) => {
        acc[r.ruleType] = (acc[r.ruleType] || 0) + 1;
        return acc;
      }, {}),
      bySeverity: rules.reduce((acc: Record<string, number>, r: any) => {
        acc[r.severity] = (acc[r.severity] || 0) + 1;
        return acc;
      }, {})
    };

    res.json({
      success: true,
      data: {
        rules,
        summary
      }
    });

  } catch (error) {
    logger.error('[Compliance] Error getting surveillance rules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get surveillance rules'
    });
  }
});

/**
 * GET /api/compliance/reports
 * Get regulatory reports
 */
complianceRouter.get('/reports', async (req, res) => {
  try {
    await initializeComplianceManager();
    
    const { reportType, status, limit = 20 } = req.query;
    let reports = complianceManager.getRegulatoryReports();

    // Apply filters
    if (reportType) {
      reports = reports.filter((r: any) => r.reportType === reportType);
    }
    if (status) {
      reports = reports.filter((r: any) => r.status === status);
    }

    // Sort by generation date and limit
    reports = reports
      .sort((a: any, b: any) => b.generatedAt.getTime() - a.generatedAt.getTime())
      .slice(0, parseInt(limit as string));

    const summary = {
      total: reports.length,
      byType: reports.reduce((acc: Record<string, number>, r: any) => {
        acc[r.reportType] = (acc[r.reportType] || 0) + 1;
        return acc;
      }, {}),
      byStatus: reports.reduce((acc: Record<string, number>, r: any) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {})
    };

    res.json({
      success: true,
      data: {
        reports,
        summary
      }
    });

  } catch (error) {
    logger.error('[Compliance] Error getting regulatory reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get regulatory reports'
    });
  }
});

/**
 * POST /api/compliance/reports/generate
 * Generate a new regulatory report
 */
complianceRouter.post('/reports/generate', async (req, res) => {
  try {
    await initializeComplianceManager();
    
    const {
      reportType,
      startDate,
      endDate,
      generatedBy = 'system'
    } = req.body;

    if (!reportType) {
      return res.status(400).json({
        success: false,
        error: 'reportType is required'
      });
    }

    if (!['daily_trading', 'position_report', 'risk_metrics', 'client_activity'].includes(reportType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid reportType. Must be: daily_trading, position_report, risk_metrics, client_activity'
      });
    }

    const reportId = await complianceManager.generateRegulatoryReport(
      reportType,
      startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000), // Default to yesterday
      endDate ? new Date(endDate) : new Date(),
      generatedBy
    );

    res.json({
      success: true,
      data: {
        reportId,
        message: 'Regulatory report generated successfully'
      }
    });

  } catch (error) {
    logger.error('[Compliance] Error generating regulatory report:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate regulatory report'
    });
  }
});

/**
 * GET /api/compliance/reports/:reportId
 * Get specific regulatory report details
 */
complianceRouter.get('/reports/:reportId', async (req, res) => {
  try {
    await initializeComplianceManager();
    
    const { reportId } = req.params;
    const reports = complianceManager.getRegulatoryReports();
    const report = reports.find((r: any) => r.id === reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    logger.error('[Compliance] Error getting regulatory report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get regulatory report'
    });
  }
});

/**
 * GET /api/compliance/access/roles
 * Get user roles and permissions
 */
complianceRouter.get('/access/roles', async (req, res) => {
  try {
    await initializeComplianceManager();
    
    const roles = complianceManager.getUserRoles();

    res.json({
      success: true,
      data: {
        roles,
        summary: {
          totalRoles: roles.length,
          totalPermissions: [...new Set(roles.flatMap((r: any) => r.permissions))].length
        }
      }
    });

  } catch (error) {
    logger.error('[Compliance] Error getting user roles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user roles'
    });
  }
});

/**
 * POST /api/compliance/access/check
 * Check user permissions
 */
complianceRouter.post('/access/check', async (req, res) => {
  try {
    await initializeComplianceManager();
    
    const { userId, permission } = req.body;

    if (!userId || !permission) {
      return res.status(400).json({
        success: false,
        error: 'userId and permission are required'
      });
    }

    const hasPermission = await complianceManager.checkPermission(userId, permission);

    res.json({
      success: true,
      data: {
        userId,
        permission,
        hasPermission
      }
    });

  } catch (error) {
    logger.error('[Compliance] Error checking permission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check permission'
    });
  }
});

export { complianceRouter };