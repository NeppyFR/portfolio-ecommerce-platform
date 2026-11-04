"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { useT } from "@/i18n";
import { common } from "@/i18n/dict/common";
import { Button } from "./Button";
import { ToastEcho } from "./Toast";

export type DialogProps = { open: boolean; onClose: () => void; title: ReactNode; children?: ReactNode; confirmLabel?: string; cancelLabel?: string; onConfirm?: () => void; danger?: boolean; busy?: boolean; confirmDisabled?: boolean; className?: string };

/** Native dialog, 440 px, confirm pattern. Without `onConfirm` it shows only a close button. */
export function Dialog({ open, onClose, title, children, confirmLabel, cancelLabel, onConfirm, danger, busy, confirmDisabled, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useT(common);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const onBackdrop = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === ref.current) onClose();
  };

  return (
    <dialog
      ref={ref}
      className={`ui-dialog ${className ?? ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={onBackdrop}
    >
      {open ? (
        <div className="ui-dialog-inner">
          <ToastEcho />
          <h2 className="type-h3">{title}</h2>
          {children ? <div className="ui-dialog-body">{children}</div> : null}
          <div className="ui-dialog-actions">
            <Button variant="ghost" onClick={onClose}>
              {cancelLabel ?? (onConfirm ? t.cancel : t.close)}
            </Button>
            {onConfirm ? (
              <Button variant={danger ? "danger" : "solid"} busy={busy} disabled={confirmDisabled} onClick={onConfirm}>
                {confirmLabel ?? t.confirm}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
