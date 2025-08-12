
// Doubly-Robust OPE: V_DR = mean[ ρ_i * (r_i - Q_b(s_i,a_i)) + V_b(s_i) ]
// Assumes you can provide behavior policy probs π_b(a|s), candidate π(a|s), and baseline Q_b / V_b estimates.
export type DRInput = {
  rewards: number[];            // r_i
  pb: number[];                 // π_b(a_i|s_i)
  p: number[];                  // π(a_i|s_i) for candidate
  Qb: number[];                 // Q_b(s_i, a_i)
  Vb: number[];                 // V_b(s_i)
};

export function doublyRobust(input: DRInput): { vdr: number; isVar: number } {
  const n = input.rewards.length || 1;
  let sum = 0, m2 = 0;
  
  for (let i = 0; i < n; i++){
    const w = Math.max(1e-9, input.p[i]) / Math.max(1e-9, input.pb[i]);   // importance ratio ρ_i
    const term = w * (input.rewards[i] - input.Qb[i]) + input.Vb[i];
    const delta = term - sum / (i || 1);
    sum += term;
    m2 += delta * (term - sum / (i + 1));
  }
  
  const vdr = sum / n;
  const varIS = m2 / Math.max(1, n - 1);
  return { vdr, isVar: varIS };
}
