
import { describe, it, expect } from "vitest";
import { loadFrozenDataset, runBacktestSlice } from "../preflight_adapters";

describe("preflight adapters", () => {
  it("loadFrozenDataset returns ok|fail with provenance", async () => {
    const r: any = await loadFrozenDataset("BTCUSDT", "5m");
    expect(r.ok === true || r.ok === false).toBe(true);
    expect(r.provenance || r.reason).toBeDefined();
    
    if (r.ok) {
      expect(Array.isArray(r.data.X)).toBe(true);
      expect(Array.isArray(r.data.y)).toBe(true);
      expect(r.provenance.source).toBeDefined();
    } else {
      expect(r.reason).toBeDefined();
      expect(r.provenance.attempts).toBeDefined();
    }
  });

  it("runBacktestSlice returns ok|fail with provenance", async () => {
    const r: any = await runBacktestSlice({ 
      symbols: ["BTCUSDT"], 
      timeframe: "5m", 
      buckets: [0.3] 
    });
    expect(r.ok === true || r.ok === false).toBe(true);
    
    if (r.ok) {
      expect(Array.isArray(r.data.summary)).toBe(true);
      expect(r.provenance.source).toBe("bench_runner");
    } else {
      expect(r.reason).toBeDefined();
      expect(r.provenance).toBeDefined();
    }
  });

  it("policy probability functions return valid structure", async () => {
    const { getBaselinePolicyProbs, getCandidatePolicyProbs } = await import("../preflight_adapters");
    
    const baseline: any = await getBaselinePolicyProbs();
    const candidate: any = await getCandidatePolicyProbs();
    
    expect(baseline.ok).toBe(true);
    expect(candidate.ok).toBe(true);
    expect(Array.isArray(baseline.data.probs)).toBe(true);
    expect(Array.isArray(candidate.data.probs)).toBe(true);
    expect(baseline.provenance.source).toBeDefined();
    expect(candidate.provenance.source).toBeDefined();
  });
});
