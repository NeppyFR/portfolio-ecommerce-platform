"use client";

import { ArrowRight, Check, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { screenById } from "@/desk/registry";
import { Avatar } from "@/desk/shell/Avatar";
import { tierWord } from "@/desk/shell/ProfileMenu";
import { useLang, useT } from "@/i18n";
import { shell } from "@/i18n/dict/shell";
import { TEAM } from "@/lib/brand";
import { setProfile, useIdentity, useStoredProfile } from "@/store/actions/profile";
import { useStore } from "@/store/core";
import type { Profile } from "@/store/types";
import { nextRoute, scopeOf } from "./StepInChips";

function ProfileRow({ profile, current, note, onPick }: { profile: Profile; current: boolean; note?: string; onPick: (profile: Profile) => void }) {
  const t = useT(shell);
  const lang = useLang();
  const me = useIdentity(profile);
  return (
    <button
      type="button"
      disabled={!me.isActive}
      onClick={() => onPick(profile)}
      className="flex w-full items-center gap-3.5 rounded-[var(--r-3)] px-4 py-3.5 text-left hover:bg-[var(--mist-2)] focus-visible:relative focus-visible:z-10 disabled:cursor-not-allowed disabled:opacity-45"
    >
      <Avatar profile={profile} size="lg" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="type-h4 text-ink">{me.name}</span>
          <span className="type-small text-ink-2">{me.role[lang]}</span>
        </span>
        <span className="type-small mt-0.5 block text-ink-2">{scopeOf(profile, t)}</span>
        {note ? <span className="type-small mt-0.5 block text-ink-3">{note}</span> : null}
        <span className="type-mono-s mt-1 flex flex-wrap items-center gap-x-2 text-ink-3">
          {me.label} · {tierWord(me.tier, t)}
          {me.isActive ? null : <span>{t.inactive}</span>}
          {current ? (
            <span className="inline-flex items-center gap-1 text-link">
              <Check size={13} strokeWidth={2} aria-hidden="true" />
              {t.current}
            </span>
          ) : null}
        </span>
      </span>
      <ArrowRight size={17} strokeWidth={1.75} className="flex-none text-ink-3" aria-hidden="true" />
    </button>
  );
}

export function EnterScreen() {
  const t = useT(shell);
  const lang = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const stored = useStoredProfile();
  const switches = useStore((s) => s.featureSwitches);

  function pick(profile: Profile) {
    if (setProfile(profile).ok) router.push(nextRoute(params.get("next"), profile, switches));
  }

  return (
    <div className="mx-auto grid max-w-[1080px] gap-x-14 gap-y-8 py-2 lg:grid-cols-[5fr_7fr] lg:py-12">
      <div>
        <p className="type-mono-s text-ink-3">{t.enterLabel}</p>
        <h1 className="type-display-l mt-2">{screenById("enter")[lang]}</h1>
        <p className="type-body-l mt-4 text-ink-2">{t.enterSub}</p>
        <p className="type-small mt-6 flex gap-2.5 border-t border-line pt-4 text-ink-2">
          <LockKeyhole size={15} strokeWidth={1.75} className="mt-0.5 flex-none text-ink-3" aria-hidden="true" />
          <span>{t.enterNote}</span>
        </p>
        <Link href="/" className="type-label mt-5 inline-flex min-h-11 items-center text-link underline-offset-2 hover:underline md:min-h-0">
          {t.enterBack}
        </Link>
      </div>
      <div>
        <h2 className="type-mono-s text-ink-3">{t.enterPeople}</h2>
        <ul className="mt-2 rounded-[var(--r-3)] border border-line">
          {TEAM.map((member) => (
            <li key={member.profile} className="border-b border-line last:border-b-0">
              <ProfileRow profile={member.profile} current={stored === member.profile} onPick={pick} />
            </li>
          ))}
        </ul>
        <h2 className="type-mono-s mt-6 text-ink-3">{t.enterSystem}</h2>
        <div className="mt-2 rounded-[var(--r-3)] border border-line">
          <ProfileRow profile="superUser" current={stored === "superUser"} note={t.enterSuperNote} onPick={pick} />
        </div>
      </div>
    </div>
  );
}
