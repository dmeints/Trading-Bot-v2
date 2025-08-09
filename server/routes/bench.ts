import { Router } from "express";
import { execSync } from "node:child_process";
import { hashDataset } from "../utils/datasetHash.js";
import type { BenchRunResult } from "../../shared/src/types/bench.js";
import type { Provenance } from "../../shared/src/types/provenance.js";

export const bench = Router();

const commit = (() => { 
  try { 
    return execSync("git rev-parse HEAD").toString().trim(); 
  } catch { 
    return "unknown"; 
  } 
})();

bench.post("/", async (req, res) => {
  const { symbols, timeframe, fromIso, toIso, feeBps, slipBps, rngSeed } = req.body;
  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  // Example computation (replace with actual benchmark logic)
  const data = { symbols, timeframe, fromIso, toIso, feeBps, slipBps, seed: rngSeed };
  const datasetId = hashDataset(data);
  
  const provenance: Provenance = {
    source: "computed",
    datasetId,
    commit,
    runId,
    generatedAt: new Date().toISOString(),
  };
  
  const headline = {
    cashGrowthScore: 0,
    totalReturnPct: 0,
    sharpe: 0,
    sortino: 0,
    winRatePct: 0,
    maxDrawdownPct: 0,
    profitFactor: 0,
  };
  
  const result: BenchRunResult = { 
    runId, 
    status: "done", 
    headline, 
    provenance 
  };
  
  res.json(result);
});