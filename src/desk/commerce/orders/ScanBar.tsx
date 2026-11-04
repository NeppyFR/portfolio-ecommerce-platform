"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CircleAlert, CircleCheck, ScanLine, TriangleAlert } from "lucide-react";
import { Button } from "@/ui";

export type ScanMessage = { tone: "ok" | "warn" | "bad"; text: string; action?: ReactNode };

export type ScanBarProps = {
  label: string;
  placeholder: string;
  onScan: (code: string) => void;
  message?: ScanMessage | null;
  nextLabel: string;
  nextTitle: string;
  /** Returns the next code a scanner would read, or null when there is none to feed. */
  nextCode: () => string | null;
  className?: string;
};

const ICONS = { ok: CircleCheck, warn: TriangleAlert, bad: CircleAlert };

/** Typed input plus a demo button that feeds a code. Scanners act as keyboards, so Enter ends a scan. */
export function ScanBar({ label, placeholder, onScan, message, nextLabel, nextTitle, nextCode, className }: ScanBarProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const code = value.trim();
    if (!code) return;
    onScan(code);
    setValue("");
  };
  const Icon = message ? ICONS[message.tone] : null;
  return (
    <div className={`or-scan ${className ?? ""}`}>
      <form className="or-scan-form" onSubmit={submit}>
        <label htmlFor={id} className="type-label or-scan-label">
          {label}
        </label>
        <span className="or-scan-field">
          <ScanLine size={16} aria-hidden="true" />
          <input ref={input} id={id} className="ui-input" autoComplete="off" spellCheck={false} placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
        </span>
        <Button
          variant="outline"
          title={nextTitle}
          onClick={() => {
            const code = nextCode();
            if (code) onScan(code);
          }}
        >
          {nextLabel}
        </Button>
      </form>
      <div className="or-scan-msg type-small" aria-live="polite" data-tone={message?.tone}>
        {message && Icon ? (
          <>
            <Icon size={14} aria-hidden="true" />
            <span>{message.text}</span>
            {message.action}
          </>
        ) : null}
      </div>
    </div>
  );
}
