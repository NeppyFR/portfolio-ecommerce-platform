export const SEARCH_MAX_LENGTH = 60;
export const SEARCH_MAX_TERMS = 8;

/** NFD with accents stripped, lower case, `-` and `_` become spaces. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[-_]/g, " ");
}

/** Cut to 60 characters, split on anything that is not a letter or digit, at most 8 terms. */
export function searchTerms(query: string): string[] {
  return fold(query.trim().slice(0, SEARCH_MAX_LENGTH)).split(/[^\p{L}\p{N}]+/u).filter(Boolean).slice(0, SEARCH_MAX_TERMS);
}

/** Every term must be a substring of the joined, folded fields. No terms means no match. */
export function matchesTerms(terms: string[], fields: (string | null | undefined)[]): boolean {
  if (terms.length === 0) return false;
  const haystack = fold(fields.filter(Boolean).join(" "));
  return terms.every((term) => haystack.includes(term));
}

export const matchesSearch = (query: string, fields: (string | null | undefined)[]): boolean => matchesTerms(searchTerms(query), fields);

type Searchable = { slug: string; nameEn: string; nameDe: string; descriptionEn: string; descriptionDe: string; status: string };

/** Only active products, in shop order. Both languages match on either page. */
export function searchProducts<T extends Searchable>(products: T[], query: string): T[] {
  const terms = searchTerms(query);
  return products.filter((p) => p.status === "active" && matchesTerms(terms, [p.nameEn, p.nameDe, p.slug, p.descriptionEn, p.descriptionDe]));
}
