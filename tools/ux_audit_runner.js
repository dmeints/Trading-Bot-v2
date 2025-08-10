
/* Runs UI checks + E2E in a loop until all green or max retries reached */
import { spawnSync } from "child_process";

const run = (cmd, args) => {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  return r.status === 0;
};

const RETRIES = Number(process.env.UX_RETRIES || 3);
for (let i = 1; i <= RETRIES; i++) {
  console.log(`\n=== UX AUDIT PASS ${i}/${RETRIES} ===`);
  const a = run("node", ["tools/ui_wiring_check.js"]);
  const b = run("npx", ["playwright", "test", "--config", "client/tests/e2e/config.ts"]);
  const c = process.env.RUN_STORYBOOK_TESTS ? run("npm", ["run", "sb:test"]) : true;

  if (a && b && c) {
    console.log("\n✅ UI/UX audit green. All checks passed.");
    process.exit(0);
  } else {
    console.warn("\n⚠ Some checks failed. Fix and I will re-run on next pass.");
  }
}
console.error("\n❌ UI/UX audit did not pass within retry budget. See logs above for exact failures.");
process.exit(1);
