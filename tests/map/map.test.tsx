import { renderToStaticMarkup as html } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ALL_NODES, SCREENS } from "@/desk/registry";
import { EDGES, NODES, STATIONS, STORY, edgePath, elbow, nodeBox, nodeById, rounded, type MapNode, type Point } from "@/map/data";
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
  it("keeps the landing's side panel clear", () => {
    for (const n of NODES.filter((x) => nodeBox(x, "hero").y < 560)) {
      const box = nodeBox(n, "hero");
      if (box.y + box.h / 2 > 352) expect(box.x + box.w / 2, n.id).toBeLessThanOrEqual(1086);
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
  it("draws the inbox lower on the landing, on its own wires", () => {
    expect(nodeBox(nodeById("inbox"), "wide").y).toBe(392);
    expect(nodeBox(nodeById("inbox"), "hero").y).toBe(640);
    expect(edgePath(EDGES.find((e) => e.id === "clMb")!, "hero")).toBe("M1290 666 L1290 744");
    for (const e of EDGES.filter((x) => x.from !== "inbox")) expect(edgePath(e, "hero")).toBe(edgePath(e, "wide"));
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

describe("MapCanvas", () => {
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
