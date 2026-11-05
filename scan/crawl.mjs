// Route crawl. Starts its own static server on 4418 over out/, honouring the base path,
// and walks every route at two widths in two languages as superUser. Usage:
//   node scan/crawl.mjs --denylist <path> [--allow-stubs] [--only <substring>]
import { createServer } from "node:http";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { argValue, loadDenylist, privateHits } from "./scan.mjs";

const PORT = 4418;
const ORIGIN = `http://localhost:${PORT}`;
const ROOT = process.cwd();
const OUT = path.join(ROOT, "out");
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
];
const LANGS = ["en", "de"];
const CONCURRENCY = 6;
const NAV_TIMEOUT = 30_000;

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".txt": "text/plain; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon",
};

/** Screen id, route and titles, read from the registry's source so this script needs no TypeScript. */
export function readRegistry(root = ROOT) {
  const source = readFileSync(path.join(root, "src", "desk", "registry.ts"), "utf8");
  const re = /\{\s*id:\s*"([^"]+)",\s*region:[^,]+,(?:\s*parent:\s*"[^"]+",)?\s*route:\s*"([^"]+)",\s*icon:\s*\w+,\s*en:\s*"([^"]+)",\s*de:\s*"([^"]+)"/g;
  return [...source.matchAll(re)].map((m) => ({ id: m[1], route: m[2], en: m[3], de: m[4] }));
}

/** Every index.html under out/, as routes. The not-found pages are covered by the deliberate 404 check. */
export function outRoutes(outDir = OUT) {
  const routes = [];
  const visit = (dir, prefix) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (prefix === "/" && (entry.name === "_next" || entry.name === "404" || entry.name === "_not-found")) continue;
        visit(path.join(dir, entry.name), `${prefix}${entry.name}/`);
      } else if (entry.name === "index.html") {
        routes.push(prefix);
      }
    }
  };
  visit(outDir, "/");
  return routes.sort();
}

export function readStates(root = ROOT) {
  const file = path.join(root, "scan", "states.json");
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, "utf8")).map((s) => (typeof s === "string" ? { path: s } : s));
}

function startServer(basePath) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, ORIGIN);
    let pathname = decodeURIComponent(url.pathname);
    const send404 = () => {
      res.writeHead(404, { "content-type": MIME[".html"] });
      res.end(readFileSync(path.join(OUT, "404.html")));
    };
    if (basePath) {
      if (pathname !== basePath && !pathname.startsWith(`${basePath}/`)) return send404();
      pathname = pathname.slice(basePath.length) || "/";
    }
    const target = path.normalize(path.join(OUT, pathname));
    if (target !== OUT && !target.startsWith(OUT + path.sep)) return send404();
    let file = target;
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!existsSync(file) || !statSync(file).isFile()) return send404();
    res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

const initScript = ([langKey, lang, profileKey, profile]) => {
  try {
    window.localStorage.setItem(langKey, lang);
    window.sessionStorage.setItem(profileKey, profile);
  } catch {
    /* a blocked store only hides the check that needs it */
  }
};

function readStorageKeys(root = ROOT) {
  const source = readFileSync(path.join(root, "src", "lib", "brand.ts"), "utf8");
  const lang = /lang:\s*"([^"]+)"/.exec(source)?.[1];
  const profile = /profile:\s*"([^"]+)"\s*\}/.exec(source)?.[1];
  if (!lang || !profile) throw new Error("STORAGE_KEYS not found in src/lib/brand.ts");
  return { lang, profile };
}

async function newPage(browser, viewport, lang, profile, keys) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, serviceWorkers: "block" });
  await context.addInitScript(initScript, [keys.lang, lang, keys.profile, profile]);
  const page = await context.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT);
  return { context, page };
}

function watch(page, problems, label, { allow404 = false } = {}) {
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (allow404 && /404/.test(m.text())) return;
    problems.push(`${label}: console error: ${m.text().slice(0, 200)}`);
  });
  page.on("pageerror", (e) => problems.push(`${label}: page error: ${String(e.message).slice(0, 200)}`));
  page.on("request", (r) => {
    const u = r.url();
    if (u.startsWith("data:") || u.startsWith("blob:") || u.startsWith("about:")) return;
    if (!u.startsWith(`${ORIGIN}/`)) problems.push(`${label}: request to another origin: ${new URL(u).origin}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !allow404) problems.push(`${label}: HTTP ${r.status()} ${new URL(r.url()).pathname}`);
  });
}

const PICTO = /\p{Extended_Pictographic}/gu;
const PICTO_OK = new Set([0xa9, 0xae, 0x2122]);

function checkText(text, lang, deny, label, problems) {
  text.split(/\n/).forEach((line, i) => {
    for (const id of privateHits(line, deny)) problems.push(`${label}: rendered line ${i + 1}: ${id}`);
    if (lang === "de" && line.includes("ß")) problems.push(`${label}: rendered line ${i + 1}: sharp-s`);
    if ([...line.matchAll(PICTO)].some((m) => !PICTO_OK.has(m[0].codePointAt(0)))) problems.push(`${label}: rendered line ${i + 1}: pictograph`);
  });
}

/** Black is the page colour everywhere. The print pages are the exception: they are documents. */
export function bodyColourProblem(pathname, colour) {
  if (pathname.split("?")[0].startsWith("/print/")) return null;
  return colour === "rgb(0, 0, 0)" ? null : `the body background is ${colour}, wanted black`;
}

async function visit(page, entry, ctx) {
  const { lang, viewport, deny, allowStubs, registry, basePath, problems } = ctx;
  const label = `${entry.path} [${lang} ${viewport.name}]`;
  try {
    await page.goto(`${ORIGIN}${basePath}${entry.path}`, { waitUntil: "load" });
    // The static HTML is the default profile until hydration reads the stored one.
    if (entry.path.startsWith("/desk/") && !entry.path.startsWith("/desk/enter")) {
      await page.waitForSelector('.dk-root[data-profile="superUser"]', { timeout: 8000 }).catch(() => {});
    }
    await page.waitForTimeout(entry.wait ?? 150);
    // A state that names a record must open it: a stale id would otherwise pass as an empty page.
    if (/[?&]open=/.test(entry.path)) {
      await page.waitForSelector("dialog[open]", { timeout: 4000 }).catch(() => problems.push(`${label}: the sheet did not open`));
    }
    if (entry.click) {
      await page.locator(entry.click).first().click({ timeout: 5000 }).catch(() => problems.push(`${label}: could not click ${entry.click}`));
      await page.waitForTimeout(150);
    }
    const facts = await page.evaluate(() => ({
      over: document.documentElement.scrollWidth - window.innerWidth,
      forms: document.querySelectorAll('input[type=password], [autocomplete^="cc-"]').length,
      stub: document.querySelectorAll("[data-screen-stub]").length,
      locked: document.querySelectorAll("[data-screen-locked]").length,
      lang: document.documentElement.lang,
      bodyColour: getComputedStyle(document.body).backgroundColor,
      text: document.body.innerText,
    }));
    if (facts.over > 1) problems.push(`${label}: page scrolls sideways by ${facts.over}px`);
    if (facts.forms) problems.push(`${label}: password or card field present`);
    if (facts.lang !== lang) problems.push(`${label}: <html lang> is ${facts.lang}`);
    const bodyColour = bodyColourProblem(entry.path, facts.bodyColour);
    if (bodyColour) problems.push(`${label}: ${bodyColour}`);
    checkText(facts.text, lang, deny, label, problems);

    const bare = entry.path.split("?")[0];
    if (bare.startsWith("/desk/")) {
      const screen = registry.find((s) => s.route === bare);
      if (!screen) problems.push(`${label}: route is not in the registry`);
      else if (!facts.text.toLowerCase().includes(screen[lang].toLowerCase())) problems.push(`${label}: registry title not rendered`);
      if (facts.locked) problems.push(`${label}: renders the locked state`);
    }
    if (facts.stub && !allowStubs) problems.push(`${label}: renders ScreenStub`);
  } catch (e) {
    problems.push(`${label}: ${String(e.message).split("\n")[0].slice(0, 200)}`);
  }
}

async function pool(items, size, worker) {
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const item = items[next++];
        await worker(item);
      }
    }),
  );
}

async function notFoundCheck(browser, keys, basePath, problems, allowStubs) {
  const { context, page } = await newPage(browser, VIEWPORTS[0], "en", "superUser", keys);
  watch(page, problems, "404 check", { allow404: true });
  try {
    const res = await page.goto(`${ORIGIN}${basePath}/no-such-route-here/`, { waitUntil: "load" });
    if (res?.status() !== 404) problems.push(`404 check: status ${res?.status()}`);
    const links = await page.locator('a[href]').count();
    if (links === 0 && !allowStubs) problems.push("404 check: no link home");
    const bodyColour = bodyColourProblem("/no-such-route-here/", await page.evaluate(() => getComputedStyle(document.body).backgroundColor));
    if (bodyColour) problems.push(`404 check: ${bodyColour}`);
  } finally {
    await context.close();
  }
}

/** The in-between widths, overflow only: the two main passes never see a tablet. */
async function tabletPass(browser, keys, basePath, problems) {
  const routes = ["/", "/built/", "/desk/", "/desk/orders/", "/desk/finance/costs/", "/shop/"];
  for (const width of [720, 900, 1100]) {
    for (const lang of LANGS) {
      const { context, page } = await newPage(browser, { width, height: 800 }, lang, "superUser", keys);
      watch(page, problems, `tablet ${width} ${lang}`);
      for (const route of routes) {
        await page.goto(`${ORIGIN}${basePath}${route}`, { waitUntil: "load" });
        await page.waitForTimeout(250);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (over > 1) problems.push(`${route} [${lang} ${width}]: page scrolls sideways by ${over}px`);
      }
      await context.close();
    }
  }
}

/**
 * Back and Forward on a sheet and on the order pane, at both widths. The way in is client navigation from the Dashboard,
 * so all the entries live in one document and a Back press that does nothing shows up as a wrong address.
 */
export async function historyPass(browser, keys, basePath, problems, origin = ORIGIN) {
  const settle = (page) => page.waitForTimeout(300);
  for (const viewport of VIEWPORTS) {
    for (const { route, row, param } of [
      { route: "/desk/products/", row: viewport.name === "phone" ? ".ui-table-card" : "table tbody tr", param: "open" },
      { route: "/desk/orders/", row: ".or-row", param: "o" },
    ]) {
      const label = `history ${route} [${viewport.name}]`;
      const { context, page } = await newPage(browser, viewport, "en", "superUser", keys);
      watch(page, problems, label);
      const here = () => {
        const url = new URL(page.url());
        return `${url.pathname.slice(basePath.length)}${url.search}`;
      };
      const sheets = () => page.evaluate(() => document.querySelectorAll("dialog[open]").length);
      const expectAt = async (step, address) => {
        if (here() !== address) problems.push(`${label}: ${step}: the address is ${here()}, wanted ${address}`);
        if (await sheets()) problems.push(`${label}: ${step}: a sheet is still open`);
      };
      const openRow = async () => {
        // On desktop the first order is already shown, and clicking it pushes nothing, so take the second.
        const index = route === "/desk/orders/" && viewport.name === "desktop" ? 1 : 0;
        await page.locator(`${row} >> visible=true`).nth(index).click();
        await page.waitForFunction((key) => new URLSearchParams(location.search).has(key), param);
        await settle(page);
      };
      try {
        await page.goto(`${origin}${basePath}/desk/`, { waitUntil: "load" });
        await page.waitForSelector(".db", { timeout: 8000 });
        const target = `${basePath}${route}`;
        const side = page.locator(`.dk-side a[href="${target}"]`).first();
        if (await side.isVisible().catch(() => false)) await side.click();
        else {
          await page.locator(".dk-menu").first().click();
          await page.locator(`dialog.dk-drawer a[href="${target}"]`).first().click();
        }
        await page.waitForFunction((pathname) => location.pathname === pathname, target);
        await page.locator(`${row} >> visible=true`).first().waitFor({ state: "visible" });
        await settle(page);

        await openRow();
        const opened = here();
        await page.goBack({ waitUntil: "commit" });
        await settle(page);
        await expectAt("Back from the open row", route);
        await page.goForward({ waitUntil: "commit" });
        await settle(page);
        if (here() !== opened) problems.push(`${label}: Forward: the address is ${here()}, wanted ${opened}`);

        // Back again, open anew, and close the way a person does. Then one Back must leave the screen.
        await page.goBack({ waitUntil: "commit" });
        await settle(page);
        await openRow();
        if (param === "open" || viewport.name === "phone") {
          await page.keyboard.press("Escape");
          await settle(page);
          await expectAt("Esc", route);
        } else {
          await page.goBack({ waitUntil: "commit" });
          await settle(page);
        }
        await page.goBack({ waitUntil: "commit" });
        await settle(page);
        await expectAt("Back after closing", "/desk/");
      } catch (e) {
        problems.push(`${label}: ${String(e.message).split("\n")[0].slice(0, 200)}`);
      } finally {
        await context.close();
      }
    }
  }
}

async function warehousePass(browser, keys, basePath, problems) {
  const { context, page } = await newPage(browser, VIEWPORTS[0], "en", "warehouse", keys);
  watch(page, problems, "warehouse pass");
  try {
    await page.goto(`${ORIGIN}${basePath}/desk/finance/`, { waitUntil: "load" });
    await page.waitForSelector('.dk-root[data-profile="warehouse"]', { timeout: 8000 }).catch(() => {});
    await page.waitForSelector("[data-screen-locked]", { timeout: 8000 }).catch(() => {});
    const locked = await page.evaluate(() => document.querySelectorAll("[data-screen-locked]").length);
    if (!locked) problems.push("warehouse pass: /desk/finance/ does not show the locked state");
  } finally {
    await context.close();
  }
}

/** Add to bag, checkout, Paid, then the order appears in Orders. Every hop is client navigation, so memory state survives. */
async function endToEnd(browser, keys, basePath, problems) {
  const { context, page } = await newPage(browser, VIEWPORTS[0], "en", "owner", keys);
  watch(page, problems, "flow");
  try {
    await page.goto(`${ORIGIN}${basePath}/shop/p/logo-tee-cloud/`, { waitUntil: "load" });
    const size = page.locator('button[aria-pressed]:not([disabled])', { hasText: /^(M|L|S|XL)$/ }).first();
    if (await size.count()) await size.click();
    await page.getByRole("button", { name: "Add to bag" }).click();
    await page.locator('a[href*="/shop/bag"]').first().click();
    await page.waitForURL(/\/shop\/bag\//);
    await page.getByRole("link", { name: /checkout/i }).first().click();
    await page.waitForURL(/\/shop\/checkout\//);
    const paid = page.getByRole("button", { name: /^Paid\b/ }).first();
    if (!(await paid.isVisible().catch(() => false))) {
      await page.getByRole("button", { name: /^continue/i }).first().click();
    }
    await paid.click();
    await page.waitForURL(/\/shop\/checkout\/result\//, { timeout: 8000 });
    const order = new URL(page.url()).searchParams.get("order");
    if (!order) problems.push("flow: the result URL has no order number");
    await page.getByRole("link", { name: /see it in the desk/i }).click();
    await page.waitForURL(/\/desk\/orders\//);
    await page.waitForTimeout(300);
    const text = await page.evaluate(() => document.body.innerText);
    if (order && !text.includes(order)) problems.push(`flow: ${order} does not appear in Orders`);
  } catch (e) {
    problems.push(`flow: ${String(e.message).split("\n")[0].slice(0, 200)}`);
  } finally {
    await context.close();
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const allowStubs = argv.includes("--allow-stubs");
  const only = argValue(argv, "--only");
  const denylistPath = argValue(argv, "--denylist");
  if (denylistPath && !existsSync(denylistPath)) {
    console.error("crawl: the file given to --denylist does not exist.");
    return 2;
  }
  if (!denylistPath) console.warn("crawl: warning: no --denylist given, the private tokens did not run.");
  if (!existsSync(path.join(OUT, "index.html"))) {
    console.error("crawl: out/index.html is missing, build first.");
    return 2;
  }
  const deny = loadDenylist(denylistPath);
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
  const registry = readRegistry();
  const keys = readStorageKeys();

  const entries = [...outRoutes().map((p) => ({ path: p })), ...readStates()].filter((e) => !only || e.path.includes(only));
  const problems = [];
  let server;
  let browser;
  let exitCode = 1;
  try {
    server = await startServer(basePath);
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const contexts = [];
    for (const viewport of VIEWPORTS) {
      for (const lang of LANGS) {
        contexts.push({ viewport, lang });
      }
    }
    for (const c of contexts) {
      const jobs = entries;
      await pool(jobs, CONCURRENCY, async (entry) => {
        const { context, page } = await newPage(browser, c.viewport, c.lang, "superUser", keys);
        watch(page, problems, `${entry.path} [${c.lang} ${c.viewport.name}]`);
        await visit(page, entry, { ...c, deny, allowStubs, registry, basePath, problems });
        await context.close();
      });
      console.log(`crawl: ${entries.length} routes done at ${c.viewport.name} ${c.lang}.`);
    }
    if (!only) {
      await notFoundCheck(browser, keys, basePath, problems, allowStubs);
      await warehousePass(browser, keys, basePath, problems);
      await tabletPass(browser, keys, basePath, problems);
      await historyPass(browser, keys, basePath, problems);
      if (!allowStubs) await endToEnd(browser, keys, basePath, problems);
      else console.log("crawl: --allow-stubs, end-to-end flow skipped.");
    }
    const unique = [...new Set(problems)];
    for (const p of unique) console.error(`crawl: ${p}`);
    console.log(`crawl: ${unique.length} problem(s) over ${entries.length} routes × ${contexts.length} passes.`);
    exitCode = unique.length ? 1 : 0;
  } catch (e) {
    console.error(`crawl: ${String(e.message).split("\n")[0]}`);
  } finally {
    await browser?.close().catch(() => {});
    await new Promise((r) => (server ? server.close(r) : r()));
  }
  return exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code));
}
