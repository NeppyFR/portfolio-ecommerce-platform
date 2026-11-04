"use client";

import Link from "next/link";
import { useT } from "@/i18n";
import { shell } from "@/i18n/dict/shell";
import { canAccess } from "@/lib/features";
import { useStore } from "@/store/core";
import { liveStatus } from "@/store/selectors";
import { liveDetail } from "./rail-rules";

/** A dot plus a word, so the state never rests on colour alone. The tooltip gives the detail. */
export function LivePill() {
  const t = useT(shell);
  const state = useStore((s) => s);
  const open = canAccess(state.profile, "it", state.featureSwitches);
  const { state: key, tone, run } = liveStatus(state);
  const detail = liveDetail(run, t);
  const body = (
    <>
      <span className="dk-live-dot" aria-hidden="true" />
      {t.live[key]}
    </>
  );
  return open ? (
    <Link href="/desk/system/health/" className="dk-live" data-tone={tone} title={detail}>
      {body}
    </Link>
  ) : (
    <span className="dk-live" data-tone={tone} title={detail}>
      {body}
    </span>
  );
}
