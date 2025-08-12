
export function edgeFromQuantiles(qs: Record<number, number>): number {
  return Math.max(0, qs[0.05] ?? 0); // conservative lower-quantile edge
}

export function edgeFromConformal(lowerBound: number, upperBound: number): number {
  return Math.max(0, lowerBound); // use conformal lower bound as edge
}
