import { renderToStaticMarkup as html } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { built } from "@/i18n/dict/built";
import { landing } from "@/i18n/dict/landing";
import { STATIONS } from "@/map/data";
import { HEALTH_CHECKS } from "@/store/seed/system";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

const { LandingScreen } = await import("@/landing/LandingScreen");
const { BuiltScreen } = await import("@/built/BuiltScreen");

const NUMBERS = ["435", "65", "45", "64", "87", "1'134", "1'301", "195", "60", "53", "2"];

describe("landing", () => {
  const page = html(<LandingScreen />);

  it("says the headline, the sentence and the honest line", () => {
    for (const line of [landing.en.headline1, landing.en.headline2, landing.en.headline3, "53-screen", "This demo runs none of it"]) expect(page).toContain(line);
    expect(landing.en.headline1).toBe("Nine services.");
    expect(landing.en.headline2).toBe("Sixteen connections.");
    expect(landing.en.headline3).toBe("One clothing shop.");
    expect(landing.de.headline1).toBe("Neun Dienste.");
  });

  it("prints the eleven ledger numbers from the allowed list", () => {
    const start = page.indexOf('class="lp-ledger"');
    const ledger = page.slice(start, page.indexOf("</dl>", start));
    expect([...ledger.matchAll(/<dd>([^<]+)<\/dd>/g)].map((m) => m[1].replace(/&#x27;/g, "'"))).toEqual(NUMBERS);
  });

  it("links the story order to the real pane and offers all six stations", () => {
    expect(page).toMatch(/href="\/desk\/orders\/?\?o=AL-1150"/);
    for (const s of STATIONS) expect(page).toContain(`</span>${s.en}</button>`);
    expect(page).toContain("data-story-step=");
  });

  it("has the map twice, one for each layout, with every box and a packet per running wire", () => {
    expect(page.match(/data-mode="wide"/g)?.length).toBe(1);
    expect(page.match(/data-mode="phone"/g)?.length).toBe(1);
    expect(page.match(/data-node="/g)?.length).toBe(22);
    expect(page.match(/data-packet="/g)?.length).toBe(28);
    expect(page).not.toContain('data-packet="ghSb"');
    expect(page).not.toContain('data-packet="ghR2"');
    expect(page).toContain('data-star="story"');
    expect(page.indexOf('data-star="story"')).toBeGreaterThan(page.indexOf('class="lp-story"'));
    expect(page).toContain('class="lp-story"');
    expect(page).toContain('id="lp-tile"');
  });

  it("shows the desk title from the seed, and step-in chips in hero and strip", () => {
    expect(page).toContain("14 to pack, 3 need you.");
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

describe("built", () => {
  const page = html(<BuiltScreen />);

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
