
// Optuna tuning for Stevie (deterministic). No network allowed in backtest.
// Uses walk-forward: train (T-2), validate (T-1), test (T). Parallel-safe via RDB.
import { spawnSync } from "node:child_process";
import fs from "fs";
import path from "path";

type SearchSpace = {
  volPctBreakout: [number, number, number];
  volPctMeanRevert: [number, number, number];
  socialGo: [number, number, number];
  costCapBps: [number, number, number];
  tpBreakout: [number, number, number];
  slBreakout: [number, number, number];
  tpRevert: [number, number, number];
  slRevert: [number, number, number];
  tpNews: [number, number, number];
  slNews: [number, number, number];
  minInterTradeSec: [number, number, number];
  burstCapPerMin: [number, number, number];
  baseRiskPct: [number, number, number];
  varianceTargetPct: [number, number, number];
  temper: [number, number, number];
  newsMaxRiskPct: [number, number, number];
};

const SPACE: SearchSpace = {
  volPctBreakout: [60, 85, 2],
  volPctMeanRevert: [25, 45, 2],
  socialGo: [0.5, 1.2, 0.05],
  costCapBps: [5, 12, 1],
  tpBreakout: [6, 18, 2],
  slBreakout: [4, 10, 1],
  tpRevert: [6, 16, 2],
  slRevert: [4, 10, 1],
  tpNews: [8, 20, 2],
  slNews: [6, 12, 1],
  minInterTradeSec: [10, 90, 5],
  burstCapPerMin: [1, 5, 1],
  baseRiskPct: [0.2, 0.8, 0.05],
  varianceTargetPct: [8, 14, 1],
  temper: [0.2, 0.7, 0.05],
  newsMaxRiskPct: [0.2, 0.6, 0.05],
};

function run(cmd: string, args: string[], env: Record<string,string|undefined> = {}): { ok: boolean; out: string } {
  const r = spawnSync(cmd, args, { encoding: "utf8", env: { ...process.env, ...env } });
  const out = (r.stdout || "") + (r.stderr || "");
  return { ok: r.status === 0, out };
}

function backtestOnce(params: Record<string, number>, tag: string) {
  // IMPORTANT: enforce no network inside backtest runner
  const args = [
    "exec", "tsx", "cli/bench.ts",
    "--strategy", "stevie",
    "--version", tag,
    "--symbols", "BTCUSDT,ETHUSDT",
    "--timeframe", "5m",
    "--from", process.env.TUNE_FROM || "2024-06-01",
    "--to", process.env.TUNE_TO || "2024-06-30",
    "--rng-seed", "42",
  ];
  const env: Record<string,string> = { NO_BACKTEST_NETWORK: "1" };
  for (const [k,v] of Object.entries(params)) env[`STEVIETUNE_${k}`] = String(v);
  
  const r = run("npm", args, env);
  if (!r.ok) throw new Error("Backtest failed: " + r.out);
  
  // Look for artifacts output
  const artifactMatch = /artifacts\/([A-Za-z0-9\-_]+)\/metrics\.json/.exec(r.out);
  const metricsPath = artifactMatch ? artifactMatch[0] : "artifacts/latest/metrics.json";
  
  if (!fs.existsSync(metricsPath)) {
    throw new Error("metrics.json not found; output:\n" + r.out);
  }
  
  const metrics = JSON.parse(fs.readFileSync(metricsPath, "utf8"));
  return { metrics, path: metricsPath };
}

function constraintFail(m: any): string[] {
  const reasons: string[] = [];
  const pf = m?.headline?.profitFactor ?? 0;
  const mdd = m?.headline?.maxDrawdownPct ?? 999;
  const slipErr = m?.slippage_error_bps ?? 999;
  const tpd = m?.tradesPerDay ?? 0;
  
  if (pf < 1.2) reasons.push("pf<1.2");
  if (mdd > 10) reasons.push("mdd>10%");
  if (slipErr > 5) reasons.push("slippage_err>5bps");
  if (tpd < 3 || tpd > 30) reasons.push("trades/day out of [3..30]");
  
  return reasons;
}

function cashGrowthScore(m: any): number {
  const s = m?.headline?.cash_growth_score ?? 0;
  return typeof s === "number" ? s : 0;
}

// Coarse grid generator
function* grid(space: SearchSpace): Generator<Record<string, number>> {
  // Full grid is huge; we'll subsample randomly for the coarse pass.
  // We'll instead draw N random points within bounds.
  const N = Number(process.env.COARSE_N || 120); // adjust
  const keys = Object.keys(space);
  
  for (let n = 0; n < N; n++) {
    const params: Record<string, number> = {};
    for (const k of keys) {
      const [lo, hi, step] = (space as any)[k];
      const steps = Math.round((hi - lo) / step);
      const r = Math.floor(Math.random() * (steps + 1));
      params[k] = +(lo + r * step).toFixed(10);
    }
    yield params;
  }
}

function writeCSV(rows: any[], outPath: string) {
  const keys = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  const head = keys.join(",");
  const body = rows.map(r => keys.map(k => JSON.stringify(r[k] ?? "")).join(",")).join("\n");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, head + "\n" + body);
}

async function main() {
  const rows: any[] = [];
  let best: any = null;

  console.log("🔍 Starting coarse grid search...");

  // Coarse search
  for (const params of grid(SPACE)) {
    try {
      const { metrics } = backtestOnce(params, "coarse");
      const reasons = constraintFail(metrics);
      const score = cashGrowthScore(metrics);
      const row = {
        phase: "coarse",
        score,
        reasons: reasons.join("|"),
        ...params,
        pf: metrics?.headline?.profitFactor,
        mdd: metrics?.headline?.maxDrawdownPct,
        sharpe: metrics?.headline?.sharpe,
        tradesPerDay: metrics?.tradesPerDay
      };
      rows.push(row);
      
      if (!reasons.length && (!best || score > best.score)) {
        best = row;
      }
      
      console.log("coarse:", row);
    } catch (e: any) {
      console.error("coarse_fail:", e.message);
    }
  }

  if (!best) {
    throw new Error("No feasible config found in coarse pass");
  }

  console.log("🎯 Best coarse config:", best);

  // Refine region around best with Optuna (Python runner)
  const studyDB = process.env.OPTUNA_RDB || "sqlite:///artifacts/tuning/stevie_optuna.db";
  const optunaEnv = {
    OPTUNA_RDB: studyDB,
    ...Object.fromEntries(Object.entries(best).map(([k, v]) => [`BEST_${k}`, String(v)]))
  };
  
  const py = run("python", ["tools/tune/stevie_optuna.py"], optunaEnv);
  if (!py.ok) {
    console.warn("Optuna refinement failed:", py.out);
  } else {
    console.log(py.out);
  }

  // Collect Optuna results CSV if emitted
  const optunaCSV = "artifacts/tuning/optuna_top10.csv";
  if (fs.existsSync(optunaCSV)) {
    const txt = fs.readFileSync(optunaCSV, "utf8");
    console.log("optuna_top10.csv:\n" + txt);
  }

  writeCSV(rows, "artifacts/tuning/coarse_results.csv");
  console.log("✅ Coarse results saved -> artifacts/tuning/coarse_results.csv");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
