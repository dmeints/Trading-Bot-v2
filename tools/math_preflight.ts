
// tools/math_preflight.ts
// Verification script that exercises all preflight adapters and writes artifacts

import fs from "fs";
import path from "path";
import { loadFrozenDataset, runBacktestSlice, getBaselinePolicyProbs, getCandidatePolicyProbs, estimateQbVb } from "./preflight_adapters";

// Ensure artifacts directory exists
const artifactsDir = "artifacts/preflight";
fs.mkdirSync(artifactsDir, { recursive: true });

async function main() {
  console.log("🧮 Math Preflight Verification Starting...");
  
  try {
    // 1. Test dataset loading
    console.log("📊 Testing frozen dataset loading...");
    const datasetResult = await loadFrozenDataset("BTCUSDT", "5m");
    console.log(`Dataset load: ${(datasetResult as any).ok ? '✅' : '❌'} (${(datasetResult as any).provenance?.source || (datasetResult as any).reason})`);
    
    // 2. Test backtest slice
    console.log("📈 Testing backtest slice execution...");
    const backtestResult = await runBacktestSlice({
      symbols: ["BTCUSDT"],
      timeframe: "5m", 
      buckets: [0.3, 0.5]
    });
    console.log(`Backtest slice: ${(backtestResult as any).ok ? '✅' : '❌'} (${(backtestResult as any).provenance?.source || (backtestResult as any).reason})`);
    
    // 3. Test policy probabilities
    console.log("🎯 Testing policy probability adapters...");
    const baseline = await getBaselinePolicyProbs();
    const candidate = await getCandidatePolicyProbs();
    console.log(`Baseline policy: ${(baseline as any).ok ? '✅' : '❌'} (${(baseline as any).provenance?.source})`);
    console.log(`Candidate policy: ${(candidate as any).ok ? '✅' : '❌'} (${(candidate as any).provenance?.source})`);
    
    // 4. Test Q/V estimation  
    console.log("🔢 Testing Q/V estimation...");
    const qvResult = await estimateQbVb(baseline, candidate);
    console.log(`Q/V estimation: ${(qvResult as any).ok ? '✅' : '❌'} (${(qvResult as any).provenance?.source})`);
    
    // 5. Write verification artifacts
    const verification = {
      timestamp: new Date().toISOString(),
      results: {
        dataset: datasetResult,
        backtest: backtestResult, 
        baseline: baseline,
        candidate: candidate,
        qv: qvResult
      }
    };
    
    fs.writeFileSync(path.join(artifactsDir, "verification.json"), JSON.stringify(verification, null, 2));
    
    // Write individual artifacts for downstream consumption
    if ((qvResult as any).ok) {
      fs.writeFileSync(path.join(artifactsDir, "dr_ope.json"), JSON.stringify({
        rewards: (qvResult as any).data.rewards,
        pb: (qvResult as any).data.pb,
        p: (qvResult as any).data.p,
        Qb: (qvResult as any).data.Qb,
        Vb: (qvResult as any).data.Vb,
        provenance: (qvResult as any).provenance
      }, null, 2));
    }
    
    if ((backtestResult as any).ok) {
      fs.writeFileSync(path.join(artifactsDir, "slippage_check.json"), JSON.stringify({
        summary: (backtestResult as any).data.summary,
        provenance: (backtestResult as any).provenance
      }, null, 2));
    }
    
    // Mock quantile calibration (placeholder for real implementation)
    fs.writeFileSync(path.join(artifactsDir, "quantile_calibration.json"), JSON.stringify({
      quantiles: [0.05, 0.5, 0.95],
      calibration_scores: [0.92, 0.89, 0.91],
      coverage_rates: [0.048, 0.501, 0.952],
      provenance: "mock_calibration"
    }, null, 2));
    
    console.log("✅ Math preflight verification complete");
    console.log(`📁 Artifacts written to ${artifactsDir}/`);
    
  } catch (error) {
    console.error("❌ Math preflight verification failed:", error);
    process.exit(1);
  }
}

main();
