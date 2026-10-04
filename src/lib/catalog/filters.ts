/**
 * URL <-> filter state for listing pages. Kept framework-free so it can be used
 * in server components, client filter UI and tests alike.
 */
export const SORTS = {
  relevance: "Relevance",
  popular: "Popularity",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
  newest: "Newest First",
  discount: "Discount",
} as const;
export type SortKey = keyof typeof SORTS;

export interface ListingFilters {
  q?: string;
  brands: string[];
  minPrice?: number; // rupees
  maxPrice?: number; // rupees
  ram: number[];
  storage: number[];
  minDiscount?: number;
  minRating?: number;
  only5G: boolean;
  inStock: boolean;
  condition?: "new" | "demo";
  sort: SortKey;
  page: number;
}

type SP = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const list = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v.join(",") : (v ?? ""))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
const num = (v: string | string[] | undefined) => {
  const n = Number(first(v));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export function parseFilters(sp: SP): ListingFilters {
  const sort = first(sp.sort);
  const page = Math.max(1, Math.min(500, Math.floor(num(sp.page) ?? 1)));
  return {
    q: first(sp.q)?.trim().slice(0, 100) || undefined,
    brands: list(sp.brand).map((b) => b.toLowerCase()),
    minPrice: num(sp.min),
    maxPrice: num(sp.max),
    ram: list(sp.ram).map(Number).filter((n) => Number.isInteger(n) && n > 0),
    storage: list(sp.storage).map(Number).filter((n) => Number.isInteger(n) && n > 0),
    minDiscount: num(sp.discount),
    minRating: num(sp.rating),
    only5G: first(sp["5g"]) === "1",
    inStock: first(sp.instock) === "1",
    condition: first(sp.condition) === "demo" ? "demo" : first(sp.condition) === "new" ? "new" : undefined,
    sort: sort && sort in SORTS ? (sort as SortKey) : "relevance",
    page,
  };
}

export function filtersToSearchParams(f: Partial<ListingFilters>): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.brands?.length) p.set("brand", f.brands.join(","));
  if (f.minPrice !== undefined) p.set("min", String(f.minPrice));
  if (f.maxPrice !== undefined) p.set("max", String(f.maxPrice));
  if (f.ram?.length) p.set("ram", f.ram.join(","));
  if (f.storage?.length) p.set("storage", f.storage.join(","));
  if (f.minDiscount) p.set("discount", String(f.minDiscount));
  if (f.minRating) p.set("rating", String(f.minRating));
  if (f.only5G) p.set("5g", "1");
  if (f.inStock) p.set("instock", "1");
  if (f.condition) p.set("condition", f.condition);
  if (f.sort && f.sort !== "relevance") p.set("sort", f.sort);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  return p;
}

export function activeFilterCount(f: ListingFilters): number {
  return (
    f.brands.length +
    f.ram.length +
    f.storage.length +
    (f.minPrice !== undefined || f.maxPrice !== undefined ? 1 : 0) +
    (f.minDiscount ? 1 : 0) +
    (f.minRating ? 1 : 0) +
    (f.only5G ? 1 : 0) +
    (f.inStock ? 1 : 0) +
    (f.condition ? 1 : 0)
  );
}

export function formatStorage(gb: number): string {
  return gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024} TB` : `${gb} GB`;
}
