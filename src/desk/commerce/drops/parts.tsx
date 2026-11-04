"use client";

import { Archive, CalendarClock, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { countdown, launchMs, zurichWallClock } from "@/desk/commerce/products/rules";
import { Pill } from "@/desk/commerce/products/shared";
import { fmt } from "@/i18n";
import { drops as dict } from "@/i18n/dict/drops";
import { formatDate } from "@/lib/format";
import { DEMO_NOW_MS, now } from "@/store/clock";
import type { Drop, DropStatus } from "@/store/types";

export type DropsT = (typeof dict)["en"];

/** The demo clock, read every 30 s. Starts at the fixed time, so the build and the browser agree on first paint. */
export function useDemoClock(): number {
  const [ms, setMs] = useState(DEMO_NOW_MS);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) setMs(Date.parse(now()));
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return ms;
}

export function DropStatusPill({ status, t }: { status: DropStatus; t: DropsT }) {
  if (status === "live")
    return (
      <Pill tone="ok" icon={Radio}>
        {t.status.live}
      </Pill>
    );
  if (status === "planned")
    return (
      <Pill tone="plan" icon={CalendarClock}>
        {t.status.planned}
      </Pill>
    );
  return (
    <Pill tone="off" icon={Archive}>
      {t.status.archived}
    </Pill>
  );
}

/** `9 d 3 h`, `3 h 58 min` or `58 min`, in whichever unit fits. */
export function timeText(ms: number, launch: number, t: DropsT): string {
  const c = countdown(ms, launch);
  if (c.days > 0) return fmt(t.time.dh, { d: c.days, h: c.hours });
  if (c.hours > 0) return fmt(t.time.hm, { h: c.hours, m: c.minutes });
  return fmt(t.time.m, { m: c.minutes });
}

/** `Launches on 17.01.2027 at 18:00`, `Launched on 18.09.2026`, or the no-date sentence. */
export function launchLine(drop: Pick<Drop, "launchOn" | "launchAt">, ms: number, t: DropsT): string {
  if (!drop.launchOn) return t.card.noLaunch;
  const at = launchMs(drop) as number;
  const when = drop.launchAt ? fmt(t.launch.at, { date: formatDate(drop.launchOn), time: zurichWallClock(drop.launchAt).time }) : formatDate(drop.launchOn);
  return fmt(ms >= at ? t.launch.was : t.launch.on, { date: when });
}

/** `Launches in 9 d 3 h` or `Launched 112 d 20 h ago`. Null without a date. */
export function countdownLine(drop: Pick<Drop, "launchOn" | "launchAt">, ms: number, t: DropsT): string | null {
  const at = launchMs(drop);
  if (at === null) return null;
  return fmt(ms >= at ? t.launch.since : t.launch.in, { time: timeText(ms, at, t) });
}
