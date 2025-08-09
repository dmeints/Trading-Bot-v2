import { Router } from "express";
export const health = Router();

health.get("/", async (_req, res) => {
  // TODO: replace placeholders with real histogram snapshots
  const slo = {
    submitAckMs: { p50: 120, p95: 280, p99: 340 },
    wsStalenessMs: { p50: 200, p95: 1200, p99: 2600 },
    backtestSuccessRate: 0.99,
    apiQuota: { x: { used: 120, limit: 800 }, coingecko: { used: 500, limit: 5000 } },
    errorBudgetBurn24h: 0.07,
    refreshedAt: Date.now(),
  };
  res.json({ status: "ok", slo });
});