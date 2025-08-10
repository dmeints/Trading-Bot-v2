
// Choose Pareto-optimal params from coarse+optuna CSVs and emit stevie.config.yaml#v2.1.X
import fs from "fs";
import path from "path";

function parseCSV(p: string) {
  if (!fs.existsSync(p)) return [];
  const [head, ...rows] = fs.readFileSync(p, "utf8").trim().split("\n");
  const cols = head.split(",");
  return rows.map(r => {
    const cells = r.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.replace(/^"|"$/g, ""));
    const obj: any = {};
    cols.forEach((k, i) => obj[k] = cells[i]);
    return obj;
  });
}

const coarse = parseCSV("artifacts/tuning/coarse_results.csv");
const optuna = parseCSV("artifacts/tuning/optuna_top10.csv").map(r => ({
  phase: "optuna",
  score: +r.value,
  params: JSON.parse(r.params),
  metrics: JSON.parse(r.metrics || "{}")
}));

const all = [...coarse, ...optuna];
if (!all.length) throw new Error("No tuning rows found");

function dominates(a: any, b: any) {
  // maximize score, minimize mdd & slipErr, maximize pf
  const sA = +(a.score || 0), sB = +(b.score || 0);
  const mA = +(a.mdd ?? a.metrics?.maxDrawdownPct ?? 999), mB = +(b.mdd ?? b.metrics?.maxDrawdownPct ?? 999);
  const pA = +(a.pf ?? a.metrics?.profitFactor ?? 0), pB = +(b.pf ?? b.metrics?.profitFactor ?? 0);
  const eA = +(a.slipErr ?? a.metrics?.slippage_error_bps ?? 999), eB = +(b.slipErr ?? b.metrics?.slippage_error_bps ?? 999);
  
  const betterOrEqual = (sA >= sB) && (mA <= mB) && (pA >= pB) && (eA <= eB);
  const strictlyBetter = (sA > sB) || (mA < mB) || (pA > pB) || (eA < eB);
  return betterOrEqual && strictlyBetter;
}

const pareto: any[] = [];
for (const r of all) {
  if (pareto.some(p => dominates(p, r))) continue;
  // remove any points dominated by r
  for (let i = pareto.length - 1; i >= 0; i--) {
    if (dominates(r, pareto[i])) pareto.splice(i, 1);
  }
  pareto.push(r);
}

pareto.sort((a, b) => (+(b.score || 0)) - (+(a.score || 0)));

const top = pareto[0];
const out = {
  version: "v2.1.candidate",
  params: top.params || Object.fromEntries(
    Object.keys(top)
      .filter(k => !/^(phase|score|reasons|pf|mdd|sharpe|tradesPerDay|metrics)$/.test(k))
      .map(k => [k, +top[k]])
  ),
  provenance: {
    createdAt: new Date().toISOString(),
    sources: ["coarse_results.csv", "optuna_top10.csv"]
  }
};

fs.mkdirSync("artifacts/tuning", { recursive: true });
fs.writeFileSync("artifacts/tuning/stevie.config.candidate.json", JSON.stringify(out, null, 2));
console.log("✅ Emitted artifacts/tuning/stevie.config.candidate.json");

// Also log the top metrics
console.log("🏆 Best candidate metrics:", {
  score: top.score || top.metrics?.cash_growth_score,
  sharpe: top.sharpe || top.metrics?.sharpe,
  profitFactor: top.pf || top.metrics?.profitFactor,
  maxDrawdown: top.mdd || top.metrics?.maxDrawdownPct,
  slippageError: top.slipErr || top.metrics?.slippage_error_bps,
  tradesPerDay: top.tpd || top.metrics?.tradesPerDay
});
// Choose Pareto-optimal params from coarse+optuna CSVs and emit stevie.config.yaml#v2.1.X
import fs from "fs";
import path from "path";

function parseCSV(p: string) {
  if (!fs.existsSync(p)) return [];
  const [head, ...rows] = fs.readFileSync(p, "utf8").trim().split("\n");
  const cols = head.split(",");
  return rows.map(r => {
    const cells = r.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.replace(/^"|"$/g, ""));
    const obj: any = {};
    cols.forEach((k, i) => obj[k] = cells[i]);
    return obj;
  });
}

const coarse = parseCSV("artifacts/tuning/coarse_results.csv");
const optuna = parseCSV("artifacts/tuning/optuna_top10.csv").map(r => ({
  phase: "optuna", score: +r.value, params: JSON.parse(r.params), metrics: JSON.parse(r.metrics || "{}")
}));
const all = [...coarse, ...optuna];

if (!all.length) throw new Error("No tuning rows found");

function dominates(a: any, b: any) {
  // maximize score, minimize mdd & slipErr, maximize pf
  const sA = +(a.score || 0), sB = +(b.score || 0);
  const mA = +(a.mdd ?? a.metrics?.maxDrawdownPct ?? 999), mB = +(b.mdd ?? b.metrics?.maxDrawdownPct ?? 999);
  const pA = +(a.pf ?? a.metrics?.profitFactor ?? 0), pB = +(b.pf ?? b.metrics?.profitFactor ?? 0);
  const eA = +(a.slipErr ?? a.metrics?.slippage_error_bps ?? 999), eB = +(b.slipErr ?? b.metrics?.slippage_error_bps ?? 999);
  const betterOrEqual = (sA >= sB) && (mA <= mB) && (pA >= pB) && (eA <= eB);
  const strictlyBetter = (sA > sB) || (mA < mB) || (pA > pB) || (eA < eB);
  return betterOrEqual && strictlyBetter;
}

const pareto: any[] = [];
for (const r of all) {
  if (pareto.some(p => dominates(p, r))) continue;
  // remove any points dominated by r
  for (let i = pareto.length - 1; i >= 0; i--) {
    if (dominates(r, pareto[i])) pareto.splice(i, 1);
  }
  pareto.push(r);
}

pareto.sort((a, b) => (+(b.score || 0)) - (+(a.score || 0)));

const top = pareto[0];
const out = {
  version: "v2.1.candidate",
  params: top.params || Object.fromEntries(
    Object.keys(top)
      .filter(k => !/^(phase|score|reasons|pf|mdd|sharpe|tradesPerDay|metrics)$/.test(k))
      .map(k => [k, +top[k]])
  ),
  provenance: {
    createdAt: new Date().toISOString(),
    sources: ["coarse_results.csv", "optuna_top10.csv"],
    paretoSize: pareto.length,
    metrics: {
      score: +(top.score || 0),
      sharpe: +(top.sharpe || top.metrics?.sharpe || 0),
      profitFactor: +(top.pf || top.metrics?.profitFactor || 0),
      maxDrawdown: +(top.mdd || top.metrics?.maxDrawdownPct || 0),
      tradesPerDay: +(top.tradesPerDay || top.metrics?.tradesPerDay || 0)
    }
  }
};

fs.mkdirSync("artifacts/tuning", { recursive: true });
fs.writeFileSync("artifacts/tuning/stevie.config.candidate.json", JSON.stringify(out, null, 2));

console.log("✅ Emitted artifacts/tuning/stevie.config.candidate.json");
console.log("📊 Candidate metrics:", out.provenance.metrics);
console.log("🎯 Pareto front size:", pareto.length);
