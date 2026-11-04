"use client";

import { ChevronDown, Ellipsis, Hammer, Lock, Map as MapIcon, Menu, Search, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { screenById, screenForPath, type Screen } from "@/desk/registry";
import { fmt, plural, useDocTitle, useLang, useT } from "@/i18n";
import { shell } from "@/i18n/dict/shell";
import { PROJECT } from "@/lib/brand";
import { canAccess } from "@/lib/features";
import "@/store/actions/profile";
import { useStore } from "@/store/core";
import { priorityMailCount } from "@/store/selectors";
import { DemoPill } from "@/ui/DemoPill";
import { openJumpBox } from "@/ui/JumpBox";
import { LangToggle } from "@/ui/LangToggle";
import { Mark } from "@/ui/Mark";
import { useReducedMotion } from "@/ui/useReducedMotion";
import { Bell } from "./Bell";
import { LivePill } from "./LivePill";
import { LockedState } from "./LockedState";
import { Popover } from "./Popover";
import { ProfileMenu } from "./ProfileMenu";
import "./shell.css";
import { dockActive, DOCK_ITEMS, NAV_GROUPS, navItem, navItemFor, screenName, type NavItem } from "./sidebar-nav";

function JumpTrigger() {
  const t = useT(shell);
  return (
    <button type="button" className="dk-jump" aria-label={t.jumpOpen} onClick={openJumpBox}>
      <Search size={16} strokeWidth={1.75} aria-hidden="true" />
      <span className="dk-jump-word">{t.jumpShort}</span>
      <kbd className="dk-kbd">Ctrl K</kbd>
    </button>
  );
}

/** Mark, wordmark and chevron. The chevron opens the project's other surfaces. */
function SideBrand() {
  const t = useT(shell);
  const links = [
    { href: "/", label: t.startPage, icon: MapIcon },
    { href: "/shop/", label: t.shop, icon: ShoppingBag },
    { href: "/built/", label: t.built, icon: Hammer },
  ];
  return (
    <Popover
      label={t.projectMenu}
      title={PROJECT.title}
      align="start"
      panelClassName="dk-pop-small"
      triggerClassName="dk-brand-btn"
      trigger={
        <>
          <Mark size={24} />
          <span className="dk-wordmark">{PROJECT.title}</span>
          <ChevronDown size={16} strokeWidth={1.75} className="dk-brand-chev" aria-hidden="true" />
        </>
      }
    >
      <ul className="p-2">
        {links.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="dk-pop-link">
              <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </Popover>
  );
}

function SideItem({ item, active, exact, badge, badgeLabel }: { item: NavItem; active: boolean; exact: boolean; badge?: number; badgeLabel?: string }) {
  const t = useT(shell);
  const lang = useLang();
  const profile = useStore((s) => s.profile);
  const switches = useStore((s) => s.featureSwitches);
  const locked = !canAccess(profile, item.feature, switches);
  const Icon = item.icon;
  return (
    <Link href={item.route} className="dk-side-item" aria-current={active ? (exact ? "page" : "true") : undefined} data-locked={locked || undefined} title={locked ? t.lockedTip : undefined}>
      <Icon size={19} strokeWidth={1.6} aria-hidden="true" />
      <span className="dk-side-word">{item[lang]}</span>
      {locked ? <Lock size={13} strokeWidth={1.75} className="flex-none" aria-hidden="true" /> : null}
      {badge && !locked ? (
        <span className="dk-side-badge" title={badgeLabel}>
          <span aria-hidden="true">{badge > 99 ? "99+" : badge}</span>
          <span className="sr-only">{badgeLabel}</span>
        </span>
      ) : null}
    </Link>
  );
}

/** The sidebar's content. The same on desktop and in the phone's drawer. */
function SideContent({ screen, onClose }: { screen: Screen; onClose?: () => void }) {
  const t = useT(shell);
  const lang = useLang();
  const state = useStore((s) => s);
  const current = navItemFor(screen);
  const mails = priorityMailCount(state);
  return (
    <>
      <div className="dk-side-brand">
        <SideBrand />
        {onClose ? (
          <button type="button" className="dk-side-close" aria-label={t.closeMenu} onClick={onClose}>
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <nav aria-label={t.navLabel} className="dk-side-nav">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => !item.superUserOnly || state.profile === "superUser");
          return (
            <div key={group.id} className="dk-side-group">
              {group.id === "main" ? null : <p className="dk-side-label">{group[lang]}</p>}
              <ul>
                {items.map((item) => (
                  <li key={item.id}>
                    <SideItem
                      item={item}
                      active={current?.id === item.id}
                      exact={item.screen === screen.id}
                      badge={item.id === "inbox" ? mails : undefined}
                      badgeLabel={item.id === "inbox" ? fmt(plural(mails, t.statusMails.one, t.statusMails.other), { n: mails }) : undefined}
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
    </>
  );
}

/** The sidebar on a narrow window: a native dialog, so Esc, the focus trap and focus return come from the browser. */
function Drawer({ open, onClose, screen }: { open: boolean; onClose: () => void; screen: Screen }) {
  const t = useT(shell);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="dk-drawer"
      aria-label={t.navLabel}
      onClose={onClose}
      onClick={(event) => {
        const target = event.target as Element;
        if (target === dialog.current || target.closest(".dk-side-item,.dk-pop-link")) onClose();
      }}
    >
      {open ? (
        <div className="dk-drawer-inner">
          <SideContent screen={screen} onClose={onClose} />
        </div>
      ) : null}
    </dialog>
  );
}

type TopBandProps = { screen: Screen; stuck: boolean; clusterRef: RefObject<HTMLDivElement | null>; topRef: RefObject<HTMLElement | null>; onMenu: () => void };

function TopBand({ screen, stuck, clusterRef, topRef, onMenu }: TopBandProps) {
  const t = useT(shell);
  const lang = useLang();
  return (
    <header ref={topRef} className="dk-top" data-stuck={stuck || undefined}>
      <button type="button" className="dk-menu" aria-label={t.openMenu} onClick={onMenu}>
        <Menu size={20} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <Link href="/desk/" className="dk-top-mark" aria-label={navItem("dashboard")[lang]}>
        <Mark />
      </Link>
      <span className="dk-top-name" aria-hidden="true">
        {screenName(screen, lang)}
      </span>
      <span className="dk-spacer" />
      <div ref={clusterRef} className="dk-cluster">
        <DemoPill className="dk-demo-full" />
        <DemoPill compact className="dk-demo-short" />
        <LivePill />
        <LangToggle />
        <JumpTrigger />
        <Bell />
        <ProfileMenu />
      </div>
      <div className="dk-cluster-phone">
        <button type="button" className="dk-avatar-btn text-ink" aria-label={t.jumpOpen} onClick={openJumpBox}>
          <Search size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <DemoPill compact />
        <ProfileMenu phone />
      </div>
    </header>
  );
}

function Dock({ screen, onMore }: { screen: Screen; onMore: () => void }) {
  const t = useT(shell);
  const lang = useLang();
  const profile = useStore((s) => s.profile);
  const switches = useStore((s) => s.featureSwitches);
  const active = dockActive(screen);
  return (
    <nav className="dk-dock" aria-label={t.dockLabel}>
      {DOCK_ITEMS.map((id) => {
        const item = navItem(id);
        const Icon = item.icon;
        const locked = !canAccess(profile, item.feature, switches);
        return (
          <Link key={id} href={item.route} className="dk-dock-item" aria-current={active === id ? "true" : undefined} data-locked={locked || undefined} title={locked ? t.lockedTip : undefined}>
            <Icon size={19} strokeWidth={1.75} aria-hidden="true" />
            {item[lang]}
          </Link>
        );
      })}
      <button type="button" className="dk-dock-item" data-active={active === "more" || undefined} onClick={onMore}>
        <Ellipsis size={19} strokeWidth={1.75} aria-hidden="true" />
        {t.more}
      </button>
    </nav>
  );
}

/**
 * Writes the band's real height to --rail-h, which sticky table heads read, and the cluster's width to --dk-cluster-w,
 * which keeps the big name clear of it. The band turns opaque once the name has started to scroll away.
 */
function useBand(root: RefObject<HTMLDivElement | null>, top: RefObject<HTMLElement | null>, cluster: RefObject<HTMLDivElement | null>, sentinel: RefObject<HTMLSpanElement | null>) {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const rootEl = root.current;
    const topEl = top.current;
    const clusterEl = cluster.current;
    if (!rootEl || !topEl || !clusterEl) return;
    const measure = () => {
      rootEl.style.setProperty("--rail-h", `${topEl.offsetHeight}px`);
      rootEl.style.setProperty("--dk-cluster-w", `${clusterEl.offsetWidth}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(topEl);
    observer.observe(clusterEl);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [root, top, cluster]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, [sentinel]);

  return stuck;
}

function FullShell({ screen, children }: { screen: Screen; children: ReactNode }) {
  const t = useT(shell);
  const profile = useStore((s) => s.profile);
  const switches = useStore((s) => s.featureSwitches);
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLElement>(null);
  const cluster = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLSpanElement>(null);
  const main = useRef<HTMLElement>(null);
  const area = navItemFor(screen)?.id;
  const lastArea = useRef(area);
  const [drawer, setDrawer] = useState(false);
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const openDrawer = useCallback(() => setDrawer(true), []);
  const stuck = useBand(root, top, cluster, sentinel);
  const pathname = usePathname();
  useEffect(() => setDrawer(false), [pathname]);

  useEffect(() => {
    if (lastArea.current === area) return;
    lastArea.current = area;
    if (!reduced) main.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "cubic-bezier(.2,.7,.2,1)" });
  }, [area, reduced]);

  const allowed = canAccess(profile, screen.feature, switches);

  return (
    <div ref={root} className="dk-root" data-profile={profile} data-area={area ?? "none"}>
      <a href="#main" className="dk-skip">
        {t.skip}
      </a>
      <aside className="dk-side">
        <SideContent screen={screen} />
      </aside>
      <div className="dk-body">
        <span ref={sentinel} className="dk-sentinel" aria-hidden="true" />
        <TopBand screen={screen} stuck={stuck} clusterRef={cluster} topRef={top} onMenu={openDrawer} />
        <main ref={main} id="main" tabIndex={-1} className="dk-main">
          {allowed ? children : <LockedState screen={screen} />}
        </main>
      </div>
      <Dock screen={screen} onMore={openDrawer} />
      <Drawer open={drawer} onClose={closeDrawer} screen={screen} />
    </div>
  );
}

/** The profile choice stands alone: nobody has chosen a profile yet, so the sidebar and the avatar would mean nothing. */
function EnterFrame({ children }: { children: ReactNode }) {
  const t = useT(shell);
  const profile = useStore((s) => s.profile);
  return (
    <div className="dk-root" data-profile={profile} data-frame="enter">
      <a href="#main" className="dk-skip">
        {t.skip}
      </a>
      <header className="dk-enter-top">
        <Link href="/" className="dk-enter-brand" aria-label={t.startPage}>
          <Mark size={24} />
          <span className="dk-wordmark hidden md:inline">{PROJECT.title}</span>
        </Link>
        <span className="dk-spacer" />
        <DemoPill className="hidden md:inline-flex" />
        <DemoPill compact className="inline-flex md:hidden" />
        <LangToggle />
      </header>
      <main id="main" tabIndex={-1} className="dk-main dk-enter-main">
        {children}
      </main>
    </div>
  );
}

export function DeskShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const lang = useLang();
  const screen = screenForPath(pathname) ?? screenById("dashboard");
  useDocTitle(screenName(screen, lang));
  if (screen.id === "enter") return <EnterFrame>{children}</EnterFrame>;
  return <FullShell screen={screen}>{children}</FullShell>;
}
