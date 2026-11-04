import { Globe, Map as MapIcon, Package, ReceiptText, ShoppingBag, Tag, Users, type LucideIcon } from "lucide-react";
import { SCREENS, screenById, type Screen, type ScreenId } from "@/desk/registry";
import { shell } from "@/i18n/dict/shell";
import { canAccess } from "@/lib/features";
import { formatChf } from "@/lib/format";
import { orderHref } from "@/lib/routes";
import { navGroupFor, navItemFor, screenName } from "./sidebar-nav";
import { fold, matchesTerms, searchTerms } from "@/lib/search";
import type { Lang, State } from "@/store/types";

export type JumpGroup = "screens" | "orders" | "products" | "customers" | "codes" | "pages";
export type JumpItem = { id: string; group: JumpGroup; label: string; hint: string; href: string; icon: LucideIcon; locked: boolean };
export type JumpSection = { group: JumpGroup; items: JumpItem[] };

const QUICK: ScreenId[] = ["dashboard", "orders", "inventory", "costs", "map", "health"];
const LIMITS: Record<JumpGroup, number> = { screens: 6, orders: 5, products: 4, customers: 4, codes: 3, pages: 3 };

function groupWord(screen: Screen, lang: Lang): string {
  const group = navGroupFor(screen);
  return group ? group[lang] : "";
}

/** Registry screens, then the rows this profile may see. superUser screens stay hidden from everyone else, as in the sidebar. */
export function searchJump(state: State, query: string, lang: Lang): JumpSection[] {
  const t = shell[lang];
  const can = (feature: Screen["feature"]) => canAccess(state.profile, feature, state.featureSwitches);
  const terms = searchTerms(query);
  const hits = (...fields: (string | null)[]) => matchesTerms(terms, fields);
  const typed = query.trim().length > 0;

  const asItem = (screen: Screen): JumpItem => {
    const locked = !can(screen.feature);
    return { id: `screen:${screen.id}`, group: "screens", label: screenName(screen, lang), hint: locked ? t.lockedLabel : groupWord(screen, lang), href: screen.route, icon: screen.icon, locked };
  };
  const visible = SCREENS.filter((s) => s.id !== "slip" && (!s.superUserOnly || state.profile === "superUser"));
  const names = (s: Screen) => {
    const nav = navItemFor(s);
    return [s.en, s.de, screenName(s, "en"), screenName(s, "de"), nav?.en ?? null, nav?.de ?? null];
  };
  const wanted = fold(query.trim());
  /** A screen named by the query comes before one that only matches through its group word, which the limit below would otherwise cut. */
  const rank = (s: Screen) => {
    const folded = names(s).filter(Boolean).map((name) => fold(name as string));
    return folded.includes(wanted) ? 0 : folded.some((name) => name.startsWith(wanted)) ? 1 : 2;
  };
  const screens = typed
    ? visible
        .filter((s) => hits(...names(s), groupWord(s, "en"), groupWord(s, "de")))
        .sort((a, b) => rank(a) - rank(b))
        .map(asItem)
    : QUICK.map((id) => asItem(screenById(id)));

  const pages: JumpItem[] = [
    { id: "page:start", group: "pages" as const, label: t.startPage, hint: "/", href: "/", icon: MapIcon, locked: false },
    { id: "page:shop", group: "pages" as const, label: t.shop, hint: "/shop/", href: "/shop/", icon: ShoppingBag, locked: false },
    { id: "page:built", group: "pages" as const, label: t.built, hint: "/built/", href: "/built/", icon: Globe, locked: false },
  ].filter((item) => !typed || hits(item.label, item.id === "page:start" ? `${shell.en.startPage} ${shell.de.startPage}` : null, item.hint));

  const looksLikeOrder = /^(al-?)?\d+$/i.test(query.trim());
  const digits = looksLikeOrder ? query.replace(/\D/g, "") : "";
  const orderRank = (orderNumber: string) => (digits && orderNumber.replace(/\D/g, "").startsWith(digits) ? 0 : 1);

  const orders: JumpItem[] =
    typed && can("orders")
      ? state.orders
          .filter((o) => hits(o.orderNumber))
          .sort((a, b) => orderRank(a.orderNumber) - orderRank(b.orderNumber) || b.orderNumber.localeCompare(a.orderNumber))
          .map((o) => ({ id: `order:${o.id}`, group: "orders" as const, label: o.orderNumber, hint: `${o.customerErased ? "" : `${o.customerName} · `}${formatChf(o.totalRappen)}`, href: orderHref(o.orderNumber), icon: ReceiptText, locked: false }))
      : [];

  const products: JumpItem[] =
    typed && can("products")
      ? state.products
          .filter((p) => hits(p.nameEn, p.nameDe, p.slug, p.variants.map((v) => v.sku).join(" ")))
          .map((p) => ({ id: `product:${p.id}`, group: "products" as const, label: lang === "de" ? p.nameDe : p.nameEn, hint: formatChf(p.priceRappen), href: `/desk/products/?open=${encodeURIComponent(p.id)}`, icon: Package, locked: false }))
      : [];

  const customers: JumpItem[] =
    typed && can("customers")
      ? state.customers
          .filter((c) => !c.erased && hits(c.fullName, c.email))
          .map((c) => ({ id: `customer:${c.id}`, group: "customers" as const, label: c.fullName, hint: c.email, href: `/desk/customers/?open=${encodeURIComponent(c.id)}`, icon: Users, locked: false }))
      : [];

  const codes: JumpItem[] =
    typed && can("discounts")
      ? state.discounts
          .filter((d) => hits(d.code))
          .map((d) => ({ id: `code:${d.id}`, group: "codes" as const, label: d.code, hint: d.description, href: `/desk/discounts/?open=${encodeURIComponent(d.id)}`, icon: Tag, locked: false }))
      : [];

  const byGroup: Record<JumpGroup, JumpItem[]> = { screens, orders, products, customers, codes, pages };
  const order: JumpGroup[] = looksLikeOrder ? ["orders", "screens", "products", "customers", "codes", "pages"] : ["screens", "orders", "products", "customers", "codes", "pages"];
  return order.map((group) => ({ group, items: byGroup[group].slice(0, LIMITS[group]) })).filter((section) => section.items.length > 0);
}
