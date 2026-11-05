import { fold, matchesTerms, searchTerms } from "@/lib/search";
import type { FileCategory, FileKind, FileRecord, FileVersion, Person } from "@/store/types";

export const TRASH_DAYS = 30;
export const MAX_FILE_BYTES = 2_000_000_000;
export const CATEGORIES: FileCategory[] = ["logo", "draft", "prototype", "final", "other"];
export const KINDS: FileKind[] = ["image", "pdf", "design", "archive", "video"];
export const SEARCH_MAX = 80;

/** `brand` holds files with no drop. `all` is a view, not a place. */
export type Where = string;
export type FileSort = "newest" | "name" | "size";
export type FileQuery = { where: Where; category: FileCategory | "all"; q: string; sort: FileSort; by: Person | "all"; type: FileKind | "all" };
export const NO_QUERY: FileQuery = { where: "all", category: "all", q: "", sort: "newest", by: "all", type: "all" };

const EXT_KIND: Record<string, FileKind> = { png: "image", jpg: "image", jpeg: "image", webp: "image", avif: "image", svg: "image", pdf: "pdf", ai: "design", eps: "design", psd: "design", fig: "design", zip: "archive", mp4: "video", mov: "video", webm: "video" };

export const ACCEPTED_EXTENSIONS = Object.keys(EXT_KIND);
export const kindOfExtension = (ext: string): FileKind | null => EXT_KIND[ext.toLowerCase()] ?? null;

export const extensionOf = (name: string): string => {
  const at = name.lastIndexOf(".");
  return at > 0 ? name.slice(at + 1).toLowerCase() : "";
};

/** `lamp_front-graphic.pdf` gives `lamp front graphic`. */
export const titleFromName = (name: string): string => {
  const at = name.lastIndexOf(".");
  return (at > 0 ? name.slice(0, at) : name).replace(/[-_]+/g, " ").trim().slice(0, 120);
};

export type PickedFile = { name: string; size: number; type: string };
export type PickProblem = "type" | "size";
export const pickProblem = (file: PickedFile): PickProblem | null => (!kindOfExtension(extensionOf(file.name)) ? "type" : file.size > MAX_FILE_BYTES ? "size" : null);

export const currentVersion = (file: Pick<FileRecord, "versions">): FileVersion => file.versions[file.versions.length - 1];
export const fileBytes = (file: Pick<FileRecord, "versions">): number => currentVersion(file).bytes;
export const whereOf = (file: Pick<FileRecord, "dropId">): string => file.dropId ?? "brand";

export const liveFiles = (files: FileRecord[]): FileRecord[] => files.filter((f) => f.trashedAt === null);
export const trashedFiles = (files: FileRecord[]): FileRecord[] => files.filter((f) => f.trashedAt !== null).sort((a, b) => (b.trashedAt ?? "").localeCompare(a.trashedAt ?? ""));
export const totalBytes = (files: FileRecord[]): number => files.reduce((sum, f) => sum + fileBytes(f), 0);

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

const matchesPlace = (file: FileRecord, q: FileQuery) => q.where === "all" || whereOf(file) === q.where;

/** Accent-folded, also matches the extension, so `entwurfe` finds `Entwürfe`. */
function matchesText(file: FileRecord, query: string): boolean {
  if (!query.trim()) return true;
  return matchesTerms(searchTerms(query.slice(0, SEARCH_MAX)), [file.title, file.notes, file.ext, ...file.tags]);
}

const matchesRest = (file: FileRecord, q: FileQuery) => matchesPlace(file, q) && matchesText(file, q.q) && (q.by === "all" || currentVersion(file).by === q.by) && (q.type === "all" || file.kind === q.type);

export function filterFiles(files: FileRecord[], q: FileQuery): FileRecord[] {
  const shown = liveFiles(files).filter((f) => matchesRest(f, q) && (q.category === "all" || f.category === q.category));
  const sorted = [...shown];
  if (q.sort === "name") sorted.sort((a, b) => collator.compare(a.title, b.title));
  else if (q.sort === "size") sorted.sort((a, b) => fileBytes(b) - fileBytes(a) || collator.compare(a.title, b.title));
  else sorted.sort((a, b) => Date.parse(currentVersion(b).at) - Date.parse(currentVersion(a).at) || collator.compare(a.title, b.title));
  return sorted;
}

/** One count per category tab. They respect the current place and filters, not the category itself. */
export function categoryCounts(files: FileRecord[], q: FileQuery): Record<FileCategory | "all", number> {
  const shown = liveFiles(files).filter((f) => matchesRest(f, q));
  const out = { all: shown.length, logo: 0, draft: 0, prototype: 0, final: 0, other: 0 };
  shown.forEach((f) => {
    out[f.category] += 1;
  });
  return out;
}

export const whereCount = (files: FileRecord[], where: Where): number => liveFiles(files).filter((f) => where === "all" || whereOf(f) === where).length;

export const isFiltered = (q: FileQuery): boolean => q.q.trim() !== "" || q.by !== "all" || q.type !== "all";

const DAY_MS = 86_400_000;

/** `30 − floor(age in days)`, never below 0. */
export const daysLeft = (trashedAt: string, nowMs: number): number => Math.max(0, TRASH_DAYS - Math.max(0, Math.floor((nowMs - Date.parse(trashedAt)) / DAY_MS)));

export type RelativeTime = { unit: "now" | "minutes" | "hours" | "yesterday" | "days" | "weeks" | "date"; n: number };

export function relativeTime(iso: string, nowMs: number): RelativeTime {
  const ms = nowMs - Date.parse(iso);
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return { unit: "now", n: 0 };
  if (minutes < 60) return { unit: "minutes", n: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { unit: "hours", n: hours };
  const days = Math.floor(hours / 24);
  if (days === 1) return { unit: "yesterday", n: 1 };
  if (days < 7) return { unit: "days", n: days };
  if (days < 30) return { unit: "weeks", n: Math.floor(days / 7) };
  return { unit: "date", n: days };
}

/** Comma separated, trimmed, duplicates gone, order kept. */
export function parseTags(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(",")
    .map((t) => t.trim())
    .filter((t) => {
      const key = fold(t);
      if (!t || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export const canPromote = (file: Pick<FileRecord, "category">): boolean => file.category === "draft" || file.category === "prototype";
