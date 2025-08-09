export const chaos = {
  wsDrop: process.env.SIMULATE_WS_DROP === "1",
  latencyMs: Number(process.env.SIMULATE_LATENCY_MS ?? "0"),
  force429: process.env.SIMULATE_429 === "1",
  clockDriftMs: Number(process.env.SIMULATE_CLOCK_DRIFT_MS ?? "0"),
};