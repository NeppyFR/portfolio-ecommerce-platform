// Privacy and no-cost scan. Usage: node scan/scan.mjs --denylist <path>
// Prints file and line, never the matched private word. Without --denylist the generics run with one warning.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* ---------- tokeniser and private matching, shared with crawl.mjs ---------- */

/** Splits on non-alphanumerics and camelCase boundaries, lower-cased. */
export function tokenise(text) {
  return text
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2")
    .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, "$1 $2")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

export function loadDenylist(file) {
  if (!file) return { orderPrefix: null, regexes: [], tokens: [], allow: [] };
  const raw = JSON.parse(readFileSync(file, "utf8"));
  return {
    orderPrefix: raw.orderPrefix ?? null,
    regexes: (raw.regexes ?? []).map((r, i) => ({
      id: r.id ?? `regex-${i + 1}`,
      re: new RegExp(r.source, `${(r.flags ?? "").replace(/[gu]/g, "")}u`),
      skipOut: Boolean(r.skipOut),
    })),
    tokens: (raw.tokens ?? []).map((t, i) => ({ id: `token-${i + 1}`, value: String(t.value).toLowerCase(), mode: t.mode === "sub" ? "sub" : "token" })),
    allow: raw.allow ?? [],
  };
}

const isAllowed = (deny, file, ruleId) => {
  const token = ruleId.startsWith("token-") ? deny.tokens[Number(ruleId.slice(6)) - 1]?.value : null;
  return deny.allow.some((a) => a.file === file && (a.token === ruleId || (token !== null && a.token === token)));
};

/** Rule ids of every private token and regex that hits this line. `minLength` limits tokens by character count. */
export function privateHits(line, deny, { minLength = 0, maxLength = Infinity, out = false } = {}) {
  const hits = [];
  const tokens = tokenise(line);
  const set = new Set(tokens);
  for (const t of deny.tokens) {
    if (t.value.length < minLength || t.value.length > maxLength) continue;
    if (t.mode === "token" ? set.has(t.value) : tokens.some((x) => x.includes(t.value))) hits.push(t.id);
  }
  if (maxLength === Infinity) {
    for (const r of deny.regexes) {
      if (out && r.skipOut) continue;
      if (r.re.test(line)) hits.push(r.id);
    }
  }
  return hits;
}

/* ---------- generic patterns ---------- */

const URL_RE = /https?:\/\/[^\s"'`<>)\\]*/gi;
/** The SVG namespaces, example.com, and the brand constant that holds an example.com host. */
const URL_OK = /^https?:\/\/(?:www\.w3\.org\/2000\/svg|www\.w3\.org\/1999\/xlink|(?:[a-z0-9-]+\.)*example\.com(?:[/:?#]|$)|\$\{SHOP_DOMAIN\})/i;
const PICTO = /\p{Extended_Pictographic}/gu;
const PICTO_OK = new Set([0xa9, 0xae, 0x2122]);
const ENV = /\bprocess\.env\b(?!\.NEXT_PUBLIC_BASE_PATH\b|\.NODE_ENV\b)|\bimport\.meta\.env\b/;
const IMG_EXT = "png|jpe?g|gif|webp|avif|bmp|ico|tiff?|heic";
/** An image in a position that would load it. Seed data may name files by metadata; nothing may load them. */
const IMG_LOAD = new RegExp(
  `(?:\\bsrc(?:Set)?\\s*=\\s*\\{?\\s*["'\`][^"'\`]*\\.(?:${IMG_EXT}|svg)\\b|\\burl\\(\\s*["']?[^)"']*\\.(?:${IMG_EXT}|svg)\\b|\\b(?:from|import|require\\()\\s*\\(?\\s*["'\`][^"'\`]*\\.(?:${IMG_EXT}|svg)["'\`]|\\bhref\\s*=\\s*\\{?\\s*["'\`][^"'\`]*\\.(?:${IMG_EXT})\\b)`,
  "i",
);

const GENERICS = [
  ["plan-word", (l) => /\bPLAN\b/.test(l)],
  ["outside-url", (l) => (l.match(URL_RE) ?? []).some((u) => !URL_OK.test(u))],
  ["password-field", (l) => /type\s*=\s*["'{]*password/i.test(l)],
  ["card-field", (l) => /cc-number|autocomplete\s*=\s*["']cc-|kartennummer|card number/i.test(l)],
  ["sharp-s", (l) => /ß/.test(l)],
  ["pictograph", (l) => [...l.matchAll(PICTO)].some((m) => !PICTO_OK.has(m[0].codePointAt(0)))],
  ["banned-next-module", (l) => /next\/font\/google|next\/image/.test(l)],
  ["banned-import", (l) => /(?:\bfrom\s+|\bimport\s*\(?\s*|\brequire\(\s*)["'](?:framer-motion|sharp)(?:\/[^"']*)?["']/.test(l)],
  ["env-read", (l) => ENV.test(l)],
  ["network-call", (l) => /\bfetch\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bsendBeacon\b/.test(l)],
  ["server-action", (l) => /["']use server["']/.test(l)],
  ["image-reference", (l) => IMG_LOAD.test(l)],
];

/** Generic rule ids that hit one line of our own text. */
export function genericHits(line, deny) {
  const hits = GENERICS.filter(([, test]) => test(line)).map(([id]) => id);
  if (deny.orderPrefix) {
    const esc = deny.orderPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?<![A-Za-z0-9])${esc}`).test(line)) hits.push("real-order-prefix");
  }
  return hits;
}

const IMAGE_FILE = new RegExp(`\\.(?:${IMG_EXT})$`, "i");
const SVG_FILE = /\.svg$/i;
const BINARY_EXT = /\.(?:woff2?|ttf|otf|eot|wasm|gz|br|zip)$/i;
/** SHA-256 of the five fonts, the same bytes in src/fonts and out/. A binary cannot be read, so any other one fails; a new font needs its hash here. */
const KNOWN_BINARIES = new Set([
  "a756882d8a7802ebd4663b4544a62ebedafc7227c1c159ab95eea61393af3f8e",
  "684ad5b531f81d43c1e8c7038262d5db7cdc1f68006e04d6c7769efa8d33c8cc",
  "19f9c92546aa300c312235e3125af1b81394d8db9a4bc4a425cd5b641d2d54e1",
  "5dfcd10d24af8c82927ba57f7983dd997f7b200594c09c35a1b1ed9fc4597506",
  "6e4f2958c3a7c4a80acde4e5a679abe7e01bc1e30b92be3c7a8b696ef401d101",
]);
const isKnownBinary = (bytes) => KNOWN_BINARIES.has(createHash("sha256").update(bytes).digest("hex"));

/** UTF-16 by its byte-order mark, UTF-8 otherwise. NULs go, so neither encoding nor a stray NUL hides a line from the scan. */
function decodeText(bytes) {
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le" : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "utf-8";
  return new TextDecoder(encoding).decode(bytes).replaceAll("\0", "");
}
const OWN_ICON = "src/app/icon.svg";
const OUT_ICON = "out/icon.svg";
const SKIP_DIRS = new Set(["node_modules", ".next", "out", ".git", "test-results", "reference"]);

function walk(root, dir, skipDirs, list = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      walk(root, path.join(dir, entry.name), skipDirs, list);
    } else {
      list.push(path.relative(root, path.join(dir, entry.name)).replaceAll("\\", "/"));
    }
  }
  return list;
}

/** Which row of the place table a project file belongs to. */
export function placeOf(rel) {
  if (rel.startsWith("scan/") || rel === "package-lock.json" || rel === "src/fonts/LICENSES.txt" || rel === "next-env.d.ts") return "private-only";
  if (rel.startsWith("src/") || rel.startsWith("tests/") || rel.startsWith("preview-banner/") || rel.startsWith("docs/")) return "own";
  if (!rel.includes("/")) return "own";
  return "private-only";
}

function scanLines(rel, text, report, deny, { generics, minLength = 0, out = false }) {
  // Lockfile integrity fields are random base64, so short tokens would hit by chance.
  const body = rel === "package-lock.json" ? text.replace(/"integrity":\s*"[^"]*"/g, '"integrity": ""') : text;
  const lines = body.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (out && line.length > 4000) {
      for (let at = 0; at < line.length; at += 3900) checkLine(line.slice(at, at + 4000));
      return;
    }
    checkLine(line);
    function checkLine(chunk) {
      for (const id of privateHits(chunk, deny, { minLength, out })) if (!isAllowed(deny, rel, id)) report(rel, i + 1, id);
      if (generics) for (const id of genericHits(chunk, deny)) report(rel, i + 1, id);
    }
  });
}

export function runScan({ root = process.cwd(), denylist = null, log = console }) {
  const deny = loadDenylist(denylist);
  const seen = new Set();
  const failures = [];
  const report = (file, line, rule) => {
    const key = `${file}:${line}:${rule}`;
    if (seen.has(key)) return;
    seen.add(key);
    failures.push({ file, line, rule });
  };

  const own = walk(root, root, SKIP_DIRS);
  for (const rel of own) {
    // File names, everywhere except node_modules, .next and out.
    for (const id of privateHits(rel, deny)) if (!isAllowed(deny, rel, id)) report(rel, 0, `filename:${id}`);
    if (rel !== OWN_ICON && (IMAGE_FILE.test(rel) || SVG_FILE.test(rel))) report(rel, 0, "filename:image");
    const bytes = readFileSync(path.join(root, rel));
    // woff2 is brotli, so reading it finds only noise: a binary passes by its hash or not at all.
    if (BINARY_EXT.test(rel)) {
      if (!isKnownBinary(bytes)) report(rel, 0, "binary:unknown");
      continue;
    }
    const text = decodeText(bytes);
    if (rel === OWN_ICON) {
      scanLines(rel, text, report, deny, { generics: false });
      continue;
    }
    scanLines(rel, text, report, deny, { generics: placeOf(rel) === "own" });
  }

  const outDir = path.join(root, "out");
  let outFiles = 0;
  if (existsSync(outDir)) {
    const files = walk(root, outDir, new Set());
    outFiles = files.length;
    for (const rel of files) {
      for (const id of privateHits(rel, deny, { minLength: 4, out: true })) if (!isAllowed(deny, rel, id)) report(rel, 0, `filename:${id}`);
      const isIconCopy = SVG_FILE.test(rel) && existsSync(path.join(root, OWN_ICON)) && readFileSync(path.join(root, rel), "utf8") === readFileSync(path.join(root, OWN_ICON), "utf8");
      if (rel !== OUT_ICON && !isIconCopy && (IMAGE_FILE.test(rel) || SVG_FILE.test(rel))) report(rel, 0, "filename:image");
      if (BINARY_EXT.test(rel)) {
        if (!isKnownBinary(readFileSync(path.join(root, rel)))) report(rel, 0, "binary:unknown");
        continue;
      }
      if (statSync(path.join(root, rel)).size > 16 * 1024 * 1024) continue;
      const text = decodeText(readFileSync(path.join(root, rel)));
      scanLines(rel, text, report, deny, { generics: false, minLength: 4, out: true });
      text.split(/\r?\n/).forEach((line, i) => {
        if (/type=["']password/i.test(line)) report(rel, i + 1, "password-field");
        if (/(?<![\w-])cc-(?:number|name|exp|csc|type|given|family)/i.test(line) || /autocomplete=["']cc-/i.test(line)) report(rel, i + 1, "card-field");
      });
    }
  }

  failures.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  for (const f of failures) log.error(`scan: ${f.file}:${f.line} ${f.rule}`);
  if (!denylist) log.warn("scan: warning: no --denylist given, only the generic patterns ran.");
  log.log(`scan: ${failures.length} problem(s) in ${own.length} project files and ${outFiles} output files.`);
  return failures;
}

export function argValue(argv, name) {
  const at = argv.indexOf(name);
  if (at !== -1) return argv[at + 1] ?? null;
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  return eq ? eq.slice(name.length + 1) : null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const denylist = argValue(process.argv.slice(2), "--denylist");
  if (denylist && !existsSync(denylist)) {
    console.error("scan: the file given to --denylist does not exist.");
    process.exit(2);
  }
  const failures = runScan({ denylist });
  process.exit(failures.length ? 1 : 0);
}
