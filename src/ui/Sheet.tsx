"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { useT } from "@/i18n";
import { common } from "@/i18n/dict/common";
import { ToastEcho } from "./Toast";
import { useReducedMotion } from "./useReducedMotion";

/** Native dialog. The caller syncs its URL param through setParam() in onClose. */
export type SheetProps = { open: boolean; onClose: () => void; title: ReactNode; wide?: boolean; children: ReactNode; footer?: ReactNode; "aria-label"?: string; className?: string };

const SLIDE_MS = 240;

/** Right side, 520 px or 880 px when wide; a 92vh bottom sheet with a grabber on a phone. Esc, close button and a backdrop click all close it, and focus returns. */
export function Sheet({ open, onClose, title, wide, children, footer, className, "aria-label": ariaLabel }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useT(common);
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      setMounted(true);
      if (!d.open) d.showModal();
      return;
    }
    if (d.open) d.close();
    const timer = window.setTimeout(() => setMounted(false), reduced ? 0 : SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [open, reduced]);

  const onBackdrop = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === ref.current) onClose();
  };

  return (
    <dialog
      ref={ref}
      className={`ui-sheet ${className ?? ""}`}
      data-wide={wide || undefined}
      aria-label={ariaLabel}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={onBackdrop}
    >
      <div className="ui-sheet-inner">
        <ToastEcho />
        <span className="ui-sheet-grabber" aria-hidden="true" />
        <header className="ui-sheet-head">
          <h2 className="type-h3">{title}</h2>
          <button type="button" className="ui-iconbtn" aria-label={t.close} title={t.close} onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="ui-sheet-body">{open || mounted ? children : null}</div>
        {footer && (open || mounted) ? <footer className="ui-sheet-foot">{footer}</footer> : null}
      </div>
    </dialog>
  );
}
