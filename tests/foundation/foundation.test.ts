import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { collectionHref, productHref, RUNTIME_PARAM } from "@/lib/routes";
import { formatChf } from "@/lib/format";
import { canAccess } from "@/lib/features";
import { SCREENS, regionScreens, screenForPath, subScreens } from "@/desk/registry";

describe("registry", () => {
  it("has unique ids and routes", () => {
    expect(new Set(SCREENS.map((s) => s.id)).size).toBe(SCREENS.length);
    expect(new Set(SCREENS.map((s) => s.route)).size).toBe(SCREENS.length);
  });
  it("has a page file for every route", () => {
    for (const s of SCREENS) {
      expect(existsSync(path.join("src/app", s.route, "page.tsx")), s.route).toBe(true);
    }
  });
  it("finds the longest matching route", () => {
    expect(screenForPath("/desk/orders/returns/")?.id).toBe("returns");
    expect(screenForPath("/desk/orders")?.id).toBe("orders");
    expect(screenForPath("/desk/")?.id).toBe("dashboard");
  });
  it("keeps second-level screens out of the Tabs row", () => {
    expect(regionScreens("commerce").map((s) => s.id)).not.toContain("returns");
    expect(subScreens("returns").map((s) => s.id)).toEqual(["orders", "returns"]);
  });
});

describe("routes", () => {
  it("sends runtime records through the x param", () => {
    expect(productHref("frost-candle-trio")).toBe("/shop/p/frost-candle-trio/");
    expect(productHref("made-today")).toBe(`/shop/p/${RUNTIME_PARAM}/?slug=made-today`);
    expect(collectionHref("lagoon")).toBe("/shop/c/lagoon/");
    expect(collectionHref("new one")).toBe(`/shop/c/${RUNTIME_PARAM}/?handle=new%20one`);
  });
});

describe("format", () => {
  it("prints CHF with a non-breaking space and a real minus", () => {
    expect(formatChf(128400)).toBe("CHF\u00a01'284.00");
    expect(formatChf(-500)).toBe("\u2212CHF\u00a05.00");
  });
});

describe("features", () => {
  it("applies the tiers", () => {
    expect(canAccess("owner", "superadmin")).toBe(false);
    expect(canAccess("owner", "it")).toBe(true);
    expect(canAccess("warehouse", "finances")).toBe(false);
    expect(canAccess("finance", "finances")).toBe(true);
    expect(canAccess("superUser", "superadmin")).toBe(true);
  });
});
