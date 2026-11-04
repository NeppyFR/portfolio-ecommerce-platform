"use client";

import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { fmt, useDocTitle, useT } from "@/i18n";
import { shop } from "@/i18n/dict/shop";
import { LABEL } from "@/lib/brand";
import { setParam } from "@/lib/routes";
import { SEARCH_MAX_LENGTH, searchProducts } from "@/lib/search";
import { Wall, useActiveProducts } from "./parts";

/** Underlined field, status line, results wall. Matching folds accents and reads both languages. */
export function SearchScreen() {
  const params = useSearchParams();
  const t = useT(shop);
  useDocTitle(t.search.title);
  const products = useActiveProducts();
  const query = params.get("q") ?? "";
  const [typed, setTyped] = useState<string | null>(null);
  const shown = typed ?? query;
  const results = useMemo(() => (query.trim() ? searchProducts(products, query) : []), [products, query]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setParam("q", shown.trim().slice(0, SEARCH_MAX_LENGTH));
  };
  const line = !query.trim() ? null : results.length === 0 ? fmt(t.search.none, { q: query }) : results.length === 1 ? fmt(t.search.resultsOne, { q: query }) : fmt(t.search.results, { n: results.length, q: query });
  return (
    <>
      <div className="sp-page sp-search-page">
        <header className="sp-page-head">
          <p className="sp-eyebrow">{LABEL.name}</p>
          <h1 className="type-shop-h2">{t.search.title}</h1>
        </header>
        <form className="sp-search" role="search" onSubmit={submit}>
          <label className="sr-only" htmlFor="sp-q">
            {t.search.label}
          </label>
          <Search size={22} aria-hidden="true" />
          <input id="sp-q" type="search" value={shown} maxLength={SEARCH_MAX_LENGTH} placeholder={t.search.label} onChange={(e) => setTyped(e.target.value)} />
          <button type="submit" className="ui-btn ui-btn-outline">
            {t.search.button}
          </button>
        </form>
        <p className="type-body sp-search-line" role="status">
          {line}
        </p>
      </div>
      {results.length ? <Wall products={results} /> : null}
    </>
  );
}
