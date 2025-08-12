
/**
 * Runs deterministic walk-forward benchmarks (no network) for:
 *  - Stevie (current candidate config)
 *  - Baselines: Buy&Hold, SMA(20/50), Donchian(20/55)
 * Across symbols/timeframes/windows. Computes metrics + bootstrap CIs.
 * Emits:
 *  - artifacts/bench/summary.csv
 *  - artifacts/bench/summary.json
 *  - artifacts/bench/report.md
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "node:child_process";

type Pair = { symbol: string; timeframe: string };

const PAIRS: Pair[] = [
  { symbol: "BTCUSDT", timeframe: "5m" },
  { symbol: "BTCUSDT", timeframe: "15m" },
  { symbol: "ETHUSDT", timeframe: "5m" },
  { symbol: "ETHUSDT", timeframe: "15m" }
];

const WINDOWS = [
  { name: "W1", from: "2024-04-01", to: "2024-05-01" },
  { name: "W2", from: "2024-05-01", to: "2024-06-01" },
  { name: "W3", from: "2024-06-01", to: "2024-07-01" },
  { name: "W4", from: "2024-07-01", to: "2024-08-01" }
];

const STRATS = [
  { id: "stevie", args: ["--strategy", "stevie", "--version", "candidate"] },
  { id: "buyhold", args: ["--strategy", "buyhold"] },
  { id: "sma", args: ["--strategy", "sma", "--fast", "20", "--slow", "50"] },
  { id: "donchian", args: ["--strategy", "donchian", "--channel", "20", "--alt", "55"] }
];

function runOnce(stratId: string, args: string[], symbol: string, timeframe: string, from: string, to: string) {
  const env = { ...process.env, NO_BACKTEST_NETWORK: "1", RNG_SEED: "1337" };
  const cmd = [
    "tsx", "cli/bench.ts", "run",
    ...args,
    "--symbols", symbol,
    "--timeframe", timeframe,
    "--from", from,
    "--to", to,
    "--rng-seed", env.RNG_SEED!
  ];
  
  const r = spawnSync("npx", cmd, { encoding: "utf8", env });
  const out = (r.stdout || "") + (r.stderr || "");
  
  if (r.status !== 0) return { ok: false, out };
  
  const metricsPath = path.join("artifacts", "latest", "metrics.json");
  if (!fs.existsSync(metricsPath)) return { ok: false, out: "metrics_missing" };
  
  const m = JSON.parse(fs.readFileSync(metricsPath, "utf8"));
  return { ok: true, m, out };
}

function rowOf(sid: string, p: Pair, w: any, m: any) {
  return {
    strategy: sid,
    symbol: p.symbol,
    timeframe: p.timeframe,
    window: w.name,
    sharpe: +m?.headline?.sharpe || 0,
    pf: +m?.headline?.profitFactor || 0,
    mdd: +m?.headline?.maxDrawdownPct || 0,
    win: +m?.headline?.winRatePct || 0,
    ret: +m?.headline?.totalReturnPct || 0,
    slipErrBps: +m?.slippage_error_bps || 0,
    trades: +m?.tradeCount || 0,
    score: +m?.headline?.cash_growth_score || 0
  };
}

(async () => {
  fs.mkdirSync("artifacts/bench", { recursive: true });
  const rows: any[] = [];
  
  for (const p of PAIRS) {
    for (const w of WINDOWS) {
      for (const s of STRATS) {
        const r = runOnce(s.id, s.args, p.symbol, p.timeframe, w.from, w.to);
        if (!r.ok) {
          console.error("run_failed", s.id, p, w, r.out.slice(0, 300));
          process.exit(1);
        }
        rows.push(rowOf(s.id, p, w, r.m));
      }
    }
  }
  
  // Bootstrap CI for Stevie vs baselines (per pair, pooled across windows)
  function ciDelta(metric: "score" | "sharpe" | "pf" | "mdd") {
    const res: any[] = [];
    const groups = new Map<string, any[]>();
    
    for (const r of rows) {
      const key = r.symbol + "_" + r.timeframe;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    
    for (const [k, arr] of groups) {
      const ste = arr.filter(r => r.strategy === "stevie").map(r => r[metric]);
      
      for (const base of ["buyhold", "sma", "donchian"]) {
        const bb = arr.filter(r => r.strategy === base).map(r => r[metric]);
        const n = Math.min(ste.length, bb.length);
        if (!n) continue;
        
        const deltas = [];
        const N = 1000;
        
        for (let i = 0; i < N; i++) {
          let s = 0;
          for (let j = 0; j < n; j++) {
            const idx = Math.floor(Math.random() * n);
            s += (ste[idx] - bb[idx]);
          }
          deltas.push(s / n);
        }
        
        deltas.sort((a, b) => a - b);
        const ciLow = deltas[Math.floor(0.025 * N)];
        const ciHigh = deltas[Math.floor(0.975 * N)];
        
        res.push({
          group: k,
          base,
          metric,
          meanDelta: deltas.reduce((a, b) => a + b, 0) / N,
          ciLow,
          ciHigh
        });
      }
    }
    return res;
  }
  
  const ciScore = ciDelta("score");
  const ciSharpe = ciDelta("sharpe");
  const ciPF = ciDelta("pf");
  
  // Write artifacts
  const csvHead = Object.keys(rows[0] || {});
  const csv = [csvHead.join(",")]
    .concat(rows.map(r => csvHead.map(k => JSON.stringify(r[k] ?? "")).join(",")))
    .join("\n");
  
  fs.writeFileSync("artifacts/bench/summary.csv", csv);
  fs.writeFileSync("artifacts/bench/summary.json", JSON.stringify({
    rows,
    ci: { score: ciScore, sharpe: ciSharpe, pf: ciPF }
  }, null, 2));
  
  fs.writeFileSync("artifacts/bench/report.md", [
    "# Stevie Historical Benchmark",
    "",
    "## Summary (per window/strategy) -> artifacts/bench/summary.csv",
    "",
    "## Stevie vs Baselines (95% bootstrap CI on deltas)",
    "```json",
    JSON.stringify({ ciScore, ciSharpe, ciPF }, null, 2),
    "```"
  ].join("\n"));
  
  console.log("✓ wrote artifacts/bench/summary.csv, summary.json, report.md");
})();
