import { renderToStaticMarkup as html } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ALL_NODES, SCREENS } from "@/desk/registry";
import { EDGES, NODES, STATIONS, STORY, VIEWBOX, edgePath, elbow, heroPoints, labelAt, nodeBox, nodeById, rounded, type EdgeId, type MapEdge, type MapNode, type Point } from "@/map/data";
import { MapCanvas } from "@/map/MapCanvas";
import { MapSheet } from "@/map/MapSheet";

const inside = (p: Point, n: MapNode, margin = 0) => {
  const b = nodeBox(n, "wide");
  return Math.abs(p[0] - b.x) < b.w / 2 - margin && Math.abs(p[1] - b.y) < b.h / 2 - margin;
};

describe("map data", () => {
  it("has eleven nodes and sixteen wires", () => {
    expect(NODES.length).toBe(11);
    expect(EDGES.length).toBe(16);
    expect(NODES.map((n) => n.id).sort()).toEqual([...ALL_NODES].sort());
    expect(new Set(EDGES.map((e) => e.id)).size).toBe(16);
  });
  it("marks the live nodes as in the source", () => {
    expect(NODES.filter((n) => n.live).map((n) => n.id).sort()).toEqual(["database", "inbox", "mail", "payments"]);
  });
  it("dashes the one presigned wire and marks hourly and nightly as slow", () => {
    expect(EDGES.filter((e) => e.dashed).map((e) => e.id)).toEqual(["pR2"]);
    expect(EDGES.filter((e) => e.slow).map((e) => e.id).sort()).toEqual(["clMb", "clSb", "ghR2", "ghSb"]);
  });
  it("marks the switched-off wires, none of them dashed", () => {
    expect(EDGES.filter((e) => e.state === "off").map((e) => e.id).sort()).toEqual(["ghR2", "ghSb"]);
    expect(EDGES.filter((e) => e.state && e.dashed)).toEqual([]);
    expect(html(<MapCanvas mode="wide" />).match(/data-state="/g)?.length).toBe(2);
  });
  it("has labels in both languages on every wire and node", () => {
    for (const e of EDGES) {
      expect(e.linesEn.join(" ").length, e.id).toBeGreaterThan(0);
      expect(e.linesDe.join(" ").length, e.id).toBeGreaterThan(0);
    }
    for (const n of NODES) {
      expect(n.second.length && n.secondDe.length && n.roleEn.length && n.roleDe.length, n.id).toBeGreaterThan(0);
    }
  });
  it("keeps boxes on the canvas and apart", () => {
    for (const a of NODES) {
      const box = nodeBox(a, "wide");
      expect(box.x - box.w / 2, a.id).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w / 2, a.id).toBeLessThanOrEqual(1440);
      for (const b of NODES) {
        if (a === b) continue;
        const other = nodeBox(b, "wide");
        const apart = Math.abs(box.x - other.x) >= (box.w + other.w) / 2 || Math.abs(box.y - other.y) >= (box.h + other.h) / 2;
        expect(apart, `${a.id} ${b.id}`).toBe(true);
      }
    }
  });
  it("starts and ends each wire at its own boxes, with the arrow outside", () => {
    for (const e of EDGES) {
      const last = e.pts[e.pts.length - 1];
      expect(inside(last, nodeById(e.to), 1), `${e.id} end`).toBe(false);
      const to = nodeBox(nodeById(e.to), "wide");
      expect(Math.abs(last[0] - to.x) <= to.w / 2 + 12 && Math.abs(last[1] - to.y) <= to.h / 2 + 12, `${e.id} reaches its target`).toBe(true);
      const from = nodeBox(nodeById(e.from), "wide");
      const first = e.pts[0];
      expect(Math.abs(first[0] - from.x) <= from.w / 2 + 12 && Math.abs(first[1] - from.y) <= from.h / 2 + 12, `${e.id} leaves its source`).toBe(true);
    }
  });
  it("gives the desk and the public pages each their own drawing", () => {
    expect(nodeBox(nodeById("inbox"), "wide").y).toBe(392);
    expect(nodeBox(nodeById("inbox"), "hero").y).toBe(222);
    expect(VIEWBOX.wide).toBe("0 340 1440 500");
    expect(edgePath(EDGES.find((e) => e.id === "clMb")!, "hero")).toBe("M1264 196 L1264 118");
  });
  it("draws both geometries", () => {
    for (const e of EDGES) {
      expect(edgePath(e, "wide")).toMatch(/^M/);
      expect(edgePath(e, "hero")).toMatch(/^M/);
      expect(edgePath(e, "phone")).toMatch(/^M/);
    }
  });
  it("keeps elbow and rounded as ported", () => {
    expect(elbow([0, 0], [10, 100])).toEqual([[0, 0], [0, 45], [10, 55], [10, 100]]);
    expect(rounded([[0, 0], [100, 0]])).toBe("M0 0 L100 0");
    expect(rounded([[0, 0], [100, 0], [100, 100]], 10)).toBe("M0 0 L90.0 0.0 Q100 0 100.0 10.0 L100 100");
  });
  it("follows the story route and stations", () => {
    expect(STORY.map((s) => s.edge)).toEqual(["cDns", "dnsV", "vSt", "cSt", "stV", "vSb", "vRs", "rsC"]);
    expect(STATIONS.map((s) => s.en)).toEqual(["Tap", "Payment", "Box", "Parcel", "Books", "Receipt"]);
    expect(STORY.map((s) => s.en).join(" ")).toContain("simulated");
    expect(STORY.map((s) => s.en).join(" ")).toContain("rendered, not sent");
  });
  it("links nodes to real routes", () => {
    const routes = new Set(SCREENS.map((s) => s.route));
    for (const n of NODES) {
      if (n.screen && !n.screen.startsWith("/shop/")) expect(routes.has(n.screen), n.id).toBe(true);
    }
    expect(nodeById("dns").screen).toBe(null);
  });
});

describe("the hero drawing", () => {
  type Rect = { left: number; right: number; top: number; bottom: number };
  /** The narrowest the drawing gets: .877 px a unit, a 1280 window with a 17 px scrollbar. */
  const PX = 0.877;
  /** The widest each label's text gets, as the browser draws it at that scale's 13.7 unit text. The plate is this plus 10 a side. */
  const TEXT: Record<"en" | "de", Record<EdgeId, number>> = {
    en: { cDns: 74.5, pDns: 108.3, dnsV: 115.3, vSb: 71, vR2: 97.8, pR2: 133.4, vSt: 111.7, cSt: 157.1, stV: 59.7, vRs: 56.2, rsC: 100.7, ghV: 155.6, ghSb: 146.1, ghR2: 112.6, clMb: 96.8, clSb: 85.2 },
    de: { cDns: 80.1, pDns: 108.5, dnsV: 108, vSb: 71.7, vR2: 113.9, pR2: 143.4, vSt: 115.7, cSt: 193.4, stV: 61.7, vRs: 60.5, rsC: 108.3, ghV: 208.2, ghSb: 156.6, ghR2: 72.5, clMb: 100.2, clSb: 120.1 },
  };
  const units = (px: number) => px / PX;
  const boxRect = (n: MapNode): Rect => {
    const b = nodeBox(n, "hero");
    return { left: b.x - b.w / 2, right: b.x + b.w / 2, top: b.y - b.h / 2, bottom: b.y + b.h / 2 };
  };
  const labelRect = (e: MapEdge, lang: "en" | "de"): Rect => {
    const at = labelAt(e, "hero");
    const w = TEXT[lang][e.id] + 20;
    const h = (lang === "de" ? e.linesDe : e.linesEn).length * 15 + 5;
    return { left: at[0] - w / 2, right: at[0] + w / 2, top: at[1] - h / 2, bottom: at[1] + h / 2 };
  };
  const gap = (a: Rect, b: Rect) => Math.max(a.left - b.right, b.left - a.right, a.top - b.bottom, b.top - a.bottom);
  const runs = (id: EdgeId): [Point, Point][] => {
    const pts = heroPoints(id);
    return pts.slice(1).map((p, i) => [pts[i], p]);
  };
  const runTouches = ([a, b]: [Point, Point], r: Rect) => Math.min(a[0], b[0]) <= r.right && Math.max(a[0], b[0]) >= r.left && Math.min(a[1], b[1]) <= r.bottom && Math.max(a[1], b[1]) >= r.top;

  it("stays on its canvas with at least 32 px between any two boxes", () => {
    const [, , width, height] = VIEWBOX.hero.split(" ").map(Number);
    NODES.forEach((a, i) => {
      const r = boxRect(a);
      expect(r.left, a.id).toBeGreaterThanOrEqual(56);
      expect(r.right, a.id).toBeLessThanOrEqual(width - 56);
      expect(r.bottom, a.id).toBeLessThanOrEqual(height);
      for (const b of NODES.slice(i + 1)) expect(gap(r, boxRect(b)), `${a.id} ${b.id}`).toBeGreaterThanOrEqual(units(32));
    });
  });
  it("runs every wire in straight, upright runs from one of its boxes to the other", () => {
    for (const e of EDGES) {
      for (const [a, b] of runs(e.id)) expect(a[0] === b[0] || a[1] === b[1], e.id).toBe(true);
      const pts = heroPoints(e.id);
      const onEdge = (p: Point, r: Rect) => (p[0] >= r.left && p[0] <= r.right && (p[1] === r.top || p[1] === r.bottom)) || (p[1] >= r.top && p[1] <= r.bottom && (p[0] === r.left || p[0] === r.right));
      expect(onEdge(pts[0], boxRect(nodeById(e.from))), `${e.id} leaves its source`).toBe(true);
      expect(onEdge(pts[pts.length - 1], boxRect(nodeById(e.to))), `${e.id} reaches its target`).toBe(true);
    }
  });
  it("runs no wire through a box", () => {
    for (const e of EDGES) {
      for (const n of NODES) {
        const r = boxRect(n);
        const inside = { left: r.left + 1, right: r.right - 1, top: r.top + 1, bottom: r.bottom - 1 };
        for (const run of runs(e.id)) expect(runTouches(run, inside), `${e.id} through ${n.id}`).toBe(false);
      }
    }
  });
  it("crosses wires once in all", () => {
    const crossings: string[] = [];
    EDGES.forEach((a, i) => {
      for (const b of EDGES.slice(i + 1)) {
        for (const [p, q] of runs(a.id)) {
          for (const [s, t] of runs(b.id)) {
            const pv = p[0] === q[0];
            const sv = s[0] === t[0];
            if (pv === sv) continue;
            const [v0, v1, h0, h1] = pv ? [p, q, s, t] : [s, t, p, q];
            const x = v0[0];
            const y = h0[1];
            if (x > Math.min(h0[0], h1[0]) && x < Math.max(h0[0], h1[0]) && y > Math.min(v0[1], v1[1]) && y < Math.max(v0[1], v1[1])) crossings.push(`${a.id}/${b.id}`);
          }
        }
      }
    });
    expect(crossings).toEqual(["vR2/ghSb"]);
  });
  for (const lang of ["en", "de"] as const) {
    it(`gives each box's labels room in ${lang}: 12 px to any box or label, on no other wire`, () => {
      for (const n of NODES) {
        const shown = EDGES.filter((e) => e.from === n.id || e.to === n.id);
        expect(shown.length, n.id).toBeGreaterThan(0);
        shown.forEach((e, i) => {
          const r = labelRect(e, lang);
          for (const m of NODES) expect(gap(r, boxRect(m)), `${n.id}: ${e.id} by ${m.id}`).toBeGreaterThanOrEqual(units(12));
          for (const o of shown.slice(i + 1)) expect(gap(r, labelRect(o, lang)), `${n.id}: ${e.id} by ${o.id}`).toBeGreaterThanOrEqual(units(12));
          for (const other of EDGES.filter((x) => x !== e)) {
            for (const run of runs(other.id)) expect(runTouches(run, r), `${e.id} on ${other.id}`).toBe(false);
          }
        });
      }
    });
  }
  it("sits each label on its own wire", () => {
    for (const e of EDGES) {
      const at = labelAt(e, "hero");
      expect(runs(e.id).some((run) => runTouches(run, { left: at[0], right: at[0], top: at[1], bottom: at[1] })), e.id).toBe(true);
    }
  });
});

describe("MapCanvas", () => {
  it("shows no label at rest with hover labels on, and offers every wire to pointer and keyboard", () => {
    const out = html(<MapCanvas mode="hero" hoverLabels onNode={() => {}} />);
    expect(out).toContain("data-hover-labels");
    expect(out.match(/data-label="/g)?.length).toBe(16);
    expect(out.match(/data-on/g)).toBe(null);
    expect(out.match(/data-fade/g)).toBe(null);
    expect(out.match(/data-hit="/g)?.length).toBe(16);
    expect(out.match(/<path[^>]*data-hit="[^"]+"[^>]*tabindex="0"/g)?.length).toBe(16);
    expect(out).toContain('aria-label="DNS to App host: points the domain at the app"');
    expect(out).toMatch(/data-layer="labels" aria-hidden="true"/);
  });
  it("keeps hover labels off the maps that do not ask for them", () => {
    for (const out of [html(<MapCanvas mode="wide" />), html(<MapCanvas mode="phone" hoverLabels />)]) {
      expect(out).not.toContain("data-hover-labels");
      expect(out).not.toContain("data-hit=");
    }
  });
  it("draws sixteen wires with labels on the wide map", () => {
    const out = html(<MapCanvas mode="wide" />);
    expect(out.match(/data-edge="/g)?.length).toBe(16);
    expect(out.match(/data-node="/g)?.length).toBe(11);
    expect(out.match(/data-label="/g)?.length).toBe(16);
    expect(out).toContain('viewBox="0 340 1440 500"');
    expect(out).toContain("Supabase, 64 tables");
    expect(out).toContain("marker-end");
  });
  it("has no wire labels or second lines on service boxes on the phone map", () => {
    const out = html(<MapCanvas mode="phone" />);
    expect(out.match(/data-label="/g)).toBe(null);
    expect(out).toContain('viewBox="0 0 390 490"');
    expect(out).not.toContain("Supabase, 64 tables");
    expect(out).not.toContain("marker-end");
  });
  it("is static and plain unless asked", () => {
    const out = html(<MapCanvas mode="wide" />);
    expect(out).not.toContain('role="button"');
    expect(out).not.toContain("data-dim");
  });
  it("makes nodes keyboard buttons when they do something", () => {
    const out = html(<MapCanvas mode="wide" onNode={() => {}} />);
    expect(out.match(/role="button"/g)?.length).toBe(11);
    expect(out).toContain('tabindex="0"');
    expect(out).toContain('aria-label="Payments: Stripe, hosted checkout"');
  });
  it("dims what is not lit", () => {
    const out = html(<MapCanvas mode="wide" lit={["app", "database"]} />);
    expect(out.match(/data-node="(?:app|database)"[^>]*data-dim/g)).toBe(null);
    expect(out).toMatch(/data-node="dns"[^>]*data-dim/);
    expect(out).toMatch(/data-edge="vSb"(?![^>]*data-dim)/);
    expect(out).toMatch(/data-edge="cDns"[^>]*data-dim/);
  });
  it("gives each instance its own arrow id", () => {
    const out = html(
      <>
        <MapCanvas mode="wide" />
        <MapCanvas mode="wide" />
      </>,
    );
    const ids = [...out.matchAll(/<marker id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(2);
  });
  it("leaves a packet layer between wires and nodes", () => {
    const out = html(<MapCanvas mode="wide" packets={<circle data-test-packet="" r="3" />} />);
    expect(out.indexOf('data-layer="wires"')).toBeLessThan(out.indexOf("data-test-packet"));
    expect(out.indexOf("data-test-packet")).toBeLessThan(out.indexOf('data-layer="nodes"'));
  });
});

describe("MapSheet", () => {
  it("renders nothing visible without a node", () => {
    expect(html(<MapSheet node={null} onClose={() => {}} />)).not.toContain("ui-mapsheet");
  });
  it("shows role, provider, state, connections, screens and a jump link", () => {
    const out = html(<MapSheet node="payments" onClose={() => {}} />);
    expect(out).toContain("Test mode only");
    expect(out).toContain("Stripe");
    expect(out).toContain("reads this one live");
    expect(out).toContain("creates the checkout session");
    expect(out).toContain("Orders");
    expect(out).toMatch(/href="\/desk\/system\/payments\/?"/);
  });
  it("says off for the rest and has no link where no screen exists", () => {
    const out = html(<MapSheet node="dns" onClose={() => {}} />);
    expect(out).toContain("Not connected to the dashboard");
    expect(out).toContain("Cloudflare");
    expect(out).not.toContain("ui-btn-outline");
  });
  it("shows no tone word without a live status, as on the landing and /built/", () => {
    for (const node of ["mail", "database", "dns"] as const) {
      const out = html(<MapSheet node={node} onClose={() => {}} />);
      expect(out, node).toContain("ui-mapsheet");
      expect(out, node).not.toContain("ui-status");
    }
  });
  it("prints the live tone and word it is handed", () => {
    const out = html(<MapSheet node="mail" live={{ tone: "warn", label: "Warning" }} onClose={() => {}} />);
    expect(out).toContain('data-tone="warn"');
    expect(out).toContain("<span>Warning</span>");
    expect(out).not.toContain('data-tone="ok"');
  });
  it("gives people no status even when handed one", () => {
    expect(html(<MapSheet node="customers" live={{ tone: "off", label: "Off" }} onClose={() => {}} />)).not.toContain("ui-status");
  });
  it("sends people to the shop and the profile choice", () => {
    expect(html(<MapSheet node="customers" onClose={() => {}} />)).toMatch(/href="\/shop\/?"/);
    expect(html(<MapSheet node="staff" onClose={() => {}} />)).toMatch(/href="\/desk\/enter\/?"/);
  });
});
