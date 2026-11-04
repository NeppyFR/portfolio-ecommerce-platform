import { ORDER_PREFIX } from "@/lib/brand";

export type ScanResult =
  | { kind: "order"; number: string }
  | { kind: "sku"; sku: string }
  | { kind: "tracking"; value: string }
  | { kind: "gtin"; value: string }
  | { kind: "unknown"; value: string };

/** EAN-8, UPC-12, EAN-13 and GTIN-14 share one check digit rule. */
export function isGtin(value: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)) return false;
  const digits = [...value].map(Number);
  const check = digits.pop() as number;
  const sum = digits.reverse().reduce((total, d, i) => total + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Sorts what a scanner or a person typed. Case does not matter and bare digits may name an order. */
export function classifyScan(raw: string): ScanResult {
  const value = raw.trim().toUpperCase();
  if (new RegExp(`^${ORDER_PREFIX}\\d{4,}$`).test(value)) return { kind: "order", number: value };
  if (/^\d{4}$/.test(value)) return { kind: "order", number: `${ORDER_PREFIX}${value}` };
  if (/^BP\d{9}ZZ$/.test(value)) return { kind: "tracking", value };
  if (isGtin(value)) return { kind: "gtin", value };
  if (new RegExp(`^${ORDER_PREFIX}[A-Z0-9]+(-[A-Z0-9]+)+$`).test(value)) return { kind: "sku", sku: value };
  return { kind: "unknown", value };
}
