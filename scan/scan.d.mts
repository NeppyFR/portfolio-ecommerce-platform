export type Denylist = {
  orderPrefix: string | null;
  regexes: { id: string; re: RegExp; skipOut: boolean }[];
  tokens: { id: string; value: string; mode: "token" | "sub" }[];
  allow: { file: string; token: string }[];
};
export type ScanFailure = { file: string; line: number; rule: string };
export type ScanLog = { error: (line: string) => void; warn: (line: string) => void; log: (line: string) => void };

export function tokenise(text: string): string[];
export function loadDenylist(file: string | null): Denylist;
export function privateHits(line: string, deny: Denylist, options?: { minLength?: number; maxLength?: number; out?: boolean }): string[];
export function genericHits(line: string, deny: Pick<Denylist, "orderPrefix">): string[];
export function placeOf(rel: string): "own" | "private-only";
export function runScan(options: { root?: string; denylist?: string | null; log?: ScanLog }): ScanFailure[];
export function argValue(argv: string[], name: string): string | null;
