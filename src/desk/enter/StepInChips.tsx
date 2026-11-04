"use client";

import { useRouter } from "next/navigation";
import { screenForPath } from "@/desk/registry";
import { useT } from "@/i18n";
import { shell } from "@/i18n/dict/shell";
import { canAccess } from "@/lib/features";
import { identityOf, setProfile } from "@/store/actions/profile";
import type { FeatureSwitch, Profile } from "@/store/types";

export function scopeOf(profile: Profile, t: typeof shell.en): string {
  const scopes: Record<Profile, string> = {
    owner: t.scopeOwner,
    finance: t.scopeFinance,
    warehouse: t.scopeWarehouse,
    studio: t.scopeStudio,
    superUser: t.scopeSuper,
  };
  return scopes[profile];
}

/** Only a desk route the chosen profile may open; anything else lands on the Dashboard. */
export function nextRoute(next: string | null, profile: Profile, switches: FeatureSwitch[]): string {
  if (!next || !next.startsWith("/desk/") || next.startsWith("/desk/enter")) return "/desk/";
  const screen = screenForPath(next);
  return screen && canAccess(profile, screen.feature, switches) ? screen.route : "/desk/";
}

export type StepInChipsProps = { profiles?: Profile[]; className?: string };

/** `Step in as` Owner, Finance, Warehouse: sets the profile and opens the desk. Each chip's tooltip gives its scope. */
export function StepInChips({ profiles = ["owner", "finance", "warehouse"], className }: StepInChipsProps) {
  const t = useT(shell);
  const router = useRouter();
  return (
    <div role="group" aria-label={t.stepIn} className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <span className="type-mono-s text-ink">{t.stepIn}</span>
      {profiles.map((profile) => (
        <button
          key={profile}
          type="button"
          title={scopeOf(profile, t)}
          onClick={() => {
            if (setProfile(profile).ok) router.push("/desk/");
          }}
          className="type-label h-11 rounded-[var(--r-pill)] border-[1.5px] border-line-3 bg-white px-3 text-ink hover:bg-mist md:h-8"
        >
          {identityOf(profile).label}
        </button>
      ))}
    </div>
  );
}
