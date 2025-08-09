// Simple in-memory snapshot for p50/p95/p99 style placeholders.
// TODO: replace with existing Prometheus-compatible metrics if available.

type Dist = { p50:number; p95:number; p99:number };
const now = ()=> Date.now();

export function snapshot(){
  const lat = (v:number):Dist => ({ p50:v, p95:v*2, p99:v*3 });
  return {
    latencyMs: {
      submitAck: lat(20),
      ackFill: lat(40),
      cancel: lat(15)
    },
    wsStalenessMs: lat(200),
    slippageBps: lat(1),
    makerTaker: { makerPct: 60, takerPct: 40 },
    rejectsByReason: { }
  };
}
