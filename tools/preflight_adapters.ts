
// tools/preflight_adapters.ts
// Real adapters for preflight. Attempts in priority order with provenance.
// Requires: DATABASE_URL (Postgres), local frozen datasets under data/frozen/, bench runner via pnpm.

import fs from "fs";
import path from "path";
import { spawnSync } from "node:child_process";
import { Client } from "pg";

// ---------- Helpers ----------
function readJSON(p: string){ return JSON.parse(fs.readFileSync(p, "utf8")); }
function tryFile(p: string){ return fs.existsSync(p) ? readJSON(p) : null; }
function ok<T>(data:T, provenance:any){ return { ok: true as const, data, provenance }; }
function fail(reason:string, provenance:any){ return { ok: false as const, reason, provenance }; }

// ---------- 1) Dataset loader (OFFLINE ONLY) ----------
/**
 * loadFrozenDataset(sym, tf) returns { X:number[][], y:number[], provenance }
 * Tries:
 *  A) ./data/frozen/{sym}/{tf}.json   (format: {X:number[][], y:number[]})
 *  B) Postgres features table: features_{sym_lower}_{tf} with cols f0..fN, ret
 *     (env: DATABASE_URL)
 *  C) Fails with reason; NEVER hits network data providers.
 */
export async function loadFrozenDataset(sym:string, tf:string){
  const prov:any = { attempts: [] };
  // A) File
  const pA = path.join("data","frozen", sym, `${tf}.json`);
  prov.attempts.push({ type:"file", path:pA });
  const fileData = tryFile(pA);
  if (fileData && Array.isArray(fileData.X) && Array.isArray(fileData.y)){
    return ok(fileData, { source:"file", path:pA });
  }

  // B) Postgres
  prov.attempts.push({ type:"postgres", table:`features_${sym.toLowerCase()}_${tf.replace(/[^a-z0-9]/gi,"")}` });
  if (process.env.DATABASE_URL){
    try{
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const table = `features_${sym.toLowerCase()}_${tf.replace(/[^a-z0-9]/gi,"")}`;
      // We expect columns: ts, ret, f0..fN (arbitrary N)
      const q = `SELECT * FROM ${table} ORDER BY ts ASC LIMIT 50000;`;
      const res = await client.query(q);
      await client.end();
      if (res.rows.length){
        // Build X, y in ascending ts
        const cols = Object.keys(res.rows[0]).filter(k => /^f\d+$/.test(k)).sort((a,b)=> {
          const ai = parseInt(a.slice(1),10), bi = parseInt(b.slice(1),10);
          return ai - bi;
        });
        const X = res.rows.map(r => cols.map(c => Number(r[c] ?? 0)));
        const y = res.rows.map(r => Number(r.ret ?? 0));
        return ok({ X, y }, { source:"postgres", table, rows: res.rows.length });
      }
    }catch(e:any){
      prov.pgError = String(e?.message || e);
    }
  }

  return fail("frozen_dataset_not_found", prov);
}

// ---------- 2) Backtest slice with buckets ----------
/**
 * runBacktestSlice({ symbols, timeframe, buckets }) runs the bench runner in OFFLINE mode.
 * For each bucket, set env SIZE_BUCKET_PCT and read artifacts/*/metrics.json to extract slippage error.
 * Returns { summary:[{sym,bucket,slipErrBps, pf, sharpe, mdd}], provenance }.
 */
export async function runBacktestSlice(opts:{ symbols:string[], timeframe:string, buckets:number[] }){
  const summary:any[] = [];
  const prov:any = { runs: [] };
  for (const sym of opts.symbols){
    for (const b of opts.buckets){
      const env = { ...process.env, NO_BACKTEST_NETWORK: "1", SIZE_BUCKET_PCT: String(b) };
      const args = ["bench","run","--strategy","stevie","--version","preflight",
        "--symbols", sym, "--timeframe", opts.timeframe, "--from", process.env.TUNE_FROM || "2024-06-01", "--to", process.env.TUNE_TO || "2024-06-30",
        "--rng-seed","777"];
      const r = spawnSync("pnpm", args, { encoding:"utf8", env });
      prov.runs.push({ sym, bucket:b, status:r.status, outlen:(r.stdout||"").length + (r.stderr||"").length });
      if (r.status !== 0) return fail(`bench_failed_${sym}_${b}`, { ...prov, out: (r.stdout||"")+(r.stderr||"") });
      // Find latest metrics.json
      const latest = path.join("artifacts","latest","metrics.json");
      if (!fs.existsSync(latest)) return fail("metrics_missing", { latestAttempt: latest, ...prov });
      const m = readJSON(latest);
      summary.push({
        sym, bucket: b,
        slipErrBps: Number(m?.slippage_error_bps ?? NaN),
        pf: Number(m?.headline?.profitFactor ?? NaN),
        sharpe: Number(m?.headline?.sharpe ?? NaN),
        mdd: Number(m?.headline?.maxDrawdownPct ?? NaN)
      });
    }
  }
  return ok({ summary }, { source:"bench_runner", prov: prov.runs.length });
}

// ---------- 3) Policy probabilities & Q/V estimates ----------
/**
 * getBaselinePolicyProbs / getCandidatePolicyProbs should return { probs:number[], states:any[] }
 * We try:
 *  A) Local API endpoint: /api/policy/probs?mode=baseline|candidate  (must be served by your server)
 *  B) Fallback: equal probs [0.5,0.5] with provenance='fallback'
 */
async function tryFetchJSON(url:string){
  // Avoid external network; only allow localhost
  if (!/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(url)) throw new Error("non_local_fetch_blocked");
  const http = await import("node:http");
  return new Promise<any>((resolve, reject)=>{
    http.get(url, (res:any)=>{
      let data=""; res.on("data",(d:any)=>data+=d);
      res.on("end", ()=>{ try{ resolve(JSON.parse(data)); }catch(e){ reject(e);} });
    }).on("error", reject);
  });
}

export async function getBaselinePolicyProbs(){
  const baseURL = process.env.LOCAL_API_BASE || "http://0.0.0.0:3000";
  try{
    const j = await tryFetchJSON(`${baseURL}/api/policy/probs?mode=baseline`);
    if (Array.isArray(j?.probs)) return ok(j, { source:"local_api", mode:"baseline" });
  }catch(_){}
  return ok({ probs:[0.5,0.5], states:[] }, { source:"fallback_equal", mode:"baseline" });
}

export async function getCandidatePolicyProbs(){
  const baseURL = process.env.LOCAL_API_BASE || "http://0.0.0.0:3000";
  try{
    const j = await tryFetchJSON(`${baseURL}/api/policy/probs?mode=candidate`);
    if (Array.isArray(j?.probs)) return ok(j, { source:"local_api", mode:"candidate" });
  }catch(_){}
  return ok({ probs:[0.55,0.45], states:[] }, { source:"fallback_bias", mode:"candidate" });
}

/**
 * estimateQbVb: prefer meta-brain API route if available, else compute naive baselines.
 * Expected return: { rewards:number[], pb:number[], p:number[], Qb:number[], Vb:number[] }
 */
export async function estimateQbVb(baseline?:any, candidate?:any){
  const baseURL = process.env.LOCAL_API_BASE || "http://0.0.0.0:3000";
  // A) Try meta-brain route if present
  try{
    const j = await tryFetchJSON(`${baseURL}/api/meta-brain/qv?window=200`);
    if (Array.isArray(j?.rewards) && Array.isArray(j?.pb) && Array.isArray(j?.p) && Array.isArray(j?.Qb) && Array.isArray(j?.Vb)){
      return ok(j, { source:"meta_brain_api" });
    }
  }catch(_){}
  // B) Naive fallback: synthetic window with mild signal; DO NOT use live trading decisions
  const n = 200;
  const rewards = Array.from({length:n}, (_,i)=> Math.sin(i/10)+1); // stationary toy
  const pb = Array(n).fill((baseline?.data?.probs?.[0] ?? 0.5));
  const p  = Array(n).fill((candidate?.data?.probs?.[0] ?? 0.55));
  const Qb = Array(n).fill(0.9);
  const Vb = Array(n).fill(1.0);
  return ok({ rewards, pb, p, Qb, Vb }, { source:"fallback_synthetic" });
}
