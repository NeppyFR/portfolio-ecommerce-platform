"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { CircleAlert } from "lucide-react";

type FieldBase = { label: ReactNode; error?: string | null; hint?: ReactNode };

export type FieldProps = FieldBase & { htmlFor?: string; children: ReactNode; describedById?: string; className?: string };

/** Label above, the control, then hint and error. A bare label takes `htmlFor`; the variants below wire it up. */
export function Field({ label, error, hint, htmlFor, children, describedById, className }: FieldProps) {
  return (
    <div className={`ui-field ${className ?? ""}`} data-invalid={error ? true : undefined}>
      <label className="ui-field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? (
        <p className="ui-field-hint" id={describedById ? `${describedById}-hint` : undefined}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="ui-field-error" id={describedById ? `${describedById}-error` : undefined} role="alert">
          <CircleAlert size={14} aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint: unknown, error: unknown, own?: string) {
  const parts = [own, hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
}

export type InputProps = FieldBase & InputHTMLAttributes<HTMLInputElement>;
export function Input({ label, error, hint, id, className, "aria-describedby": own, ...rest }: InputProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={fieldId} describedById={fieldId} className={className}>
      <input id={fieldId} className="ui-input" aria-invalid={error ? true : undefined} aria-describedby={describedBy(fieldId, hint, error, own)} {...rest} />
    </Field>
  );
}

export type SelectProps = FieldBase & SelectHTMLAttributes<HTMLSelectElement>;
export function Select({ label, error, hint, id, children, className, "aria-describedby": own, ...rest }: SelectProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={fieldId} describedById={fieldId} className={className}>
      <select id={fieldId} className="ui-input ui-select" aria-invalid={error ? true : undefined} aria-describedby={describedBy(fieldId, hint, error, own)} {...rest}>
        {children}
      </select>
    </Field>
  );
}

export type TextareaProps = FieldBase & TextareaHTMLAttributes<HTMLTextAreaElement>;
export function Textarea({ label, error, hint, id, className, "aria-describedby": own, ...rest }: TextareaProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={fieldId} describedById={fieldId} className={className}>
      <textarea id={fieldId} className="ui-input ui-textarea" aria-invalid={error ? true : undefined} aria-describedby={describedBy(fieldId, hint, error, own)} {...rest} />
    </Field>
  );
}

const toText = (minor: number | null) => (minor === null ? "" : (minor / 100).toFixed(2));

/** Reads `1284.00`, `1284`, `1'284.50` or `1284,5`; anything else is null. */
export function parseMoney(text: string): number | null {
  const cleaned = text.replace(/['\s ]/g, "").replace(",", ".");
  if (cleaned === "" || cleaned === "-" || cleaned === "." || !/^-?\d*(\.\d{0,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/** Value in integer Rappen (or minor units); the field shows and parses `1284.00`. */
export type MoneyInputProps = FieldBase & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value: number | null; onChange: (minor: number | null) => void; currency?: string };
export function MoneyInput({ value, onChange, currency = "CHF", onBlur, ...rest }: MoneyInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="ui-money-input" data-currency={currency}>
      <Input
        {...rest}
        inputMode="decimal"
        value={draft ?? toText(value)}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(parseMoney(e.target.value));
        }}
        onBlur={(e) => {
          setDraft(null);
          onBlur?.(e);
        }}
      />
    </div>
  );
}

export type DateInputProps = InputProps;
export function DateInput(props: DateInputProps) {
  return <Input type="date" {...props} />;
}
