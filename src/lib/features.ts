import { DEMO_TODAY } from "@/store/clock";
import type { FeatureKey, FeatureSwitch, Person, Profile, SwitchableFeature, Tier } from "@/store/types";

export const SWITCHABLE_FEATURES: SwitchableFeature[] = [
  "drops", "products", "inventory", "orders", "customers", "discounts",
  "analytics", "marketing", "inbox",
  "files", "calendar", "tasks", "finances", "production",
];

export const FIXED_FEATURES: FeatureKey[] = ["settings", "it", "superadmin", "shell"];

export const DEFAULT_GRANTS: Record<Person, SwitchableFeature[]> = {
  owner: SWITCHABLE_FEATURES,
  finance: ["finances", "orders", "inventory", "drops", "analytics", "files", "calendar", "tasks", "production"],
  warehouse: ["orders", "inventory", "products", "production", "drops", "files", "calendar", "tasks"],
  studio: ["drops", "products", "production", "marketing", "inbox", "files", "calendar", "tasks"],
};

export function tierOf(profile: Profile): Tier {
  if (profile === "superUser") return "super";
  return profile === "owner" ? "full" : "partner";
}

const isSwitchable = (feature: FeatureKey): feature is SwitchableFeature => (SWITCHABLE_FEATURES as FeatureKey[]).includes(feature);

/** A switch's last day counts in full; it has ended only once that day has passed. */
export const isSwitchActive = (sw: Pick<FeatureSwitch, "until">, today: string): boolean => sw.until === null || sw.until >= today;

/**
 * The one access question. An active switch decides. After a switch ends, a partner falls back to
 * the code default, and the owner to the opposite of what the switch said.
 * Fixed features ignore switches, so Settings and System can never leave the owner.
 */
export function canAccess(profile: Profile, feature: FeatureKey, switches: FeatureSwitch[] = [], today: string = DEMO_TODAY): boolean {
  if (feature === "shell") return true;
  const tier = tierOf(profile);
  if (tier === "super") return true;
  if (feature === "superadmin") return false;
  if (feature === "settings" || feature === "it") return tier === "full";
  if (!isSwitchable(feature)) return false;
  const person = profile as Person;
  const row = switches.find((s) => s.profile === person && s.feature === feature);
  if (row) {
    if (isSwitchActive(row, today)) return row.on;
    return person === "owner" ? !row.on : DEFAULT_GRANTS[person].includes(feature);
  }
  return DEFAULT_GRANTS[person].includes(feature);
}

/** Erasing a customer, a drop's waitlist addresses, cost prices, CSV exports and the email preview. */
export const hasFullPowers = (profile: Profile): boolean => tierOf(profile) !== "partner";
