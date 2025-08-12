
// Fast projected-gradient QP: min 0.5*Δw^T(Σ+κD)Δw - q^TΔw  s.t. L1/box/impact caps.
// This is a stub: simple iterations + clamping. Replace with better solver as needed.
export type QPCfg = { 
  kappa: number; 
  step: number; 
  iters: number; 
  l1Cap: number; 
  boxCap: number; 
  slipCapBps?: number 
};

export type QPInput = {
  Sigma: number[][];           // risk matrix
  Ddiag?: number[];            // impact diagonal (same length as w)
  q: number[];                 // linear term
  slipForecast?: (dw: number[]) => number; // bps; optional
};

export function solveQP(x0: number[], input: QPInput, cfg: QPCfg): { dw: number[]; iters: number; slipBps: number } {
  const n = x0.length;
  let x = x0.slice();
  const { Sigma, Ddiag = [], q, slipForecast } = input;
  const { kappa, step, iters, l1Cap, boxCap, slipCapBps = 9999 } = cfg;
  
  const grad = (v: number[]): number[] => {
    const Av = new Array(n).fill(0);
    for (let i = 0; i < n; i++){
      let s = 0;
      for (let j = 0; j < n; j++) s += (Sigma[i][j] || 0) * v[j];
      Av[i] = s + (kappa * (Ddiag[i] || 0)) * v[i];
    }
    return Av.map((a, i) => a - q[i]);
  };
  
  for (let it = 0; it < iters; it++){
    // gradient step
    const g = grad(x);
    for (let i = 0; i < n; i++) x[i] -= step * g[i];
    
    // box projection
    for (let i = 0; i < n; i++) x[i] = Math.max(Math.min(x[i], boxCap), -boxCap);
    
    // L1 projection (simple shrink to meet cap)
    const l1 = x.reduce((a, b) => a + Math.abs(b), 0);
    if (l1 > l1Cap){
      const scale = l1Cap / (l1 || 1);
      for (let i = 0; i < n; i++) x[i] *= scale;
    }
    
    // impact/slippage guard
    const slip = slipForecast ? slipForecast(x) : 0;
    if (slip > slipCapBps){
      const s = (slipCapBps / (slip || 1));
      for (let i = 0; i < n; i++) x[i] *= s;
    }
  }
  
  const slipBps = input.slipForecast ? input.slipForecast(x) : 0;
  return { dw: x, iters, slipBps };
}
