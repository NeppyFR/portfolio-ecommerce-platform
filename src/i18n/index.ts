"use client";

import { useEffect, useSyncExternalStore } from "react";
import { PROJECT, STORAGE_KEYS } from "@/lib/brand";
import type { Lang } from "@/store/types";

export type { Lang };
export type Dict<T> = { en: T; de: T };

let current: Lang | null = null;
const listeners = new Set<() => void>();

function read(): Lang {
  if (current) return current;
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEYS.lang);
  } catch {
    stored = null;
  }
  current = stored === "de" ? "de" : "en";
  return current;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, read, () => "en");
}

export function setLang(lang: Lang): void {
  current = lang;
  try {
    window.localStorage.setItem(STORAGE_KEYS.lang, lang);
  } catch {
    /* storage can be blocked; the choice still holds for this page's memory */
  }
  document.documentElement.lang = lang;
  listeners.forEach((l) => l());
}

export function useT<T>(dict: Dict<T>): T {
  return dict[useLang()];
}

/** `fmt("{n} to pack", { n: 14 })`. An unknown placeholder stays visible, so a typo shows up in review. */
export function fmt(str: string, vars: Record<string, string | number>): string {
  return str.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

export function plural(n: number, one: string, other: string): string {
  return n === 1 ? one : other;
}

const docTitles: string[] = [];
const applyDocTitle = () => {
  const wanted = docTitles[docTitles.length - 1];
  if (wanted && document.title !== wanted) document.title = wanted;
};
let docTitleWatch: MutationObserver | null = null;

/**
 * The browser tab in the page's language. Static metadata stays as the first value and for the exported HTML.
 * The router writes its English title on client navigation, possibly after this effect, so a watcher puts this one back.
 * Text null means the bare project title; undefined means this screen has no say, because a child such as the not-found body does.
 */
export function useDocTitle(text: string | null | undefined): void {
  useEffect(() => {
    if (text === undefined) return;
    const full = text === null ? PROJECT.title : `${text} · ${PROJECT.title}`;
    docTitles.push(full);
    applyDocTitle();
    docTitleWatch ??= new MutationObserver(applyDocTitle);
    docTitleWatch.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => {
      docTitles.splice(docTitles.lastIndexOf(full), 1);
      if (docTitles.length) applyDocTitle();
      else docTitleWatch?.disconnect();
    };
  }, [text]);
}

/** Mounted once in the root layout, so `<html lang>` follows the toggle on every surface. */
export function LangSync(): null {
  const lang = useLang();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}
