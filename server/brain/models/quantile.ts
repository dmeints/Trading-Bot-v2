
// Quantile regression (pinball loss) with simple SGD; supports q05/q50/q95 online/mini-batch.
// This is a lightweight stub: replace with your preferred optimizer later.
export type QRConfig = { dim: number; lr: number; l2?: number; taus?: number[] };

export class QuantileRegressor {
  beta: Record<number, Float64Array>; // tau -> weights
  cfg: QRConfig;
  
  constructor(cfg: QRConfig){
    this.cfg = { ...cfg, taus: cfg.taus ?? [0.05, 0.5, 0.95] };
    this.beta = Object.fromEntries(this.cfg.taus!.map(t => [t, new Float64Array(cfg.dim)]));
  }
  
  predict(x: number[]): Record<number, number> {
    const out: Record<number, number> = {};
    for (const tau of this.cfg.taus!) {
      const b = this.beta[tau]; 
      let s = 0;
      for (let i = 0; i < b.length; i++) s += b[i] * (x[i] ?? 0);
      out[tau] = s;
    }
    return out;
  }
  
  partialFit(X: number[][], y: number[]): void {
    const { lr, l2 = 0 } = this.cfg;
    for (let n = 0; n < X.length; n++){
      const x = X[n], yi = y[n];
      for (const tau of this.cfg.taus!){
        const b = this.beta[tau];
        // residual
        let yhat = 0; 
        for (let i = 0; i < b.length; i++) yhat += b[i] * (x[i] ?? 0);
        const u = yi - yhat;
        // subgradient of pinball loss
        const gscale = (u >= 0 ? (tau - 1) : tau); // derivative wrt yhat is -(tau - 1_{u<0}); we update weights opposite sign
        for (let i = 0; i < b.length; i++){
          const grad = gscale * (x[i] ?? 0) + 2 * l2 * b[i];
          b[i] -= lr * grad;
        }
      }
    }
  }
}

export function cvarLower(qs: Record<number, number>, alpha = 0.05): number {
  // crude CVaR proxy: use lower quantile as a conservative stand-in (upgrade later with tail averaging)
  const key = Object.keys(qs).map(parseFloat).sort((a,b) => a - b).find(k => k >= alpha) ?? alpha;
  return qs[key];
}
