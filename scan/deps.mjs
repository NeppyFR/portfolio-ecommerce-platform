// Dependency gate. Reads package.json and every package in package-lock.json.
// Direct dependencies: the full forbidden list, and every version must be exact.
// Installed tree: the same list, except framer-motion under motion and sharp or @img/* under next,
// with the parent checked in the lockfile.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FORBIDDEN_EXACT = new Set([
  "supabase", "stripe", "resend", "react-email", "nodemailer", "aws-sdk", "next-intl", "next-auth",
  "pg", "postgres", "prisma", "drizzle-orm", "firebase", "openai", "ai", "axios", "got", "node-fetch", "ky",
  "posthog-js", "cloudflare", "wrangler", "twilio", "sharp", "recharts", "three", "framer-motion", "zod",
  "libphonenumber-js", "sonner", "@base-ui/react",
]);
const FORBIDDEN_SCOPES = [
  "@supabase/", "@stripe/", "@react-email/", "@aws-sdk/", "@vercel/", "@auth/", "@clerk/", "@prisma/",
  "@anthropic-ai/", "@ai-sdk/", "@sentry/", "@react-three/",
];
const FORBIDDEN_PREFIXES = ["mixpanel"];

export function isForbidden(name) {
  return FORBIDDEN_EXACT.has(name) || FORBIDDEN_SCOPES.some((s) => name.startsWith(s)) || FORBIDDEN_PREFIXES.some((p) => name.startsWith(p));
}

const isImgFamily = (name) => name.startsWith("@img/");
const EXACT_VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

/** The package name at a lockfile key: `node_modules/a/node_modules/@b/c` gives `@b/c`. */
export function nameOf(key) {
  const tail = key.slice(key.lastIndexOf("node_modules/") + "node_modules/".length);
  return tail;
}

/** Every lockfile package that lists `name` in any of its dependency maps. */
function parentsOf(name, packages) {
  const parents = [];
  for (const [key, pkg] of Object.entries(packages)) {
    const lists = [pkg.dependencies, pkg.optionalDependencies, pkg.peerDependencies];
    if (lists.some((l) => l && Object.hasOwn(l, name))) parents.push(key === "" ? "(root)" : nameOf(key));
  }
  return parents;
}

/**
 * Follows the lockfile upwards from `name` and answers whether every route reaches `allowedParent`
 * before reaching the root or anything else. `@img/colour` hangs off `sharp`, and `@img/sharp-*`
 * hang off `sharp` and each other, so the walk has to pass through those.
 */
function onlyVia(name, allowedParent, packages, passThrough) {
  const seen = new Set();
  const stack = [name];
  const bad = [];
  while (stack.length) {
    const current = stack.pop();
    if (seen.has(current)) continue;
    seen.add(current);
    const parents = parentsOf(current, packages);
    if (parents.length === 0) bad.push(`${current} has no parent`);
    for (const parent of parents) {
      if (parent === allowedParent) continue;
      if (passThrough(parent)) stack.push(parent);
      else bad.push(`${current} is required by ${parent}`);
    }
  }
  return bad;
}

export function checkDeps(pkg, lock) {
  const failures = [];
  const direct = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies };

  for (const [name, version] of Object.entries(direct)) {
    if (isForbidden(name)) failures.push(`package.json: forbidden direct dependency ${name}`);
    if (!EXACT_VERSION.test(String(version))) failures.push(`package.json: non-exact version ${name}@${version}`);
  }

  const packages = lock.packages ?? {};
  for (const key of Object.keys(packages)) {
    if (key === "") continue;
    const name = nameOf(key);
    if (name === "framer-motion") {
      for (const b of onlyVia(name, "motion", packages, () => false)) failures.push(`package-lock.json: ${b}, only motion may`);
      continue;
    }
    if (name === "sharp" || isImgFamily(name)) {
      const via = onlyVia(name, "next", packages, (p) => p === "sharp" || isImgFamily(p));
      for (const b of via) failures.push(`package-lock.json: ${b}, only next may`);
      continue;
    }
    if (isForbidden(name)) failures.push(`package-lock.json: forbidden package ${key}`);
  }
  return failures;
}

function main() {
  const root = process.cwd();
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"));
  const failures = checkDeps(pkg, lock);
  const count = Object.keys(lock.packages ?? {}).length - 1;
  if (failures.length) {
    for (const f of failures) console.error(`deps: ${f}`);
    console.error(`deps: FAILED with ${failures.length} problem(s) across ${count} packages.`);
    process.exit(1);
  }
  console.log(`deps: ok, ${count} packages checked.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
