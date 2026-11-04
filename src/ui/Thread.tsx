"use client";

export type ThreadStop = { key: "placed" | "paid" | "packed" | "shipped" | "delivered" | "books"; label: string; at: string | null; done: boolean };
export type ThreadProps = { stops: ThreadStop[]; className?: string };

/** Placed, Paid, Packed, Shipped, Delivered, In the books, with times. Sits on the order head's field. */
export function Thread({ stops, className }: ThreadProps) {
  return (
    <ol className={`ui-thread ${className ?? ""}`}>
      {stops.map((s) => (
        <li key={s.key} className="ui-thread-stop" data-done={s.done || undefined}>
          <span className="ui-thread-dot" aria-hidden="true" />
          <span className="type-label">{s.label}</span>
          <span className="type-mono-s ui-thread-at">{s.at ?? "–"}</span>
        </li>
      ))}
    </ol>
  );
}
