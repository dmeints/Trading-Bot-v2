import fs from "fs";
import path from "path";

const suspicious = [
  /\bSharpe\b\s*[:=]\s*\d+(\.\d+)?/i,
  /\bWin\s*Rate\b\s*[:=]\s*\d+%/i,
  /\bMax\s*Drawdown\b\s*[:=]\s*-?\d+(\.\d+)?%/i,
  /\bProfit\s*Factor\b\s*[:=]\s*\d+(\.\d+)?/i,
];
const allow = [/(__tests__|fixtures|README|\.md$|mock|example)/i];

function walk(dir: string, acc: string[] = []): string[] {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(p)) acc.push(p);
  }
  return acc;
}

describe("Anti-fabrication: no hardcoded performance metrics in source", () => {
  const roots = ["server", "client"].filter(fs.existsSync);
  const files = roots.flatMap(r => walk(r)).filter(f => !allow.some(r => r.test(f)));
  test.each(files)("no hardcoded metrics in %s", (file) => {
    const txt = fs.readFileSync(file, "utf8");
    for (const pat of suspicious) expect(pat.test(txt)).toBe(false);
  });
});