import type { Profile, Tier } from "@/store/types";

export const PROJECT = {
  title: "Commerce Platform",
  description: "A real online shop and the 53-screen staff system behind it, rebuilt as a static showcase for the fictional label Aerloom.",
  repo: "example/commerce-platform",
};

export const LABEL = {
  name: "Aerloom",
  tagline: { en: "Woven from thin air.", de: "Aus dünner Luft gewoben." },
};

export const ORDER_PREFIX = "AL-";
export const FIRST_SEEDED_ORDER = 1001;
export const LAST_SEEDED_ORDER = 1150;
export const STORY_ORDER = "AL-1150";
export const FIRST_NEW_ORDER = 1151;

export const SKU_PREFIX = "AL-";
export const RETURN_PREFIX = "R-";
export const PO_PREFIX = "PO-";

export const CARRIER = {
  name: "Beispielpost",
  trackingPrefix: "BP",
  trackingSuffix: "ZZ",
  trackingExample: "BP123456785ZZ",
  checkWeights: [8, 6, 4, 2, 3, 5, 9, 7],
};

export const SHOP_DOMAIN = "shop.example.com";
export const SUPPORT_EMAIL = "support@example.com";
export const customerEmail = (first: string, last: string) => `${first}.${last}@example.com`.toLowerCase();

export const PHONE = "+41 00 000 00 00";
export const STREETS = ["Beispielstrasse 12", "Musterweg 4", "Testgasse 7", "Probeplatz 3"];
export const POSTCODES = ["1000", "2000", "3000", "4000", "5000", "6000", "7000", "8000", "9000"];
export const CITIES = ["Musterstadt", "Beispielwil", "Testikon", "Probdorf"];

export const ACCOUNT_ID = "acct_demo_1";
export const checkoutSessionId = (n: number) => `cs_demo_${n}`;
export const eventId = (n: number) => `evt_demo_${n}`;

export const CHECKOUT_DEFAULTS = {
  fullName: "Anna Muster",
  email: "anna.muster@example.com",
  phone: PHONE,
  line1: "Beispielstrasse 12",
  postalCode: "9999",
  city: "Musterstadt",
  countryCode: "CH",
};

export type TeamMember = {
  profile: Exclude<Profile, "superUser">;
  name: string;
  initials: string;
  role: { en: string; de: string };
  profileLabel: string;
  tier: Tier;
};

export const TEAM: TeamMember[] = [
  { profile: "owner", name: "Mara Keller", initials: "MK", role: { en: "Studio lead", de: "Studioleitung" }, profileLabel: "Owner", tier: "full" },
  { profile: "finance", name: "Jonas Aebi", initials: "JA", role: { en: "Books and payouts", de: "Buchhaltung und Auszahlungen" }, profileLabel: "Finance", tier: "partner" },
  { profile: "warehouse", name: "Lea Brunner", initials: "LB", role: { en: "Parcels and stock", de: "Pakete und Lager" }, profileLabel: "Warehouse", tier: "partner" },
  { profile: "studio", name: "Nico Steiner", initials: "NS", role: { en: "Range and samples", de: "Sortiment und Muster" }, profileLabel: "Studio", tier: "partner" },
];

export const SUPER_USER = { profile: "superUser" as const, name: "superUser", tier: "super" as const };

export const DEFAULT_PROFILE: Profile = "owner";

/** Browser storage keys. The crawl seeds these in its init script, so they stay here and nowhere else. */
export const STORAGE_KEYS = { lang: "cp-lang", profile: "cp-profile" };
