"use client";

import { useId, useRef, type ReactNode, type ToggleEvent } from "react";

type PopoverProps = {
  label: string;
  title?: string;
  triggerClassName?: string;
  panelClassName?: string;
  /** Which edge of the trigger the panel lines up with. */
  align?: "start" | "end";
  trigger: ReactNode;
  children: ReactNode;
};

/** Native popover: light dismiss, Esc and focus return come from the browser. Clicking a link or [data-close] closes it. */
export function Popover({ label, title, triggerClassName, panelClassName, align = "end", trigger, children }: PopoverProps) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  function place(event: ToggleEvent<HTMLDivElement>) {
    if (event.newState !== "open" || !button.current || !panel.current) return;
    const box = button.current.getBoundingClientRect();
    panel.current.style.top = `${Math.round(box.bottom + 8)}px`;
    if (align === "start") panel.current.style.left = `${Math.max(8, Math.round(box.left))}px`;
    else panel.current.style.right = `${Math.max(8, Math.round(window.innerWidth - box.right))}px`;
  }

  return (
    <>
      <button ref={button} type="button" popoverTarget={id} aria-label={label} title={title} className={triggerClassName}>
        {trigger}
      </button>
      <div
        ref={panel}
        id={id}
        popover="auto"
        className={panelClassName ? `dk-pop ${panelClassName}` : "dk-pop"}
        onBeforeToggle={place}
        onClick={(event) => {
          if ((event.target as Element).closest("a,[data-close]")) panel.current?.hidePopover();
        }}
      >
        {children}
      </div>
    </>
  );
}
