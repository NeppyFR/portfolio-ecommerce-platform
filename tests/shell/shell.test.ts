import { beforeEach, describe, expect, it } from "vitest";
import { nextRoute } from "@/desk/enter/StepInChips";
import { regionScreens } from "@/desk/registry";
import { searchJump } from "@/desk/shell/jump-search";
import { deriveNotifications, emptyLine, isUnread, markAllSeen } from "@/desk/shell/notifications";
import { liveDetail, shortStamp } from "@/desk/shell/rail-rules";
import { shell } from "@/i18n/dict/shell";
import { clearProfile, identityOf, isProfile, PROFILES, setProfile } from "@/store/actions/profile";
import { DEMO_NOW_MS } from "@/store/clock";
import { getState, resetStore, update } from "@/store/core";
import type { HealthRun, State } from "@/store/types";

const at = (minutesAgo: number) => new Date(DEMO_NOW_MS - minutesAgo * 60_000).toISOString();
const run = (overall: HealthRun["overall"], minutesAgo: number): HealthRun => ({
  id: "run",
  startedAt: at(minutesAgo),
  finishedAt: at(minutesAgo),
  source: "watchdog",
  target: null,
  overall,
  checks: [
    { id: "a", status: "pass", code: "", reason: "", ms: 1 },
    { id: "b", status: overall === "pass" ? "pass" : overall, code: "", reason: "", ms: 1 },
  ],
});

beforeEach(() => resetStore());

describe("profile", () => {
  it("defaults to the owner on the seed", () => {
    expect(getState().profile).toBe("owner");
  });
  it("sets, refuses an unknown profile and clears", () => {
    expect(setProfile("finance")).toEqual({ ok: true, data: "finance" });
    expect(getState().profile).toBe("finance");
    const refused = setProfile("nobody" as never);
    expect(refused.ok).toBe(false);
    expect(getState().profile).toBe("finance");
    clearProfile();
    expect(getState().profile).toBe("owner");
  });
  it("cannot pick a person switched off under Team", () => {
    update((s) => ({ ...s, team: [{ profile: "studio", name: "Renamed", initials: "RN", roleEn: "Role", roleDe: "Rolle", isActive: false, lastSignInAt: null }] }));
    expect(identityOf("studio").name).toBe("Renamed");
    const refused = setProfile("studio");
    expect(refused.ok).toBe(false);
    expect(getState().profile).toBe("owner");
  });
  it("knows five fixed profiles and never gives superUser initials", () => {
    expect(PROFILES).toHaveLength(5);
    expect(isProfile("superUser")).toBe(true);
    expect(isProfile("admin")).toBe(false);
    expect(identityOf("superUser").initials).toBeNull();
    expect(identityOf("owner").initials).toBe("MK");
  });
});

describe("after the picker", () => {
  it("only follows a desk route the profile may open", () => {
    expect(nextRoute("/desk/finance/", "finance", [])).toBe("/desk/finance/");
    expect(nextRoute("/desk/finance/", "warehouse", [])).toBe("/desk/");
    expect(nextRoute("/desk/su/", "owner", [])).toBe("/desk/");
    expect(nextRoute("/desk/enter/", "owner", [])).toBe("/desk/");
    expect(nextRoute("//elsewhere.example.com/", "owner", [])).toBe("/desk/");
    expect(nextRoute(null, "owner", [])).toBe("/desk/");
  });
});

describe("registry", () => {
  it("keeps superUser in System's list, where the sidebar filters it", () => {
    expect(regionScreens("system").filter((s) => s.superUserOnly).map((s) => s.id)).toEqual(["su"]);
    expect(regionScreens("system").filter((s) => !s.superUserOnly)).toHaveLength(12);
  });
});

describe("live pill", () => {
  it("writes the detail with counts that are not zero", () => {
    expect(liveDetail(run("pass", 2), shell.en)).toBe("Last check 14:00 · 2/2 passed");
    expect(liveDetail(run("warn", 2), shell.en)).toBe("Last check 14:00 · 1/2 passed · 1 warning");
    expect(liveDetail(null, shell.de)).toBe(shell.de.live.detailNone);
  });
  it("prints the date only for another day", () => {
    expect(shortStamp("2027-01-08T09:15:00+01:00")).toBe("09:15");
    expect(shortStamp("2027-01-07T09:15:00+01:00")).toBe("07.01.2027, 09:15");
  });
});

describe("bell", () => {
  const paidOrder = { status: "paid", paidAt: at(60), orderNumber: "AL-1150", totalRappen: 8900, refunds: [], needsAttention: false, attentionResolvedAt: null } as unknown as State["orders"][number];

  it("lists a new paid order as an event that vanishes once seen", () => {
    update((s) => ({ ...s, orders: [paidOrder], returns: [], tasks: [], inbox: [], products: [], signIns: [], healthRuns: [], notifications: [], settings: { ...s.settings, notifyNewOrder: true } }));
    const rows = deriveNotifications(getState(), "owner", shell.en);
    expect(rows.map((r) => r.kind)).toEqual(["orders"]);
    expect(rows[0].href).toBe("/desk/orders/?o=AL-1150");
    expect(isUnread("owner", rows[0])).toBe(true);
    markAllSeen("owner", rows);
    expect(isUnread("owner", rows[0])).toBe(false);
    expect(isUnread("finance", rows[0])).toBe(true);
  });
  it("hides what the profile may not open", () => {
    update((s) => ({ ...s, orders: [paidOrder], returns: [], tasks: [], inbox: [], products: [], signIns: [], healthRuns: [], notifications: [] }));
    expect(deriveNotifications(getState(), "studio", shell.en)).toEqual([]);
    expect(emptyLine(getState(), "studio", shell.en)).toBe(shell.en.bell.emptyPartner);
    expect(emptyLine(getState(), "owner", shell.en)).toBe(`${shell.en.bell.empty} ${shell.en.bell.emptyMoney}`);
  });
  it("respects the settings switches", () => {
    update((s) => ({ ...s, orders: [paidOrder], returns: [], tasks: [], inbox: [], products: [], signIns: [], healthRuns: [], notifications: [], settings: { ...s.settings, notifyNewOrder: false } }));
    expect(deriveNotifications(getState(), "owner", shell.en)).toEqual([]);
  });
  it("lists a notify() row once, ahead of the derived kinds", () => {
    update((s) => ({ ...s, orders: [], returns: [], tasks: [], inbox: [], products: [], signIns: [], healthRuns: [], notifications: [{ id: "n1", at: at(1), kind: "demo", title: "Hello", href: "/desk/", readAt: null }] }));
    const rows = deriveNotifications(getState(), "owner", shell.en);
    expect(rows.map((r) => r.key)).toEqual(["n1"]);
  });
  it("hides a seeded return row from anyone without Finance, and words it in the viewer's language", () => {
    update((s) => ({ ...s, orders: [], returns: [], tasks: [], inbox: [], products: [], signIns: [], healthRuns: [], notifications: [{ id: "n2", at: at(1), kind: "return_opened", title: "Return opened", href: "/desk/orders/returns/", readAt: null }] }));
    expect(deriveNotifications(getState(), "warehouse", shell.en)).toEqual([]);
    expect(deriveNotifications(getState(), "finance", shell.de).map((r) => r.title)).toEqual([shell.de.note.returnTitle.one]);
  });
});

describe("jump box", () => {
  const order = { id: "o1", orderNumber: "AL-1042", customerName: "Anna Muster", customerErased: false, totalRappen: 8900 } as unknown as State["orders"][number];
  const customer = (id: string, erased: boolean) => ({ id, fullName: `Zoe ${id}`, email: `zoe.${id}@example.com`, erased }) as unknown as State["customers"][number];
  const groups = (s: State, q: string, lang: "en" | "de" = "en") => searchJump(s, q, lang);

  it("offers a short list before anything is typed", () => {
    const sections = groups(getState(), "");
    expect(sections.map((x) => x.group)).toEqual(["screens", "pages"]);
    expect(sections[0].items[0].href).toBe("/desk/");
  });
  it("finds screens in either language, folding accents", () => {
    expect(groups(getState(), "hosting")[0].items[0].href).toBe("/desk/system/map/");
    expect(groups(getState(), "Rückerstattungen")[0].items[0].href).toBe("/desk/finance/refunds/");
    expect(groups(getState(), "ruckerstattungen")[0].items[0].href).toBe("/desk/finance/refunds/");
  });
  it("puts orders first for something shaped like an order number", () => {
    update((s) => ({ ...s, orders: [order] }));
    for (const q of ["1042", "AL-1042"]) {
      const sections = groups(getState(), q);
      expect(sections[0].group).toBe("orders");
      expect(sections[0].items[0].href).toBe("/desk/orders/?o=AL-1042");
    }
  });
  it("ranks numbers that start with what was typed, then newest first", () => {
    const row = (n: string) => ({ ...order, id: n, orderNumber: n });
    update((s) => ({ ...s, orders: [row("AL-1001"), row("AL-1042"), row("AL-1109"), row("AL-1110")] }));
    expect(groups(getState(), "AL-10")[0].items.map((i) => i.label)).toEqual(["AL-1042", "AL-1001", "AL-1110", "AL-1109"]);
  });
  it("hides superUser screens from everyone else, and flags a locked screen", () => {
    expect(groups(getState(), "superUser").flatMap((x) => x.items).some((i) => i.href.startsWith("/desk/su"))).toBe(false);
    setProfile("superUser");
    expect(groups(getState(), "superUser").flatMap((x) => x.items).some((i) => i.href === "/desk/su/")).toBe(true);
    setProfile("warehouse");
    const ledger = groups(getState(), "ledger")[0].items[0];
    expect(ledger.locked).toBe(true);
  });
  it("hides rows behind a feature the profile lacks, and erased customers from everyone", () => {
    update((s) => ({ ...s, orders: [order], customers: [customer("kept", false), customer("gone", true)] }));
    const names = groups(getState(), "zoe").flatMap((x) => x.items).map((i) => i.label);
    expect(names).toEqual(["Zoe kept"]);
    setProfile("studio");
    expect(groups(getState(), "1042").some((x) => x.group === "orders")).toBe(false);
  });
  it("says nothing for a query that matches nothing", () => {
    expect(groups(getState(), "zzzzzz")).toEqual([]);
  });
});
