/**
 * CSV for Swiss Excel: UTF-8 BOM, semicolon, CRLF, every cell quoted, quotes doubled,
 * amounts like 1284.00, and a formula guard on text cells.
 */
const BOM = "﻿";
const FORMULA_START = /^\s*[=+\-@＝＋－＠]/;
const CONTROL_START = /^[\t\r\n]/;

export type CsvCell = string | number | null | undefined | { raw: string };

/** An amount cell: no thousands separator, two decimals, never formula-guarded. */
export function csvAmount(rappen: number): { raw: string } {
  const abs = Math.abs(Math.round(rappen));
  return { raw: `${rappen < 0 ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}` };
}

function cellText(cell: CsvCell): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "number") return String(cell);
  if (typeof cell === "object") return cell.raw;
  return CONTROL_START.test(cell) || FORMULA_START.test(cell) ? `'${cell}` : cell;
}

const quoted = (cell: CsvCell) => `"${cellText(cell).replaceAll('"', '""')}"`;

export function toCsv(header: string[], rows: CsvCell[][]): string {
  return `${BOM}${[header, ...rows].map((row) => row.map(quoted).join(";")).join("\r\n")}\r\n`;
}
