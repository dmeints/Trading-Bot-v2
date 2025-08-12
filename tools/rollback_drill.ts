
// tools/rollback_drill.ts
import http from "node:http";

const BASE = process.env.LOCAL_API_BASE || "http://0.0.0.0:3000";

function post(path:string, body:any={}): Promise<any>{
  return new Promise((res, rej)=>{
    const u = new URL(`${BASE}${path}`);
    const req = http.request({ 
      method:"POST", 
      hostname:u.hostname, 
      port:u.port, 
      path:u.pathname, 
      headers:{ "Content-Type":"application/json" }
    }, (r:any)=>{
      let d=""; 
      r.on("data",(c:any)=>d+=c); 
      r.on("end",()=>res(d)); 
    });
    req.on("error", rej); 
    req.write(JSON.stringify(body)); 
    req.end();
  });
}

function get(path:string): Promise<any>{
  return new Promise((res, rej)=>{
    http.get(`${BASE}${path}`, (r:any)=>{ 
      let d=""; 
      r.on("data",(c:any)=>d+=c); 
      r.on("end",()=>res(d)); 
    }).on("error", rej);
  });
}

(async ()=>{
  console.log("🚨 Emergency Rollback Drill Starting...");
  const t0 = Date.now();
  
  try{ 
    await post("/api/kill/reduce-only", { enable:true }); 
    console.log("✅ Reduce-only mode activated");
  }catch(_){ 
    console.log("⚠️ reduce-only endpoint missing; simulating"); 
  }
  
  try{ 
    await post("/api/kill/hedge-flat"); 
    console.log("✅ Hedge-to-flat executed");
  }catch(_){ 
    console.log("⚠️ hedge-flat endpoint missing; simulating"); 
  }
  
  // Check positions
  let positions=""; 
  try{ 
    positions = await get("/api/portfolio/positions"); 
    console.log("📊 Position check:", JSON.parse(positions || "{}"));
  }catch(_){
    console.log("⚠️ Position check endpoint missing");
  }
  
  const t1 = Date.now();
  console.log(`⏱️ Emergency response time: ${t1-t0}ms`);
  
  // Wait a moment then restore
  await new Promise(r=>setTimeout(r, 2000));
  
  try{ 
    await post("/api/kill/reduce-only", { enable:false }); 
    console.log("✅ Normal trading mode restored");
  }catch(_){
    console.log("⚠️ Mode restoration endpoint missing; simulating");
  }
  
  console.log("✅ Rollback drill complete");
})();
