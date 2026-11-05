import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const shop = readFileSync("src/shop/shop.css", "utf8");
const print = readFileSync("src/print/print.css", "utf8");
const slip = readFileSync("src/print/SlipScreen.tsx", "utf8");
const labels = readFileSync("src/print/LabelsScreen.tsx", "utf8");
const art = readFileSync("src/art/ProductArt.tsx", "utf8");

/** Every rule of a stylesheet that names this selector exactly. */
const rule = (css: string, selector: string) => {
  const at = css.indexOf(`${selector}{`);
  if (at < 0) throw new Error(`no rule ${selector}`);
  return css.slice(at, css.indexOf("}", at));
};

describe("the shop on black", () => {
  it("puts the shop and its header on the black page", () => {
    expect(rule(shop, ".sp-root")).toContain("background:var(--page)");
    expect(rule(shop, ".sp-head")).toContain("background:var(--page)");
  });

  it("never names the old surface, and keeps white for the email frame alone", () => {
    expect(shop).not.toContain("var(--white)");
    const whites = shop.match(/#fff\b|#ffffff\b|\bwhite\b(?!-)/gi) ?? [];
    expect(whites).toEqual(["#fff"]);
    expect(rule(shop, ".sp-mail")).toContain("background:#fff");
  });

  it("marks a step on the solid blue, not on the page's text colour", () => {
    expect(rule(shop, ".sp-co-no")).toContain("background:var(--solid)");
    expect(rule(shop, ".sp-co-no")).toContain("color:var(--on-solid)");
  });

  it("draws the focus ring inside a wall tile, where its neighbours cannot paint over it", () => {
    expect(rule(shop, ".sp-wall-link:focus-visible::after")).toContain("inset 0 0 0 2px var(--ice)");
    expect(rule(shop, ".sp-wall-link:focus-visible")).toContain("z-index:2");
  });

  it("gives the hovers that a dark surface needs", () => {
    for (const selector of [".sp-bag:hover", ".sp-outcome:hover"]) expect(rule(shop, selector)).toContain("background:var(--mist-2)");
    expect(rule(shop, ".sp-wall-link:hover .sp-cap")).toContain("background:var(--mist)");
    expect(rule(shop, ".sp-linkbtn:hover")).toContain("text-decoration-thickness:2px");
  });
});

describe("the printed documents", () => {
  it("keeps the slip and the label sheets on paper, with the page around them black", () => {
    expect(slip).toContain('className="pr-sheet paper"');
    expect(labels).toContain('"pr-a4" : "pr-roll"} paper`');
    expect(rule(print, ".pr-page")).toContain("background:var(--page)");
  });
});

describe("products on a night tile", () => {
  it("draws only with the art's own palette, so a dark tile shows no stray grey", () => {
    expect(art).not.toContain("#7286d0");
  });

  it("names no white or near-white tile", () => {
    const fields = readFileSync("src/styles/fields.css", "utf8");
    const tiles = fields.split(/\r?\n/).filter((line) => line.startsWith(".t-"));
    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) expect(tile, tile).not.toMatch(/#fff\b|#ffffff\b|\bwhite\b/i);
  });
});
