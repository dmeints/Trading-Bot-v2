
import { Router } from 'express';
import { db } from '../db.js';
import { ws } from '../ws.js';
import { strategyRouter } from '../services/StrategyRouter.js';
import { executionRouter } from '../services/ExecutionRouter.js';
import { dataQuality } from '../services/DataQuality.js';
import { riskGuards } from '../services/RiskGuards.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Track metrics for health endpoint
let healthMetrics = {
  routerDecisionsLastMin: 0,
  execBlockedLastMin: 0,
  lastRouterDecision: new Date(),
  lastExecBlocked: new Date(),
  dbConnectionOk: true,
  dbLatencyMs: 0
};

// Reset counters every minute
setInterval(() => {
  healthMetrics.routerDecisionsLastMin = 0;
  healthMetrics.execBlockedLastMin = 0;
}, 60000);

router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Test database connectivity and latency
    try {
      await db.execute('SELECT 1');
      healthMetrics.dbLatencyMs = Date.now() - startTime;
      healthMetrics.dbConnectionOk = true;
    } catch (error) {
      healthMetrics.dbConnectionOk = false;
      healthMetrics.dbLatencyMs = -1;
    }

    // Get WebSocket client count
    const wsClients = ws.clients?.size || 0;

    // Get data quality stats
    const dataQualityStats = dataQuality.getStats();

    // Get risk guard state
    const guardState = riskGuards.getState();

    // Calculate uptime
    const uptime = process.uptime();

    // Get execution history
    const executionRecords = executionRouter.getExecutionRecords();

    const health = {
      status: healthMetrics.dbConnectionOk ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.floor(uptime),
      
      // Database metrics
      db: {
        connected: healthMetrics.dbConnectionOk,
        latencyMs: healthMetrics.dbLatencyMs
      },
      
      // WebSocket metrics
      ws: {
        clients: wsClients,
        connected: wsClients > 0
      },
      
      // Strategy Router metrics
      router: {
        decisionsLastMin: healthMetrics.routerDecisionsLastMin,
        lastDecision: healthMetrics.lastRouterDecision.toISOString(),
        activePolicies: Array.from(strategyRouter.getPolicies().keys()).length
      },
      
      // Execution metrics
      execution: {
        blockedLastMin: healthMetrics.execBlockedLastMin,
        lastBlocked: healthMetrics.lastExecBlocked.toISOString(),
        totalExecutions: executionRecords.length,
        avgExecutionSize: executionRecords.length > 0 ? 
          executionRecords.reduce((sum, r) => sum + r.finalSize, 0) / executionRecords.length : 0
      },
      
      // Data Quality metrics
      dataQuality: {
        totalCandles: dataQualityStats.totalCandles,
        quarantinedCandles: dataQualityStats.quarantinedCandles,
        schemaViolations: dataQualityStats.schemaViolations,
        spikeDetections: dataQualityStats.spikeDetections,
        qualityScore: dataQualityStats.totalCandles > 0 ? 
          1 - (dataQualityStats.quarantinedCandles / dataQualityStats.totalCandles) : 1
      },
      
      // Risk Guard metrics
      riskGuards: {
        drawdownBreakerActive: guardState.drawdownBreaker.active,
        totalNotional: guardState.totalNotional,
        symbolCount: Object.keys(guardState.symbolNotionals).length
      },
      
      // System metrics
      system: {
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        nodeVersion: process.version
      }
    };

    res.json(health);
  } catch (error) {
    logger.error('[Health] Health check error:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Helper functions to update metrics (called by other services)
export function recordRouterDecision(): void {
  healthMetrics.routerDecisionsLastMin++;
  healthMetrics.lastRouterDecision = new Date();
}

export function recordExecutionBlocked(): void {
  healthMetrics.execBlockedLastMin++;
  healthMetrics.lastExecBlocked = new Date();
}

export default router;
