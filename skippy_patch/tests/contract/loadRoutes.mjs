import fs from "fs";
import path from "path";

const CSV = path.resolve("routes_map.csv");

function fromCsv() {
  if (!fs.existsSync(CSV)) return [];
  const raw = fs.readFileSync(CSV, "utf8").split(/\r?\n/).filter(Boolean);
  const [header, ...rows] = raw;
  const out = [];
  for (const r of rows) {
    const cols = r.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(s => s.replace(/^"|"$/g,"").replace(/""/g,'"'));
    const [file, object, method, routePath] = cols;
    if (!routePath) continue;
    out.push({ file, object, method, path: routePath });
  }
  return out;
}

function liveScan() {
  const glob = (dir) => {
    const res = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|js|mjs|cjs)$/.test(e.name) && p.includes(path.sep + "server" + path.sep)) res.push(p);
      }
    };
    if (fs.existsSync(dir)) walk(dir);
    return res;
  };
  const files = glob("server");
  const re = /(router|app)\s*\.\s*(get|post|put|patch|delete|options|head|use)\s*\(\s*([`'"])(.+?)\3/gi;
  const out = [];
  for (const f of files) {
    const s = fs.readFileSync(f, "utf8");
    let m;
    while ((m = re.exec(s))) {
      out.push({ file: f, object: m[1], method: m[2].toUpperCase(), path: m[4] });
    }
  }
  return out;
}

export function loadRoutes() {
  const rows = fromCsv();
  if (rows.length) return rows;
  return liveScan();
}
