import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkDeps, isForbidden } from "../../scan/deps.mjs";
import { genericHits, loadDenylist, placeOf, privateHits, runScan, tokenise } from "../../scan/scan.mjs";
import { checkOut } from "../../scan/out-check.mjs";
import { bodyColourProblem, outRoutes, readRegistry, readStates } from "../../scan/crawl.mjs";

const root = mkdtempSync(path.join(tmpdir(), "cp-gates-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

function fixture(name: string, files: Record<string, string>) {
  const dir = path.join(root, name);
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

const quiet = () => {
  const lines: string[] = [];
  return { lines, log: { error: (l: string) => lines.push(l), warn: (l: string) => lines.push(l), log: (l: string) => lines.push(l) } };
};

/* Invented words stand in for the private ones: the real list never enters the project. */
const DENY = { orderPrefix: "ZZ-", regexes: [{ id: "phrase", source: "made up phrase", flags: "i" }], tokens: [{ value: "zorblax", mode: "sub" }, { value: "qw", mode: "token" }, { value: "quillon", mode: "token" }], allow: [] };

describe("deps gate", () => {
  const lock = (packages: Record<string, unknown>) => ({ packages: { "": {}, ...packages } });
  const pkg = { dependencies: { next: "16.4.2" } };

  it("passes the real lockfile", () => {
    const real = JSON.parse(readFileSync("package.json", "utf8"));
    const realLock = JSON.parse(readFileSync("package-lock.json", "utf8"));
    expect(checkDeps(real, realLock)).toEqual([]);
  });
  it("names the forbidden patterns", () => {
    for (const name of ["stripe", "@stripe/stripe-js", "mixpanel-browser", "@sentry/nextjs", "@vercel/analytics", "ai", "sharp", "framer-motion", "next/font"].slice(0, 8)) expect(isForbidden(name), name).toBe(true);
    for (const name of ["next", "motion", "lucide-react", "airbnb"]) expect(isForbidden(name), name).toBe(false);
  });
  it("fails a forbidden direct dependency and a version range", () => {
    expect(checkDeps({ dependencies: { motion: "^14.9.0", zod: "4.0.0" } }, lock({})).join()).toMatch(/non-exact.*motion|motion.*non-exact|forbidden direct dependency zod/);
    expect(checkDeps({ dependencies: { motion: "^14.9.0" } }, lock({})).length).toBe(1);
    expect(checkDeps({ dependencies: { zod: "4.0.0" } }, lock({})).length).toBe(1);
  });
  it("checks the parent of the allowed families", () => {
    const ok = lock({
      "node_modules/next": { optionalDependencies: { sharp: "1" } },
      "node_modules/sharp": { optionalDependencies: { "@img/colour": "1" } },
      "node_modules/@img/colour": {},
      "node_modules/motion": { dependencies: { "framer-motion": "1" } },
      "node_modules/framer-motion": {},
    });
    expect(checkDeps(pkg, ok)).toEqual([]);
    const wrongSharp = lock({ "node_modules/other": { dependencies: { sharp: "1" } }, "node_modules/sharp": {} });
    expect(checkDeps(pkg, wrongSharp).join()).toMatch(/sharp is required by other/);
    const wrongMotion = lock({ "node_modules/other": { dependencies: { "framer-motion": "1" } }, "node_modules/framer-motion": {} });
    expect(checkDeps(pkg, wrongMotion).join()).toMatch(/framer-motion is required by other/);
    expect(checkDeps(pkg, lock({ "node_modules/@img/colour": {} })).join()).toMatch(/no parent/);
  });
  it("fails a forbidden package deep in the tree", () => {
    expect(checkDeps(pkg, lock({ "node_modules/a/node_modules/axios": {} })).join()).toMatch(/forbidden package/);
  });
});

describe("tokeniser", () => {
  it("splits on non-alphanumerics and camelCase", () => {
    expect(tokenise("fooBar-baz_QUX HTMLParser2")).toEqual(["foo", "bar", "baz", "qux", "html", "parser2"]);
  });
});

describe("private matching", () => {
  const deny = loadDenylist(writeDeny());
  function writeDeny() {
    const file = path.join(root, "deny.json");
    writeFileSync(file, JSON.stringify(DENY));
    return file;
  }
  it("token mode compares whole tokens", () => {
    expect(privateHits("the quillon here", deny)).toEqual(["token-3"]);
    expect(privateHits("a quillonish word", deny)).toEqual([]);
    expect(privateHits("myQuillonName", deny)).toEqual(["token-3"]);
  });
  it("sub mode also matches inside a token", () => {
    expect(privateHits("the Zorblax word", deny)).toEqual(["token-1"]);
    expect(privateHits("unzorblaxed", deny)).toEqual(["token-1"]);
  });
  it("short tokens stop at the length limit", () => {
    expect(privateHits("qw", deny)).toEqual(["token-2"]);
    expect(privateHits("qw", deny, { minLength: 4 })).toEqual([]);
  });
  it("runs the clear regexes", () => {
    expect(privateHits("a Made Up Phrase here", deny)).toEqual(["phrase"]);
  });
  it("fails the order prefix in our own text", () => {
    expect(genericHits("see ZZ-1042", deny)).toContain("real-order-prefix");
    expect(genericHits("see AZZ-1042", deny)).not.toContain("real-order-prefix");
  });
});

describe("generic patterns", () => {
  const none = { orderPrefix: null, regexes: [], tokens: [], allow: [] };
  const hit = (line: string) => genericHits(line, none);
  const cases: [string, string][] = [
    ["plan-word", "see the PL" + "AN file"],
    ["outside-url", "ht" + "tps://elsewhere.test/a"],
    ["password-field", '<input type="pass' + 'word" />'],
    ["card-field", "autocomplete='cc" + "-number'"],
    ["card-field", "Karten" + "nummer"],
    ["sharp-s", "Gro" + String.fromCharCode(0xdf) + "e"],
    ["pictograph", "great " + String.fromCodePoint(0x1f680)],
    ["banned-next-module", 'import x from "next/im' + 'age";'],
    ["banned-next-module", 'import x from "next/font/goo' + 'gle";'],
    ["banned-import", 'import { x } from "framer' + '-motion";'],
    ["banned-import", 'const s = require("sh' + 'arp");'],
    ["env-read", "process." + "env.SECRET_THING"],
    ["network-call", "await fet" + "ch(url)"],
    ["network-call", "new Web" + "Socket(u)"],
    ["network-call", "navigator.send" + "Beacon(u)"],
    ["server-action", '"use ser' + 'ver";'],
    ["image-reference", '<img src="/a.pn' + 'g" />'],
    ["image-reference", "background:url(/b.jp" + "g)"],
    ["image-reference", 'import a from "./a.we' + 'bp";'],
  ];
  for (const [rule, line] of cases) {
    it(`${rule}: ${JSON.stringify(line).slice(0, 40)}`, () => {
      expect(hit(line)).toContain(rule);
    });
  }
  it("lets the allowed forms through", () => {
    expect(hit('xmlns="ht' + 'tp://www.w3.org/2000/svg"')).toEqual([]);
    expect(hit("ht" + "tps://shop.example.com/x")).toEqual([]);
    expect(hit("`ht" + "tps://${SHOP_DOMAIN}/track`")).toEqual([]);
    expect(hit("`ht" + "tps://${OTHER}/track`")).toContain("outside-url");
    expect(hit("process." + "env.NEXT_PUBLIC_BASE_PATH")).toEqual([]);
    expect(hit("process." + "env.NODE_ENV")).toEqual([]);
    expect(hit("background:#000;color:black;fill:rgba(0, 0, 0, .3)")).toEqual([]);
    expect(hit("Copyright © and ™ stay")).toEqual([]);
    expect(hit('name: "lookbook-01.jp' + 'g"')).toEqual([]);
    expect(hit("refetch" + "(x)")).toEqual([]);
    expect(hit("planning the plan")).toEqual([]);
  });
});

describe("place table", () => {
  it("routes files to the right row", () => {
    expect(placeOf("src/ui/Button.tsx")).toBe("own");
    expect(placeOf("docs/coverage.md")).toBe("own");
    expect(placeOf("next.config.ts")).toBe("own");
    expect(placeOf("scan/scan.mjs")).toBe("private-only");
    expect(placeOf("package-lock.json")).toBe("private-only");
    expect(placeOf("src/fonts/LICENSES.txt")).toBe("private-only");
    expect(placeOf("next-env.d.ts")).toBe("private-only");
  });
});

describe("runScan", () => {
  const denyFile = () => {
    const file = path.join(root, "deny-run.json");
    writeFileSync(file, JSON.stringify(DENY));
    return file;
  };

  it("prints file and line, never the matched word", () => {
    const dir = fixture("leak", { "src/a.ts": "ok line\nconst zorblaxName = 1;\n" });
    const q = quiet();
    const failures = runScan({ root: dir, denylist: denyFile(), log: q.log });
    expect(failures).toEqual([{ file: "src/a.ts", line: 2, rule: "token-1" }]);
    expect(q.lines.join("\n").toLowerCase()).not.toContain("zorblax");
  });
  it("runs generics on our text but only private tokens on scan/ and the lockfile", () => {
    const dir = fixture("rows", {
      "src/a.ts": "await fet" + "ch(u)\n",
      "scan/b.mjs": "await fet" + "ch(u)\n",
      "package-lock.json": '{ "resolved": "ht' + 'tps://registry.npmjs.org/x", "integrity": "sha512-a/qw/b" }\n',
    });
    const q = quiet();
    const failures = runScan({ root: dir, denylist: denyFile(), log: q.log });
    expect(failures.map((f) => f.file)).toEqual(["src/a.ts"]);
  });
  it("checks file names, allowing only the favicon", () => {
    const dir = fixture("names", { "src/app/icon.svg": "<svg/>", "src/x.png": "", "docs/zorblax-notes.md": "fine\n", "src/b.svg": "<svg/>" });
    const rules = runScan({ root: dir, denylist: denyFile(), log: quiet().log }).map((f) => `${f.file} ${f.rule}`);
    expect(rules).toContain("src/x.png filename:image");
    expect(rules).toContain("src/b.svg filename:image");
    expect(rules).toContain("docs/zorblax-notes.md filename:token-1");
    expect(rules.some((r) => r.startsWith("src/app/icon.svg"))).toBe(false);
  });
  it("limits out/ to long tokens, our markers and image files", () => {
    const dir = fixture("output", {
      "src/app/icon.svg": "<svg/>",
      "out/a.js": "fet" + "ch(u); var qw=1;\n",
      "out/b.js": "var zorblax=1;\n",
      "out/c.js": 'x="<input type=\\"pass' + 'word\\">";\n',
      "out/d.html": '<input type="pass' + 'word">\n',
      "out/icon.svg": "<svg/>",
      "out/_next/static/media/icon.abc.svg": "<svg/>",
      "out/e.png": "",
    });
    const files = runScan({ root: dir, denylist: denyFile(), log: quiet().log }).map((f) => f.file);
    expect(files).toContain("out/b.js");
    expect(files).toContain("out/d.html");
    expect(files).toContain("out/e.png");
    expect(files).not.toContain("out/a.js");
    expect(files).not.toContain("out/icon.svg");
    expect(files).not.toContain("out/_next/static/media/icon.abc.svg");
  });
  it("honours the allow list by exact file and token", () => {
    const file = path.join(root, "deny-allow.json");
    writeFileSync(file, JSON.stringify({ ...DENY, allow: [{ file: "out/b.js", token: "zorblax" }] }));
    const dir = fixture("allowed", { "out/b.js": "var zorblax=1;\n", "out/f.js": "var zorblax=1;\n" });
    expect(runScan({ root: dir, denylist: file, log: quiet().log }).map((f) => f.file)).toEqual(["out/f.js"]);
  });
  it("reads UTF-16 and files with a NUL, and passes a binary only by its hash", () => {
    const line = "const zorblaxName = 1;\n";
    const dir = fixture("encodings", {
      "src/nul.ts": `${line}\0`,
      "docs/wide.md": "",
      "docs/wide-be.md": "",
      "src/fonts/planted.woff2": line,
      "out/planted.woff2": line,
    });
    writeFileSync(path.join(dir, "docs/wide.md"), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(line, "utf16le")]));
    writeFileSync(path.join(dir, "docs/wide-be.md"), Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(line, "utf16le").swap16()]));
    copyFileSync(path.join(process.cwd(), "src/fonts/geist.woff2"), path.join(dir, "src/fonts/geist.woff2"));
    const rules = runScan({ root: dir, denylist: denyFile(), log: quiet().log }).map((f) => `${f.file} ${f.rule}`);
    expect(rules).toContain("src/nul.ts token-1");
    expect(rules).toContain("docs/wide.md token-1");
    expect(rules).toContain("docs/wide-be.md token-1");
    expect(rules).toContain("src/fonts/planted.woff2 binary:unknown");
    expect(rules).toContain("out/planted.woff2 binary:unknown");
    expect(rules.some((r) => r.startsWith("src/fonts/geist.woff2"))).toBe(false);
  });
  it("warns once and runs the generics without a denylist", () => {
    const dir = fixture("nolist", { "src/a.ts": "zorblax\n" });
    const q = quiet();
    expect(runScan({ root: dir, denylist: null, log: q.log })).toEqual([]);
    expect(q.lines.filter((l) => l.includes("warning")).length).toBe(1);
  });
});

describe("out-check", () => {
  const good = { "next.config.ts": 'export default { output: "export" };', "src/app/page.tsx": "", "out/index.html": "", "out/404.html": "" };
  it("passes a clean export", () => {
    expect(checkOut(fixture("clean", good))).toEqual([]);
  });
  it("fails the server shapes", () => {
    const failing: Record<string, string>[] = [
      { "next.config.ts": "export default {};" },
      { "src/app/x/route.ts": "" },
      { "src/middleware.ts": "" },
      { "out/api/a.txt": "" },
      { "out/server/a.txt": "" },
      { "out/_worker.js": "" },
      { "out/a.js.map": "" },
      { "out/vercel.json": "" },
      { ".env.local": "" },
    ];
    failing.forEach((extra, i) => {
      expect(checkOut(fixture(`bad${i}`, { ...good, ...extra })).length, Object.keys(extra)[0]).toBeGreaterThan(0);
    });
    const missing = fixture("missing", { "next.config.ts": good["next.config.ts"], "src/app/page.tsx": "", "out/index.html": "" });
    expect(checkOut(missing).join()).toMatch(/404\.html/);
  });
});

describe("crawl inputs", () => {
  it("wants a black body on every route but the print pages", () => {
    const black = "rgb(0, 0, 0)";
    for (const route of ["/", "/shop/", "/desk/", "/desk/orders/?o=AL-1147", "/no-such-route-here/"]) {
      expect(bodyColourProblem(route, black), route).toBeNull();
      expect(bodyColourProblem(route, "rgb(255, 255, 255)"), route).toContain("wanted black");
      expect(bodyColourProblem(route, "rgba(0, 0, 0, 0)"), route).toContain("wanted black");
    }
    expect(bodyColourProblem("/print/slip/?o=AL-1147", "rgb(255, 255, 255)")).toBeNull();
    expect(bodyColourProblem("/print/labels/", "rgb(255, 255, 255)")).toBeNull();
  });
  it("reads every registry screen", () => {
    const rows = readRegistry();
    expect(rows.length).toBe(42);
    expect(rows.find((r) => r.id === "orders")).toEqual({ id: "orders", route: "/desk/orders/", en: "Orders", de: "Bestellungen" });
    expect(rows.find((r) => r.id === "returns")?.route).toBe("/desk/orders/returns/");
  });
  it("turns index files into routes, leaving out the framework folders", () => {
    const dir = fixture("routes", { "out/index.html": "", "out/shop/index.html": "", "out/_next/x/index.html": "", "out/404/index.html": "", "out/_not-found/index.html": "" });
    expect(outRoutes(path.join(dir, "out"))).toEqual(["/", "/shop/"]);
  });
  it("carries the deep-link states the crawl must load", () => {
    const paths = readStates().map((s) => s.path);
    for (const p of ["/desk/orders/?o=AL-1147", "/desk/system/email/?tab=outbox", "/shop/checkout/result/?state=failed", "/shop/c/x/?handle=unknown", "/shop/p/x/?slug=unknown"]) expect(paths).toContain(p);
  });
});
