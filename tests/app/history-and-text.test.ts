import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchJump } from "@/desk/shell/jump-search";
import { seedRows, seedText } from "@/i18n/dict/seed-text";
import { setParams } from "@/lib/routes";
import { getState, resetStore } from "@/store/core";
import { createSeed } from "@/store/seed";

/** A small model of one tab's session history. back() lands later, as in a browser. */
function fakeBrowser(start: string) {
  const entries: { url: string; state: unknown }[] = [{ url: start, state: null }];
  let at = 0;
  const listeners = new Set<() => void>();
  const pending: (() => void)[] = [];
  const history = {
    get state() {
      return entries[at].state;
    },
    pushState(state: unknown, _unused: string, url: URL) {
      entries.splice(at + 1);
      entries.push({ url: String(url), state });
      at += 1;
    },
    replaceState(state: unknown, _unused: string, url: URL) {
      entries[at] = { url: String(url), state };
    },
    back() {
      pending.push(() => step(-1));
    },
  };
  const step = (by: number) => {
    at += by;
    for (const listener of [...listeners]) {
      listener();
      listeners.delete(listener);
    }
  };
  vi.stubGlobal("window", {
    history,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
  });
  vi.stubGlobal("document", {
    get URL() {
      return entries[at].url;
    },
  });
  return {
    get url() {
      return entries[at].url.replace("https://shop.example.com", "");
    },
    get length() {
      return entries.length;
    },
    get at() {
      return at;
    },
    /** What the Back and Forward buttons do. */
    press: (by: number) => step(by),
    land: () => {
      while (pending.length) pending.shift()?.();
    },
  };
}

describe("setParams and session history", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("pushes when a sheet opens, and closing steps back with no second copy of the list", () => {
    const tab = fakeBrowser("https://shop.example.com/desk/products/");
    setParams({ open: "p1" });
    expect(tab.url).toBe("/desk/products/?open=p1");
    expect(tab.length).toBe(2);
    setParams({ open: null });
    tab.land();
    expect(tab.url).toBe("/desk/products/");
    expect(tab.at).toBe(0);
  });

  it("treats the order pane the same way", () => {
    const tab = fakeBrowser("https://shop.example.com/desk/orders/?status=packed");
    setParams({ o: "AL-1" });
    expect(tab.length).toBe(2);
    setParams({ o: null });
    tab.land();
    expect(tab.url).toBe("/desk/orders/?status=packed");
    expect(tab.at).toBe(0);
  });

  it("keeps one entry when one sheet swaps to another, and still closes in one step", () => {
    const tab = fakeBrowser("https://shop.example.com/desk/orders/");
    setParams({ o: "AL-1" });
    setParams({ o: "AL-2" });
    expect(tab.length).toBe(2);
    expect(tab.url).toBe("/desk/orders/?o=AL-2");
    setParams({ o: null });
    tab.land();
    expect(tab.at).toBe(0);
    expect(tab.url).toBe("/desk/orders/");
  });

  it("closes by replacing on a deep link, because no list entry lies behind it", () => {
    const tab = fakeBrowser("https://shop.example.com/desk/products/?open=p1");
    setParams({ open: null });
    tab.land();
    expect(tab.url).toBe("/desk/products/");
    expect(tab.length).toBe(1);
  });

  it("replaces for filters and typed search", () => {
    const tab = fakeBrowser("https://shop.example.com/desk/inventory/");
    setParams({ filter: "low" });
    setParams({ q: "lamp" });
    expect(tab.length).toBe(1);
    expect(tab.url).toBe("/desk/inventory/?filter=low&q=lamp");
  });

  it("closes through replace when the same call also changes a filter", () => {
    const tab = fakeBrowser("https://shop.example.com/desk/orders/");
    setParams({ o: "AL-1" });
    setParams({ status: "packed", o: null });
    tab.land();
    expect(tab.url).toBe("/desk/orders/?status=packed");
    expect(tab.at).toBe(1);
  });

  it("does not step back twice on a double close, and applies a write made while the step is on its way", () => {
    const tab = fakeBrowser("https://shop.example.com/desk/products/");
    setParams({ open: "p1" });
    setParams({ open: null });
    setParams({ open: null });
    setParams({ sort: "price" });
    tab.land();
    expect(tab.at).toBe(0);
    expect(tab.url).toBe("/desk/products/?sort=price");
  });

  it("still knows the way back after Back and Forward", () => {
    const tab = fakeBrowser("https://shop.example.com/desk/products/");
    setParams({ open: "p1" });
    tab.press(-1);
    expect(tab.url).toBe("/desk/products/");
    tab.press(1);
    expect(tab.url).toBe("/desk/products/?open=p1");
    setParams({ open: null });
    tab.land();
    expect(tab.at).toBe(0);
  });

  it("never steps back when nothing is open, even on the address a sheet came from", () => {
    const tab = fakeBrowser("https://shop.example.com/desk/system/email/");
    setParams({ open: "m1" });
    tab.press(-1);
    setParams({ tab: null, open: null });
    tab.land();
    expect(tab.at).toBe(0);
    expect(tab.url).toBe("/desk/system/email/");
  });

  it("compares addresses by meaning, not by spelling", () => {
    const tab = fakeBrowser("https://shop.example.com/desk/products/?q=a%20b");
    setParams({ open: "p1" });
    setParams({ open: null });
    tab.land();
    expect(tab.at).toBe(0);
  });
});

describe("jump box names", () => {
  beforeEach(() => resetStore());

  it("finds the sidebar's Finances in both languages, with the Ledger first", () => {
    for (const query of ["finance", "finances", "Finanzen"]) {
      const screens = searchJump(getState(), query, "en").find((s) => s.group === "screens");
      expect(screens?.items[0]?.href).toBe("/desk/finance/");
    }
  });

  it("puts the IT row before screens that only match through a group word", () => {
    const screens = searchJump(getState(), "it", "de").find((s) => s.group === "screens");
    expect(screens?.items[0]?.href).toBe("/desk/system/");
  });
});

describe("German wording of the invented rows", () => {
  const names = /^(Studio|Bank|Stripe|Domain · .+)$/;

  it("covers every seeded task, list, event and ledger row", () => {
    const seed = createSeed();
    const texts = [
      ...seed.tasks.flatMap((t) => [t.title, t.notes]),
      ...seed.taskLists.map((l) => l.name),
      ...seed.calendarEvents.flatMap((e) => [e.title, e.notes]),
      ...seed.ledger.flatMap((e) => [e.title, e.description]),
      ...seed.accounts.map((a) => a.name),
    ].filter((text) => text !== "" && !names.test(text));
    const missed = [...new Set(texts)].filter((text) => seedText(text, "de") === text);
    expect(missed).toEqual([]);
  });

  it("is Swiss German and leaves typed text and English alone", () => {
    const seed = createSeed();
    const german = seed.tasks.map((t) => seedText(t.title, "de")).join(" ");
    expect(german).not.toContain(String.fromCharCode(223));
    expect(seedText("My own task", "de")).toBe("My own task");
    expect(seedText("Book the shoot location", "en")).toBe("Book the shoot location");
    expect(seedText("Payout 2026-10", "de")).toBe("Auszahlung 2026-10");
    expect(seedText("App host · 2026-10", "de")).toBe("App-Host · 2026-10");
  });

  it("hands back the store's own rows in English and copies in German", () => {
    const rows = [{ title: "Parcel tape" }];
    expect(seedRows(rows, "en", "title")).toBe(rows);
    expect(seedRows(rows, "de", "title")[0].title).toBe("Paketband");
    expect(rows[0].title).toBe("Parcel tape");
  });
});
