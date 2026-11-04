// Runs tsc over the whole project and blocks only on errors under the given paths.
// Usage: npm run typecheck:mine -- src/shop src/store/actions/bag.ts
import { spawnSync } from "node:child_process";
import path from "node:path";

const wanted = process.argv.slice(2).map((p) => p.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, ""));
if (wanted.length === 0) {
  console.error("Give at least one path: npm run typecheck:mine -- src/shop");
  process.exit(2);
}
const tsc = path.join("node_modules", "typescript", "bin", "tsc");
const run = spawnSync(process.execPath, [tsc, "--noEmit", "--incremental", "false", "--pretty", "false"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
if (run.error) throw run.error;

const lines = `${run.stdout}${run.stderr}`.split(/\r?\n/);
let keep = false;
let mine = 0;
let others = 0;
const out = [];
for (const line of lines) {
  const m = /^(.+?)\(\d+,\d+\): error TS\d+/.exec(line);
  if (m) {
    const file = m[1].replaceAll("\\", "/");
    keep = wanted.some((w) => file === w || file.startsWith(`${w}/`));
    if (keep) { mine += 1; out.push(line); } else { others += 1; }
  } else if (keep && /^\s/.test(line)) {
    out.push(line);
  } else {
    keep = false;
  }
}
if (out.length) console.log(out.join("\n"));
console.log(`typecheck:mine: ${mine} error(s) under your paths, ${others} elsewhere (ignored).`);
process.exit(mine > 0 ? 1 : 0);
