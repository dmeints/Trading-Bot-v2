
/**
 * Creates/validates a frozen dataset manifest for historical benchmarks.
 * Never hits external APIs. Sources: ./data/frozen/** or Postgres snapshot tables.
 * Emits: artifacts/bench/manifest.json with SHA256 of each slice.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Client } from "pg";

type Slice = {
  symbol: string;
  timeframe: string;
  from: string;
  to: string;
  rows: number;
  sha256: string;
  source: "file" | "postgres";
  path?: string;
  table?: string;
};

type Manifest = {
  createdAt: string;
  slices: Slice[];
  notes: string[];
};

function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function fileSlice(sym: string, tf: string, from: string, to: string): Promise<Slice | null> {
  const p = path.join("data", "frozen", sym, `${tf}_${from}_${to}.json`);
  if (!fs.existsSync(p)) return null;
  
  const raw = fs.readFileSync(p);
  const j = JSON.parse(raw.toString());
  
  return {
    symbol: sym,
    timeframe: tf,
    from,
    to,
    rows: j?.X?.length || 0,
    sha256: sha256(raw),
    source: "file",
    path: p
  };
}

async function pgSlice(sym: string, tf: string, from: string, to: string): Promise<Slice | null> {
  if (!process.env.DATABASE_URL) return null;
  
  const table = `features_${sym.toLowerCase()}_${tf.replace(/[^a-z0-9]/gi, "")}`;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    const q = `SELECT * FROM ${table} WHERE ts >= $1 AND ts < $2 ORDER BY ts ASC;`;
    const res = await client.query(q, [from, to]);
    const buf = Buffer.from(JSON.stringify(res.rows));
    
    return {
      symbol: sym,
      timeframe: tf,
      from,
      to,
      rows: res.rows.length,
      sha256: sha256(buf),
      source: "postgres",
      table
    };
  } catch (error) {
    return null;
  } finally {
    await client.end();
  }
}

(async () => {
  const pairs = [
    { sym: "BTCUSDT", tf: "5m" },
    { sym: "BTCUSDT", tf: "15m" },
    { sym: "ETHUSDT", tf: "5m" },
    { sym: "ETHUSDT", tf: "15m" }
  ];
  
  const windows = [
    { from: "2024-04-01", to: "2024-05-01" },
    { from: "2024-05-01", to: "2024-06-01" },
    { from: "2024-06-01", to: "2024-07-01" },
    { from: "2024-07-01", to: "2024-08-01" }
  ];
  
  const slices: Slice[] = [];
  const notes: string[] = [];
  
  for (const p of pairs) {
    for (const w of windows) {
      const f = await fileSlice(p.sym, p.tf, w.from, w.to);
      if (f) {
        slices.push(f);
        continue;
      }
      
      const pg = await pgSlice(p.sym, p.tf, w.from, w.to);
      if (pg) {
        slices.push(pg);
        continue;
      }
      
      notes.push(`missing_slice ${p.sym} ${p.tf} ${w.from}..${w.to}`);
    }
  }
  
  fs.mkdirSync("artifacts/bench", { recursive: true });
  const manifest: Manifest = {
    createdAt: new Date().toISOString(),
    slices,
    notes
  };
  
  fs.writeFileSync("artifacts/bench/manifest.json", JSON.stringify(manifest, null, 2));
  
  if (notes.length) {
    console.error("Dataset freeze has gaps:", notes);
    process.exit(1);
  }
  
  console.log("✓ dataset manifest -> artifacts/bench/manifest.json");
})();
