"use client";

import type { KeyboardEvent, ReactNode } from "react";

export type Column<T> = { key: string; header: ReactNode; cell: (row: T) => ReactNode; align?: "left" | "right"; phone?: boolean; width?: string };
export type TableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** The phone card. Without it, the card prints the columns flagged `phone`, the first as its top line. */
  phoneRow?: (row: T) => ReactNode;
  selectedKey?: string | null;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  caption?: string;
  className?: string;
};

function DefaultCard<T>({ columns, row }: { columns: Column<T>[]; row: T }) {
  const shown = columns.filter((c) => c.phone);
  const [first, ...rest] = shown.length ? shown : columns;
  return (
    <>
      <div className="ui-table-card-top">{first?.cell(row)}</div>
      <div className="ui-table-card-rest type-small">
        {rest.map((c) => (
          <span key={c.key} data-align={c.align}>
            {c.cell(row)}
          </span>
        ))}
      </div>
    </>
  );
}

/**
 * A real table from 720 px up. On a phone a `<ul>` of two-line cards instead, never a sideways-scrolling table.
 * Both render and CSS shows one, so the server output needs no width.
 */
export function Table<T>({ columns, rows, rowKey, phoneRow, selectedKey, onRowClick, empty, caption, className }: TableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  const keyOpen = (row: T) => (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onRowClick?.(row);
    }
  };
  return (
    <div className={`ui-table-wrap ${className ?? ""}`}>
      <table className="ui-table">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className="type-mono-s" data-align={c.align} style={c.width ? { width: c.width } : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const key = rowKey(r);
            const selected = key === selectedKey;
            return (
              <tr
                key={key}
                data-selected={selected || undefined}
                data-clickable={onRowClick ? true : undefined}
                aria-current={selected ? "true" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                onKeyDown={onRowClick ? keyOpen(r) : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} data-align={c.align}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <ul className="ui-table-cards">
        {rows.map((r) => {
          const key = rowKey(r);
          return (
            <li key={key} className="ui-table-card" data-selected={key === selectedKey || undefined} data-clickable={onRowClick ? true : undefined} tabIndex={onRowClick ? 0 : undefined} onClick={onRowClick ? () => onRowClick(r) : undefined} onKeyDown={onRowClick ? keyOpen(r) : undefined}>
              {phoneRow ? phoneRow(r) : <DefaultCard columns={columns} row={r} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
