// Output gate: a static export and nothing that could run on a server.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVER_FILE = /^(?:route|middleware|proxy)\.[cm]?[jt]sx?$/;
const OUT_FORBIDDEN_DIRS = new Set(["api", "server", "functions"]);
const OUT_FORBIDDEN_FILE = /(?:^_worker\.js$|\.func$|\.php$|^vercel\.json$|\.map$)/;

function walk(dir, visit) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    visit(entry, full);
    if (entry.isDirectory()) walk(full, visit);
  }
}

export function checkOut(root = process.cwd()) {
  const failures = [];
  const rel = (p) => path.relative(root, p).replaceAll("\\", "/");

  const configPath = path.join(root, "next.config.ts");
  const config = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  if (!/output:\s*["']export["']/.test(config)) failures.push('next.config.ts does not set output: "export"');

  const appDir = path.join(root, "src", "app");
  if (existsSync(appDir)) {
    walk(appDir, (entry, full) => {
      if (entry.isFile() && SERVER_FILE.test(entry.name)) failures.push(`${rel(full)} is a route handler or middleware`);
      if (entry.isDirectory() && entry.name === "api" && path.dirname(full) === appDir) failures.push(`${rel(full)} is an API folder`);
    });
  }
  for (const name of readdirSync(path.join(root, "src"))) {
    if (/^(?:middleware|proxy)\.[cm]?[jt]sx?$/.test(name)) failures.push(`src/${name} is middleware`);
  }
  for (const name of readdirSync(root)) {
    if (/^(?:middleware|proxy)\.[cm]?[jt]sx?$/.test(name)) failures.push(`${name} is middleware`);
    if (/^\.env/.test(name)) failures.push(`${name} is an env file`);
  }

  const outDir = path.join(root, "out");
  if (!existsSync(outDir)) {
    failures.push("out/ does not exist, build first");
    return failures;
  }
  for (const required of ["index.html", "404.html"]) {
    if (!existsSync(path.join(outDir, required))) failures.push(`out/${required} is missing`);
  }
  for (const name of readdirSync(outDir)) {
    if (OUT_FORBIDDEN_DIRS.has(name)) failures.push(`out/${name}/ must not exist`);
  }
  walk(outDir, (entry, full) => {
    if (entry.isFile() && OUT_FORBIDDEN_FILE.test(entry.name)) failures.push(`${rel(full)} must not exist`);
  });
  return failures;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const failures = checkOut();
  for (const f of failures) console.error(`outcheck: ${f}`);
  console.log(failures.length ? `outcheck: FAILED with ${failures.length} problem(s).` : "outcheck: ok.");
  process.exit(failures.length ? 1 : 0);
}
