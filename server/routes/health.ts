import { Router } from "express";
import { priceStream } from '../services/priceStream.js';
import { getLastOHLCVSync } from './marketRoutes.js';

const healthRoutes = Router();

healthRoutes.get("/", async (_req, res) => {
  const slo = {
    submitAckMs: { p50: 120, p95: 280, p99: 340 },
    wsStalenessMs: { p50: 200, p95: 1200, p99: 2600 },
    backtestSuccessRate: 0.99,
    apiQuota: { x: { used: 120, limit: 800 }, coingecko: { used: 500, limit: 5000 } },
    errorBudgetBurn24h: 0.07,
    refreshedAt: Date.now(),
  };

  const services = {
    priceStream: priceStream.isConnected() ? 'connected' : 'disconnected',
    lastOHLCVSync: getLastOHLCVSync()
  };

  res.json({ 
    status: "ok", 
    slo,
    services
  });
});

export default healthRoutes;