import fs from "fs";
import path from "path";
import supertest from "supertest";
import { loadRoutes } from "./loadRoutes.mjs";

const cfg = JSON.parse(fs.readFileSync(path.resolve("tests/contract/config.json"), "utf8"));
const BASE = process.env.BASE_URL || cfg.baseUrl;
const agent = supertest(BASE);
const now = new Date().toISOString().replace(/[:\.]/g,"-");
const reportPath = path.resolve(`reports/contract-${now}.md`);

const denyPatterns = cfg.dangerousPathPatterns.map(p => new RegExp(p.replace(/\*/g,".*"), "i"));
const skipExact = new Set(cfg.skipExactPaths);
const MAX = cfg.maxPerMethod || 1000;

function isDangerous(p) {
  if (skipExact.has(p)) return true;
  if (p.includes(":") || p.includes("*")) return true;
  return denyPatterns.some(rx => rx.test(p));
}

function pickBodyByMethod(m) {
  const empty = {};
  switch (m) {
    case "POST":
    case "PUT":
    case "PATCH": return empty;
    default: return null;
  }
}

function okOrClientError(code){ return (code >= 200 && code < 500); }

const all = loadRoutes()
  .filter(r => r && r.path && typeof r.path === "string")
  .map(r => ({ method: r.method?.toUpperCase() || "GET", path: r.path.trim() }))
  .filter(r => !isDangerous(r.path));

const key = r => `${r.method} ${r.path}`;
const unique = Array.from(new Map(all.map(r => [key(r), r])).values());

const limited = [];
const seenPerMethod = {};
for (const r of unique) {
  seenPerMethod[r.method] = seenPerMethod[r.method] || 0;
  if (seenPerMethod[r.method] < MAX) {
    seenPerMethod[r.method]++;
    limited.push(r);
  }
}

const results = [];

async function hitOne({ method, path }) {
  try {
    let req = agent[method.toLowerCase()](path).set("Accept", "application/json");
    const body = pickBodyByMethod(method);
    if (body) req = req.send(body);
    const res = await req;
    const ok = okOrClientError(res.status);
    results.push({ method, path, status: res.status, ok });
    return ok;
  } catch (e) {
    results.push({ method, path, status: 0, ok: false, error: e?.message || String(e) });
    return false;
  }
}

async function main() {
  try { await agent.get("/api/health"); } catch {}

  for (const r of limited) {
    await hitOne(r);
  }

  const fails = results.filter(r => !r.ok);
  const md = [
    `# Contract Test Report (${new Date().toISOString()})`,
    `Base URL: \`${BASE}\``,
    ``,
    `## Summary`,
    `- total tested: ${results.length}`,
    `- failures (5xx or network): ${fails.length}`,
    ``,
    `## Failures`,
    fails.length ? fails.map(f => `- \`${f.method} ${f.path}\` → status: ${f.status} ${f.error ? `(${f.error})`:""}`).join("\n") : "_None_",
    ``,
    `## Sample (first 50)`,
    results.slice(0, 50).map(r => `- \`${r.method} ${r.path}\` → ${r.status}`).join("\n")
  ].join("\n");
  os = require("os");
  if (!fs.existsSync("reports")) fs.mkdirSync("reports", { recursive: true });
  fs.writeFileSync(reportPath, md);
  console.log("Report:", reportPath);
  if (fails.length) { process.exit(1); }
}
main().catch(e => { console.error(e); process.exit(1); });
