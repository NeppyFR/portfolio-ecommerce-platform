"use client";

import Link from "next/link";
import { GitBranch, LayoutGrid, Map as MapIcon, Search, ShoppingBag, type LucideIcon } from "lucide-react";
import { useT } from "@/i18n";
import { landing } from "@/i18n/dict/landing";
import { PROJECT } from "@/lib/brand";
import { LangToggle } from "@/ui/LangToggle";
import { Mark } from "@/ui/Mark";
import { openJumpBox } from "@/ui/JumpBox";

type StopId = "map" | "shop" | "desk" | "built";

const STOPS: { id: StopId; href: string; icon: LucideIcon }[] = [
  { id: "map", href: "/", icon: MapIcon },
  { id: "shop", href: "/shop/", icon: ShoppingBag },
  { id: "desk", href: "/desk/", icon: LayoutGrid },
  { id: "built", href: "/built/", icon: GitBranch },
];

/** The rail of the two public pages: skip link, mark and title, stops on a wire, demo note, Jump, language. */
export function PublicRail({ active, className, main = "main" }: { active: StopId; className?: string; main?: string }) {
  const t = useT(landing);
  const names: Record<StopId, string> = { map: t.navMap, shop: t.navShop, desk: t.navDesk, built: t.navBuilt };
  return (
    <header className={`lp-rail ${className ?? ""}`}>
      <a className="lp-skip" href={`#${main}`}>
        {t.skip}
      </a>
      <Link href="/" className="lp-brand" aria-label={t.home}>
        <Mark />
        <span>{PROJECT.title}</span>
      </Link>
      <nav className="lp-stops" aria-label={t.navLabel}>
        {STOPS.map((s) => (
          <Link key={s.id} href={s.href} className="lp-stop" aria-current={s.id === active ? "page" : undefined}>
            <s.icon size={14} aria-hidden="true" />
            {names[s.id]}
          </Link>
        ))}
      </nav>
      <div className="lp-rail-end">
        <span className="lp-rail-note">{t.railNote}</span>
        <button type="button" className="lp-jump" onClick={openJumpBox} aria-label={t.jumpAria}>
          <Search size={14} aria-hidden="true" />
          <span className="lp-jump-word">{t.jump}</span>
          <kbd className="lp-jump-key">{t.jumpKey}</kbd>
        </button>
        <LangToggle />
      </div>
    </header>
  );
}
