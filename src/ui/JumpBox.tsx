"use client";

import { Lock, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { searchJump, type JumpItem } from "@/desk/shell/jump-search";
import { fmt, useLang, useT } from "@/i18n";
import { shell } from "@/i18n/dict/shell";
import { setParams } from "@/lib/routes";
import { useStore } from "@/store/core";
import "@/store/actions/profile";

let opener: (() => void) | null = null;

/** Every Jump button calls this. The host is mounted once in the root layout. */
export function openJumpBox(): void {
  opener?.();
}

function JumpPanel({ onClose }: { onClose: () => void }) {
  const t = useT(shell);
  const lang = useLang();
  const router = useRouter();
  const pathname = usePathname();
  const state = useStore((s) => s);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const activeRow = useRef<HTMLDivElement>(null);

  const sections = useMemo(() => searchJump(state, query, lang), [state, query, lang]);
  const flat = useMemo(() => sections.flatMap((section) => section.items), [sections]);
  const active = flat[Math.min(activeIndex, flat.length - 1)] as JumpItem | undefined;

  useEffect(() => {
    activeRow.current?.scrollIntoView({ block: "nearest" });
  }, [active?.id]);

  function go(item: JumpItem) {
    onClose();
    // A record on the screen already opens through a history write, so Back closes it and the list keeps its filters.
    const target = new URL(item.href, document.baseURI);
    if (target.search && item.href.startsWith(`${pathname}?`)) setParams(Object.fromEntries(target.searchParams));
    else router.push(item.href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (flat.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (Math.min(index, flat.length - 1) + step + flat.length) % flat.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (active) go(active);
    }
  }

  const optionId = (item: JumpItem) => `${listId}-${item.id}`;

  return (
    <div className="flex max-h-[inherit] flex-col">
      <div className="flex flex-none items-center gap-2 border-b border-line pl-4 pr-2">
        <Search size={17} strokeWidth={1.75} className="flex-none text-ink-3" aria-hidden="true" />
        <input
          type="text"
          role="combobox"
          aria-label={t.jumpLabel}
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active ? optionId(active) : undefined}
          placeholder={t.jumpPlaceholder}
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          className="type-body-l h-[52px] min-w-0 flex-1 bg-transparent text-ink placeholder:text-ink-3"
          style={{ outline: "none", boxShadow: "none" }}
        />
        <button type="button" aria-label={t.jumpClose} onClick={onClose} className="grid size-11 flex-none place-items-center rounded-[var(--r-2)] text-ink-2 hover:bg-mist md:size-9">
          <X size={17} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      <div id={listId} role="listbox" aria-label={t.jumpLabel} className="min-h-0 flex-1 overflow-y-auto py-1">
        {flat.length === 0 ? <p className="type-small px-4 py-5 text-ink-2">{fmt(t.jumpNone, { q: query.trim() })}</p> : null}
        {sections.map((section) => (
          <div key={section.group} role="group" aria-label={t.jumpGroups[section.group]}>
            <p className="type-mono-s px-4 pb-1 pt-3 text-ink-3" aria-hidden="true">
              {t.jumpGroups[section.group]}
            </p>
            {section.items.map((item) => {
              const Icon = item.icon;
              const on = item.id === active?.id;
              return (
                <div
                  key={item.id}
                  ref={on ? activeRow : undefined}
                  id={optionId(item)}
                  role="option"
                  aria-selected={on}
                  onClick={() => go(item)}
                  onMouseMove={() => setActiveIndex(flat.indexOf(item))}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 px-4 py-1.5 ${on ? "bg-[var(--mist-2)]" : ""}`}
                >
                  <Icon size={16} strokeWidth={1.75} className="flex-none text-ink-2" aria-hidden="true" />
                  <span className="type-label min-w-0 flex-1 text-ink">{item.label}</span>
                  {item.locked ? <Lock size={13} strokeWidth={1.75} className="flex-none text-ink-3" aria-hidden="true" /> : null}
                  {item.hint ? <span className="type-mono-s min-w-0 text-right text-ink-3">{item.hint}</span> : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <p className="type-mono-s hidden flex-none border-t border-line px-4 py-2 text-ink-3 md:block">{t.jumpHint}</p>
    </div>
  );
}

export function JumpBox() {
  const t = useT(shell);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    opener = () => setOpen(true);
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((now) => !now);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      opener = null;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      el.querySelector("input")?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-label={t.jumpLabel}
      onClose={() => setOpen(false)}
      onClick={(event) => {
        if (event.target === dialog.current) setOpen(false);
      }}
      className="fixed inset-x-0 top-[8vh] bottom-auto m-0 mx-auto max-h-[80vh] w-[min(600px,calc(100vw-32px))] rounded-[var(--r-3)] border-0 bg-white p-0 text-ink opacity-100 shadow-[var(--float)] transition-opacity duration-[140ms] backdrop:bg-[rgba(10,31,99,.28)] starting:open:opacity-0 motion-reduce:transition-none md:top-[12vh] md:max-h-[76vh]"
    >
      {open ? <JumpPanel onClose={() => setOpen(false)} /> : null}
    </dialog>
  );
}
