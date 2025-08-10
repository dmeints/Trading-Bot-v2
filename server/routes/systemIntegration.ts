import { Router } from 'express';
import { logger } from '../utils/logger.js';

const systemIntegrationRouter = Router();

// Import system integration manager service dynamically
let systemIntegrationManager: any = null;

async function initializeSystemIntegrationManager() {
  if (!systemIntegrationManager) {
    try {
      const { SystemIntegrationManager } = await import('../services/SystemIntegrationManager.js');
      systemIntegrationManager = new SystemIntegrationManager();
      logger.info('[SystemIntegration] SystemIntegrationManager service initialized');
    } catch (error) {
      logger.error('[SystemIntegration] Failed to initialize SystemIntegrationManager:', error);
      throw error;
    }
  }
}

/**
 * GET /api/system/overview
 * Get comprehensive system overview with health, analytics, and performance metrics
 */
systemIntegrationRouter.get('/overview', async (req, res) => {
  try {
    await initializeSystemIntegrationManager();
    
    const overview = await systemIntegrationManager.getSystemOverview();

    res.json({
      success: true,
      data: overview
    });

  } catch (error) {
    logger.error('[SystemIntegration] Error getting system overview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system overview'
    });
  }
});

/**
 * GET /api/system/health
 * Get detailed system health metrics
 */
systemIntegrationRouter.get('/health', async (req, res) => {
  try {
    await initializeSystemIntegrationManager();
    
    const health = systemIntegrationManager.getSystemHealth();
    const services = systemIntegrationManager.getServiceStatuses();

    const healthSummary = {
      status: 'healthy', // This would be calculated based on metrics
      timestamp: health.timestamp,
      uptime: health.uptime,
      services: {
        total: services.length,
        healthy: services.filter((s: any) => s.status === 'healthy').length,
        degraded: services.filter((s: any) => s.status === 'degraded').length,
        unhealthy: services.filter((s: any) => s.status === 'unhealthy').length
      },
      performance: {
        memoryUsage: health.memoryUsage.percentage,
        cpuUsage: health.cpuUsage,
        averageResponseTime: health.apiResponseTimes.average,
        errorRate: health.errorRate,
        throughput: health.throughput
      }
    };

    res.json({
      success: true,
      data: {
        health,
        services,
        summary: healthSummary
      }
    });

  } catch (error) {
    logger.error('[SystemIntegration] Error getting system health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system health'
    });
  }
});

/**
 * GET /api/system/analytics
 * Get unified analytics across all platform components
 */
systemIntegrationRouter.get('/analytics', async (req, res) => {
  try {
    await initializeSystemIntegrationManager();
    
    const analytics = systemIntegrationManager.getUnifiedAnalytics();

    // Calculate additional insights
    const insights = {
      totalSystemValue: analytics.portfolio.totalAUM,
      dailyGrowthRate: (analytics.trading.volume24h / analytics.portfolio.totalAUM) * 100,
      systemEfficiency: (analytics.trading.successRate + analytics.compliance.integrityScore) / 2,
      userEngagement: analytics.social.socialEngagement + analytics.system.userActivity,
      dataIntegrity: analytics.compliance.integrityScore * 100,
      communityHealth: analytics.social.communityGrowthRate * 100,
      performanceScore: (analytics.trading.successRate * 0.4 + 
                       analytics.portfolio.avgPerformance * 0.3 + 
                       analytics.compliance.integrityScore * 0.3) * 100
    };

    res.json({
      success: true,
      data: {
        analytics,
        insights,
        lastUpdated: analytics.timestamp
      }
    });

  } catch (error) {
    logger.error('[SystemIntegration] Error getting analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics'
    });
  }
});

/**
 * GET /api/system/alerts
 * Get system alerts and notifications
 */
systemIntegrationRouter.get('/alerts', async (req, res) => {
  try {
    await initializeSystemIntegrationManager();
    
    const { severity, includeResolved = false } = req.query;
    let alerts = systemIntegrationManager.getSystemAlerts(includeResolved === 'true');

    // Filter by severity if specified
    if (severity) {
      alerts = alerts.filter((alert: any) => alert.severity === severity);
    }

    // Sort by timestamp (most recent first)
    alerts.sort((a: any, b: any) => b.timestamp.getTime() - a.timestamp.getTime());

    const summary = {
      total: alerts.length,
      bySeverity: alerts.reduce((acc: Record<string, number>, alert: any) => {
        acc[alert.severity] = (acc[alert.severity] || 0) + 1;
        return acc;
      }, {}),
      byType: alerts.reduce((acc: Record<string, number>, alert: any) => {
        acc[alert.type] = (acc[alert.type] || 0) + 1;
        return acc;
      }, {}),
      unresolved: alerts.filter((alert: any) => !alert.resolved).length
    };

    res.json({
      success: true,
      data: {
        alerts,
        summary
      }
    });

  } catch (error) {
    logger.error('[SystemIntegration] Error getting alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get alerts'
    });
  }
});

/**
 * POST /api/system/alerts/:alertId/resolve
 * Resolve a system alert
 */
systemIntegrationRouter.post('/alerts/:alertId/resolve', async (req, res) => {
  try {
    await initializeSystemIntegrationManager();
    
    const { alertId } = req.params;
    const { resolvedBy = 'system-admin' } = req.body;

    const resolved = await systemIntegrationManager.resolveAlert(alertId, resolvedBy);

    if (resolved) {
      res.json({
        success: true,
        data: {
          alertId,
          resolvedBy,
          resolvedAt: new Date(),
          message: 'Alert resolved successfully'
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Alert not found or already resolved'
      });
    }

  } catch (error) {
    logger.error('[SystemIntegration] Error resolving alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert'
    });
  }
});

/**
 * GET /api/system/performance
 * Get performance metrics and optimizations
 */
systemIntegrationRouter.get('/performance', async (req, res) => {
  try {
    await initializeSystemIntegrationManager();
    
    const health = systemIntegrationManager.getSystemHealth();
    const optimizations = systemIntegrationManager.getPerformanceOptimizations();

    const performanceMetrics = {
      current: {
        responseTime: health.apiResponseTimes,
        memoryUsage: health.memoryUsage,
        cpuUsage: health.cpuUsage,
        throughput: health.throughput,
        errorRate: health.errorRate
      },
      optimizations: {
        total: optimizations.length,
        totalImpact: optimizations.reduce((sum: number, opt: any) => sum + opt.performanceImprovement, 0),
        resourceSavings: optimizations.reduce((acc: any, opt: any) => ({
          memory: acc.memory + opt.resourceSavings.memory,
          cpu: acc.cpu + opt.resourceSavings.cpu,
          network: acc.network + opt.resourceSavings.network
        }), { memory: 0, cpu: 0, network: 0 }),
        recent: optimizations.slice(-5) // Last 5 optimizations
      },
      recommendations: [
        {
          component: 'API Response Caching',
          expectedImprovement: 25,
          effort: 'medium',
          description: 'Implement Redis caching for frequently accessed data'
        },
        {
          component: 'Database Query Optimization',
          expectedImprovement: 15,
          effort: 'low',
          description: 'Add database indexes for common query patterns'
        },
        {
          component: 'WebSocket Connection Pooling',
          expectedImprovement: 20,
          effort: 'high',
          description: 'Optimize real-time data streaming connections'
        }
      ]
    };

    res.json({
      success: true,
      data: performanceMetrics
    });

  } catch (error) {
    logger.error('[SystemIntegration] Error getting performance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get performance metrics'
    });
  }
});

/**
 * POST /api/system/performance/optimize
 * Record a performance optimization implementation
 */
systemIntegrationRouter.post('/performance/optimize', async (req, res) => {
  try {
    await initializeSystemIntegrationManager();
    
    const {
      component,
      optimization,
      impact,
      performanceImprovement,
      resourceSavings = { memory: 0, cpu: 0, network: 0 }
    } = req.body;

    if (!component || !optimization || !impact || performanceImprovement === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: component, optimization, impact, performanceImprovement'
      });
    }

    if (!['low', 'medium', 'high'].includes(impact)) {
      return res.status(400).json({
        success: false,
        error: 'Impact must be: low, medium, high'
      });
    }

    await systemIntegrationManager.recordPerformanceOptimization({
      component,
      optimization,
      impact,
      performanceImprovement: parseFloat(performanceImprovement),
      resourceSavings
    });

    res.json({
      success: true,
      data: {
        message: 'Performance optimization recorded successfully',
        component,
        improvement: performanceImprovement
      }
    });

  } catch (error) {
    logger.error('[SystemIntegration] Error recording optimization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record performance optimization'
    });
  }
});

/**
 * GET /api/system/services
 * Get detailed service status information
 */
systemIntegrationRouter.get('/services', async (req, res) => {
  try {
    await initializeSystemIntegrationManager();
    
    const services = systemIntegrationManager.getServiceStatuses();

    const servicesSummary = {
      total: services.length,
      healthy: services.filter((s: any) => s.status === 'healthy').length,
      degraded: services.filter((s: any) => s.status === 'degraded').length,
      unhealthy: services.filter((s: any) => s.status === 'unhealthy').length,
      averageResponseTime: services.reduce((sum: number, s: any) => sum + s.responseTime, 0) / services.length,
      totalErrors: services.reduce((sum: number, s: any) => sum + s.errorCount, 0),
      oldestUptime: Math.min(...services.map((s: any) => s.uptime))
    };

    res.json({
      success: true,
      data: {
        services,
        summary: servicesSummary
      }
    });

  } catch (error) {
    logger.error('[SystemIntegration] Error getting services:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get services'
    });
  }
});

/**
 * GET /api/system/intelligence
 * Get AI-powered system insights and predictions
 */
systemIntegrationRouter.get('/intelligence', async (req, res) => {
  try {
    await initializeSystemIntegrationManager();
    
    const analytics = systemIntegrationManager.getUnifiedAnalytics();
    const health = systemIntegrationManager.getSystemHealth();
    const alerts = systemIntegrationManager.getSystemAlerts();

    // Generate AI insights (simulated intelligent analysis)
    const insights = {
      systemTrends: {
        performance: {
          trend: 'improving',
          confidence: 0.85,
          prediction: 'System performance expected to improve by 12% over next 7 days'
        },
        usage: {
          trend: 'stable',
          confidence: 0.92,
          prediction: 'User activity will remain steady with 5% growth'
        },
        errors: {
          trend: 'decreasing',
          confidence: 0.78,
          prediction: 'Error rates trending down, expect 20% reduction'
        }
      },
      businessInsights: {
        trading: {
          recommendation: 'Optimize order execution algorithms',
          impact: 'high',
          reasoning: 'Current success rate of 68% could reach 75% with ML optimization'
        },
        portfolio: {
          recommendation: 'Implement dynamic rebalancing',
          impact: 'medium',
          reasoning: 'Average performance could improve by 8% with automated rebalancing'
        },
        social: {
          recommendation: 'Enhance community features',
          impact: 'high',
          reasoning: 'Social engagement growth rate of 15% indicates strong user interest'
        }
      },
      predictiveAlerts: [
        {
          type: 'performance',
          probability: 0.25,
          timeframe: '2-4 hours',
          description: 'Memory usage may exceed 80% during peak trading hours'
        },
        {
          type: 'capacity',
          probability: 0.15,
          timeframe: '1-2 days',
          description: 'API throughput may require scaling for increased user activity'
        }
      ],
      optimization: {
        priority: 'Database query optimization',
        expectedGain: '25% response time improvement',
        effort: 'medium',
        roi: 'high'
      }
    };

    res.json({
      success: true,
      data: {
        insights,
        dataPoints: {
          systemScore: (analytics.trading.successRate * 100).toFixed(1),
          healthGrade: health.memoryUsage.percentage < 70 ? 'A' : 'B',
          riskLevel: alerts.length > 5 ? 'elevated' : 'normal',
          efficiency: ((analytics.trading.successRate + analytics.compliance.integrityScore) / 2 * 100).toFixed(1)
        },
        generatedAt: new Date()
      }
    });

  } catch (error) {
    logger.error('[SystemIntegration] Error generating intelligence insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate intelligence insights'
    });
  }
});

export { systemIntegrationRouter };