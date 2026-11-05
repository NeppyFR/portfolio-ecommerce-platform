import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tokens = readFileSync("src/styles/tokens.css", "utf8");
const fields = readFileSync("src/styles/fields.css", "utf8");
/** The first :root block only: the screen's palette, before .paper and print. */
const screen = tokens.slice(0, tokens.indexOf("}"));

function token(name: string): string {
  const match = new RegExp(`--${name}:(#[0-9a-f]{3,6})\\b`, "i").exec(screen);
  if (!match) throw new Error(`no solid token --${name}`);
  return match[1];
}

function rgb(hex: string): number[] {
  const h = hex.slice(1);
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("the dark palette", () => {
  it("has a pure black page, with cards and raised things one step up each", () => {
    expect(token("page")).toBe("#000");
    expect(luminance(token("card"))).toBeGreaterThan(luminance(token("page")));
    expect(luminance(token("raised"))).toBeGreaterThan(luminance(token("card")));
    expect(screen).toContain("color-scheme:dark");
  });

  const surfaces = ["page", "card", "raised", "mist", "mist-2", "tint"];
  const words = ["ink", "ink-2", "ink-3", "link", "rose", "amber", "green", "ok", "unknown", "off"];
  for (const word of words) {
    it(`--${word} reads at AA on every dark surface`, () => {
      for (const surface of surfaces) expect(contrast(token(word), token(surface)), surface).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("keeps each status word readable on its own tint", () => {
    for (const [word, tint] of [["rose", "rose-tint"], ["amber", "amber-tint"], ["green", "green-tint"], ["ok", "ok-tint"]]) {
      expect(contrast(token(word), token(tint)), word).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("puts white on solid and its hover at AA, and a control's edge at 3:1", () => {
    expect(contrast(token("on-solid"), token("solid"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("on-solid"), token("solid-hover"))).toBeGreaterThanOrEqual(4.5);
    for (const surface of surfaces) expect(contrast(token("line-3"), token(surface)), surface).toBeGreaterThanOrEqual(3);
  });

  it("has no white stop left in a field or a tile", () => {
    const rules = fields.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(rules).not.toMatch(/#fff(?![0-9a-f])|#ffffff(?![0-9a-f])|\bwhite\b/i);
  });

  it("gives the print and paper scopes black ink on white", () => {
    const paper = tokens.slice(tokens.indexOf(".paper{"));
    const print = tokens.slice(tokens.indexOf("@media print{"));
    for (const scope of [paper, print]) {
      expect(scope).toContain("--ink:#000");
      expect(scope).toContain("--white:#fff");
      expect(scope).toContain("--page:#fff");
    }
  });
});
