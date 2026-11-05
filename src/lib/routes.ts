/**
 * Every product and collection that exists at build time. `generateStaticParams` reads these,
 * and the seed must use exactly these slugs and handles (a test in tests/ can assert it).
 */
export const PRODUCT_TITLES: Record<string, string> = {
  "desk-lamp": "Desk Lamp",
  "lagoon-speaker": "Lagoon Speaker",
  "tall-lamp": "Tall Lamp",
  "logo-mug": "Logo Mug",
  "studio-mug": "Studio Mug",
  "trail-bottle": "Trail Bottle",
  "stoneware-planter": "Stoneware Planter",
  "shelf-speaker": "Shelf Speaker",
  "travel-pouch-cobalt": "Travel Pouch, Cobalt",
  "zip-pouch-lagoon": "Zip Pouch, Lagoon",
  "frost-candle": "Frost Candle",
  "logo-notebook-cloud": "Logo Notebook, Cloud",
  "frost-candle-trio": "Frost Candle Trio",
};

export const HIDDEN_COLLECTION_HANDLE = "frost-archive";

export const COLLECTION_TITLES: Record<string, string> = {
  essentials: "Essentials",
  lagoon: "Lagoon",
  "desk-and-travel": "Desk and travel",
  [HIDDEN_COLLECTION_HANDLE]: "Frost archive",
};

/** The route param for anything created at runtime; the real key arrives as a query parameter. */
export const RUNTIME_PARAM = "x";

export const SEED_PRODUCT_SLUGS = Object.keys(PRODUCT_TITLES);
export const SEED_COLLECTION_HANDLES = Object.keys(COLLECTION_TITLES);

export function productHref(slug: string): string {
  return slug in PRODUCT_TITLES ? `/shop/p/${slug}/` : `/shop/p/${RUNTIME_PARAM}/?slug=${encodeURIComponent(slug)}`;
}

export function collectionHref(handle: string): string {
  return handle in COLLECTION_TITLES ? `/shop/c/${handle}/` : `/shop/c/${RUNTIME_PARAM}/?handle=${encodeURIComponent(handle)}`;
}

export const orderHref = (orderNumber: string) => `/desk/orders/?o=${encodeURIComponent(orderNumber)}`;
export const slipHref = (orderNumber: string) => `/print/slip/?o=${encodeURIComponent(orderNumber)}`;
export const checkoutResultHref = (state: string, orderNumber?: string) =>
  `/shop/checkout/result/?state=${encodeURIComponent(state)}${orderNumber ? `&order=${encodeURIComponent(orderNumber)}` : ""}`;

/** The parameters that put a sheet or the order pane on screen. */
const SHEET_KEYS = ["open", "o"];
const hasSheet = (url: URL) => SHEET_KEYS.some((key) => url.searchParams.get(key));
/** Sorted and re-serialised, so two spellings of one address compare equal. */
const comparable = (url: URL) => {
  const copy = new URL(url);
  copy.searchParams.sort();
  return copy.href;
};

type ParamValues = Record<string, string | null | undefined>;
/** Writes that arrive while a history.back() is on its way. They apply when it lands, because until then the URL is still the old one. */
let afterBack: ParamValues | null = null;

/**
 * Query-only state on the current page (`?open=`, `?o=`, `?tab=`, `?filter=`). Next syncs these history calls with useSearchParams: no payload request, no scroll jump.
 * Filters, tabs, typed search and a swap from one sheet to another replace the entry. Opening a sheet or the order pane from none pushes one, so Back closes it.
 * That entry remembers where it came from in `sheetFrom`, which survives Back, Forward and a reload. Closing to that address steps back instead of writing a second copy of it, which would leave a Back press that does nothing. A deep-linked sheet has no such entry behind it and closes by replacing.
 * The state must never carry Next's own marker: its patched history calls skip their sync when they see it. Without the marker they add their own fields and keep ours.
 * A null or empty value removes the parameter.
 */
export function setParams(values: ParamValues): void {
  if (typeof window === "undefined") return;
  if (afterBack) {
    Object.assign(afterBack, values);
    return;
  }
  const before = new URL(document.URL);
  const url = new URL(document.URL);
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === "") url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  const sheetFrom: string | null = window.history.state?.sheetFrom ?? null;
  if (hasSheet(url) && !hasSheet(before)) {
    window.history.pushState({ sheetFrom: comparable(before) }, "", url);
    return;
  }
  if (hasSheet(before) && !hasSheet(url) && sheetFrom === comparable(url)) {
    afterBack = {};
    window.addEventListener(
      "popstate",
      () => {
        const waiting: ParamValues = afterBack ?? {};
        afterBack = null;
        if (Object.keys(waiting).length) setParams(waiting);
      },
      { once: true },
    );
    window.history.back();
    return;
  }
  window.history.replaceState(sheetFrom && hasSheet(url) ? { sheetFrom } : null, "", url);
}

export function setParam(key: string, value: string | null | undefined): void {
  setParams({ [key]: value });
}
