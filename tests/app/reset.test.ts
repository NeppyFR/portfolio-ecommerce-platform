import { beforeEach, describe, expect, it } from "vitest";
import { isUnread, markAllSeen, type BellRow } from "@/desk/shell/notifications";
import { addOne } from "@/store/actions/bag";
import { resortMail, whyOf } from "@/store/actions/inbox";
import { pendingDelivery, scanDelivery } from "@/store/actions/inventory";
import { packStateOf, scanIntoBox } from "@/store/actions/orders";
import { getFailedSource, setFailedSource } from "@/store/actions/system";
import { addTask } from "@/store/actions/tasks";
import { getState, resetStore, update } from "@/store/core";
import { nextOrderNumber } from "@/store/flows";
import { createSeed } from "@/store/seed";
import type { State } from "@/store/types";

beforeEach(() => resetStore());

describe("Reset this demo", () => {
  it("restores every slice of the store to the seed", () => {
    const seed = createSeed();
    const keys = Object.keys(seed) as (keyof State)[];
    expect(keys.length).toBeGreaterThan(20);
    update((s) => {
      const broken = { ...s } as Record<string, unknown>;
      for (const key of keys) {
        const value = s[key];
        broken[key] = Array.isArray(value) ? [] : typeof value === "object" && value !== null ? {} : "changed";
      }
      return broken as unknown as State;
    });
    for (const key of keys) expect(getState()[key]).not.toEqual(seed[key]);
    resetStore();
    expect(getState()).toEqual(seed);
  });

  it("restores what real actions changed", () => {
    const seed = createSeed();
    const variant = seed.products.find((p) => p.status === "active")?.variants.find((v) => v.stock > 0);
    expect(variant).toBeTruthy();
    addOne((variant as { id: string }).id);
    addTask(seed.taskLists[0].id, "A new task");
    expect(getState()).not.toEqual(seed);
    resetStore();
    expect(getState()).toEqual(seed);
  });

  it("clears the module-level state outside the store", () => {
    const seed = createSeed();
    const mail = seed.inbox[0];
    const paid = seed.orders.find((o) => o.status === "paid");
    const sku = paid?.items[0].sku as string;

    resortMail(mail.id, { category: "customer_support", priority: "P3", why: "Not urgent" });
    expect(whyOf(mail.id)).toBe("Not urgent");
    scanDelivery(sku);
    expect(pendingDelivery().lines.length).toBeGreaterThan(0);
    scanIntoBox(paid?.orderNumber as string, sku);
    expect(Object.keys(packStateOf(paid?.orderNumber as string)).length).toBeGreaterThan(0);
    const scanned = packStateOf(paid?.orderNumber as string);
    setFailedSource("database");
    expect(getFailedSource()).toBe("database");
    const row = { key: "demo", signature: "1" } as unknown as BellRow;
    markAllSeen("owner", [row]);
    expect(isUnread("owner", row)).toBe(false);
    const first = nextOrderNumber();

    resetStore();

    expect(whyOf(mail.id)).toBeUndefined();
    expect(pendingDelivery().lines).toHaveLength(0);
    expect(packStateOf(paid?.orderNumber as string)).not.toBe(scanned);
    expect(getFailedSource()).toBeNull();
    expect(isUnread("owner", row)).toBe(true);
    expect(nextOrderNumber(false)).toBe(first);
  });

  it("restarts the id counters, so a repeat of the same steps gives the same ids", () => {
    const listId = getState().taskLists[0].id;
    const make = () => {
      const made = addTask(listId, "A new task");
      return made.ok ? made.data.id : "refused";
    };
    const one = make();
    expect(one).not.toBe("refused");
    resetStore();
    expect(make()).toBe(one);
  });
});
