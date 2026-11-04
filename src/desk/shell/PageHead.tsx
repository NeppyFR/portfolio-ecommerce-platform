"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { screenById, type ScreenId } from "@/desk/registry";
import { useLang, useT } from "@/i18n";
import { shell } from "@/i18n/dict/shell";
import { canAccess } from "@/lib/features";
import { useStore } from "@/store/core";
import { Touches } from "@/ui/Touches";
import { useEffect, useRef, type ReactNode } from "react";
import { screenName, subNavOf } from "./sidebar-nav";
import { useStorePulse } from "./useStorePulse";

export type PagePill = { id: string; label: ReactNode; href?: string; onSelect?: () => void };

export type PageHeadProps = {
  /** The registry id of this screen. It gives the big plain name, the touches line and the sub-screen pills. */
  id: ScreenId;
  /** The computed sentence. It prints as the quiet line under the name. */
  title: ReactNode;
  actions?: ReactNode;
  /** A RuleLine, printed under the sentence. */
  rule?: ReactNode;
  /** Query-only sub tabs (Email, Security) print as a second row under the sub-screen pills. Pills with an href replace the sub-screen row. */
  pills?: PagePill[];
  activePill?: string;
};

/**
 * The page header: plain screen name, one quiet sentence, the touches line, then the pill rows and the actions.
 * The shell keeps the search, bell and avatar cluster on the same row as the name, which is why the name reserves its width.
 */
export function PageHead({ id, title, actions, rule, pills, activePill }: PageHeadProps) {
  const lang = useLang();
  const t = useT(shell);
  const pulse = useStorePulse();
  const profile = useStore((s) => s.profile);
  const switches = useStore((s) => s.featureSwitches);
  const screen = screenById(id);
  const replaced = pills?.some((pill) => pill.href);
  const subs = replaced ? [] : subNavOf(id).filter((sub) => !sub.superUserOnly || profile === "superUser");
  const head = useRef<HTMLElement>(null);

  // On a phone the pill row scrolls sideways, so bring the active one into view. scrollIntoView could also move ancestor scrollers.
  useEffect(() => {
    head.current?.querySelectorAll<HTMLElement>(".dk-pills").forEach((nav) => {
      const active = nav.querySelector<HTMLElement>('[aria-current="page"],[aria-pressed="true"]');
      if (!active || nav.scrollWidth <= nav.clientWidth) return;
      nav.scrollLeft += active.getBoundingClientRect().left - nav.getBoundingClientRect().left - (nav.clientWidth - active.offsetWidth) / 2;
    });
  }, [id, activePill]);

  return (
    <header ref={head} className="dk-head">
      <h1 className="dk-head-name">{screenName(screen, lang)}</h1>
      <div className="dk-head-line">
        <div className="dk-head-sentence">{title}</div>
        <Touches nodes={screen.touches} pulse={pulse} className="dk-head-touches" />
      </div>
      {rule ? <div className="dk-head-rule">{rule}</div> : null}
      {subs.length || pills || actions ? (
        <div className="dk-head-bar">
          {subs.length || pills ? (
            <div className="dk-head-rows">
              {subs.length ? (
                <nav className="dk-pills" aria-label={t.subScreensLabel}>
                  {subs.map((sub) => {
                    const locked = !canAccess(profile, sub.feature, switches);
                    return (
                      <Link key={sub.id} href={sub.route} className="dk-pill" aria-current={sub.id === id ? "page" : undefined} data-locked={locked || undefined} title={locked ? t.lockedTip : undefined}>
                        {sub[lang]}
                        {locked ? <Lock size={12} strokeWidth={1.75} aria-hidden="true" /> : null}
                      </Link>
                    );
                  })}
                </nav>
              ) : null}
              {pills ? (
                <nav className="dk-pills" data-level={replaced ? undefined : "query"} aria-label={t.subScreensLabel}>
                  {pills.map((pill) =>
                    pill.href ? (
                      <Link key={pill.id} href={pill.href} className="dk-pill" aria-current={pill.id === activePill ? "page" : undefined}>
                        {pill.label}
                      </Link>
                    ) : (
                      <button key={pill.id} type="button" className="dk-pill" aria-pressed={pill.id === activePill} onClick={pill.onSelect}>
                        {pill.label}
                      </button>
                    ),
                  )}
                </nav>
              ) : null}
            </div>
          ) : null}
          {actions ? <div className="dk-head-actions">{actions}</div> : null}
        </div>
      ) : null}
    </header>
  );
}
