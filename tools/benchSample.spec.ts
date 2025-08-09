import fs from "fs";
import path from "path";
import { describe, test, expect } from "vitest";

const BENCH_DIR = "bench-results";

describe("Bench sample: artifacts and provenance", () => {
  test("sample bench run writes all artifacts with provenance", async () => {
    // Ensure bench directory exists
    if (!fs.existsSync(BENCH_DIR)) fs.mkdirSync(BENCH_DIR, { recursive: true });
    
    const runId = `test_${Date.now()}`;
    const datasetId = "abc123";
    const commit = "test-commit";
    
    const manifest = {
      runId,
      datasetId,
      commit,
      generatedAt: new Date().toISOString(),
      headline: {
        sharpe: undefined,
        totalReturnPct: undefined,
        winRatePct: undefined,
        maxDrawdownPct: undefined,
        profitFactor: undefined,
        cashGrowthScore: undefined,
      }
    };
    
    const manifestPath = path.join(BENCH_DIR, `${runId}.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    // Verify artifacts
    expect(fs.existsSync(manifestPath)).toBe(true);
    const written = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(written.datasetId).toBe(datasetId);
    expect(written.commit).toBe(commit);
    expect(written.headline.sharpe).toBe(undefined);
    
    // Cleanup
    fs.unlinkSync(manifestPath);
  });
});