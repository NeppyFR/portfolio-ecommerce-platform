import { MonitorCog, Wallet, type LucideIcon } from "lucide-react";
import { regionScreens, screenById, subScreens, type Screen, type ScreenId } from "@/desk/registry";
import type { FeatureKey, Lang } from "@/store/types";

export type NavGroupId = "main" | "growth" | "workspace" | "system";
export type NavItemId = "dashboard" | "products" | "inventory" | "orders" | "customers" | "discounts" | "drops" | "analytics" | "marketing" | "inbox" | "files" | "calendar" | "checklist" | "finances" | "production" | "it" | "settings" | "su";

export type NavItem = {
  id: NavItemId;
  /** The screen this item opens. */
  screen: ScreenId;
  route: string;
  icon: LucideIcon;
  en: string;
  de: string;
  feature: FeatureKey;
  superUserOnly: boolean;
};

export type NavGroup = { id: NavGroupId; en: string; de: string; items: NavItem[] };

function fromScreen(id: NavItemId, screenId: ScreenId, over?: { en: string; de: string; icon: LucideIcon }): NavItem {
  const screen = screenById(screenId);
  return {
    id,
    screen: screenId,
    route: screen.route,
    icon: over?.icon ?? screen.icon,
    en: over?.en ?? screen.en,
    de: over?.de ?? screen.de,
    feature: screen.feature,
    superUserOnly: screen.superUserOnly ?? false,
  };
}

/** The sidebar, top to bottom. The registry stays the list of screens; this file only says where each one sits. */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "main",
    en: "Shop",
    de: "Shop",
    items: [
      fromScreen("dashboard", "dashboard"),
      fromScreen("products", "products"),
      fromScreen("inventory", "inventory"),
      fromScreen("orders", "orders"),
      fromScreen("customers", "customers"),
      fromScreen("discounts", "discounts"),
      fromScreen("drops", "drops"),
    ],
  },
  { id: "growth", en: "Growth", de: "Wachstum", items: [fromScreen("analytics", "analytics"), fromScreen("marketing", "marketing"), fromScreen("inbox", "inbox")] },
  {
    id: "workspace",
    en: "Workspace",
    de: "Arbeitsbereich",
    items: [
      fromScreen("files", "files"),
      fromScreen("calendar", "calendar"),
      fromScreen("checklist", "checklist"),
      fromScreen("finances", "ledger", { en: "Finances", de: "Finanzen", icon: Wallet }),
      fromScreen("production", "production"),
    ],
  },
  {
    id: "system",
    en: "System",
    de: "System",
    items: [fromScreen("it", "system", { en: "IT", de: "IT", icon: MonitorCog }), fromScreen("settings", "settings"), fromScreen("su", "su")],
  },
];

const ITEMS = new Map<NavItemId, NavItem>(NAV_GROUPS.flatMap((group) => group.items).map((item) => [item.id, item]));

export function navItem(id: NavItemId): NavItem {
  const item = ITEMS.get(id);
  if (!item) throw new Error(`Unknown nav item ${id}`);
  return item;
}

function navIdFor(screen: Screen): NavItemId | null {
  const top = screen.parent ?? screen.id;
  if (screen.id === "dashboard") return "dashboard";
  if (screen.region === "finance") return "finances";
  if (top === "settings") return "settings";
  if (top === "su") return "su";
  if (screen.region === "system") return "it";
  if (top === "enter" || screen.outsideShell) return null;
  return top as NavItemId;
}

/** The sidebar item a screen lights up. */
export function navItemFor(screen: Screen): NavItem | null {
  const id = navIdFor(screen);
  return id ? navItem(id) : null;
}

/** The group a screen sits in: the word the jump box prints beside it. */
export function navGroupFor(screen: Screen): NavGroup | null {
  const id = navIdFor(screen);
  return id ? (NAV_GROUPS.find((group) => group.items.some((item) => item.id === id)) ?? null) : null;
}

/** The pill row under the header, the area's home first. Empty on a screen without sub-screens. */
export function subNavOf(id: ScreenId): Screen[] {
  const screen = screenById(id);
  if (screen.region === "finance") return regionScreens("finance");
  if (navIdFor(screen) === "it") return regionScreens("system").filter((s) => s.id !== "settings" && s.id !== "su");
  return subScreens(id);
}

/** The plain name in the header. IT reads differently now that the sidebar names it. */
export function screenName(screen: Screen, lang: Lang): string {
  if (screen.id === "system") return navItem("it")[lang];
  return screen[lang];
}

export type DockId = "dashboard" | "orders" | "products" | "finances" | "more";

/** The phone's thumb dock. Everything else lives behind More, which opens the sidebar as a drawer. */
export const DOCK_ITEMS: NavItemId[] = ["dashboard", "orders", "products", "finances"];

export function dockActive(screen: Screen): DockId {
  const id = navIdFor(screen);
  return id === "dashboard" || id === "orders" || id === "products" || id === "finances" ? id : "more";
}
