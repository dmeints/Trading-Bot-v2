
import { Router } from 'express';
import { db } from '../db';

const router = Router();

// Store some runtime metrics
let wsClients = 0;
let routerDecisionsLastMin = 0;
let execBlockedLastMin = 0;
let lastOHLCVSync = Date.now();

// Simple counters for metrics
const metrics = {
  routerDecisions: 0,
  execBlocked: 0
};

router.get('/', async (req, res) => {
  try {
    // Test database latency
    const dbStart = Date.now();
    await db.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - dbStart;

    // Mock WebSocket client count (in real app, would get from WebSocket server)
    wsClients = Math.floor(Math.random() * 50) + 10;

    // Mock recent activity counters
    routerDecisionsLastMin = Math.floor(Math.random() * 100) + 20;
    execBlockedLastMin = Math.floor(Math.random() * 5);

    res.json({
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime(),
      db: {
        connected: true,
        latencyMs: dbLatencyMs
      },
      ws: {
        clients: wsClients
      },
      router: {
        decisionsLastMin: routerDecisionsLastMin
      },
      exec: {
        blockedLastMin: execBlockedLastMin
      },
      lastOHLCVSync: lastOHLCVSync,
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal
      },
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: Date.now(),
      error: 'Health check failed'
    });
  }
});

// Helper functions to update metrics (called from other services)
export const updateRouterDecisions = () => {
  metrics.routerDecisions++;
  routerDecisionsLastMin++;
};

export const updateExecBlocked = () => {
  metrics.execBlocked++;
  execBlockedLastMin++;
};

export const updateOHLCVSync = () => {
  lastOHLCVSync = Date.now();
};

// Reset per-minute counters every minute
setInterval(() => {
  routerDecisionsLastMin = 0;
  execBlockedLastMin = 0;
}, 60000);

export default router;
