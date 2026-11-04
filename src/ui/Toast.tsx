"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useT } from "@/i18n";
import { common } from "@/i18n/dict/common";

type Item = { id: number; message: string };

const LIFETIME = 3500;
const EMPTY: Item[] = [];
let items: Item[] = EMPTY;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** Works from anywhere, including outside React. Toaster is mounted once in the root layout. */
export function toast(message: string): void {
  const id = nextId++;
  items = [...items.slice(-2), { id, message }];
  emit();
  if (typeof window !== "undefined") {
    window.setTimeout(() => {
      items = items.filter((t) => t.id !== id);
      emit();
    }, LIFETIME);
  }
}

/**
 * A modal makes everything outside it inert, so a screen reader would miss the Toaster while a Sheet or Dialog is open.
 * Both render this inside themselves. A closed dialog is display:none, which keeps it silent the rest of the time.
 */
export function ToastEcho() {
  const shown = useSyncExternalStore(subscribe, () => items, () => EMPTY);
  return (
    <div className="sr-only" aria-live="polite" role="status">
      {shown.at(-1)?.message}
    </div>
  );
}

/**
 * A manual popover, because a toast raised inside a Sheet or Dialog has to sit above the modal's top layer.
 * Showing it again on every change puts it back on top of whatever opened since.
 */
export function Toaster() {
  const shown = useSyncExternalStore(subscribe, () => items, () => EMPTY);
  const t = useT(common);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.showPopover !== "function") return;
    try {
      if (el.matches(":popover-open")) el.hidePopover();
      if (shown.length) el.showPopover();
    } catch {
      /* an old browser just shows the region without the top layer */
    }
  }, [shown]);
  return (
    <div ref={ref} className="ui-toaster" popover="manual" aria-live="polite" role="status">
      {shown.map((item) => (
        <div key={item.id} className="ui-toast">
          <p className="type-body">{item.message}</p>
          <p className="type-mono-s">{t.demoToast}</p>
        </div>
      ))}
    </div>
  );
}
