import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const symbol = process.argv[2] || "BTCUSDT";
const minutes = Number(process.argv[3] || 60);

(async () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const db = drizzle(client);

  const since = Date.now() - minutes*60*1000;

  const rows = await client.query(`
    SELECT ts, c, provider
    FROM market_bars
    WHERE symbol=$1 AND ts >= $2
      AND provider IN ('coingecko','binance')
    ORDER BY ts ASC
  `,[symbol, since]);

  const g: Record<string, number[]> = { coingecko:[], binance:[] };
  for (const r of rows.rows) g[r.provider]?.push(Number(r.c));
  if (!g.coingecko.length || !g.binance.length) {
    console.error("❌ Missing series from one or both providers");
    process.exit(1);
  }
  const n = Math.min(g.coingecko.length, g.binance.length);
  let diffs: number[] = [];
  for (let i=0;i<n;i++){
    const mid1 = g.coingecko[i], mid2 = g.binance[i];
    diffs.push(Math.abs(mid1 - mid2) / ((mid1+mid2)/2));
  }
  diffs.sort((a,b)=>a-b);
  const med = diffs[Math.floor(diffs.length/2)] * 100; // %
  console.log(`Median abs % diff (${symbol}, ${minutes}m): ${med.toFixed(3)}%`);
  if (med > 0.5) { console.error("❌ Divergence > 0.5%"); process.exit(1); }
  console.log("✓ Cross-source sanity OK");
  process.exit(0);
})();