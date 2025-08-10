const fs = require("fs"), path = require("path");
const ROOTS = ["server","client","shared"];
const ALLOW = /(__tests__|fixtures|stories?|mocks?|scripts|README|\.md)$/i;
const NEEDLES = /\b(mock|faker|dummy|stub|sampleData|lorem|json-server|msw|miragejs|nock)\b/i;

let bad = [];
function walk(d){ for(const f of fs.readdirSync(d)){ const p=path.join(d,f); const s=fs.statSync(p);
  if(s.isDirectory()) walk(p); else if(/\.(ts|tsx|js|json)$/.test(p)){
    if (ALLOW.test(p)) continue;
    const t = fs.readFileSync(p,"utf8");
    if (NEEDLES.test(t)) bad.push(p);
  }}}
for (const r of ROOTS) if (fs.existsSync(r)) walk(r);
if (bad.length){ console.error("❌ Mock-like content found:", bad); process.exit(1); }
console.log("✓ No mock fingerprints in source");