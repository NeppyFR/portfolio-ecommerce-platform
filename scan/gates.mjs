// All gates in order. Usage: npm run gates -- --denylist <path> [--allow-stubs]
// Each gate runs even after an earlier one failed, so one pass shows everything.
import { spawnSync } from "node:child_process";
import path from "node:path";

const argv = process.argv.slice(2);
const at = argv.indexOf("--denylist");
const denylist = at !== -1 ? ["--denylist", argv[at + 1]] : [];
const stubs = argv.includes("--allow-stubs") ? ["--allow-stubs"] : [];

const GATES = [
  ["scan", ["scan/scan.mjs", ...denylist]],
  ["deps", ["scan/deps.mjs"]],
  ["outcheck", ["scan/out-check.mjs"]],
  ["crawl", ["scan/crawl.mjs", ...denylist, ...stubs]],
  ["test", [path.join("node_modules", "vitest", "vitest.mjs"), "run"]],
];

const results = [];
for (const [name, args] of GATES) {
  console.log(`\n=== gate: ${name}`);
  const run = spawnSync(process.execPath, args, { stdio: "inherit" });
  results.push([name, run.status === 0]);
}
console.log("");
for (const [name, ok] of results) console.log(`${ok ? "pass" : "FAIL"}  ${name}`);
process.exit(results.every(([, ok]) => ok) ? 0 : 1);
