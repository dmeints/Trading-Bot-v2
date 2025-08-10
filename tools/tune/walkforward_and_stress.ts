
// Runs the tuned config over sliding windows + stress scenarios; writes a summary CSV and JSON.
import fs from "fs";
import path from "path";
import { spawnSync } from "node:child_process";

function run(from: string, to: string, tag: string, stress?: string) { 
  const env: any = { NO_BACKTEST_NETWORK: "1", ...(stress ? { STRESS: stress } : {}) };
  const r = spawnSync("npm", ["exec", "tsx", "cli/bench.ts", "--strategy", "stevie", "--version", tag, "--symbols", "BTCUSDT,ETHUSDT", "--timeframe", "5m", "--from", from, "--to", to, "--rng-seed", "7"], { 
    encoding: "utf8", 
    env: { ...process.env, ...env } 
  });
  
  const out = (r.stdout || "") + (r.stderr || "");
  if (r.status !== 0) throw new Error(out);
  
  const p = "artifacts/latest/metrics.json";
  if (!fs.existsSync(p)) throw new Error("metrics not found");
  
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function write(pathOut: string, rows: any[]) {
  const keys = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  const head = keys.join(",");
  const body = rows.map(r => keys.map(k => JSON.stringify(r[k] ?? "")).join(",")).join("\n");
  fs.mkdirSync(path.dirname(pathOut), { recursive: true });
  fs.writeFileSync(pathOut, head + "\n" + body);
}

const windows = [
  { name: "W1", train: "2024-04-01..2024-04-30", valid: "2024-05-01..2024-05-31", test: "2024-06-01..2024-06-30" },
  { name: "W2", train: "2024-05-01..2024-05-31", valid: "2024-06-01..2024-06-30", test: "2024-07-01..2024-07-31" },
  { name: "W3", train: "2024-06-01..2024-06-30", valid: "2024-07-01..2024-07-31", test: "2024-08-01..2024-08-07" }
];

const stresses = ["fees+25", "slip+25", "weekend", "news"];
const rows: any[] = [];

console.log("🧪 Running walk-forward and stress tests...");

for (const w of windows) {
  const [tf, tt] = w.test.split("..");
  
  // Base test
  const m = run(tf, tt, "candidate");
  rows.push({
    phase: "test",
    window: w.name,
    sharpe: m.headline?.sharpe,
    pf: m.headline?.profitFactor,
    mdd: m.headline?.maxDrawdownPct,
    score: m.headline?.cash_growth_score,
    slipErr: m.slippage_error_bps,
    tpd: m.tradesPerDay
  });
  
  // Stress tests
  for (const s of stresses) {
    try {
      const ms = run(tf, tt, "candidate", s);
      rows.push({
        phase: s,
        window: w.name,
        sharpe: ms.headline?.sharpe,
        pf: ms.headline?.profitFactor,
        mdd: ms.headline?.maxDrawdownPct,
        score: ms.headline?.cash_growth_score,
        slipErr: ms.slippage_error_bps,
        tpd: ms.tradesPerDay
      });
    } catch (e: any) {
      console.warn(`Stress test ${s} failed for window ${w.name}:`, e.message);
    }
  }
}

write("artifacts/tuning/walkforward_stress.csv", rows);
console.log("✅ walk-forward + stress summary -> artifacts/tuning/walkforward_stress.csv");
