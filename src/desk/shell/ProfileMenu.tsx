"use client";

import { Check, ChevronDown, UserCog } from "lucide-react";
import Link from "next/link";
import { fmt, useLang, useT } from "@/i18n";
import { shell } from "@/i18n/dict/shell";
import { identityOf, PROFILES, setProfile } from "@/store/actions/profile";
import { useStore } from "@/store/core";
import type { Tier } from "@/store/types";
import { LangToggle } from "@/ui/LangToggle";
import { Avatar } from "./Avatar";
import { BellPanel, unreadLabel, useBell } from "./Bell";
import { LivePill } from "./LivePill";
import { Popover } from "./Popover";

export function tierWord(tier: Tier, t: typeof shell.en): string {
  if (tier === "full") return t.tierFull;
  return tier === "super" ? t.tierSuper : t.tierPartner;
}

/** Shows who you are and switches profile. On a phone it also carries language, the live state and the bell. */
export function ProfileMenu({ phone = false }: { phone?: boolean }) {
  const t = useT(shell);
  const lang = useLang();
  const profile = useStore((s) => s.profile);
  const { unread } = useBell();
  const team = useStore((s) => s.team);
  const me = identityOf(profile, team);
  const label = phone && unread ? `${fmt(t.profileMenu, { name: me.name })}. ${unreadLabel(unread, t)}` : fmt(t.profileMenu, { name: me.name });

  return (
    <Popover
      label={label}
      title={phone ? undefined : `${me.name} · ${me.role[lang]}`}
      triggerClassName={phone ? "dk-avatar-btn" : "dk-profile-btn"}
      trigger={
        <>
          <Avatar profile={profile} />
          {phone ? null : <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />}
          {phone && unread ? (
            <span className="dk-badge" aria-hidden="true">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </>
      }
    >
      <div className="flex items-center gap-3 border-b border-line p-4">
        <Avatar profile={profile} size="lg" />
        <div className="min-w-0">
          <p className="type-h4">{me.name}</p>
          <p className="type-small text-ink-2">{me.role[lang]}</p>
          <p className="type-mono-s text-ink-3">
            {me.label} · {tierWord(me.tier, t)}
          </p>
        </div>
      </div>

      {phone ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <LivePill />
            <LangToggle />
          </div>
          <div className="border-b border-line">
            <BellPanel />
          </div>
        </>
      ) : null}

      <div className="p-2">
        <p className="type-mono-s px-2 py-1.5 text-ink-3">{t.switchProfile}</p>
        <ul>
          {PROFILES.map((option) => {
            const person = identityOf(option, team);
            const current = option === profile;
            return (
              <li key={option}>
                <button
                  type="button"
                  data-close
                  aria-pressed={current}
                  disabled={!person.isActive}
                  title={person.isActive ? undefined : t.inactive}
                  onClick={() => setProfile(option)}
                  className="flex min-h-11 w-full items-center gap-2.5 rounded-[var(--r-2)] px-2 py-1.5 text-left hover:bg-[var(--mist-2)] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Avatar profile={option} />
                  <span className="min-w-0 flex-1">
                    <span className="type-label block">{person.name}</span>
                    <span className="type-small block text-ink-2">{person.role[lang]}</span>
                  </span>
                  {current ? <Check size={16} strokeWidth={2} className="flex-none text-link" aria-label={t.current} /> : null}
                </button>
              </li>
            );
          })}
        </ul>
        <Link href="/desk/enter/" className="type-label mt-1 flex min-h-11 items-center gap-2.5 rounded-[var(--r-2)] px-2 text-link hover:bg-[var(--mist-2)]">
          <UserCog size={16} strokeWidth={1.75} aria-hidden="true" />
          {t.profileChoice}
        </Link>
      </div>

      {phone ? (
        <div className="flex flex-wrap gap-x-4 border-t border-line px-4 py-1">
          <Link href="/" className="type-label flex min-h-11 items-center text-link">
            {t.startPage}
          </Link>
          <Link href="/shop/" className="type-label flex min-h-11 items-center text-link">
            {t.shop}
          </Link>
        </div>
      ) : null}
    </Popover>
  );
}
