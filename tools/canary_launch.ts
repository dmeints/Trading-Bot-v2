
// tools/canary_launch.ts
import http from "node:http";
import fs from "fs";

const BASE = process.env.LOCAL_API_BASE || "http://0.0.0.0:3000";

function fetchJSON(path:string): Promise<any>{
  return new Promise((res, rej)=>{
    http.get(`${BASE}${path}`, (r:any)=>{ 
      let d=""; 
      r.on("data",(c:any)=>d+=c); 
      r.on("end",()=>{ 
        try{res(JSON.parse(d));}catch(e){rej(e);} 
      }); 
    }).on("error", rej);
  });
}

function postJSON(path:string, body:any): Promise<any>{
  return new Promise((res, rej)=>{
    const u = new URL(`${BASE}${path}`);
    const req = http.request({ 
      method:"POST", 
      hostname:u.hostname, 
      port:u.port, 
      path:u.pathname, 
      headers:{ "Content-Type": "application/json" }
    }, (r:any)=>{
      let d=""; 
      r.on("data",(c:any)=>d+=c); 
      r.on("end",()=>{ 
        try{res(JSON.parse(d||"{}"));}catch(e){res({});} 
      });
    });
    req.on("error", rej);
    req.write(JSON.stringify(body)); 
    req.end();
  });
}

async function evaluateGate(){
  // Pull artifacts written by Phase 1 or endpoints if available
  let drope:any = null;
  try{ 
    drope = JSON.parse(fs.readFileSync("artifacts/preflight/dr_ope.json","utf8")); 
  }catch(_){}
  
  if (!drope?.rewards){ 
    try{ 
      drope = await fetchJSON("/api/meta-brain/dr-ope"); 
    }catch(_){
      console.log("⚠️ DR-OPE endpoint unavailable, using artifacts");
    } 
  }
  
  const kl = { pi:[0.51,0.49], base:[0.5,0.5], eps: 0.1 }; // TODO: replace with real policy vectors if exposed
  const conformal = { cvar05: 0.01, abstentionRate: 0.2 }; // TODO: read from /api/uncertainty/coverage or metrics store
  
  // Simple promotion gate logic (replace with real implementation)
  const ciLow = drope?.rewards ? Math.min(...drope.rewards.slice(-10)) : -0.05;
  const allow = ciLow > -0.03; // Conservative threshold
  const reasons = allow ? [] : ['CI_lower_bound_too_low'];
  
  const result = { allow, reasons, inputs: { drope, kl, conformal }, ciLow };
  
  fs.mkdirSync("artifacts/promotion", { recursive: true });
  fs.writeFileSync("artifacts/promotion/decision.json", JSON.stringify(result, null, 2));
  return result;
}

async function enableLive(notionalPct:number){
  try{ 
    return await postJSON("/api/live/enable", { symbol:"BTCUSDT", notionalPct }); 
  }catch(_){ 
    console.log("⚠️ Live enable endpoint missing - simulating");
    return { ok:false, reason:"endpoint_missing" }; 
  }
}

async function downshiftOrPause(reason:string){
  try{ 
    return await postJSON("/api/live/downshift", { reason }); 
  }catch(_){ 
    console.log("⚠️ Downshift endpoint missing - simulating");
    return { ok:false, reason:"endpoint_missing" }; 
  }
}

async function postRollup(){
  try{ 
    return await postJSON("/api/ops/rollup", {}); 
  }catch(_){ 
    console.log("⚠️ Rollup endpoint missing - simulating");
    return { ok:false }; 
  }
}

(async ()=>{
  console.log("🚀 Canary Launch Sequence Starting...");
  
  const gate = await evaluateGate();
  console.log(`🚪 Promotion Gate: ${gate.allow ? '✅ ALLOW' : '❌ BLOCK'}`);
  
  if (!gate.allow){ 
    console.log("🛑 Gate blocked:", gate.reasons); 
    process.exit(0); 
  }
  
  const en = await enableLive(0.5);
  console.log("✓ Canary live 0.5%:", en.ok ? '✅ ENABLED' : '⚠️ SIMULATED');
  
  for (let i=0;i<8;i++){
    try{
      const m = await fetchJSON("/api/metrics/live?window=15m");
      console.log(`[rollup ${i+1}/8] PnL=${m?.pnl} Sharpe=${m?.sharpe} PF=${m?.pf} trades=${m?.trades} slipErr=${m?.slipErrBps} abst=${m?.abstention}% cov=${m?.coverage}% ackP99=${m?.ackP99}ms`);
    }catch(_){ 
      console.log(`[rollup ${i+1}/8] metrics endpoint unavailable; skip`); 
    }
    await postRollup();
    await new Promise(r=>setTimeout(r, 1000));
  }
  console.log("✅ Canary session complete");
})();
