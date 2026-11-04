import { readFileSync } from "node:fs";
import { renderToStaticMarkup as html } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { AMBIENT, COMMERCE_PREVIEW_LABELS, CP_CSS, CommercePreview, DOT_AT, FAULT_STILL_T, FAULT_T, LOOP_S, STILL_T, WIDE_FROM, frame, partTransform, pillW, type Frame, type Part, type Variant } from "../../preview-banner/CommercePreview";

const source = readFileSync(new URL("../../preview-banner/CommercePreview.tsx", import.meta.url), "utf8");
const demo = readFileSync(new URL("../../preview-banner/demo.html", import.meta.url), "utf8");
const readme = readFileSync(new URL("../../preview-banner/README.md", import.meta.url), "utf8");
const near = (a: number, b: number, eps = 0.02) => Math.abs(a - b) <= eps;
const WORDS = ["paid", "stored", "retry", "sent"];

function shownWords(f: Frame, prefix: string): string[] {
  return WORDS.filter((w) => f[`${prefix}w.${w}`].o > 0.9);
}
function sig(f: Frame): string {
  return Object.keys(f)
    .sort()
    .map((k) => `${k}:${f[k].o.toFixed(4)}:${partTransform(f[k])}`)
    .join(";");
}
const changed = (a: Part, b: Part) => Math.abs(a.o - b.o) > 0.01 || Math.abs(a.x - b.x) > 0.1 || Math.abs(a.y - b.y) > 0.1 || Math.abs(a.s - b.s) > 0.002 || Math.abs(a.r - b.r) > 0.1;
/** How many parts, other than the always-moving decoration, move between t and t + .05. */
function moving(t: number, variant: Variant): number {
  const a = frame(t, variant);
  const b = frame(t + 0.05, variant);
  return Object.keys(a).filter((k) => !AMBIENT.includes(k) && changed(a[k], b[k])).length;
}

describe("the loop", () => {
  for (const variant of ["wide", "compact"] as Variant[]) {
    it(`${variant}: frame at 12 is frame at 0, and the loop wraps`, () => {
      expect(LOOP_S).toBe(12);
      expect(sig(frame(12, variant))).toBe(sig(frame(0, variant)));
      expect(sig(frame(12.5, variant))).toBe(sig(frame(0.5, variant)));
      expect(sig(frame(-1, variant))).toBe(sig(frame(11, variant)));
    });

    it(`${variant}: the end of the loop is close to the start, so it never jumps`, () => {
      const a = frame(11.999, variant);
      const b = frame(0, variant);
      for (const k of Object.keys(a)) expect(near(a[k].o, b[k].o, 0.05), k).toBe(true);
    });

    it(`${variant}: moves with the clock, and every part has a real opacity`, () => {
      expect(sig(frame(2, variant))).not.toBe(sig(frame(3.5, variant)));
      for (let t = 0; t < 12; t += 0.25) {
        for (const [k, p] of Object.entries(frame(t, variant))) {
          expect(p.o, `${k} at ${t}`).toBeGreaterThanOrEqual(0);
          expect(p.o, `${k} at ${t}`).toBeLessThanOrEqual(1);
        }
      }
    });

    it(`${variant}: something other than decoration moves, except around the seam`, () => {
      const still: number[] = [];
      for (let i = 0; i < 240; i++) {
        const t = i * 0.05;
        if (moving(t, variant) === 0) still.push(Number(t.toFixed(2)));
      }
      expect(still.filter((t) => t >= 0.2 && t < 11.6)).toEqual([]);
    });
  }

  it("wide: at least four parts move at once when the row lands and when the chart grows", () => {
    const peak = (a: number, b: number) => {
      let top = 0;
      for (let t = a; t < b; t += 0.05) top = Math.max(top, moving(t, "wide"));
      return top;
    };
    expect(peak(6.9, 7.3)).toBeGreaterThanOrEqual(4);
    expect(peak(7.4, 8.1)).toBeGreaterThanOrEqual(4);
  });
});

describe("storyboard, wide", () => {
  const f = (t: number) => frame(t, "wide");
  it("starts with a click on the button, and the hoodie reaches the bag", () => {
    expect(f(0.8)["w.cur"].o).toBeGreaterThan(0.9);
    expect(f(1.05)["w.cta"].s).toBeLessThan(1);
    expect(f(1.5)["w.mini"].o).toBe(1);
    expect(f(1.84)["w.badge"].o).toBe(0);
    expect(f(2.2)["w.badge"].s).toBe(1);
  });
  it("starts each word when the packet arrives, not before", () => {
    expect(shownWords(f(2.5), "w.")).toEqual([]);
    expect(f(2.75)["w.pkt"].x).toBe(427);
    expect(f(2.75)["w.pkt"].y).toBe(112);
    expect(shownWords(f(3), "w.")).toEqual(["paid"]);
    expect(shownWords(f(3.5), "w.")).toEqual([]);
    expect(f(3.65)["w.pkt"].y).toBe(192);
    expect(shownWords(f(4), "w.")).toEqual(["stored"]);
    expect(shownWords(f(5), "w.")).toEqual(["retry"]);
    expect(shownWords(f(6.3), "w.")).toEqual(["sent"]);
    expect(shownWords(f(9.45), "w.")).toEqual([]);
  });
  it("stops the packet at the fault, dims Mail and shows the triangle", () => {
    expect([f(4.4)["w.pkt"].x, f(4.4)["w.pkt"].y]).toEqual([427, 245]);
    expect([f(6)["w.pkt"].x, f(6)["w.pkt"].y]).toEqual([427, 245]);
    expect(f(5)["w.mail"].o).toBeCloseTo(0.55, 5);
    expect(f(5)["w.tri"].o).toBe(1);
    expect(f(6.1)["w.tri"].o).toBe(0);
    expect(f(6.1)["w.mail"].o).toBe(1);
  });
  it("lands the row, rolls the numbers and grows the chart", () => {
    expect(f(6.8)["w.new"].o).toBe(0);
    expect(f(7.3)["w.new"].o).toBe(1);
    expect(f(7.3)["w.new"].x).toBe(0);
    expect(f(7.3)["w.o0"].y).toBe(360);
    expect(f(7.3)["w.o1"].o).toBe(0);
    for (const k of ["w.k0.0", "w.k0.1", "w.k0.2", "w.k1.0", "w.k1.1"]) expect(f(8)[k].y).toBe(-29);
    expect(f(7.3)["w.cover"].x).toBe(0);
    expect(f(8.2)["w.cover"].x).toBe(60);
    expect(f(8.2)["w.dot"].x).toBe(960);
    expect(f(8.2)["w.donut"].r).toBe(24);
    expect(f(8.2)["w.tip"].o).toBe(1);
  });
  it("packs dot by dot, then moves the chip on", () => {
    const dots = (t: number) => DOT_AT.map((_, i) => f(t)[`w.d${i}`].o > 0.9);
    expect(dots(9.45)).toEqual([true, true, true, false, false]);
    expect(dots(9.8)).toEqual([true, true, true, true, true]);
    expect(f(9.45)["w.c.paid"].o).toBe(1);
    expect(f(10.15)["w.c.packed"].o).toBe(1);
    expect(f(10.55)["w.c.shipped"].o).toBe(1);
  });
  it("resets by fading, and the digits never roll back", () => {
    expect(f(11)["w.k0.0"].y).toBe(-29);
    expect(f(11)["w.k0.0b"].o).toBeGreaterThan(0);
    expect(f(11.6)["w.k0.0"].y).toBe(0);
    expect(f(11.6)["w.k0.0b"].o).toBe(0);
    expect(f(11.7)["w.new"].o).toBe(0);
    expect(f(11.7)["w.o0"].y).toBe(330);
    expect(f(11.7)["w.o0"].o).toBe(1);
    expect(f(11.7)["w.o1"].o).toBe(1);
  });
});

describe("storyboard, compact", () => {
  const f = (t: number) => frame(t, "compact");
  it("has its own parts on the same clock", () => {
    expect(Object.keys(f(0)).every((k) => k.startsWith("c."))).toBe(true);
    expect(f(0.5)["c.tap"].o).toBeGreaterThan(0);
    expect(f(2)["c.mini"].o).toBe(1);
    expect(shownWords(f(5), "c.")).toEqual(["retry"]);
    expect(f(5)["c.tri"].o).toBe(1);
    expect([f(5)["c.tri"].x, f(5)["c.tri"].y]).toEqual([174, 205]);
  });
  it("swaps the row number, rolls the numbers and moves the status on", () => {
    expect(f(6.8)["c.n1"].o).toBe(0);
    expect(f(7.3)["c.n1"].o).toBe(1);
    expect(f(8)["c.k0.0"].y).toBe(-31);
    expect(f(8.2)["c.cover"].x).toBe(54);
    expect(f(9.45)["c.s.paid"].o).toBe(1);
    expect(f(10.2)["c.s.packed"].o).toBe(1);
    expect(f(11.7)["c.s.paid"].o).toBe(1);
  });
});

describe("the contract", () => {
  it("imports react and nothing else", () => {
    const imports = [...source.matchAll(/^import[^;]*from\s+"([^"]+)"/gm)].map((m) => m[1]);
    expect(imports).toEqual(["react"]);
    expect(demo).not.toMatch(/<script[^>]+src=/);
    expect(demo).not.toMatch(/<link[^>]+href=/);
  });
  it("swaps the art in CSS at 900 and keeps the reduced-motion stills", () => {
    expect(WIDE_FROM).toBe(900);
    expect(CP_CSS).toContain("@container cp (max-width:899.98px)");
    expect(CP_CSS).toContain(".cp-c{display:block;max-width:520px;margin:auto}");
    expect(STILL_T).toBe(9.45);
    expect(FAULT_T).toBe(4.4);
    expect(FAULT_STILL_T).toBe(5);
  });
  it("writes only transform and opacity per frame, on one rAF", () => {
    const engine = source.slice(source.indexOf("const renderFrame"), source.indexOf("const tick"));
    expect(engine).toContain("node.style.opacity");
    expect(engine).toContain("node.style.transform");
    expect(engine).not.toContain("setAttribute");
    expect(source).toContain("Math.min(now - last, 64)");
    expect(source).toContain("threshold: [0, 0.5]");
  });
  it("stays on the palette, with no network and no image", () => {
    for (const text of [source, demo]) {
      expect(text).not.toMatch(new RegExp("#0{3}\\b"));
      expect(text).not.toMatch(new RegExp(["\\bfet" + "ch\\(", "XMLHttp" + "Request", "<image\\b", "<img\\b", "@font-face"].join("|")));
      expect(text.replaceAll("http://www.w3.org/2000/svg", "")).not.toMatch(/https?:\/\//);
    }
  });
  it("has both languages in Swiss orthography", () => {
    expect(JSON.stringify(COMMERCE_PREVIEW_LABELS)).not.toContain(String.fromCharCode(0xdf));
    expect(COMMERCE_PREVIEW_LABELS.de.fail).toBe("Fehler auslösen");
    expect(COMMERCE_PREVIEW_LABELS.de.illustration).toBe("Vereinfachte Darstellung");
    expect(Object.keys(COMMERCE_PREVIEW_LABELS.de)).toEqual(Object.keys(COMMERCE_PREVIEW_LABELS.en));
  });
  it("never says the mail went out, because the real system renders it", () => {
    expect(COMMERCE_PREVIEW_LABELS.en.sent).toBe("rendered");
    expect(COMMERCE_PREVIEW_LABELS.de.sent).toBe("gerendert");
    const words = html(<CommercePreview lang="en" />).replace(/<[^>]+>/g, " ");
    expect(words).not.toMatch(/\bsent\b/);
    expect(COMMERCE_PREVIEW_LABELS.en.alt).not.toMatch(/\bsent\b/);
    expect(COMMERCE_PREVIEW_LABELS.de.alt).not.toMatch(/Mailversand/);
  });
  it("uses the desk's own words for the screens it draws", () => {
    const { en, de } = COMMERCE_PREVIEW_LABELS;
    expect([de.navCustomers, de.navInbox, de.navSettings, de.statusPacked, de.statusShipped]).toEqual(["Kundschaft", "Posteingang", "Einstellungen", "Gepackt", "Versendet"]);
    expect([en.statusPaid, en.statusPending, en.statusPacked, en.statusShipped]).toEqual(["Paid", "Pending", "Packed", "Shipped"]);
    expect(source).not.toContain("To pack");
  });
  it("renders a real button in HTML, outside the drawings, in the chosen language", () => {
    const out = html(<CommercePreview lang="de" />);
    expect(out.indexOf("</svg></div>")).toBeLessThan(out.indexOf("Fehler auslösen"));
    expect(out).toContain("Vereinfachte Darstellung");
    expect(out).toContain("<button");
    expect(out).toContain('viewBox="0 0 1200 420"');
    expect(out).toContain('viewBox="0 0 480 300"');
    expect(out).toContain('data-t="0"');
  });
  it("draws both products with real numbers from the desk's first load", () => {
    const out = html(<CommercePreview lang="en" />);
    for (const name of ["Online shop", "Staff system", "Essential Hoodie", "CHF 89.00", "Add to bag", "Payments", "Database", "Mail", "Total Revenue", "Recent Orders", "AL-1150", "CHF 158.00", "AL-1149", "CHF 297.00", "AL-1151"]) {
      expect(out, name).toContain(`>${name}</text>`);
    }
    expect(out).not.toContain('opacity="0.25"');
  });
  it("keeps every word at 16 units in the wide art and 24 in the compact", () => {
    const out = html(<CommercePreview lang="en" />);
    const sizes = (s: string) => [...s.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
    const compactAt = out.indexOf('class="cp-c"');
    expect(Math.min(...sizes(out.slice(0, compactAt)))).toBeGreaterThanOrEqual(16);
    expect(Math.min(...sizes(out.slice(compactAt)))).toBeGreaterThanOrEqual(24);
  });
  it("sizes each word's pill from the word", () => {
    expect(pillW("gespeichert", 17)).toBeGreaterThan(pillW("paid", 17));
    expect(pillW("gespeichert", 24)).toBeGreaterThan(pillW("gespeichert", 17));
  });
  it("keeps the cinematic section contract with the code", () => {
    expect(readme).toContain("CinematicSection");
    expect(readme).toContain("CommerceSlot");
    expect(readme).toContain("useLanguage");
  });
});

describe("demo.html stays a copy", () => {
  it("has the same drawings as the component", () => {
    const m = demo.match(/var SVG = `([\s\S]*?)`;/);
    expect(m).toBeTruthy();
    const out = html(<CommercePreview lang="en" />);
    const uid = out.match(/id="([^"]*?)wa1"/)?.[1] ?? "";
    const start = out.indexOf("<svg");
    const fromTsx = out
      .slice(start, out.indexOf("</svg></div>", start) + 6)
      .split(`${uid}w`)
      .join("__ID__w")
      .split(`${uid}c`)
      .join("__ID__c");
    expect(m?.[1]).toBe(fromTsx);
  });
  it("has the same frame function and swap rule as the component", () => {
    const block = (text: string) => text.slice(text.indexOf("/* FRAME-START */"), text.indexOf("/* FRAME-END */"));
    const compiled = ts.transpileModule(block(source), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    const norm = (s: string) =>
      s
        .replace(/export \{\s*\};?/g, "")
        .replace(/^\s*export /gm, "")
        .replace(/\/\*\s*FRAME-(START|END)\s*\*\//g, "")
        .replace(/\s+/g, " ")
        .trim();
    expect(norm(block(demo))).toBe(norm(compiled));
    expect(demo).toContain(CP_CSS);
  });
  it("opens at the width the banner is used at, with a width picker, a scrub slider and a reduced-motion toggle", () => {
    expect(demo).toContain("--w:1214px");
    expect(demo).toContain("--w:263px");
    expect(demo).toContain('<select id="width">');
    for (const w of [1214, 970, 781, 480, 276, 246]) expect(demo).toContain(`<option value="${w}"`);
    expect(demo).toContain('<option value="1214" selected>');
    expect(demo).toContain("max-width:100%");
    expect(demo).toContain('type="range"');
    expect(demo).toContain('id="reduced"');
    expect(demo).toContain("window.previewApi");
  });
});
