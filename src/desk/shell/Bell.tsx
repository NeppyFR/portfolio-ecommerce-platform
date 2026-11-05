"use client";

import {
  Bell as BellIcon,
  Boxes,
  Inbox,
  KeyRound,
  ListTodo,
  LockKeyhole,
  PackageOpen,
  ReceiptText,
  ShieldAlert,
  TriangleAlert,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { fmt, plural, useT } from "@/i18n";
import { shell } from "@/i18n/dict/shell";
import { useStore } from "@/store/core";
import { deriveNotifications, emptyLine, isUnread, markAllSeen, seenVersion, subscribeSeen, type BellKind, type BellTone } from "./notifications";
import { Popover } from "./Popover";
import { shortStamp } from "./rail-rules";

const ICONS: Record<BellKind, LucideIcon> = {
  profile_password: KeyRound,
  lockout: LockKeyhole,
  watchdog: ShieldAlert,
  attention: TriangleAlert,
  tasks: ListTodo,
  orders: ReceiptText,
  return_opened: PackageOpen,
  refund_paid: Undo2,
  inbox: Inbox,
  low_stock: Boxes,
  demo: BellIcon,
};

const TONE_COLOR: Record<BellTone, string> = { info: "var(--link)", warn: "var(--amber)", bad: "var(--rose)" };

export function useBell() {
  const state = useStore((s) => s);
  const t = useT(shell);
  const version = useSyncExternalStore(subscribeSeen, seenVersion, () => 0);
  return useMemo(() => {
    void version;
    const all = deriveNotifications(state, state.profile, t);
    const rows = all.filter((row) => !row.event || isUnread(state.profile, row));
    const unread = rows.filter((row) => isUnread(state.profile, row)).length;
    return { rows, unread, profile: state.profile, empty: emptyLine(state, state.profile, t) };
  }, [state, t, version]);
}

export function unreadLabel(unread: number, t: typeof shell.en): string {
  return unread ? fmt(plural(unread, t.bell.unread.one, t.bell.unread.other), { count: unread }) : t.bell.nothingNew;
}

export function BellPanel() {
  const t = useT(shell);
  const { rows, unread, profile, empty } = useBell();
  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="type-h4">{t.bell.title}</h2>
        <button
          type="button"
          className="type-label text-link underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-ink-3 disabled:no-underline"
          disabled={unread === 0}
          title={unread === 0 ? t.bell.allSeen : undefined}
          onClick={() => markAllSeen(profile, rows)}
        >
          {t.bell.markSeen}
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="type-small px-4 py-4 text-ink-2">{empty}</p>
      ) : (
        <ul>
          {rows.map((row) => {
            const Icon = ICONS[row.kind];
            const fresh = isUnread(profile, row);
            return (
              <li key={row.key} className="border-b border-line last:border-b-0">
                <Link href={row.href} className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--mist-2)]">
                  <Icon size={16} strokeWidth={1.75} className="mt-0.5 flex-none" style={{ color: TONE_COLOR[row.tone] }} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="type-label block">
                      {row.title}
                      {fresh ? (
                        <>
                          <span className="ml-1.5 inline-block size-1.5 rounded-full bg-solid align-middle" aria-hidden="true" />
                          <span className="sr-only"> {t.bell.newMark}</span>
                        </>
                      ) : null}
                    </span>
                    {row.detail ? <span className="type-small block text-ink-2">{row.detail}</span> : null}
                    {row.at ? <span className="type-mono-s mt-0.5 block text-ink-3">{shortStamp(row.at)}</span> : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function Bell() {
  const t = useT(shell);
  const { unread } = useBell();
  return (
    <Popover
      label={unreadLabel(unread, t)}
      title={t.bell.title}
      triggerClassName="dk-avatar-btn text-ink"
      trigger={
        <>
          <BellIcon size={18} strokeWidth={1.75} aria-hidden="true" />
          {unread ? (
            <span className="dk-badge" aria-hidden="true">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </>
      }
    >
      <BellPanel />
    </Popover>
  );
}
