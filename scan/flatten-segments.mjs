// After `next build`. The static export writes per-segment payloads into nested folders
// (`__next.desk/finance/__PAGE__.txt`), while the client router asks for one flat file name
// (`__next.desk.finance.__PAGE__.txt`). Without flat copies every prefetch is a 404 on a static host.
import { readdirSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "out");

const leaves = (dir, trail = []) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? leaves(path.join(dir, entry.name), [...trail, entry.name])
      : [{ from: path.join(dir, entry.name), parts: [...trail, entry.name] }],
  );

let moved = 0;
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (!entry.name.startsWith("__next.")) {
      walk(full);
      continue;
    }
    for (const { from, parts } of leaves(full)) {
      renameSync(from, path.join(dir, [entry.name, ...parts].join(".")));
      moved += 1;
    }
    rmSync(full, { recursive: true, force: true });
  }
};

if (!statSync(OUT, { throwIfNoEntry: false })?.isDirectory()) {
  console.error("flatten-segments: out/ is missing, run next build first");
  process.exit(1);
}
walk(OUT);
console.log(`flatten-segments: ${moved} payload file(s) flattened`);
