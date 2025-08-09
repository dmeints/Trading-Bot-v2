import crypto from "crypto";
export type Bar = { t: number; o: number; h: number; l: number; c: number; v?: number }; // ms epoch

export function hashDataset(params: {
  symbols: string[]; timeframe: "1m"|"5m"|"1h"|"1d"; fromIso: string; toIso: string;
  feeBps?: number; slipBps?: number; seed?: number;
  data: Record<string, Bar[]>; // sorted ascending by t
}): string {
  const { symbols, timeframe, fromIso, toIso, feeBps = 0, slipBps = 0, seed = 0, data } = params;
  const h = crypto.createHash("sha256");
  h.update(JSON.stringify({ symbols: [...symbols].sort(), timeframe, fromIso, toIso, feeBps, slipBps, seed }));
  const r = (x: number) => Math.round(x * 1e8) / 1e8;
  for (const sym of [...symbols].sort()) {
    h.update(sym);
    const bars = (data[sym] || []).slice().sort((a, b) => a.t - b.t);
    for (const b of bars) h.update(`${b.t}|${r(b.o)}|${r(b.h)}|${r(b.l)}|${r(b.c)}|${b.v != null ? r(b.v) : ""};`);
  }
  return `sha256:${h.digest("hex")}`;
}