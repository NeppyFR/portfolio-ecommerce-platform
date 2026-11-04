"use client";

import { screenById, type ScreenId } from "@/desk/registry";
import { useLang } from "@/i18n";

type Props = { id: ScreenId; label?: undefined } | { label: string; id?: undefined };

/** Placeholder for an unfinished screen. The crawl fails on it unless --allow-stubs is passed. */
export function ScreenStub(props: Props) {
  const lang = useLang();
  const title = props.id ? screenById(props.id)[lang] : props.label;
  return (
    <div data-screen-stub={props.id ?? props.label} style={{ padding: "var(--s-7) var(--gutter)" }}>
      <p className="type-mono-s">Stub screen</p>
      <h1 className="type-title">{title}</h1>
    </div>
  );
}
