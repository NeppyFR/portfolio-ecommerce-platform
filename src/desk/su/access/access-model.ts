import { screenById, type Screen, type ScreenId } from "@/desk/registry";
import { addDays } from "@/lib/dates";
import { canAccess, DEFAULT_GRANTS, isSwitchActive, SWITCHABLE_FEATURES } from "@/lib/features";
import type { FeatureSwitch, IsoDay, Person, SwitchableFeature } from "@/store/types";

/**
 * Staging for the feature matrix. Nothing here touches the store: `staged` is what the page holds until
 * Review and save, and `ends` is the last day chosen for a staged cell.
 */
export type Staged = Record<string, boolean>;
export type Ends = Record<string, IsoDay | null>;

/** The matrix columns: the three partners, then the owner. */
export const SWITCH_PROFILES: Person[] = ["finance", "warehouse", "studio", "owner"];
export const MONEY_FEATURES: SwitchableFeature[] = ["orders", "discounts", "finances"];
export const PERSONAL_FEATURES: SwitchableFeature[] = ["orders", "customers", "inbox"];
export const MAX_END_DAYS = 365;

export const cellKey = (profile: Person, feature: SwitchableFeature) => `${profile}:${feature}`;
const parseKey = (key: string) => key.split(":") as [Person, SwitchableFeature];

export const defaultOn = (profile: Person, feature: SwitchableFeature): boolean => DEFAULT_GRANTS[profile].includes(feature);
const rowOf = (switches: FeatureSwitch[], profile: Person, feature: SwitchableFeature) => switches.find((s) => s.profile === profile && s.feature === feature);

/** Flipping a cell back to what the profile has now removes the staged change. */
export function stage(staged: Staged, profile: Person, feature: SwitchableFeature, value: boolean, switches: FeatureSwitch[], today: IsoDay): Staged {
  const key = cellKey(profile, feature);
  const next = { ...staged };
  if (value === canAccess(profile, feature, switches, today)) delete next[key];
  else next[key] = value;
  return next;
}

/** What the switch shows: the staged value if there is one, else what the profile has now. */
export function cellValue(staged: Staged, profile: Person, feature: SwitchableFeature, switches: FeatureSwitch[], today: IsoDay): boolean {
  return staged[cellKey(profile, feature)] ?? canAccess(profile, feature, switches, today);
}

/**
 * A staged change may carry an end day only if the end would bring back what the profile has now.
 * A cell that already has a running end day cannot, because that end would be lost.
 */
export function endable(profile: Person, feature: SwitchableFeature, value: boolean, switches: FeatureSwitch[], today: IsoDay): boolean {
  const row = rowOf(switches, profile, feature);
  if (row && row.until !== null && isSwitchActive(row, today)) return false;
  const current = canAccess(profile, feature, switches, today);
  if (value === current) return false;
  const afterEnd = profile === "owner" ? !value : defaultOn(profile, feature);
  return afterEnd === current;
}

export type Change = { key: string; profile: Person; feature: SwitchableFeature; on: boolean; toDefault: boolean; canEnd: boolean };

export function changesOf(staged: Staged, switches: FeatureSwitch[], today: IsoDay): Change[] {
  const order = (c: Change) => SWITCH_PROFILES.indexOf(c.profile) * 100 + SWITCHABLE_FEATURES.indexOf(c.feature);
  return Object.entries(staged)
    .map(([key, on]) => {
      const [profile, feature] = parseKey(key);
      return { key, profile, feature, on, toDefault: on === defaultOn(profile, feature), canEnd: endable(profile, feature, on, switches, today) };
    })
    .sort((a, b) => order(a) - order(b));
}

/**
 * The full list to store. Staged cells as chosen (back to default with no end day drops the row),
 * other running rows unchanged, ended rows written as what they left behind.
 */
export function finalSwitches(staged: Staged, ends: Ends, switches: FeatureSwitch[], today: IsoDay): FeatureSwitch[] {
  const out: FeatureSwitch[] = [];
  const seen = new Set<string>();
  for (const [key, on] of Object.entries(staged)) {
    const [profile, feature] = parseKey(key);
    seen.add(key);
    const until = ends[key] ?? null;
    if (until === null && on === defaultOn(profile, feature)) continue;
    out.push({ profile, feature, on, until });
  }
  for (const row of switches) {
    const key = cellKey(row.profile, row.feature);
    if (seen.has(key)) continue;
    if (isSwitchActive(row, today)) {
      out.push(row);
      continue;
    }
    const left = row.profile === "owner" ? !row.on : defaultOn(row.profile, row.feature);
    if (left !== defaultOn(row.profile, row.feature)) out.push({ profile: row.profile, feature: row.feature, on: left, until: null });
  }
  return out;
}

/** The features a profile would hold once these staged cells are saved. */
export function previewFeatures(profile: Person, staged: Staged, switches: FeatureSwitch[], today: IsoDay): SwitchableFeature[] {
  const next = finalSwitches(staged, {}, switches, today);
  return SWITCHABLE_FEATURES.filter((f) => canAccess(profile, f, next, today));
}

/** The owner keeps Settings and System, so only a partner can end up with no page. */
export function leavesNoPages(profile: Person, staged: Staged, switches: FeatureSwitch[], today: IsoDay): boolean {
  return profile !== "owner" && previewFeatures(profile, staged, switches, today).length === 0;
}

/** What Reset would switch on and off for this profile. */
export function resetEffects(profile: Person, switches: FeatureSwitch[], today: IsoDay): { on: SwitchableFeature[]; off: SwitchableFeature[] } {
  const on: SwitchableFeature[] = [];
  const off: SwitchableFeature[] = [];
  for (const feature of SWITCHABLE_FEATURES) {
    const current = canAccess(profile, feature, switches, today);
    const back = defaultOn(profile, feature);
    if (current !== back) (back ? on : off).push(feature);
  }
  return { on, off };
}

export const hasSwitches = (profile: Person, switches: FeatureSwitch[]): boolean => switches.some((s) => s.profile === profile);

export type CellStatus = { kind: "default" | "changed" | "until" | "ended" | "staged"; day: IsoDay | null };

export function cellStatus(staged: Staged, profile: Person, feature: SwitchableFeature, switches: FeatureSwitch[], today: IsoDay): CellStatus {
  if (cellKey(profile, feature) in staged) return { kind: "staged", day: null };
  const row = rowOf(switches, profile, feature);
  if (!row) return { kind: "default", day: null };
  if (!isSwitchActive(row, today)) return { kind: "ended", day: row.until };
  if (row.until !== null) return { kind: "until", day: row.until };
  return { kind: row.on === defaultOn(profile, feature) ? "default" : "changed", day: null };
}

/** The last day is a shop day between today and a year from today. */
export const endDayBounds = (today: IsoDay) => ({ min: today, max: addDays(today, MAX_END_DAYS) });
export function endDayOk(day: string | null | undefined, today: IsoDay): boolean {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const { min, max } = endDayBounds(today);
  return day >= min && day <= max;
}

/** A change ending today or tomorrow reads as ending soon. */
export const endsSoon = (until: IsoDay, today: IsoDay): boolean => until >= today && until <= addDays(today, 1);

/* Grouped as the sidebar groups them, for the matrix and the phone list. */
export type FeatureGroup = { id: "shop" | "growth" | "workspace"; features: SwitchableFeature[] };
export const FEATURE_GROUPS: FeatureGroup[] = [
  { id: "shop", features: ["products", "inventory", "orders", "customers", "discounts", "drops"] },
  { id: "growth", features: ["analytics", "marketing", "inbox"] },
  { id: "workspace", features: ["files", "calendar", "tasks", "finances", "production"] },
];

export type RailGroupId = "shop" | "growth" | "workspace" | "system";
const RAIL_GROUPS: { id: RailGroupId; screens: ScreenId[] }[] = [
  { id: "shop", screens: ["dashboard", "products", "inventory", "orders", "customers", "discounts", "drops"] },
  { id: "growth", screens: ["analytics", "marketing", "inbox"] },
  { id: "workspace", screens: ["files", "calendar", "checklist", "ledger", "production"] },
  { id: "system", screens: ["system", "settings"] },
];

export type RailScreen = { screen: Screen; open: boolean };
export type RailGroup = { id: RailGroupId; screens: RailScreen[] };

/** The sidebar this profile would get with these staged cells, open or locked. superUser's own item stays hidden from them. */
export function previewRail(profile: Person, staged: Staged, switches: FeatureSwitch[], today: IsoDay): RailGroup[] {
  const next = finalSwitches(staged, {}, switches, today);
  return RAIL_GROUPS.map((group) => ({
    id: group.id,
    screens: group.screens.map((id) => {
      const screen = screenById(id);
      return { screen, open: canAccess(profile, screen.feature, next, today) };
    }),
  }));
}

/** How the preview differs from this profile's default: what it gains and what it loses. */
export function previewDiff(profile: Person, staged: Staged, switches: FeatureSwitch[], today: IsoDay): { gains: SwitchableFeature[]; loses: SwitchableFeature[] } {
  const held = previewFeatures(profile, staged, switches, today);
  return {
    gains: held.filter((f) => !defaultOn(profile, f)),
    loses: SWITCHABLE_FEATURES.filter((f) => defaultOn(profile, f) && !held.includes(f)),
  };
}
