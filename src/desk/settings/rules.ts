import { formatChf, parseChf } from "@/lib/format";
import type { Settings } from "@/store/types";

export type SettingsDraft = {
  shopName: string; legalName: string; address: string; email: string; phone: string;
  shipping: string; freeFrom: string; lowStock: string; hold: string; trackingLink: string;
  vatEnabled: boolean; notifyNewOrder: boolean; notifyLowStock: boolean; notifyInboxHigh: boolean; notifyWatchdogFail: boolean;
};

export type SettingsErrorKey = "shopNameMissing" | "shopNameLong" | "legalNameLong" | "addressLong" | "emailInvalid" | "phoneLong" | "shippingInvalid" | "freeFromInvalid" | "wholeNumbers" | "holdRange" | "trackingInvalid";
export type SettingsErrors = Partial<Record<keyof SettingsDraft, SettingsErrorKey>>;

const toChf = (rappen: number) => (rappen / 100).toFixed(2);

export function draftOf(s: Settings): SettingsDraft {
  return {
    shopName: s.shopName, legalName: s.legalName, address: s.address, email: s.email, phone: s.phone,
    shipping: toChf(s.shippingRappen), freeFrom: toChf(s.freeShippingThresholdRappen), lowStock: String(s.lowStockDefault), hold: String(s.holdMinutes), trackingLink: s.trackingLink,
    vatEnabled: s.vatEnabled, notifyNewOrder: s.notifyNewOrder, notifyLowStock: s.notifyLowStock, notifyInboxHigh: s.notifyInboxHigh, notifyWatchdogFail: s.notifyWatchdogFail,
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WHOLE = /^\d+$/;

/** https only, holds `{tracking}`, at most 300 characters. */
export function trackingLinkOk(link: string): boolean {
  const value = link.trim();
  if (value.length === 0 || value.length > 300 || !value.includes("{tracking}")) return false;
  try {
    return new URL(value.replaceAll("{tracking}", "x")).protocol === "https:";
  } catch {
    return false;
  }
}

function moneyInRange(text: string, max: number): number | null {
  const rappen = parseChf(text);
  return rappen === null || rappen < 0 || rappen > max ? null : rappen;
}

export type SettingsPatch = Omit<Settings, "inboxRetentionDays" | "updatedAt" | "updatedBy">;

export function checkSettings(d: SettingsDraft): { errors: SettingsErrors; patch: SettingsPatch | null } {
  const errors: SettingsErrors = {};
  const shopName = d.shopName.trim();
  const legalName = d.legalName.trim();
  const address = d.address.trim();
  const email = d.email.trim();
  const phone = d.phone.trim();
  if (!shopName) errors.shopName = "shopNameMissing";
  else if (shopName.length > 80) errors.shopName = "shopNameLong";
  if (legalName.length > 120) errors.legalName = "legalNameLong";
  if (address.length > 300) errors.address = "addressLong";
  if (email.length > 120 || !EMAIL.test(email)) errors.email = "emailInvalid";
  if (phone.length > 40) errors.phone = "phoneLong";
  const shipping = moneyInRange(d.shipping, 100_000);
  if (shipping === null) errors.shipping = "shippingInvalid";
  const freeFrom = moneyInRange(d.freeFrom, 10_000_000);
  if (freeFrom === null) errors.freeFrom = "freeFromInvalid";
  const lowStock = Number(d.lowStock.trim());
  if (!WHOLE.test(d.lowStock.trim()) || lowStock > 1000) errors.lowStock = "wholeNumbers";
  const hold = Number(d.hold.trim());
  if (!WHOLE.test(d.hold.trim())) errors.hold = "wholeNumbers";
  else if (hold < 30 || hold > 1440) errors.hold = "holdRange";
  if (!trackingLinkOk(d.trackingLink)) errors.trackingLink = "trackingInvalid";
  if (Object.keys(errors).length > 0) return { errors, patch: null };
  return {
    errors,
    patch: {
      shopName, legalName, address, email, phone,
      shippingRappen: shipping as number, freeShippingThresholdRappen: freeFrom as number, lowStockDefault: lowStock, holdMinutes: hold, trackingLink: d.trackingLink.trim(),
      vatEnabled: d.vatEnabled, notifyNewOrder: d.notifyNewOrder, notifyLowStock: d.notifyLowStock, notifyInboxHigh: d.notifyInboxHigh, notifyWatchdogFail: d.notifyWatchdogFail,
    },
  };
}

export type QuotePreview =
  | { kind: "threshold"; below: string; shipping: string; from: string; trackingNumber: string; trackingExample: string | null }
  | { kind: "no_shipping" | "all_free"; trackingNumber: string; trackingExample: string | null };

const SAMPLE_TRACKING = "BP123456785ZZ";

/** What the draft would quote: an order just under the free-shipping line, and where tracking opens. Null while the money fields are not readable. */
export function previewQuote(d: Pick<SettingsDraft, "shipping" | "freeFrom" | "trackingLink">): QuotePreview | null {
  const shipping = moneyInRange(d.shipping, 100_000);
  const freeFrom = moneyInRange(d.freeFrom, 10_000_000);
  if (shipping === null || freeFrom === null) return null;
  const trackingExample = trackingLinkOk(d.trackingLink) ? d.trackingLink.trim().replaceAll("{tracking}", SAMPLE_TRACKING).replace(/^[a-z]+:\/\//i, "") : null;
  const tail = { trackingNumber: SAMPLE_TRACKING, trackingExample };
  if (shipping === 0) return { kind: "no_shipping", ...tail };
  if (freeFrom === 0) return { kind: "all_free", ...tail };
  return { kind: "threshold", below: formatChf(freeFrom - 5), shipping: formatChf(shipping), from: formatChf(freeFrom), ...tail };
}

export type MemberDraft = { name: string; initials: string; role: string; isActive: boolean };
export type MemberErrorKey = "nameMissing" | "nameLong" | "initialsInvalid" | "roleLong" | "reserved";
export type MemberErrors = Partial<Record<"name" | "initials" | "role", MemberErrorKey>>;

const RESERVED_NAME = "superuser";
const RESERVED_INITIALS = "SU";

/** Name 1 to 60, initials 1 or 2 letters A to Z, role up to 80. Nobody may take superUser's name or initials. */
export function checkMember(d: MemberDraft): MemberErrors {
  const errors: MemberErrors = {};
  const name = d.name.trim();
  const initials = d.initials.trim().toUpperCase();
  if (!name) errors.name = "nameMissing";
  else if (name.length > 60) errors.name = "nameLong";
  else if (name.toLowerCase() === RESERVED_NAME) errors.name = "reserved";
  if (!/^[A-Z]{1,2}$/.test(initials)) errors.initials = "initialsInvalid";
  else if (initials === RESERVED_INITIALS) errors.initials = "reserved";
  if (d.role.trim().length > 80) errors.role = "roleLong";
  return errors;
}
