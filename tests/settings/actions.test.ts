import { beforeEach, describe, expect, it } from "vitest";
import { draftOf } from "@/desk/settings/rules";
import { assignMail, markMailDone, reopenMail, resortMail, whyOf } from "@/store/actions/inbox";
import { previewDanger, resetAccess, resetDemo, saveAccess, saveMember, saveSettings, signOutEveryoneElse, signOutProfile, signOutSession, switchLock } from "@/store/actions/team";
import { canAccess } from "@/lib/features";
import { getState, resetStore, update } from "@/store/core";
import { createSeed } from "@/store/seed";
import type { Person, Profile } from "@/store/types";

const asProfile = (profile: Profile) => update((s) => ({ ...s, profile }));
const mailId = (key: string) => (getState().inbox.find((m) => m.key === key) as { id: string }).id;
const memberDraft = (profile: Person) => {
  const m = getState().team.find((x) => x.profile === profile);
  if (!m) throw new Error(profile);
  return { name: m.name, initials: m.initials, role: m.roleEn, isActive: m.isActive };
};

beforeEach(() => resetStore());

describe("inbox actions", () => {
  it("assigns and unassigns, and logs it", () => {
    const id = mailId("damaged");
    const before = getState().activity.length;
    expect(assignMail(id, "warehouse")).toMatchObject({ ok: true, data: { assigned: true } });
    expect(getState().inbox.find((m) => m.id === id)?.assignee).toBe("warehouse");
    expect(assignMail(id, null)).toMatchObject({ ok: true, data: { assigned: false } });
    expect(getState().activity.length).toBe(before + 2);
  });

  it("refuses someone switched off", () => {
    asProfile("owner");
    saveMember("studio", { ...memberDraft("studio"), isActive: false });
    expect(assignMail(mailId("damaged"), "studio")).toMatchObject({ ok: false, code: "inactive" });
  });

  it("marks done with the person, then reopens to where it was", () => {
    asProfile("finance");
    const id = mailId("damaged");
    expect(markMailDone(id).ok).toBe(true);
    expect(getState().inbox.find((m) => m.id === id)).toMatchObject({ status: "done", doneBy: "finance" });
    expect(markMailDone(id)).toMatchObject({ ok: false, code: "already_done" });
    expect(reopenMail(id).ok).toBe(true);
    expect(getState().inbox.find((m) => m.id === id)).toMatchObject({ status: "sorted", doneAt: null, doneBy: null });
    expect(reopenMail(id)).toMatchObject({ ok: false, code: "not_done" });
  });

  it("names nobody when superUser marks a mail done, since it is no assignee", () => {
    asProfile("superUser");
    const id = mailId("damaged");
    markMailDone(id);
    expect(getState().inbox.find((m) => m.id === id)?.doneBy).toBeNull();
  });

  it("locks a mail on correction, clears the review flag and keeps the reason", () => {
    asProfile("owner");
    const id = mailId("injection");
    expect(getState().inbox.find((m) => m.id === id)?.needsReview).toBe(true);
    const result = resortMail(id, { category: "manufacturer", priority: "P1", why: " actually a mill " });
    expect(result).toMatchObject({ ok: true, data: { priority: "P1" } });
    expect(getState().inbox.find((m) => m.id === id)).toMatchObject({ category: "manufacturer", priority: "P1", locked: true, needsReview: false, classifiedBy: "Mara Keller", confidence: null, status: "sorted" });
    expect(whyOf(id)).toBe("actually a mill");
    resetStore();
    expect(whyOf(id)).toBeUndefined();
  });

  it("holds low priority at P3 and a reason to 200 characters", () => {
    const id = mailId("damaged");
    expect(resortMail(id, { category: "low_priority", priority: "P1" })).toMatchObject({ ok: true, data: { priority: "P3" } });
    expect(resortMail(id, { category: "manufacturer", priority: "P2", why: "x".repeat(201) })).toMatchObject({ ok: false, code: "why_long" });
  });

  it("sorts an unsorted mail, so it leaves that tab", () => {
    const unsorted = getState().inbox.find((m) => m.status === "unsorted");
    if (!unsorted) throw new Error("the seed holds one unsorted mail");
    resortMail(unsorted.id, { category: "customer_support", priority: "P2" });
    expect(getState().inbox.find((m) => m.id === unsorted.id)).toMatchObject({ status: "sorted", lastError: null });
  });
});

describe("settings", () => {
  it("saves, names who and when, and reaches the store", () => {
    asProfile("owner");
    const draft = { ...draftOf(getState().settings), shipping: "9.00", vatEnabled: true };
    expect(saveSettings(draft).ok).toBe(true);
    expect(getState().settings).toMatchObject({ shippingRappen: 900, vatEnabled: true, updatedBy: "Mara Keller" });
  });

  it("refuses a bad draft and changes nothing", () => {
    const before = getState().settings;
    expect(saveSettings({ ...draftOf(before), hold: "5" })).toMatchObject({ ok: false, code: "invalid" });
    expect(getState().settings).toBe(before);
  });
});

describe("team locks", () => {
  it("gives one reason per case, in the order of the rules", () => {
    const team = getState().team;
    expect(switchLock("superUser", "owner", team)).toBe("fixed");
    expect(switchLock("owner", "owner", team)).toBe("self");
    expect(switchLock("owner", "finance", team)).toBe("full_switch");
    expect(switchLock("owner", "superUser", team)).toBeNull();
    expect(switchLock("finance", "owner", team)).toBeNull();
  });

  it("keeps the last active person on", () => {
    const one = getState().team.map((m) => ({ ...m, isActive: m.profile === "finance" }));
    expect(switchLock("finance", "owner", one)).toBe("last");
  });

  it("refuses a locked switch but still saves the name", () => {
    asProfile("finance");
    expect(saveMember("finance", { ...memberDraft("finance"), isActive: false })).toMatchObject({ ok: false, code: "self" });
    expect(saveMember("owner", { ...memberDraft("owner"), isActive: false })).toMatchObject({ ok: false, code: "full_switch" });
    expect(saveMember("finance", { ...memberDraft("finance"), name: "Jonas A." })).toMatchObject({ ok: true, data: { name: "Jonas A." } });
    expect(getState().team.find((m) => m.profile === "finance")).toMatchObject({ name: "Jonas A.", isActive: true });
  });

  it("uppercases initials and rejects superUser's", () => {
    asProfile("owner");
    saveMember("studio", { ...memberDraft("studio"), initials: "nk" });
    expect(getState().team.find((m) => m.profile === "studio")?.initials).toBe("NK");
    expect(saveMember("studio", { ...memberDraft("studio"), initials: "SU" })).toMatchObject({ ok: false, code: "invalid" });
  });

  it("ends a person's sessions when they go off, but never this browser's row", () => {
    asProfile("owner");
    expect(getState().sessions.some((x) => x.profile === "warehouse")).toBe(true);
    saveMember("warehouse", { ...memberDraft("warehouse"), isActive: false });
    expect(getState().sessions.some((x) => x.profile === "warehouse")).toBe(false);
    asProfile("superUser");
    saveMember("owner", { ...memberDraft("owner"), isActive: false });
    expect(getState().team.find((m) => m.profile === "owner")?.isActive).toBe(false);
    expect(getState().sessions.some((x) => x.isThisBrowser)).toBe(true);
  });

  it("keeps a role in both languages until it is really changed", () => {
    asProfile("owner");
    saveMember("finance", { ...memberDraft("finance"), name: "J. Aebi" });
    expect(getState().team.find((m) => m.profile === "finance")).toMatchObject({ roleEn: "Books and payouts", roleDe: "Buchhaltung und Auszahlungen" });
    saveMember("finance", { ...memberDraft("finance"), role: "Books" });
    expect(getState().team.find((m) => m.profile === "finance")).toMatchObject({ roleEn: "Books", roleDe: "Books" });
  });
});

describe("feature access", () => {
  it("is superUser's alone", () => {
    asProfile("owner");
    expect(saveAccess({ "finance:inbox": true }, {})).toMatchObject({ ok: false, code: "forbidden" });
    expect(resetAccess("finance")).toMatchObject({ ok: false, code: "forbidden" });
    expect(getState().featureSwitches).toEqual(createSeed().featureSwitches);
  });

  it("saves a grant, writes history and activity, and opens the feature", () => {
    asProfile("superUser");
    const before = getState().accessHistory.length;
    expect(canAccess("finance", "inbox", getState().featureSwitches)).toBe(false);
    expect(saveAccess({ "finance:inbox": true }, { "finance:inbox": "2027-02-01" })).toMatchObject({ ok: true, data: { changes: 1 } });
    expect(canAccess("finance", "inbox", getState().featureSwitches)).toBe(true);
    expect(getState().accessHistory.length).toBe(before + 1);
    expect(getState().accessHistory[0]).toMatchObject({ profile: "finance", feature: "inbox", on: true, until: "2027-02-01", kind: "set" });
    expect(getState().activity[0]).toMatchObject({ action: "access.set" });
  });

  it("refuses a day out of range and saves nothing", () => {
    asProfile("superUser");
    expect(saveAccess({ "finance:inbox": true }, { "finance:inbox": "2026-12-31" })).toMatchObject({ ok: false, code: "bad_day" });
    expect(getState().featureSwitches).toEqual(createSeed().featureSwitches);
  });

  it("resets one profile and leaves the others", () => {
    asProfile("superUser");
    saveAccess({ "finance:inbox": true, "warehouse:inbox": true }, {});
    expect(resetAccess("finance").ok).toBe(true);
    expect(getState().featureSwitches.map((x) => x.profile)).toEqual(["warehouse", "warehouse"]);
    expect(getState().accessHistory[0]).toMatchObject({ profile: "finance", kind: "reset" });
  });

  it("gives the owner everything on after a reset", () => {
    asProfile("superUser");
    saveAccess({ "owner:orders": false }, {});
    expect(canAccess("owner", "orders", getState().featureSwitches)).toBe(false);
    resetAccess("owner");
    expect(canAccess("owner", "orders", getState().featureSwitches)).toBe(true);
    expect(canAccess("owner", "settings", getState().featureSwitches)).toBe(true);
  });
});

describe("sign-out rows", () => {
  beforeEach(() => asProfile("superUser"));

  it("ends one row, and refuses this browser's", () => {
    const own = getState().sessions.find((x) => x.isThisBrowser)?.id as string;
    expect(signOutSession(own)).toMatchObject({ ok: false, code: "nothing" });
    expect(signOutSession("ses_2")).toMatchObject({ ok: true, data: { count: 1 } });
    expect(getState().sessions.some((x) => x.id === "ses_2")).toBe(false);
    expect(getState().activity[0]).toMatchObject({ action: "auth.revoke_sessions" });
  });

  it("ends a profile's rows, the no-profile group included", () => {
    expect(signOutProfile("warehouse")).toMatchObject({ ok: true, data: { count: 2 } });
    expect(signOutProfile(null)).toMatchObject({ ok: true, data: { count: 1 } });
    expect(signOutProfile("warehouse")).toMatchObject({ ok: false, code: "nothing" });
  });

  it("ends everyone else and keeps this browser", () => {
    expect(signOutEveryoneElse()).toMatchObject({ ok: true, data: { count: 5 } });
    expect(getState().sessions.map((x) => x.isThisBrowser)).toEqual([true]);
    expect(signOutEveryoneElse()).toMatchObject({ ok: false, code: "nothing" });
  });

  it("is superUser's alone", () => {
    asProfile("owner");
    expect(signOutEveryoneElse()).toMatchObject({ ok: false, code: "forbidden" });
  });
});

describe("danger previews", () => {
  beforeEach(() => asProfile("superUser"));

  it("needs the phrase", () => {
    expect(previewDanger("demo", "remove demo")).toMatchObject({ ok: false, code: "phrase" });
  });

  it("counts, logs one row and deletes nothing", () => {
    const orders = getState().orders;
    const before = getState().activity.length;
    const result = previewDanger("demo", "remove demo data");
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.data.counts.orders).toBe(150);
    expect(getState().orders).toBe(orders);
    expect(getState().activity.length).toBe(before + 1);
    expect(getState().activity[0].action).toBe("danger.demo_preview");
  });

  it("has nothing to preview for local orders until one is made", () => {
    expect(previewDanger("local", "remove local test orders")).toMatchObject({ ok: false, code: "nothing" });
  });

  it("is superUser's alone", () => {
    asProfile("owner");
    expect(previewDanger("demo", "remove demo data")).toMatchObject({ ok: false, code: "forbidden" });
  });

  it("really resets on Reset this demo", () => {
    previewDanger("demo", "remove demo data");
    saveAccess({ "finance:inbox": true }, {});
    resetDemo();
    expect(getState().featureSwitches).toEqual(createSeed().featureSwitches);
    expect(getState().activity.some((a) => a.action === "danger.demo_preview")).toBe(false);
  });
});
