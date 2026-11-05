import { renderToStaticMarkup as html } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Garment, GlyphCluster } from "@/garments/Garment";
import { common } from "@/i18n/dict/common";
import { Button } from "@/ui/Button";
import { Bars, BarList, Delta, Spark } from "@/ui/charts";
import { Dialog } from "@/ui/Dialog";
import { Input, parseMoney } from "@/ui/Field";
import { Money } from "@/ui/Money";
import { OrderStatus } from "@/ui/OrderStatus";
import { Pager } from "@/ui/Pager";
import { Segmented } from "@/ui/Segmented";
import { Sheet } from "@/ui/Sheet";
import { Status } from "@/ui/Status";
import { Stops, EXIT_STOPS, FLOW_STOPS } from "@/ui/Stops";
import { Table } from "@/ui/Table";
import { Tabs } from "@/ui/Tabs";
import { Thread } from "@/ui/Thread";
import { Tl } from "@/ui/Tl";
import { Track } from "@/ui/Track";
import { DemoPill } from "@/ui/DemoPill";
import type { GarmentTone, GarmentType, Tone } from "@/store/types";

const TYPES: GarmentType[] = ["hoodie", "zip", "tee", "pants", "cargo", "cap", "beanie", "tote"];
const TONES: GarmentTone[] = ["ice", "sky", "azure", "dusk", "lilac"];

describe("Garment", () => {
  it("draws every type, tone and view", () => {
    for (const type of TYPES) {
      for (const tone of TONES) {
        for (const view of ["full", "crop-cuff", "crop-hood", "mini"] as const) {
          const out = html(<Garment type={type} tone={tone} view={view} />);
          expect(out, `${type} ${tone} ${view}`).toContain("<path");
          expect(out).toContain(`data-garment="${type}"`);
        }
      }
    }
  });
  it("keeps gradient ids per instance", () => {
    const out = html(
      <>
        <Garment type="tee" tone="ice" />
        <Garment type="tee" tone="dusk" />
      </>,
    );
    const ids = [...out.matchAll(/<linearGradient id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("drops shading on mini and keeps a readable outline", () => {
    const mini = html(<Garment type="hoodie" tone="ice" view="mini" />);
    expect(mini).not.toContain("<pattern");
    expect(mini).not.toContain("radialGradient");
    expect(mini).toContain('stroke="#b9f3ff"');
  });
  it("uses the blue rib overlay on pale tones and white on the rest", () => {
    expect(html(<Garment type="beanie" tone="ice" />)).toMatch(/fill="#2f6bff" opacity="0.14"/);
    expect(html(<Garment type="beanie" tone="lilac" />)).toMatch(/fill="#2f6bff" opacity="0.14"/);
    expect(html(<Garment type="beanie" tone="dusk" />)).toMatch(/fill="#fff" opacity="0.55"/);
  });
  it("draws the hood opening flat at .42", () => {
    expect(html(<Garment type="hoodie" tone="sky" />)).toMatch(/d="M156 94[^"]*" fill="#1b3fc4" opacity=".42"/);
  });
  it("prints in navy on a pale tone and in white on a deep one", () => {
    expect(html(<Garment type="tee" tone="ice" printed />)).toMatch(/<text[^>]*fill="#0a1a52"/);
    expect(html(<Garment type="tee" tone="dusk" printed />)).toMatch(/<text[^>]*fill="#fff"/);
  });
  it("prints the label name on tote and printed tee, nowhere else", () => {
    expect(html(<Garment type="tote" tone="ice" />)).toContain("Aerloom");
    expect(html(<Garment type="tee" tone="ice" printed />)).toContain("Aerloom");
    expect(html(<Garment type="tee" tone="dusk" />)).not.toContain("Aerloom");
    for (const type of ["hoodie", "zip", "pants", "cargo", "cap", "beanie"] as const) expect(html(<Garment type={type} tone="ice" />), type).not.toContain("<text");
    expect(html(<Garment type="tote" tone="ice" view="mini" />)).not.toContain("<text");
  });
  it("names itself only when given a title", () => {
    expect(html(<Garment type="cap" tone="sky" title="A cap" />)).toContain('aria-label="A cap"');
    expect(html(<Garment type="cap" tone="sky" />)).toContain('aria-hidden="true"');
  });
  it("clusters at most three minis", () => {
    const items = TYPES.slice(0, 5).map((type) => ({ type, tone: "sky" as const }));
    const out = html(<GlyphCluster items={items} />);
    expect(out.match(/data-garment=/g)?.length).toBe(3);
    expect(out).toContain("+2");
  });
});

describe("primitives", () => {
  it("Status always has an icon and the word", () => {
    for (const tone of ["ok", "warn", "bad", "unknown", "off"] as Tone[]) {
      const out = html(<Status tone={tone}>Word</Status>);
      expect(out).toContain("<svg");
      expect(out).toContain("Word");
      expect(out).toContain(`data-tone="${tone}"`);
    }
  });
  it("OrderStatus has a default label from common", () => {
    expect(html(<OrderStatus status="refunded" />)).toContain("Refunded");
    expect(html(<OrderStatus status="paid" label="X" />)).toContain("X");
  });
  it("Button keeps its label while busy and disables itself", () => {
    const out = html(<Button busy>Save</Button>);
    expect(out).toContain("Save");
    expect(out).toContain("disabled");
    expect(out).toContain('aria-busy="true"');
  });
  it("Field wires label, error and description", () => {
    const out = html(<Input label="Email" id="e" error="Wrong" hint="Hint" />);
    expect(out).toContain('for="e"');
    expect(out).toContain('aria-invalid="true"');
    expect(out).toContain('aria-describedby="e-hint e-error"');
    expect(out).toContain('role="alert"');
  });
  it("parseMoney reads the forms people type", () => {
    expect(parseMoney("1284.00")).toBe(128400);
    expect(parseMoney("1'284.5")).toBe(128450);
    expect(parseMoney("12,30")).toBe(1230);
    expect(parseMoney("29.905")).toBe(null);
    expect(parseMoney("abc")).toBe(null);
    expect(parseMoney("")).toBe(null);
    expect(parseMoney("-5")).toBe(-500);
  });
  it("Segmented marks the pressed and disabled cells", () => {
    const out = html(<Segmented aria-label="Size" value="M" onChange={() => {}} options={[{ value: "S", label: "S", disabled: true }, { value: "M", label: "M" }]} />);
    expect(out).toContain('aria-pressed="true"');
    expect(out).toContain("disabled");
  });
  it("Tabs links, marks the current one and shows the lock", () => {
    const out = html(<Tabs aria-label="Screens" active="a" items={[{ id: "a", label: "A", href: "/a/" }, { id: "b", label: "B", href: "/b/", locked: true, title: "Locked" }]} />);
    expect(out).toContain('aria-current="page"');
    expect(out).toContain("data-locked");
    expect(out).toContain('title="Locked"');
  });
  it("Stops has both groups, in order, with counts", () => {
    expect(FLOW_STOPS).toEqual(["pending", "paid", "packed", "shipped", "delivered"]);
    expect(EXIT_STOPS).toEqual(["cancelled", "refunded", "attention"]);
    const out = html(<Stops active="paid" counts={{ paid: 14 }} onChange={() => {}} />);
    expect(out.match(/data-stop=/g)?.length).toBe(8);
    expect(out).toContain(">14<");
    expect(out).toContain("Needs attention");
  });
  it("Track fills up to the status and says the exits in words", () => {
    const on = (s: Parameters<typeof Track>[0]["status"]) => html(<Track status={s} />).match(/data-on/g)?.length ?? 0;
    expect(on("pending")).toBe(1);
    expect(on("packed")).toBe(3);
    expect(on("delivered")).toBe(5);
    expect(on("cancelled")).toBe(0);
    expect(html(<Track status="cancelled" />)).toContain("Cancelled");
    const attention = html(<Track status="paid" attention />);
    expect(attention).toContain("Needs attention");
    expect(attention).toContain("<svg");
  });
  it("Thread prints six stops and an empty mark", () => {
    const stops = (["placed", "paid", "packed", "shipped", "delivered", "books"] as const).map((key, i) => ({ key, label: key, at: i < 2 ? "08.01" : null, done: i < 2 }));
    const out = html(<Thread stops={stops} />);
    expect(out.match(/ui-thread-stop/g)?.length).toBe(6);
    expect(out.match(/data-done/g)?.length).toBe(2);
    expect(out).toContain("–");
  });
  it("Tl joins date, actor and detail and names the service", () => {
    const out = html(<Tl label="Paid" date="08.01" actor="Mara" detail="Card" service="payments" />);
    expect(out).toContain("08.01 · Mara");
    expect(out).toContain("Card");
    expect(out).toContain("Payments");
  });
  it("Money signs and warns below zero", () => {
    expect(html(<Money value={128400} />)).toContain("CHF 1&#x27;284.00");
    expect(html(<Money value={500} signed />)).toContain('data-signed="up"');
    expect(html(<Money value={500} signed />)).toContain("+");
    expect(html(<Money value={-500} signed />)).toContain("−");
    const low = html(<Money value={-500} balance />);
    expect(low).toContain("below zero");
    expect(low).toContain("<svg");
    expect(html(<Money value={2000} currency="USD" />)).toContain("USD 20.00");
  });
  it("Pager disables the ends", () => {
    const out = html(<Pager page={1} pages={3} onPage={() => {}} />);
    expect(out).toContain("Page 1 of 3");
    expect(out.match(/disabled/g)?.length).toBe(1);
  });
  it("Table renders the table and the phone cards", () => {
    const rows = [{ id: "a", name: "Ann" }];
    const out = html(<Table rows={rows} rowKey={(r) => r.id} columns={[{ key: "n", header: "Name", cell: (r) => r.name, phone: true }, { key: "x", header: "Sum", align: "right", cell: () => "5" }]} phoneRow={(r) => <b>{r.name}!</b>} selectedKey="a" />);
    expect(out).toContain("<table");
    expect(out).toContain("<ul");
    expect(out).toContain("Ann!");
    expect(out).toContain('data-align="right"');
    expect(out).toContain("data-selected");
    const fallback = html(<Table rows={rows} rowKey={(r) => r.id} columns={[{ key: "n", header: "Name", cell: (r) => `${r.name}?`, phone: true }]} />);
    expect(fallback).toContain("ui-table-card-top");
    expect(fallback.match(/Ann\?/g)?.length).toBe(2);
    expect(html(<Table rows={[] as typeof rows} rowKey={(r) => r.id} columns={[]} empty={<p>None</p>} />)).toBe("<p>None</p>");
  });
  it("Sheet and Dialog stay native dialogs and empty until open", () => {
    const closed = html(<Sheet open={false} onClose={() => {}} title="T" wide><p>Body</p></Sheet>);
    expect(closed).toContain("<dialog");
    expect(closed).toContain("data-wide");
    expect(closed).not.toContain("Body");
    expect(html(<Sheet open onClose={() => {}} title="T"><p>Body</p></Sheet>)).toContain("Body");
    expect(html(<Dialog open onClose={() => {}} title="T" onConfirm={() => {}} danger confirmLabel="Go" />)).toContain("ui-btn-danger");
    expect(html(<Dialog open={false} onClose={() => {}} title="T" />)).not.toContain("T<");
  });
  it("DemoPill carries the tooltip", () => {
    const out = html(<DemoPill />);
    expect(out).toContain("Demo: fake data");
    expect(out).toContain("Nothing is charged, emailed or shipped.");
    expect(html(<DemoPill compact />)).toContain(">Demo<");
  });
});

describe("charts", () => {
  const data = [{ key: "a", label: "Mon", value: 10 }, { key: "b", label: "Tue", value: 30, active: true }, { key: "c", label: "Wed", value: 0 }];
  it("Bars has an sr-only table and labels the largest", () => {
    const out = html(<Bars data={data} caption="Revenue" formatValue={(v) => `v${v}`} />);
    expect(out).toContain('<div class="sr-only"><table>');
    expect(out).toContain("<caption>Revenue</caption>");
    expect(out).toContain(">v30</text>");
    expect(out).not.toContain(">v10</text>");
    expect(out).toContain('fill="var(--ice)"');
  });
  it("Bars survives no data", () => {
    expect(html(<Bars data={[]} caption="None" />)).toContain("None");
  });
  it("BarList and Spark carry tables", () => {
    expect(html(<BarList data={[{ key: "a", label: "A", value: 3, display: "CHF 3" }]} caption="List" />)).toContain("<caption>List</caption>");
    const spark = html(<Spark values={[1, 4, 2]} caption="Trend" />);
    expect(spark).toContain("<polyline");
    expect(spark).toContain('viewBox="0 0 56 22"');
    expect(spark).toContain("<caption>Trend</caption>");
    expect(html(<Spark values={[5]} caption="One" />)).toContain("<polyline");
  });
  it("Delta reads direction, neutral and the rising word", () => {
    expect(html(<Delta percent={12} />)).toContain('data-tone="up"');
    expect(html(<Delta percent={-12} />)).toContain("−12%");
    expect(html(<Delta percent={12} neutral />)).toContain('data-tone="neutral"');
    const bad = html(<Delta percent={12} invert />);
    expect(bad).toContain('data-tone="bad"');
    expect(bad).toContain("rising");
    expect(html(<Delta percent={null} />)).toContain("no earlier figure");
  });
});

describe("common dictionary", () => {
  const shape = (o: unknown): unknown => (typeof o === "object" && o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, shape(v)])) : "s");
  it("has the same keys in both languages", () => {
    expect(shape(common.de)).toEqual(shape(common.en));
  });
  it("carries the exact demo strings", () => {
    expect(common.en.demoToast).toBe("Demo: resets when you reload");
    expect(common.de.demoToast).toBe("Demo: wird beim Neuladen zurückgesetzt");
    expect(common.en.demoPill).toBe("Demo: fake data");
    expect(common.de.demoPill).toBe("Demo: Fake-Daten");
    expect(common.en.belowZero).toBe("below zero");
    expect(common.de.belowZero).toBe("unter null");
  });
});
