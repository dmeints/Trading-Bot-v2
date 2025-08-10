import { expect, test } from "vitest";
import fs from "fs";

test("headline metrics vary across runs", () => {
  if (!fs.existsSync("artifacts")) return;
  const runs = fs.readdirSync("artifacts").slice(0,5).flatMap(id => {
    try { return [JSON.parse(fs.readFileSync(`artifacts/${id}/metrics.json`,"utf8"))]; } catch { return []; }
  });
  if (runs.length < 3) return; // not enough to judge — skip
  const sharpe = runs.map(r => r?.headline?.sharpe).filter((x)=>typeof x==="number");
  const uniq = new Set(sharpe.map(x => x!.toFixed(4)));
  expect(uniq.size).toBeGreaterThan(1); // suspicious if identical
});