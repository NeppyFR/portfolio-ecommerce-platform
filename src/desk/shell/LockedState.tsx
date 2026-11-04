"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Screen } from "@/desk/registry";
import { fmt, useLang, useT } from "@/i18n";
import { shell } from "@/i18n/dict/shell";
import { useIdentity } from "@/store/actions/profile";
import { useStore } from "@/store/core";
import { Button } from "@/ui/Button";
import { PageHead } from "./PageHead";
import { screenName } from "./sidebar-nav";

/** Shown in place of a screen the profile may not open. The crawl looks for [data-screen-locked]. */
export function LockedState({ screen }: { screen: Screen }) {
  const t = useT(shell);
  const lang = useLang();
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const vars = { name: useIdentity(profile).name, screen: screenName(screen, lang) };
  const body = screen.feature === "superadmin" ? t.lockedSuper : screen.feature === "settings" || screen.feature === "it" ? t.lockedFixed : t.lockedSwitchable;

  return (
    <section data-screen-locked={screen.id}>
      <PageHead id={screen.id} title={t.lockedTitle} />
      <div className="dk-locked">
        <span className="dk-locked-tile">
          <Lock size={18} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <p className="type-body-l text-ink-2">{fmt(body, vars)}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button onClick={() => router.push(`/desk/enter/?next=${encodeURIComponent(screen.route)}`)}>{t.switchProfile}</Button>
          <Button variant="outline" onClick={() => router.push("/desk/")}>
            {t.backDashboard}
          </Button>
        </div>
      </div>
    </section>
  );
}
