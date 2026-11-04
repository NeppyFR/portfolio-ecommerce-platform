import { beforeEach, describe, expect, it } from "vitest";
import { areaLights, attentionAreas, configLight, edgeLastSeen, entityOf, idList, isLateRelease, loginSummary, nodeLights, securityLight, whenOf } from "@/desk/system/rules/lights";
import { filterActivity, filterOutbox, isRetryable, outboxBase, outboxCounts, pageOf, waitingToRender } from "@/desk/system/rules/logs";
import { tableFacts } from "@/desk/system/rules/db-tables";
import { fitScale, labelScale, labelsFit, neighbourhood, nodeFit } from "@/desk/system/rules/map-fit";
import { lockStatus, rotationRows, rotationSummary } from "@/lib/security-rules";
import { EDGES, NODES, nodeBox } from "@/map/data";
import { clearLockout, getFailedSource, logEveryoneOut, manualChecks, retentionProblem, retryEmail, runHealthChecks, setFailedSource, setRetentionDays, setRotationDate, simulateWrongTries } from "@/store/actions/system";
import { DEMO_NOW_MS, DEMO_TODAY } from "@/store/clock";
import { getState, resetStore } from "@/store/core";
import { healthSummary } from "@/store/selectors";
import { system } from "@/i18n/dict/system";

beforeEach(() => resetStore());

describe("the seeded scenario shows every tone", () => {
  it("reads each area as the notes say", () => {
    const tones = Object.fromEntries(areaLights(getState(), DEMO_NOW_MS).map((l) => [l.id, l.tone]));
    expect(tones).toEqual({ health: "warn", database: "ok", payments: "warn", email: "warn", security: "ok", config: "warn", deploys: "ok", ci: "bad" });
  });

  it("sorts attention worst first and leaves OK out", () => {
    const attention = attentionAreas(areaLights(getState(), DEMO_NOW_MS));
    expect(attention[0].id).toBe("ci");
    expect(attention.map((a) => a.tone)).not.toContain("ok");
    expect(attention).toHaveLength(5);
  });

  it("keeps only four map boxes live", () => {
    expect(Object.keys(nodeLights(getState(), DEMO_NOW_MS)).sort()).toEqual(["database", "inbox", "mail", "payments"]);
  });

  it("has a last sign of life on five wires, all of them real edges and none switched off", () => {
    const ids = Object.keys(edgeLastSeen(getState()));
    expect(ids).toHaveLength(5);
    expect(ids).not.toContain("ghSb");
    const known = new Set<string>(EDGES.map((e) => e.id));
    for (const id of ids) expect(known.has(id)).toBe(true);
  });
});

describe("a failed source", () => {
  it("turns only its own area unknown and clears on reset", () => {
    setFailedSource("config");
    const lights = areaLights(getState(), DEMO_NOW_MS, getFailedSource());
    expect(lights.filter((l) => l.tone === "unknown").map((l) => l.id)).toEqual(["config"]);
    expect(lights.find((l) => l.id === "ci")?.tone).toBe("bad");
    resetStore();
    expect(getFailedSource()).toBeNull();
  });
});

describe("helpers", () => {
  it("cuts id lists after three", () => {
    expect(idList(["a", "b"])).toBe("a, b");
    expect(idList(["a", "b", "c", "d", "e"])).toBe("a, b, c +2");
  });

  it("prints only the time for today", () => {
    expect(whenOf(new Date(DEMO_NOW_MS - 60_000).toISOString(), DEMO_NOW_MS)).toMatch(/^\d\d:\d\d$/);
    expect(whenOf("2026-12-24T09:00:00Z", DEMO_NOW_MS)).toContain("24.12.2026");
  });

  it("calls a release late past 15 minutes", () => {
    const base = { id: "r", ref: "x", units: 1, totalRappen: 100 };
    expect(isLateRelease({ ...base, reason: "expired", expiredAt: "2027-01-08T10:00:00Z", releasedAt: "2027-01-08T10:16:00Z" })).toBe(true);
    expect(isLateRelease({ ...base, reason: "expired", expiredAt: "2027-01-08T10:00:00Z", releasedAt: "2027-01-08T10:15:00Z" })).toBe(false);
    expect(isLateRelease({ ...base, reason: "cancelled", expiredAt: "2027-01-08T10:00:00Z", releasedAt: "2027-01-08T11:00:00Z" })).toBe(false);
  });

  it("maps areas to the About groups, and unknown areas to none", () => {
    expect(entityOf("orders")).toBe("order");
    expect(entityOf("auth")).toBe("session");
    expect(entityOf("finances")).toBe("finance");
    expect(entityOf("no-such-area")).toBeNull();
  });

  it("clamps pages", () => {
    const rows = Array.from({ length: 120 }, (_, i) => i);
    expect(pageOf(rows, 1, 50)).toMatchObject({ page: 1, pages: 3 });
    expect(pageOf(rows, 9, 50).rows).toHaveLength(20);
    expect(pageOf(rows, 9, 50).page).toBe(3);
    expect(pageOf([], 1, 50)).toMatchObject({ page: 1, pages: 1, rows: [] });
  });
});

describe("health run", () => {
  it("prepends a 16-check admin run with no target and leaves the title count alone", () => {
    const before = healthSummary(getState()).pass;
    const count = getState().healthRuns.length;
    expect(runHealthChecks().ok).toBe(true);
    const run = getState().healthRuns[0];
    expect(getState().healthRuns).toHaveLength(count + 1);
    expect(run.source).toBe("admin");
    expect(run.target).toBeNull();
    expect(run.checks).toHaveLength(16);
    expect(healthSummary(getState()).pass).toBe(before);
    expect(getState().activity[0].action).toBe("health.run");
  });

  it("reads live state, so fixing the failed mail clears that warning in the next run", () => {
    const row = () => manualChecks(getState(), DEMO_NOW_MS).find((c) => c.id === "email.outbox_coverage");
    expect(row()?.status).toBe("warn");
    for (const mail of getState().outbox.filter(isRetryable)) retryEmail(mail.id);
    expect(row()?.status).toBe("pass");
  });
});

describe("outbox", () => {
  it("starts with the seeded counts, and never reaches sent", () => {
    expect(outboxCounts(getState().outbox)).toEqual({ all: 180, queued: 2, rendered: 170, failed: 1, skipped: 7, sent: 0 });
    expect(waitingToRender(getState().outbox)).toBe(3);
  });

  it("filters by order number or address, by type and by status", () => {
    const rows = getState().outbox;
    const number = rows[0].orderNumber as string;
    expect(filterOutbox(rows, { q: number.toLowerCase(), type: "", status: "" }).every((m) => m.orderNumber === number)).toBe(true);
    const address = rows[0].to;
    expect(filterOutbox(rows, { q: address.toUpperCase(), type: "", status: "" }).every((m) => m.to === address)).toBe(true);
    expect(filterOutbox(rows, { q: "", type: "shipping_notification", status: "" }).every((m) => m.template === "shipping_notification")).toBe(true);
    expect(filterOutbox(rows, { q: "", type: "", status: "failed" })).toHaveLength(1);
    expect(outboxBase(rows, { q: "no such thing", type: "" })).toHaveLength(0);
  });

  it("retries a failed mail to rendered, once", () => {
    const failed = getState().outbox.find((m) => m.status === "failed");
    if (!failed) throw new Error("seed has no failed mail");
    expect(retryEmail(failed.id).ok).toBe(true);
    const after = getState().outbox.find((m) => m.id === failed.id);
    expect(after?.status).toBe("rendered");
    expect(after?.error).toBeNull();
    expect(after?.attempts).toBe(failed.attempts + 1);
    expect(retryEmail(failed.id)).toMatchObject({ ok: false, code: "not_retryable" });
    expect(areaLights(getState(), DEMO_NOW_MS).find((l) => l.id === "email")?.key).not.toBe("emailFailed");
  });

  it("refuses a rendered, a skipped or an unknown mail", () => {
    const rendered = getState().outbox.find((m) => m.status === "rendered");
    const skipped = getState().outbox.find((m) => m.status === "skipped");
    expect(retryEmail(rendered?.id ?? "")).toMatchObject({ ok: false, code: "not_retryable" });
    expect(retryEmail(skipped?.id ?? "")).toMatchObject({ ok: false, code: "not_retryable" });
    expect(retryEmail("nope")).toMatchObject({ ok: false, code: "not_found" });
  });
});

describe("retention", () => {
  it("takes whole days from 7 to 365", () => {
    expect(retentionProblem("abc")).toBe("whole");
    expect(retentionProblem("7.5")).toBe("whole");
    expect(retentionProblem("6")).toBe("min");
    expect(retentionProblem("366")).toBe("max");
    expect(retentionProblem("7")).toBeNull();
    expect(retentionProblem("365")).toBeNull();
  });

  it("saves and logs, and a bad value changes nothing", () => {
    expect(setRetentionDays("120")).toEqual({ ok: true, data: 120 });
    expect(getState().settings.inboxRetentionDays).toBe(120);
    expect(setRetentionDays("3").ok).toBe(false);
    expect(getState().settings.inboxRetentionDays).toBe(120);
  });
});

describe("lockout", () => {
  it("the seed is not locked, with two failures in 24 hours", () => {
    expect(lockStatus(getState().signIns, DEMO_NOW_MS).locked).toBe(false);
    expect(loginSummary(getState().signIns, DEMO_NOW_MS).failure).toBe(2);
    expect(clearLockout()).toMatchObject({ ok: false, code: "nothing_to_clear" });
  });

  it("five wrong tries lock one address, and clearing removes them", () => {
    simulateWrongTries();
    const lock = lockStatus(getState().signIns, DEMO_NOW_MS);
    expect(lock.locked).toBe(true);
    expect(lock.global).toBe(false);
    expect(lock.prefixes).toHaveLength(1);
    expect(lock.liftsAt).not.toBeNull();
    expect(securityLight(getState(), DEMO_NOW_MS).tone).toBe("warn");
    expect(clearLockout()).toEqual({ ok: true, data: { removed: 5 } });
    expect(lockStatus(getState().signIns, DEMO_NOW_MS).locked).toBe(false);
    expect(securityLight(getState(), DEMO_NOW_MS).tone).toBe("ok");
  });
});

describe("log everyone out", () => {
  it("ends every session and keeps one row with no profile for this browser", () => {
    expect(getState().sessions).toHaveLength(6);
    expect(logEveryoneOut()).toEqual({ ok: true, data: { ended: 6 } });
    const sessions = getState().sessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ profile: null, isThisBrowser: true });
    expect(getState().activity[0].action).toBe("auth.revoke_sessions");
  });
});

describe("rotation", () => {
  it("seeds one secret due, and recording a new day clears the light", () => {
    const due = rotationSummary(rotationRows(getState().configVars, DEMO_TODAY)).due;
    expect(due).toHaveLength(1);
    expect(configLight(getState()).key).toBe("configRotationDue");
    expect(setRotationDate(due[0], DEMO_TODAY)).toEqual({ ok: true, data: DEMO_TODAY });
    expect(rotationSummary(rotationRows(getState().configVars, DEMO_TODAY)).due).toHaveLength(0);
    expect(configLight(getState()).tone).toBe("ok");
  });

  it("refuses a bad day, and anything that is not a secret", () => {
    const due = rotationSummary(rotationRows(getState().configVars, DEMO_TODAY)).due[0];
    expect(setRotationDate(due, "nonsense")).toMatchObject({ ok: false, code: "invalid" });
    expect(setRotationDate(due, "2019-12-31")).toMatchObject({ ok: false, code: "too_early" });
    expect(setRotationDate(due, "2099-01-01")).toMatchObject({ ok: false, code: "future" });
    const setting = getState().configVars.find((v) => v.kind === "setting");
    expect(setRotationDate(setting?.name ?? "", DEMO_TODAY)).toMatchObject({ ok: false, code: "not_secret" });
  });
});

describe("the database tab reads the demo's own data", () => {
  it("keeps every table, biggest first, with counts that agree with the store", () => {
    const s = getState();
    const facts = tableFacts(s);
    expect(facts).toHaveLength(64);
    for (let i = 1; i < facts.length; i += 1) expect(facts[i - 1].sizeBytes).toBeGreaterThanOrEqual(facts[i].sizeBytes);
    const rows = (name: string) => facts.find((t) => t.name === name)?.rows;
    expect(rows("orders")).toBe(s.orders.length);
    expect(rows("products")).toBe(s.products.length);
    expect(rows("stock_movements")).toBe(s.movements.length);
    expect(rows("email_outbox")).toBe(s.outbox.length);
    expect(rows("product_variants")).toBe(s.products.reduce((n, p) => n + p.variants.length, 0));
  });
});

describe("the map holds the 12 px floor at any width", () => {
  it("grows text exactly as far as the drawing shrinks, and never below full size", () => {
    expect(fitScale(1414, 1414)).toBe(1);
    expect(fitScale(1414, 2000)).toBe(1);
    const scale = fitScale(1414, 1100);
    expect((12 * scale) / (1414 / 1100)).toBeGreaterThanOrEqual(12);
    expect((12.5 * labelScale(scale)) / (1414 / 1100)).toBeGreaterThanOrEqual(12);
    expect(fitScale(1414, 0)).toBe(1);
  });

  it("keeps wire labels only while they fit between the boxes", () => {
    expect(labelsFit(1)).toBe(true);
    expect(labelsFit(1.1)).toBe(true);
    expect(labelsFit(1.25)).toBe(false);
  });

  it("keeps a grown box centred, apart from the two that step aside", () => {
    const app = NODES.find((n) => n.id === "app");
    if (!app) throw new Error("no app box");
    const box = nodeBox(app, "wide");
    const fit = nodeFit(box, "app", 1.25);
    expect(Math.abs(fit.x + (box.w * 1.25) / 2 - box.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(fit.y + (box.h * 1.25) / 2 - box.y)).toBeLessThanOrEqual(1);
  });

  it("finds a box's wires and neighbours", () => {
    const near = neighbourhood("mailbox");
    expect(near.edges.map((e) => e.id)).toEqual(["clMb"]);
    expect(near.lit.sort()).toEqual(["inbox", "mailbox"]);
  });
});

describe("activity filter", () => {
  it("narrows by actor and by About group", () => {
    const rows = getState().activity;
    expect(rows).toHaveLength(120);
    expect(filterActivity(rows, { actor: "system", entity: "" }).every((r) => r.actor === "system")).toBe(true);
    const orders = filterActivity(rows, { actor: "", entity: "order" });
    expect(orders.length).toBeGreaterThan(0);
    expect(orders.every((r) => entityOf(r.area) === "order")).toBe(true);
    expect(filterActivity(rows, { actor: "system", entity: "danger" })).toHaveLength(0);
    expect(filterActivity(rows, { actor: "", entity: "" })).toHaveLength(120);
  });
});

describe("system dictionary", () => {
  it("writes Swiss German: ss, never the sharp s", () => {
    expect(JSON.stringify(system.de)).not.toMatch(/\u00df/);
    expect(JSON.stringify(system.en)).not.toMatch(/\u00df/);
  });
});
