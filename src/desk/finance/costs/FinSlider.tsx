"use client";

import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { stopIndexFor } from "../rules/planner";

export type FinSliderProps = {
  label: string;
  /** The values the thumb snaps to. Stepped, not linear. */
  stops: number[];
  value: number;
  onChange: (value: number) => void;
  /** The current value in words, for the bubble and for screen readers. */
  valueText: string;
  /** Second line of the bubble: what this value adds to the bill, so the eye can stay on the thumb. */
  bubbleNote?: string;
  /** Printed inside the exact box, e.g. `GB`. */
  unit?: string;
  /** The stop where included usage ends. Up to it the fill is blue, past it violet. */
  includedIndex?: number | null;
  exactText: (value: number) => string;
  /** Null when the typed text is not a value. */
  parseExact: (text: string) => number | null;
  exactAria: string;
  /** Left of the footer: the included note. */
  note?: ReactNode;
  /** Right of the footer: what this slider adds to the bill. */
  charge?: ReactNode;
  error?: string | null;
  onInvalid?: (invalid: boolean) => void;
  disabled?: boolean;
};

const MAX_DOTS = 12;

/**
 * The native range stays on top for pointer, touch and keys, so it snaps stop by stop and stays accessible.
 * Only the rail under it is drawn: the thumb glides between stops by transform, the bubble rides on the thumb while it is held,
 * and the fill turns violet at the point where usage starts to cost money.
 */
export function FinSlider({ label, stops, value, onChange, valueText, bubbleNote, unit, includedIndex, exactText, parseExact, exactAria, note, charge, error, onInvalid, disabled }: FinSliderProps) {
  const id = useId();
  const [typed, setTyped] = useState<string | null>(null);
  const [held, setHeld] = useState(false);
  const last = Math.max(1, stops.length - 1);
  const index = stopIndexFor(stops, value);
  const p = (index / last) * 100;
  const hasIncluded = includedIndex !== null && includedIndex !== undefined;
  const inc = hasIncluded ? (includedIndex / last) * 100 : 100;
  const within = Math.min(p, inc);
  const over = Math.max(0, p - inc);
  const invalid = typed !== null && parseExact(typed) === null;

  /* A press can end anywhere on the page, so the release is heard on the window. */
  useEffect(() => {
    if (!held) return;
    const release = () => setHeld(false);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [held]);

  return (
    <div className="fin-sl" data-over={over > 0 || undefined} data-held={held || undefined}>
      <div className="fin-sl-top">
        <label className="fin-sl-label" htmlFor={id}>
          {label}
        </label>
        <span className="fin-sl-num" data-invalid={invalid || undefined}>
          <input
            className="fin-sl-box"
            inputMode="decimal"
            aria-label={exactAria}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            value={typed ?? exactText(value)}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const text = e.target.value;
              setTyped(text);
              const parsed = parseExact(text);
              onInvalid?.(parsed === null);
              if (parsed !== null) onChange(parsed);
            }}
            onBlur={() => {
              setTyped(null);
              onInvalid?.(false);
            }}
          />
          {unit ? <span className="fin-sl-unit">{unit}</span> : null}
        </span>
      </div>
      <div className="fin-rng">
        <input
          id={id}
          type="range"
          min={0}
          max={stops.length - 1}
          step={1}
          value={index}
          disabled={disabled}
          aria-valuetext={bubbleNote ? `${valueText}, ${bubbleNote}` : valueText}
          onPointerDown={() => setHeld(true)}
          onChange={(e) => {
            setTyped(null);
            onInvalid?.(false);
            onChange(stops[Number(e.target.value)]);
          }}
        />
        <div className="fin-rng-rail" aria-hidden="true" style={{ "--p": p } as CSSProperties}>
          <div className="fin-rng-track">
            <i className="fin-rng-lead" />
            {hasIncluded ? <i className="fin-rng-free" style={{ transform: `scaleX(${inc / 100})` }} /> : null}
            <i className="fin-rng-in" style={{ transform: `scaleX(${within / 100})` }} />
            <i className="fin-rng-over" style={{ transform: `translateX(${inc}%) scaleX(${over / 100})` }} />
          </div>
          {stops.length <= MAX_DOTS ? stops.map((stop, i) => <i key={`${stop}-${i}`} className="fin-rng-stop" data-on={i < index || undefined} style={{ left: `${(i / last) * 100}%` }} />) : null}
          {hasIncluded ? <i className="fin-rng-tick" style={{ left: `${inc}%` }} /> : null}
          <div className="fin-rng-mover" style={{ transform: `translateX(${p}%)` }}>
            <span className="fin-rng-halo" />
            <span className="fin-rng-bubble" style={{ transform: `translateX(${-p}%)` }}>
              <span className="fin-rng-bubble-in">
                <b>{valueText}</b>
                {bubbleNote ? <em>{bubbleNote}</em> : null}
              </span>
            </span>
            <span className="fin-rng-thumb">
              <span key={index} className="fin-rng-pip" />
            </span>
          </div>
        </div>
      </div>
      {note || charge ? (
        <div className="fin-sl-foot">
          <span>{note}</span>
          {charge}
        </div>
      ) : null}
      {invalid && error ? (
        <p className="ui-field-error" role="alert">
          <CircleAlert size={14} aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
