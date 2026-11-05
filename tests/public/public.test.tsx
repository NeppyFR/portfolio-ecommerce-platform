import { readFileSync } from "node:fs";
import { renderToStaticMarkup as html } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { built } from "@/i18n/dict/built";
import { landing } from "@/i18n/dict/landing";
import { screenForPath } from "@/desk/registry";
import { DOCK_ITEMS, NAV_GROUPS } from "@/desk/shell/sidebar-nav";
import { STATIONS } from "@/map/data";
import { getState } from "@/store/core";
import { attentionCount, toPackCount } from "@/store/selectors";
import { HEALTH_CHECKS } from "@/store/seed/system";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

const { LandingScreen } = await import("@/landing/LandingScreen");
const { BuiltScreen } = await import("@/built/BuiltScreen");

const NUMBERS = ["435", "65", "45", "64", "87", "1'134", "1'301", "195", "60", "53", "2"];
/** The landing's stats row leads with the screens. */
const LANDING_NUMBERS = ["53", "435", "65", "45", "64", "87", "1'134", "1'301", "195", "60", "2"];
const text = (markup: string) => markup.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'");

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("the public pages on black", () => {
  const OWNED = ["src/landing/landing.css", "src/landing/LandingScreen.tsx", "src/landing/LiveMap.tsx", "src/map/MapCanvas.tsx", "src/built/built.css", "src/built/ArchitectureDiagram.tsx"];

  it("holds none of the old light surfaces, navy inks or their shadows", () => {
    for (const path of OWNED) {
      const text = read(path);
      expect(text, path).not.toMatch(/#0a1f63|#233a84|#46599e|#0f1730|#39425c|#5c6580|#143bb0|#7286d0|#f4f8ff|#e9f1ff|#d8e4ff|#b6cbfa|#e8f0ff|#e4ecff|#e9f9ff|#c6f4ff|#9be6ff/i);
      expect(text, path).not.toMatch(/rgba\((10,31,99|15,23,48),/);
      expect(text, path).not.toMatch(/background:var\(--white\)|color:var\(--white\)|fill="#fff"/);
    }
  });
  it("gives the hero a black page and a sky-to-violet third line", () => {
    const css = read("src/landing/landing.css");
    expect(css).toMatch(/\.lp\{background:var\(--page\)/);
    expect(css).toContain(".lp-h1 em{background:linear-gradient(90deg,#6fd3ff,#8c7bff)");
  });
  it("fills the hubs and people from the map's own gradient", () => {
    const page = html(<LandingScreen />);
    expect(page).toContain('id="lp-hub"');
    expect(read("src/landing/landing.css")).toMatch(/data-kind="hub"\],\[data-kind="person"\]\) \.ui-map-box\{fill:url\(#lp-hub\)/);
  });
  it("keeps the wire labels to hover on both wide drawings, with the packets under them in each", () => {
    const page = html(<LandingScreen />);
    expect(page.match(/data-hover-labels/g)?.length).toBe(2);
    expect(page.match(/data-label="/g)?.length).toBe(32);
    expect(page).not.toContain('<svg class="lp-story"');
    expect(page.indexOf('data-star="story"')).toBeLessThan(page.indexOf('data-layer="labels"'));
    const css = read("src/styles/ui.css");
    expect(css).toMatch(/\[data-hover-labels\] \.ui-map-label\{opacity:0;visibility:hidden;pointer-events:none/);
    expect(css).toMatch(/prefers-reduced-motion:reduce\)\{\s*\.ui-map\[data-hover-labels\] \.ui-map-label/);
  });
  it("holds the map's text floor by the width the map really has, without squeezing the type or stretching the plates", () => {
    const css = read("src/landing/landing.css");
    expect(css).toMatch(/@media \(min-width:1280px\)\{\s*@container \(max-width:1275\.98px\)\{\s*\.lp-map-wide\{display:none\}\s*\.lp-map-snug\{display:block\}\s*\}\s*@container \(max-width:1439\.98px\)\{\s*\.lp-map \.ui-map-label text,\.lp-map \.ui-map-name\{font-size:13\.7px\}/);
    expect(css).toContain('.lp-map .ui-map[data-drawing="snug"] :is(.ui-map-label text,.ui-map-name,.ui-map-second){font-size:14px}');
    expect(read("src/built/built.css")).toContain("@media (min-width:1280px){@container (max-width:1275.98px){.bt-map-wide{display:none}.bt-map-snug{display:block}}}");
    expect(css).toContain(".lp-hero-wrap{container-type:inline-size}");
    expect(read("src/built/built.css")).toContain(".bt-map-band{container-type:inline-size;");
    expect(css).not.toMatch(/ui-map-second[^}]*letter-spacing/);
    expect(css).not.toContain("scaleX(");
  });
  it("marks a focused wire along its own line, not with a rectangle around it", () => {
    const css = read("src/app/globals.css").replace(/\s+/g, " ");
    expect(css).toContain(".ui-map .ui-map-hit:focus-visible { outline: none; box-shadow: none; stroke: rgba(185, 243, 255, .22); }");
  });
  it("lists the connections in a closed section under the map on either layout, and moves the panel and chips out of the map", () => {
    const page = html(<LandingScreen />);
    expect(page.match(/<details class="lp-all/g)?.length).toBe(2);
    expect(page).not.toMatch(/<details[^>]*\sopen/);
    expect(page.indexOf('class="lp-all lp-all-wide"')).toBeGreaterThan(page.indexOf('data-mode="wide"'));
    expect(page.indexOf("lp-panel-float")).toBeGreaterThan(0);
    expect(page.indexOf("lp-panel-float")).toBeLessThan(page.indexOf('data-mode="wide"'));
  });
});

describe("landing", () => {
  const page = html(<LandingScreen />);

  it("says the headline, the sentence and the honest line", () => {
    for (const line of [landing.en.headline1, landing.en.headline2, landing.en.headline3, "53-screen", "This demo runs none of it"]) expect(page).toContain(line);
    expect([landing.en.headline1, landing.en.headline2, landing.en.headline3]).toEqual(["One online shop.", "53 staff screens.", "Everything behind it."]);
    expect([landing.de.headline1, landing.de.headline2, landing.de.headline3]).toEqual(["Ein Onlineshop.", "53 Screens fürs Team.", "Und alles dahinter."]);
    expect([landing.en.mapTitle1, landing.en.mapTitle2]).toEqual(["Nine services.", "Sixteen connections."]);
    expect([landing.de.mapTitle1, landing.de.mapTitle2]).toEqual(["Neun Dienste.", "Sechzehn Verbindungen."]);
  });

  it("has one h1, the headline, and leaves the main landmark to the desk shell", () => {
    expect(page.match(/<h1[\s>]/g)?.length).toBe(1);
    expect(page).not.toMatch(/<main[\s>]/);
    expect(page).not.toContain('id="main"');
    expect(page).not.toMatch(/class="lp-rail[ "]/);
  });

  it("opens the dashboard from the big button, with the shop as the quiet link", () => {
    expect(landing.en.openDesk).toBe("Open the dashboard");
    expect(landing.de.openDesk).toBe("Dashboard öffnen");
    expect(page).toMatch(/<a class="lp-go-main" href="\/desk\/?">Open the dashboard/);
    expect(page).toMatch(/<a class="lp-go-quiet" href="\/shop\/?">/);
    expect(page.indexOf('class="lp-go-main"')).toBeLessThan(page.indexOf('class="lp-go-quiet"'));
  });

  it("puts the hero, the tour, the map, the stats and the shop in that order", () => {
    const order = ['class="lp-top"', 'class="lt"', 'id="map"', 'class="lp-ledger"', 'class="lp-shop"'].map((m) => page.indexOf(m));
    for (const at of order) expect(at).toBeGreaterThan(0);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("tours six areas of the desk, each with links into its screens", () => {
    for (const id of ["orders", "stock", "launch", "money", "team", "run"]) {
      const start = page.indexOf(`class="lt-panel lt-${id}`);
      expect(start, id).toBeGreaterThan(0);
      expect(page.slice(start, start + 20000), id).toMatch(/href="\/desk\//);
    }
  });

  it("prints the eleven ledger numbers from the allowed list, the screens first", () => {
    const start = page.indexOf('class="lp-ledger"');
    const ledger = page.slice(start, page.indexOf("</dl>", start));
    expect([...ledger.matchAll(/<dd>([^<]+)<\/dd>/g)].map((m) => m[1].replace(/&#x27;/g, "'"))).toEqual(LANDING_NUMBERS);
  });

  it("links the story order to the real pane and offers all six stations", () => {
    expect(page).toMatch(/href="\/desk\/orders\/?\?o=AL-1150"/);
    for (const s of STATIONS) expect(page).toContain(`</span>${s.en}</button>`);
    expect(page).toContain("data-story-step=");
  });

  it("has the map three times, the hero and snug drawings for the wide layout and the phone one, with every box and a packet per running wire", () => {
    expect(page.match(/data-mode="wide"/g)?.length).toBe(2);
    expect(page.match(/data-drawing="snug"/g)?.length).toBe(1);
    expect(page.match(/data-mode="phone"/g)?.length).toBe(1);
    expect(page.match(/data-node="/g)?.length).toBe(33);
    expect(page.match(/data-packet="/g)?.length).toBe(42);
    expect(page).not.toContain('data-packet="ghSb"');
    expect(page).not.toContain('data-packet="ghR2"');
    expect(page).toContain('data-star="story"');
    expect(page).toContain('class="lp-story"');
    expect(page).toContain('id="lp-tile"');
  });

  it("counts the orders from the seed, and offers the step-in chips in the hero and under the tour", () => {
    const state = getState();
    const need = attentionCount(state);
    expect(text(page)).toContain(`${toPackCount(state)} to pack, ${need} ${need === 1 ? "needs" : "need"} you.`);
    expect((page.match(/>Warehouse<\/button>/g) ?? []).length).toBe(2);
  });

  it("closes with a receipt of zeros and a link to /built/", () => {
    expect(page.match(/CHF.0\.00/g)?.length).toBe(6);
    expect(page).toContain("Charged to you");
    expect(page).toMatch(/href="\/built\/?"/);
  });

  it("has no outbound link", () => {
    const hrefs = [...page.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(5);
    for (const h of hrefs) expect(h.startsWith("/") || h.startsWith("#"), h).toBe(true);
  });
});

describe("inside the desk", () => {
  it("opens the overview and How it was built from the top of the sidebar, above the Dashboard", () => {
    expect(NAV_GROUPS[0].items.map((i) => [i.id, i.route])).toEqual([["overview", "/"], ["built", "/built/"]]);
    expect(NAV_GROUPS[1].items[0].id).toBe("dashboard");
    expect(NAV_GROUPS[0].items.map((i) => [i.en, i.de])).toEqual([["Overview", "Übersicht"], ["How it was built", "So ist es gebaut"]]);
    expect(DOCK_ITEMS[0]).toBe("overview");
  });
  it("finds the overview at the root only", () => {
    expect(screenForPath("/")?.id).toBe("overview");
    expect(screenForPath("/built/")?.id).toBe("built");
    expect(screenForPath("/shop/")).toBe(undefined);
    expect(screenForPath("/desk/")?.id).toBe("dashboard");
  });
  it("renders both pages inside the shell", () => {
    for (const path of ["src/app/page.tsx", "src/app/built/page.tsx"]) expect(read(path), path).toContain("<DeskShell>");
  });
});

describe("built", () => {
  const page = html(<BuiltScreen />);

  it("has one h1 and leaves the main landmark to the desk shell", () => {
    expect(page.match(/<h1[\s>]/g)?.length).toBe(1);
    expect(page).not.toMatch(/<main[\s>]/);
    expect(page).not.toContain('id="main"');
  });

  it("has all seven anchors, each with its target", () => {
    for (const id of ["map", "architecture", "money-path", "security", "testing", "timeline", "demo"]) {
      expect(page).toContain(`href="#${id}"`);
      expect(page).toContain(`id="${id}"`);
    }
  });

  it("states the real hosting setup line and gives the map's tiles their gradient", () => {
    expect(page).toContain("This is the real hosting setup. Not all of it runs yet. This demo runs none of it.");
    expect(page).toContain('id="lp-tile"');
  });

  it("promises what a declined card does", () => {
    expect(page).toContain("A declined card changes nothing");
  });

  it("names the security details", () => {
    for (const word of ["scrypt", "HS256", "5 tries"]) expect(page).toContain(word);
    expect(built.en.layers.length).toBe(5);
    expect(built.de.layers.length).toBe(5);
    expect(built.en.paths.map((r) => r[0])).toContain("/%2561dmin");
  });

  it("lists the eleven numbers, with what each proves", () => {
    expect(built.en.ledger.map((r) => r[0])).toEqual(NUMBERS);
    expect(built.de.ledger.map((r) => r[0])).toEqual(NUMBERS);
    for (const row of built.en.ledger) expect(row[2].length).toBeGreaterThan(5);
  });

  it("explains all 27 checks in both languages, none left out", () => {
    expect(HEALTH_CHECKS.length).toBe(27);
    for (const c of HEALTH_CHECKS) {
      expect(built.en.checks[c.id], c.id).toBeTruthy();
      expect(built.de.checks[c.id], c.id).toBeTruthy();
      expect(page, c.id).toContain(`>${c.id}</code>`);
    }
    expect(page).not.toMatch(/\b31 (checks|health)/);
  });

  it("dates the timeline 18 to 29 October, with the same stops in German", () => {
    expect(built.en.milestones[0][0]).toMatch(/^18/);
    expect(built.en.milestones.at(-1)?.[0]).toMatch(/^29/);
    expect(built.de.milestones.length).toBe(built.en.milestones.length);
  });

  it("says what the demo changed", () => {
    const words = built.en.demoRows.map((r) => r[2]).join(" ");
    for (const word of ["No database", "No payment", "No email", "No storage", "No paid API", "invented"]) expect(words).toContain(word);
    expect(built.en.demoRows.at(-1)?.[1]).toBe("Not in the original");
  });

  it("has no outbound link", () => {
    for (const m of page.matchAll(/href="([^"]+)"/g)) expect(m[1].startsWith("/") || m[1].startsWith("#"), m[1]).toBe(true);
  });
});

describe("strings", () => {
  it("use Swiss orthography", () => {
    expect(JSON.stringify([landing, built])).not.toContain(String.fromCharCode(0xdf));
  });
  it("keep the same arrays in both languages", () => {
    expect(built.de.checkout.length).toBe(built.en.checkout.length);
    expect(built.de.webhook.length).toBe(built.en.webhook.length);
    expect(built.de.demoRows.length).toBe(built.en.demoRows.length);
    expect(built.de.paths.length).toBe(built.en.paths.length);
  });
});
