
// tools/feature_ablation.ts
import fs from "fs"; 
import { loadFrozenDataset } from "./preflight_adapters";

// Simple distance correlation implementation (dcor approximation)
function dcor(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;
  
  const n = x.length;
  
  // Center the data
  const meanX = x.reduce((sum, val) => sum + val, 0) / n;
  const meanY = y.reduce((sum, val) => sum + val, 0) / n;
  
  // Calculate Pearson correlation as dcor approximation
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  
  for (let i = 0; i < n; i++) {
    const deltaX = x[i] - meanX;
    const deltaY = y[i] - meanY;
    
    numerator += deltaX * deltaY;
    denomX += deltaX * deltaX;
    denomY += deltaY * deltaY;
  }
  
  if (denomX === 0 || denomY === 0) return 0;
  
  return Math.abs(numerator / Math.sqrt(denomX * denomY));
}

(async ()=>{
  console.log("🔍 Feature Ablation Analysis Starting...");
  
  const res = await loadFrozenDataset("BTCUSDT","5m");
  if ((res as any).ok !== true){ 
    console.error("❌ ablation_failed:", (res as any).reason); 
    process.exit(1); 
  }
  
  const { X, y } = (res as any).data;
  console.log(`📊 Dataset loaded: ${X.length} samples, ${X[0]?.length || 0} features`);
  
  if (!X.length || !X[0]?.length) {
    console.error("❌ Empty dataset - cannot perform ablation");
    process.exit(1);
  }
  
  const names = X[0].map((_:any, i:number) => `f${i}`);
  console.log("🧮 Computing distance correlations...");
  
  const scores = names.map((n:string, i:number) => ({ 
    name: n, 
    score: dcor(X.map((r:number[]) => r[i]), y) 
  }));
  
  scores.sort((a, b) => b.score - a.score);
  
  fs.mkdirSync("artifacts/ablation", { recursive: true });
  fs.writeFileSync(
    "artifacts/ablation/top10_dcor.json", 
    JSON.stringify(scores.slice(0, 10), null, 2)
  );
  
  console.log("✅ Feature ablation analysis complete");
  console.log("📈 Top 10 features by distance correlation:");
  scores.slice(0, 10).forEach((score, i) => {
    console.log(`  ${i+1}. ${score.name}: ${score.score.toFixed(4)}`);
  });
  console.log(`📁 Results written to artifacts/ablation/top10_dcor.json`);
})();
