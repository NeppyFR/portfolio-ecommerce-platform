import { describe, expect, it } from "vitest";
import { correctedPriority, firedRules, inboxStats, inTab, isUnverified, sortMails, tabCounts, visibleMails } from "@/desk/growth/inbox/rules";
import { checkMember, checkSettings, draftOf, previewQuote, trackingLinkOk } from "@/desk/settings/rules";
import { cellStatus, cellValue, changesOf, endable, endDayOk, endsSoon, finalSwitches, leavesNoPages, previewDiff, previewFeatures, previewRail, resetEffects, stage, type Staged } from "@/desk/su/access/access-model";
import { DANGER_PHRASES, dangerCounts, phraseMatches, sessionOrders, shownRows, totalOf } from "@/desk/su/danger/danger-rules";
import { attemptStats, describeRecent, groupSessions, recentChanges, runningSessions, signedInCount } from "@/desk/su/sessions";
import { DEFAULT_GRANTS } from "@/lib/features";
import { DEMO_NOW_MS, DEMO_TODAY } from "@/store/clock";
import { getState } from "@/store/core";
import type { ActivityRow, FeatureSwitch, InboxMail } from "@/store/types";

const TODAY = DEMO_TODAY;

describe("inbox rules", () => {
  const mails = () => getState().inbox;

  it("has the 16 sample mails and counts each tab", () => {
    const stats = inboxStats(mails());
    expect(stats.urgent).toBe(mails().filter((m) => m.status !== "done" && m.priority === "P1").length);
    expect(stats.unsorted).toBe(1);
    expect(stats.nobody + mails().filter((m) => m.status !== "done" && m.assignee !== null).length).toBe(mails().filter((m) => m.status !== "done").length);
    const counts = tabCounts(mails());
    expect(mails()).toHaveLength(16);
    expect(counts.open + counts.done).toBe(16);
    expect(counts.unsorted).toBe(mails().filter((m) => m.status === "unsorted").length);
  });

  it("puts a sorted mail in its category tab only while it is sorted", () => {
    const mail = { status: "sorted", category: "manufacturer" } as Pick<InboxMail, "status" | "category">;
    expect(inTab(mail, "manufacturer")).toBe(true);
    expect(inTab({ ...mail, status: "done" }, "manufacturer")).toBe(false);
    expect(inTab({ ...mail, status: "done" }, "done")).toBe(true);
  });

  it("sorts by priority with unsorted last, or newest when asked", () => {
    const sorted = sortMails(mails(), false);
    expect(sorted[0].priority).toBe("P1");
    expect(sorted[sorted.length - 1].priority).toBeNull();
    const newest = sortMails(mails(), true);
    expect(Date.parse(newest[0].receivedAt)).toBeGreaterThanOrEqual(Date.parse(newest[1].receivedAt));
  });

  it("searches sender, subject, summary and text with accents folded", () => {
    const hits = visibleMails(mails(), { tab: "open", query: "ceramica", newest: false });
    expect(hits.length).toBeGreaterThan(0);
    expect(visibleMails(mails(), { tab: "open", query: "nothing-matches-this", newest: false })).toEqual([]);
  });

  it("treats anything but a DMARC pass as unverified", () => {
    expect(isUnverified({ dmarc: "pass" })).toBe(false);
    expect(isUnverified({ dmarc: "fail" })).toBe(true);
    expect(isUnverified({ dmarc: null })).toBe(true);
  });

  it("names the rules that fired on a mail", () => {
    const bank = mails().find((m) => m.key === "pay-now") as InboxMail;
    expect(firedRules(bank)).toEqual(expect.arrayContaining(["bank_change", "unverified"]));
    const injection = mails().find((m) => m.key === "injection") as InboxMail;
    expect(firedRules(injection)).toEqual(expect.arrayContaining(["injection", "low_is_p3"]));
  });

  it("keeps low priority at P3 through a correction", () => {
    expect(correctedPriority("low_priority", "P1")).toBe("P3");
    expect(correctedPriority("manufacturer", "P1")).toBe("P1");
  });
});

describe("settings rules", () => {
  const base = () => draftOf(getState().settings);

  it("round-trips the seed with no errors", () => {
    const { errors, patch } = checkSettings(base());
    expect(errors).toEqual({});
    expect(patch?.shippingRappen).toBe(700);
    expect(patch?.freeShippingThresholdRappen).toBe(15000);
  });

  it("refuses each bad field with its own key", () => {
    const { errors, patch } = checkSettings({ ...base(), shopName: " ", email: "nope", shipping: "seven", freeFrom: "x", lowStock: "1.5", hold: "29", trackingLink: "http:x" });
    expect(patch).toBeNull();
    expect(errors).toEqual({ shopName: "shopNameMissing", email: "emailInvalid", shipping: "shippingInvalid", freeFrom: "freeFromInvalid", lowStock: "wholeNumbers", hold: "holdRange", trackingLink: "trackingInvalid" });
  });

  it("holds shipping to 1000.00 and free shipping to 100000.00", () => {
    expect(checkSettings({ ...base(), shipping: "1000.00" }).errors.shipping).toBeUndefined();
    expect(checkSettings({ ...base(), shipping: "1000.05" }).errors.shipping).toBe("shippingInvalid");
    expect(checkSettings({ ...base(), freeFrom: "100000.05" }).errors.freeFrom).toBe("freeFromInvalid");
  });

  it("takes only an https tracking link that holds the placeholder", () => {
    const scheme = ["https", "://shop.example.com/track/"].join("");
    expect(trackingLinkOk(`${scheme}{tracking}`)).toBe(true);
    expect(trackingLinkOk(scheme)).toBe(false);
    expect(trackingLinkOk(`${scheme}{tracking}`.replace("https", "http"))).toBe(false);
    expect(trackingLinkOk(`${scheme}${"x".repeat(300)}{tracking}`)).toBe(false);
  });

  it("previews the quote from the draft, before saving", () => {
    expect(previewQuote(base())).toMatchObject({ kind: "threshold", below: "CHF 149.95", shipping: "CHF 7.00", from: "CHF 150.00" });
    expect(previewQuote({ ...base(), shipping: "0" })).toMatchObject({ kind: "no_shipping" });
    expect(previewQuote({ ...base(), freeFrom: "0" })).toMatchObject({ kind: "all_free" });
    expect(previewQuote({ ...base(), shipping: "nope" })).toBeNull();
    expect(previewQuote(base())?.trackingExample).toBe("shop.example.com/track/BP123456785ZZ");
  });

  it("keeps superUser's name and initials reserved", () => {
    const fine = { name: "Mara Keller", initials: "mk", role: "Lead", isActive: true };
    expect(checkMember(fine)).toEqual({});
    expect(checkMember({ ...fine, name: "SuperUser" }).name).toBe("reserved");
    expect(checkMember({ ...fine, initials: "su" }).initials).toBe("reserved");
    expect(checkMember({ ...fine, initials: "M1" }).initials).toBe("initialsInvalid");
    expect(checkMember({ ...fine, name: "" }).name).toBe("nameMissing");
    expect(checkMember({ ...fine, role: "x".repeat(81) }).role).toBe("roleLong");
  });
});

describe("feature access model", () => {
  const none: FeatureSwitch[] = [];

  it("drops a staged change when it is flipped back", () => {
    const one = stage({}, "finance", "inbox", true, none, TODAY);
    expect(one).toEqual({ "finance:inbox": true });
    expect(stage(one, "finance", "inbox", false, none, TODAY)).toEqual({});
  });

  it("shows the staged value, else the current one", () => {
    const staged: Staged = { "finance:inbox": true };
    expect(cellValue(staged, "finance", "inbox", none, TODAY)).toBe(true);
    expect(cellValue(staged, "warehouse", "inbox", none, TODAY)).toBe(false);
    expect(cellStatus(staged, "finance", "inbox", none, TODAY).kind).toBe("staged");
    expect(cellStatus(staged, "finance", "orders", none, TODAY).kind).toBe("default");
  });

  it("marks back-to-default changes and which ones may carry an end day", () => {
    const grant = changesOf({ "finance:inbox": true }, none, TODAY)[0];
    expect(grant).toMatchObject({ on: true, toDefault: false, canEnd: true });
    const switches: FeatureSwitch[] = [{ profile: "finance", feature: "inbox", on: true, until: null }];
    const back = changesOf({ "finance:inbox": false }, switches, TODAY)[0];
    expect(back).toMatchObject({ on: false, toDefault: true, canEnd: false });
  });

  it("refuses an end day on a cell that already runs one, since that end would be lost", () => {
    const running: FeatureSwitch[] = [{ profile: "finance", feature: "inbox", on: true, until: "2027-02-01" }];
    expect(endable("finance", "inbox", false, running, TODAY)).toBe(false);
  });

  it("lets the owner's change carry an end day, because the end brings back what he has", () => {
    expect(endable("owner", "orders", false, none, TODAY)).toBe(true);
  });

  it("stores chosen cells, drops back-to-default rows and rewrites ended rows as what they left", () => {
    const ended: FeatureSwitch[] = [{ profile: "finance", feature: "inbox", on: true, until: "2027-01-01" }, { profile: "owner", feature: "orders", on: false, until: "2027-01-01" }];
    const next = finalSwitches({ "warehouse:inbox": true }, { "warehouse:inbox": "2027-02-01" }, ended, TODAY);
    expect(next).toContainEqual({ profile: "warehouse", feature: "inbox", on: true, until: "2027-02-01" });
    expect(next.some((row) => row.profile === "finance")).toBe(false);
    expect(next.some((row) => row.profile === "owner")).toBe(false);
    expect(finalSwitches({ "finance:inbox": false }, {}, [{ profile: "finance", feature: "inbox", on: true, until: null }], TODAY)).toEqual([]);
  });

  it("previews staged features and spots a profile left with no page", () => {
    expect(previewFeatures("finance", { "finance:inbox": true }, none, TODAY)).toContain("inbox");
    const allOff: Staged = Object.fromEntries(DEFAULT_GRANTS.warehouse.map((f) => [`warehouse:${f}`, false]));
    expect(leavesNoPages("warehouse", allOff, none, TODAY)).toBe(true);
    expect(leavesNoPages("finance", allOff, none, TODAY)).toBe(false);
    const ownerOff: Staged = Object.fromEntries(DEFAULT_GRANTS.owner.map((f) => [`owner:${f}`, false]));
    expect(leavesNoPages("owner", ownerOff, none, TODAY)).toBe(false);
  });

  it("draws the rail with Settings and System closed to partners and open to the owner", () => {
    const openIds = (profile: "finance" | "owner") => previewRail(profile, {}, none, TODAY).flatMap((r) => r.screens).filter((s) => s.open).map((s) => s.screen.id);
    expect(openIds("finance")).toContain("ledger");
    expect(openIds("finance")).not.toContain("settings");
    expect(openIds("finance")).not.toContain("inbox");
    expect(openIds("owner")).toContain("settings");
    expect(previewRail("owner", {}, none, TODAY).flatMap((r) => r.screens).some((s) => s.screen.id === "su")).toBe(false);
  });

  it("groups the preview like the sidebar and hides superUser's own item", () => {
    const groups = previewRail("finance", {}, none, TODAY);
    expect(groups.map((g) => g.id)).toEqual(["shop", "growth", "workspace", "system"]);
    expect(groups[0].screens[0]).toMatchObject({ open: true });
    expect(groups[0].screens[0].screen.id).toBe("dashboard");
    expect(groups.flatMap((g) => g.screens).map((s) => s.screen.id)).not.toContain("su");
  });

  it("names what the preview gains and loses against the default", () => {
    expect(previewDiff("finance", {}, none, TODAY)).toEqual({ gains: [], loses: [] });
    const staged: Staged = { "finance:inbox": true, "finance:orders": false };
    expect(previewDiff("finance", staged, none, TODAY)).toEqual({ gains: ["inbox"], loses: ["orders"] });
  });

  it("says what a reset would flip", () => {
    const switches: FeatureSwitch[] = [{ profile: "finance", feature: "inbox", on: true, until: null }, { profile: "finance", feature: "orders", on: false, until: null }];
    expect(resetEffects("finance", switches, TODAY)).toEqual({ on: ["orders"], off: ["inbox"] });
    expect(resetEffects("owner", [{ profile: "owner", feature: "orders", on: false, until: null }], TODAY)).toEqual({ on: ["orders"], off: [] });
  });

  it("takes an end day from today to a year from today", () => {
    expect(endDayOk(TODAY, TODAY)).toBe(true);
    expect(endDayOk("2027-01-07", TODAY)).toBe(false);
    expect(endDayOk("2028-01-08", TODAY)).toBe(true);
    expect(endDayOk("2028-01-09", TODAY)).toBe(false);
    expect(endDayOk("not-a-day", TODAY)).toBe(false);
    expect(endsSoon("2027-01-09", TODAY)).toBe(true);
    expect(endsSoon("2027-01-10", TODAY)).toBe(false);
  });
});

describe("danger counts", () => {
  it("matches the phrase exactly", () => {
    expect(phraseMatches("remove demo data", DANGER_PHRASES.demo)).toBe(true);
    expect(phraseMatches("Remove demo data", DANGER_PHRASES.demo)).toBe(false);
    expect(phraseMatches("remove demo data ", DANGER_PHRASES.demo)).toBe(false);
  });

  it("counts the seed without changing it", () => {
    const s = getState();
    expect(sessionOrders(s)).toEqual([]);
    expect(totalOf(dangerCounts("local", s))).toBe(0);
    expect(dangerCounts("demo", s)).toMatchObject({ products: 13, orders: 150, codes: 7, inbox: 16 });
    expect(shownRows(dangerCounts("test", s)).every(([, n]) => n > 0)).toBe(true);
    expect(getState()).toBe(s);
  });
});

describe("sessions and attempts", () => {
  it("dresses this browser in the profile in use and groups the rest", () => {
    const s = { ...getState(), profile: "superUser" as const };
    const running = runningSessions(s);
    expect(running.find((x) => x.isThisBrowser)?.profile).toBe("superUser");
    expect(signedInCount(running, "owner")).toBe(0);
    expect(signedInCount(running, "warehouse")).toBe(2);
    const groups = groupSessions(running);
    expect(groups[groups.length - 1].profile).toBeNull();
    expect(groups.map((g) => g.profile)).not.toContain("owner");
  });

  it("counts failures by age and finds the last superUser sign-in", () => {
    const stats = attemptStats(getState().signIns, DEMO_NOW_MS);
    expect(stats.day).toBe(2);
    expect(stats.week).toBeGreaterThanOrEqual(stats.day);
    expect(stats.recent.length).toBe(stats.week);
    expect(stats.lastSuper).not.toBeNull();
  });

  it("lists only access changes, ended sessions and danger previews, ten at most", () => {
    const row = (action: string, i: number): ActivityRow => ({ id: `a${i}`, at: "2027-01-08T10:00:00Z", actor: "superUser", area: "x", action, detail: `change ${i}` });
    const rows = [row("order.paid", 0), ...Array.from({ length: 12 }, (_, i) => row(i % 2 ? "access.set" : "danger.demo_preview", i + 1))];
    const recent = recentChanges(rows);
    expect(recent).toHaveLength(10);
    expect(recent.some((r) => r.action === "order.paid")).toBe(false);
  });

  it("says the same change once, keeping the newest", () => {
    const row = (id: string, detail: string): ActivityRow => ({ id, at: "2027-01-08T10:00:00Z", actor: "superUser", area: "access", action: "access.set", detail });
    const recent = recentChanges([row("new", "Studio: Inbox on"), row("old", "Studio: Inbox on"), row("other", "Finance: Orders off")]);
    expect(recent.map((r) => r.id)).toEqual(["new", "other"]);
  });
});

describe("describeRecent", () => {
  const words = {
    feature: (key: string) => ({ inbox: "Posteingang", tasks: "Checkliste" } as Record<string, string>)[key],
    person: (who: string) => ({ studio: "Nico Steiner", finance: "Jonas Aebi" } as Record<string, string>)[who] ?? who,
    on: "{feature} ein",
    off: "{feature} aus",
    until: "bis {day}",
    day: (iso: string) => iso.split("-").reverse().join("."),
    reset: "{who}: zurück zum Standard",
    endedOne: "Sitzung {id} beendet",
    endedProfile: "{who}: {n} beendet",
    endedNoProfile: "Kein Profil gewählt: {n} beendet",
    endedOthers: "Alle anderen: {n} beendet",
    danger: "Nur Vorschau: {n} Zeilen gezählt, nichts wurde gelöscht",
  };

  it("says an access change in the page's language", () => {
    expect(describeRecent("Studio: Inbox on", words)).toBe("Nico Steiner: Posteingang ein");
    expect(describeRecent("Finance: Checklist off until 2027-01-09", words)).toBe("Jonas Aebi: Checkliste aus bis 09.01.2027");
  });

  it("covers resets, ended sessions and danger previews", () => {
    expect(describeRecent("Studio: back to the defaults", words)).toBe("Nico Steiner: zurück zum Standard");
    expect(describeRecent("Session ses_4: 1 ended", words)).toBe("Sitzung ses_4 beendet");
    expect(describeRecent("Sessions of finance: 2 ended", words)).toBe("Jonas Aebi: 2 beendet");
    expect(describeRecent("Sessions of no profile: 1 ended", words)).toBe("Kein Profil gewählt: 1 beendet");
    expect(describeRecent("Everyone else: 5 ended", words)).toBe("Alle anderen: 5 beendet");
    expect(describeRecent("Preview only: 534 rows counted, nothing was deleted", words)).toBe("Nur Vorschau: 534 Zeilen gezählt, nichts wurde gelöscht");
  });

  it("prints an unknown shape as written", () => {
    expect(describeRecent("Studio: Unknownthing on", words)).toBe("Studio: Unknownthing on");
    expect(describeRecent("Something else entirely", words)).toBe("Something else entirely");
  });
});
