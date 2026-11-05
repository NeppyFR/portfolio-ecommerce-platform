import {
  Boxes, CalendarDays, ChartColumn, ClipboardList, CreditCard, Database, Factory, FileSpreadsheet,
  FolderOpen, GitBranch, Hammer, HeartPulse, History, House, Inbox, KeyRound, Layers, ListChecks, Mail, Map as MapIcon, Megaphone,
  MonitorCog, Package, Printer, Receipt, ReceiptText, Rocket, Settings, ShieldAlert, ShieldCheck, ShieldUser,
  SlidersHorizontal, Tag, Tags, ToggleRight, TriangleAlert, Undo2, UserCog, Users,
  UsersRound, Wallet, Waypoints, type LucideIcon,
} from "lucide-react";
import type { FeatureKey, NodeId } from "@/store/types";

export type RegionId = "commerce" | "growth" | "work" | "finance" | "system";

export type ScreenId =
  | "overview" | "built"
  | "dashboard" | "enter"
  | "drops" | "products" | "collections" | "inventory" | "orders" | "returns" | "customers" | "discounts"
  | "analytics" | "marketing" | "inbox"
  | "files" | "calendar" | "checklist" | "production"
  | "ledger" | "costs" | "reports" | "refunds" | "stockcount"
  | "system" | "map" | "health" | "database" | "payments" | "email" | "security" | "config" | "deploys" | "ci" | "activity"
  | "settings" | "team"
  | "su" | "su-access" | "su-team" | "su-security" | "su-danger"
  | "slip" | "labels";

export type Screen = {
  id: ScreenId;
  region: RegionId | null;
  /** Second-level screen: it shows in the parent's pill row, not in the sidebar. */
  parent?: ScreenId;
  route: string;
  icon: LucideIcon;
  en: string;
  de: string;
  touches: NodeId[];
  feature: FeatureKey;
  /** Printed outside the desk shell. */
  outsideShell?: boolean;
  /** Tabs hidden unless the profile is superUser; a direct link shows the locked state. */
  superUserOnly?: boolean;
  /** A public page shown inside the desk shell: its own headline is the page title, and it runs edge to edge. */
  page?: boolean;
};

export const ALL_NODES: NodeId[] = ["customers", "staff", "mail", "dns", "code", "payments", "app", "files", "database", "inbox", "mailbox"];
export const LIVE_NODES: NodeId[] = ["database", "payments", "mail", "inbox"];

export const SCREENS: Screen[] = [
  { id: "overview", region: null, route: "/", icon: Waypoints, en: "Overview", de: "Übersicht", touches: [], feature: "shell", page: true },
  { id: "built", region: null, route: "/built/", icon: Hammer, en: "How it was built", de: "So ist es gebaut", touches: [], feature: "shell", page: true },
  { id: "dashboard", region: null, route: "/desk/", icon: House, en: "Dashboard", de: "Dashboard", touches: ["app", "database"], feature: "shell" },
  { id: "enter", region: null, route: "/desk/enter/", icon: UserCog, en: "Who are you?", de: "Wer bist du?", touches: ["app"], feature: "shell" },

  { id: "drops", region: "commerce", route: "/desk/drops/", icon: Rocket, en: "Drops", de: "Drops", touches: ["app", "database"], feature: "drops" },
  { id: "products", region: "commerce", route: "/desk/products/", icon: Package, en: "Products", de: "Produkte", touches: ["app", "database"], feature: "products" },
  { id: "collections", region: "commerce", parent: "products", route: "/desk/products/collections/", icon: Layers, en: "Collections", de: "Kollektionen", touches: ["app", "database"], feature: "products" },
  { id: "inventory", region: "commerce", route: "/desk/inventory/", icon: Boxes, en: "Inventory", de: "Lager", touches: ["app", "database"], feature: "inventory" },
  { id: "orders", region: "commerce", route: "/desk/orders/", icon: ReceiptText, en: "Orders", de: "Bestellungen", touches: ["payments", "app", "database", "mail"], feature: "orders" },
  { id: "returns", region: "commerce", parent: "orders", route: "/desk/orders/returns/", icon: Undo2, en: "Returns", de: "Retouren", touches: ["app", "database"], feature: "orders" },
  { id: "customers", region: "commerce", route: "/desk/customers/", icon: Users, en: "Customers", de: "Kundschaft", touches: ["app", "database"], feature: "customers" },
  { id: "discounts", region: "commerce", route: "/desk/discounts/", icon: Tag, en: "Discounts", de: "Rabatte", touches: ["app", "database"], feature: "discounts" },

  { id: "analytics", region: "growth", route: "/desk/analytics/", icon: ChartColumn, en: "Analytics", de: "Auswertungen", touches: ["app", "database"], feature: "analytics" },
  { id: "marketing", region: "growth", route: "/desk/marketing/", icon: Megaphone, en: "Marketing", de: "Marketing", touches: ["app", "database"], feature: "marketing" },
  { id: "inbox", region: "growth", route: "/desk/inbox/", icon: Inbox, en: "Inbox", de: "Posteingang", touches: ["inbox", "mailbox", "database"], feature: "inbox" },

  { id: "files", region: "work", route: "/desk/files/", icon: FolderOpen, en: "Files", de: "Dateiablage", touches: ["app", "files"], feature: "files" },
  { id: "calendar", region: "work", route: "/desk/calendar/", icon: CalendarDays, en: "Calendar", de: "Kalender", touches: ["app", "database"], feature: "calendar" },
  { id: "checklist", region: "work", route: "/desk/checklist/", icon: ListChecks, en: "Checklist", de: "Checkliste", touches: ["app", "database"], feature: "tasks" },
  { id: "production", region: "work", route: "/desk/production/", icon: Factory, en: "Production", de: "Produktion", touches: ["app", "database"], feature: "production" },

  { id: "ledger", region: "finance", route: "/desk/finance/", icon: Wallet, en: "Ledger", de: "Buch", touches: ["app", "database", "files"], feature: "finances" },
  { id: "costs", region: "finance", route: "/desk/finance/costs/", icon: Receipt, en: "Running costs", de: "Laufende Kosten", touches: ["app", "database"], feature: "finances" },
  { id: "reports", region: "finance", route: "/desk/finance/reports/", icon: FileSpreadsheet, en: "Quarterly report", de: "Quartalsbericht", touches: ["app", "database"], feature: "finances" },
  { id: "refunds", region: "finance", route: "/desk/finance/refunds/", icon: Undo2, en: "Refunds", de: "Rückerstattungen", touches: ["payments", "database"], feature: "finances" },
  { id: "stockcount", region: "finance", route: "/desk/finance/stock-count/", icon: ClipboardList, en: "Stock count", de: "Inventur", touches: ["app", "database"], feature: "finances" },

  { id: "system", region: "system", route: "/desk/system/", icon: MonitorCog, en: "Overview", de: "Überblick", touches: LIVE_NODES, feature: "it" },
  { id: "map", region: "system", route: "/desk/system/map/", icon: MapIcon, en: "Hosting map", de: "Hosting-Karte", touches: ALL_NODES, feature: "it" },
  { id: "health", region: "system", route: "/desk/system/health/", icon: HeartPulse, en: "Health", de: "Zustand", touches: ["code", "app", "database"], feature: "it" },
  { id: "database", region: "system", route: "/desk/system/database/", icon: Database, en: "Database", de: "Datenbank", touches: ["database"], feature: "it" },
  { id: "payments", region: "system", route: "/desk/system/payments/", icon: CreditCard, en: "Payments", de: "Zahlungen", touches: ["payments", "app", "database"], feature: "it" },
  { id: "email", region: "system", route: "/desk/system/email/", icon: Mail, en: "Email", de: "E-Mail", touches: ["mail", "inbox", "mailbox"], feature: "it" },
  { id: "security", region: "system", route: "/desk/system/security/", icon: ShieldCheck, en: "Security", de: "Sicherheit", touches: ["dns", "app", "database"], feature: "it" },
  { id: "config", region: "system", route: "/desk/system/config/", icon: SlidersHorizontal, en: "Config", de: "Konfiguration", touches: ["app"], feature: "it" },
  { id: "deploys", region: "system", route: "/desk/system/deploys/", icon: Rocket, en: "Deploys", de: "Deploys", touches: ["code", "app"], feature: "it" },
  { id: "ci", region: "system", route: "/desk/system/ci/", icon: GitBranch, en: "Code and CI", de: "Code und CI", touches: ["code"], feature: "it" },
  { id: "activity", region: "system", route: "/desk/system/activity/", icon: History, en: "Activity", de: "Aktivität", touches: ["app", "database"], feature: "it" },
  { id: "settings", region: "system", route: "/desk/settings/", icon: Settings, en: "Settings", de: "Einstellungen", touches: ["app", "database"], feature: "settings" },
  { id: "team", region: "system", parent: "settings", route: "/desk/settings/team/", icon: UsersRound, en: "Team", de: "Team", touches: ["app", "database"], feature: "settings" },

  { id: "su", region: "system", route: "/desk/su/", icon: ShieldUser, en: "superUser", de: "superUser", touches: ["app", "database"], feature: "superadmin", superUserOnly: true },
  { id: "su-access", region: "system", parent: "su", route: "/desk/su/access/", icon: ToggleRight, en: "Feature access", de: "Funktionszugriff", touches: ["app", "database"], feature: "superadmin", superUserOnly: true },
  { id: "su-team", region: "system", parent: "su", route: "/desk/su/team/", icon: KeyRound, en: "Team and sign-in", de: "Team und Anmeldung", touches: ["app", "database"], feature: "superadmin", superUserOnly: true },
  { id: "su-security", region: "system", parent: "su", route: "/desk/su/security/", icon: ShieldAlert, en: "Security", de: "Sicherheit", touches: ["app", "database"], feature: "superadmin", superUserOnly: true },
  { id: "su-danger", region: "system", parent: "su", route: "/desk/su/danger/", icon: TriangleAlert, en: "Danger zone", de: "Gefahrenzone", touches: ["database"], feature: "superadmin", superUserOnly: true },

  { id: "slip", region: null, route: "/print/slip/", icon: Printer, en: "Packing slip", de: "Lieferschein", touches: ["app"], feature: "orders", outsideShell: true },
  { id: "labels", region: null, route: "/print/labels/", icon: Tags, en: "Print labels", de: "Etiketten drucken", touches: ["app"], feature: "inventory", outsideShell: true },
];

const BY_ID = new Map<ScreenId, Screen>(SCREENS.map((s) => [s.id, s]));

export function screenById(id: ScreenId): Screen {
  const screen = BY_ID.get(id);
  if (!screen) throw new Error(`Unknown screen ${id}`);
  return screen;
}

/** The first-level screens of a region, in table order: the pill row of Finances and IT. */
export function regionScreens(region: RegionId): Screen[] {
  return SCREENS.filter((s) => s.region === region && !s.parent);
}

/** The second-level pill row of a screen, parent first. Empty when the screen has none. */
export function subScreens(id: ScreenId): Screen[] {
  const top = screenById(id).parent ?? id;
  const children = SCREENS.filter((s) => s.parent === top);
  return children.length ? [screenById(top), ...children] : [];
}

/** Longest route that prefixes the pathname. Pass `usePathname()`, which already excludes the base path. */
export function screenForPath(pathname: string): Screen | undefined {
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  let best: Screen | undefined;
  for (const s of SCREENS) {
    // The overview sits at the root, so it matches only itself: every other path would start with it.
    const hit = s.route === "/" ? path === "/" : path.startsWith(s.route);
    if (hit && (!best || s.route.length > best.route.length)) best = s;
  }
  return best;
}
