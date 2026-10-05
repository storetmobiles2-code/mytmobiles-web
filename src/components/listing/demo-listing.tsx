"use client";

import { useMemo, useSyncExternalStore } from "react";
import { SearchX } from "lucide-react";
import { activeFilterCount, parseFilters, type ListingFilters } from "@/lib/catalog/filters";
import type { Facets, ProductCardData } from "@/lib/catalog/queries";
import { DEMO_FILTERS_EVENT, matchesQuery } from "@/lib/demo";
import { ProductGrid } from "@/components/product/product-card";
import { EmptyState } from "@/components/ui/misc";
import { FiltersForm, SortSelect } from "./filters-form";

export interface DemoListingMeta {
  keywords: string[];
  variants: { price: number; ramGb: number | null; storageGb: number | null }[];
}

/** Applies the same rules as buildWhere()/orderBy() in lib/catalog/queries.ts. */
function apply(items: ProductCardData[], meta: Record<string, DemoListingMeta>, f: ListingFilters) {
  const out = items.filter((p) => {
    const m = meta[p.id];
    if (f.q && !matchesQuery({ name: p.name, brand: p.brand, keywords: m?.keywords ?? [] }, f.q)) return false;
    if (f.condition && p.condition !== (f.condition === "demo" ? "DEMO" : "NEW")) return false;
    if (f.brands.length && !f.brands.includes(p.brand.slug)) return false;
    if (f.only5G && !p.is5G) return false;
    if (f.inStock && !p.inStock) return false;
    if (f.minDiscount && p.discountPct < f.minDiscount) return false;
    if (f.minRating && p.ratingAvg < f.minRating) return false;
    const needsVariant = f.minPrice !== undefined || f.maxPrice !== undefined || f.ram.length || f.storage.length;
    if (needsVariant) {
      return (m?.variants ?? []).some(
        (v) =>
          (f.minPrice === undefined || v.price >= f.minPrice * 100) &&
          (f.maxPrice === undefined || v.price <= f.maxPrice * 100) &&
          (!f.ram.length || (v.ramGb !== null && f.ram.includes(v.ramGb))) &&
          (!f.storage.length || (v.storageGb !== null && f.storage.includes(v.storageGb))),
      );
    }
    return true;
  });
  const time = (d: Date | string | null) => (d ? new Date(d).getTime() : 0);
  switch (f.sort) {
    case "price-asc":
      return out.sort((a, b) => a.priceFrom - b.priceFrom);
    case "price-desc":
      return out.sort((a, b) => b.priceFrom - a.priceFrom);
    case "newest":
      return out.sort((a, b) => time(b.launchedAt) - time(a.launchedAt));
    case "discount":
      return out.sort((a, b) => b.discountPct - a.discountPct || a.priceFrom - b.priceFrom);
    case "popular":
      return out.sort((a, b) => b.ratingCount - a.ratingCount || b.ratingAvg - a.ratingAvg);
    default:
      return out; // server order is the relevance order
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(DEMO_FILTERS_EVENT, onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener(DEMO_FILTERS_EVENT, onChange);
    window.removeEventListener("popstate", onChange);
  };
}

/**
 * Listing for the static preview: the server renders every product in scope and
 * the browser applies the URL's filters, so filter and sort links keep working
 * without a server.
 */
export function DemoListing({
  title,
  description,
  basePath,
  items,
  meta,
  facets,
  showBrandFilter,
  showConditionFilter,
}: {
  title: string;
  description?: string;
  basePath: string;
  items: ProductCardData[];
  meta: Record<string, DemoListingMeta>;
  facets: Facets;
  showBrandFilter: boolean;
  showConditionFilter: boolean;
}) {
  const query = useSyncExternalStore(subscribe, () => location.search.replace(/^\?/, ""), () => "");

  const filters = useMemo(() => parseFilters(Object.fromEntries(new URLSearchParams(query))), [query]);
  const shown = useMemo(() => apply([...items], meta, filters), [items, meta, filters]);
  const active = activeFilterCount(filters);
  const heading = basePath === "/search" && filters.q ? `Results for “${filters.q}”` : title;
  const clear = () => {
    history.pushState(null, "", filters.q ? `${location.pathname}?q=${encodeURIComponent(filters.q)}` : location.pathname);
    window.dispatchEvent(new Event(DEMO_FILTERS_EVENT));
  };

  return (
    <>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{heading}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {shown.length.toLocaleString("en-IN")} {shown.length === 1 ? "product" : "products"}
            {description ? ` · ${description}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Keyed by the query so the uncontrolled inputs pick up the current filters */}
          <FiltersForm key={`m-${query}`} mode="mobile" filters={filters} facets={facets} showBrand={showBrandFilter} showCondition={showConditionFilter} />
          <SortSelect key={`s-${query}`} value={filters.sort} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <div className="card sticky top-36 max-h-[calc(100dvh-10rem)] overflow-y-auto px-4 py-1">
            <div className="flex items-center justify-between pt-3">
              <h2 className="font-bold">Filters</h2>
              {active > 0 && (
                <button type="button" onClick={clear} className="text-xs font-semibold text-brand-700 hover:underline">
                  Clear all ({active})
                </button>
              )}
            </div>
            <FiltersForm key={`d-${query}`} mode="desktop" filters={filters} facets={facets} showBrand={showBrandFilter} showCondition={showConditionFilter} />
          </div>
        </aside>
        <section aria-labelledby="products-heading">
          <h2 id="products-heading" className="sr-only">Products</h2>
          {shown.length ? (
            <ProductGrid products={shown} priorityCount={4} />
          ) : (
            <EmptyState
              icon={<SearchX className="h-7 w-7" />}
              title="No products match these filters"
              action={
                <button type="button" onClick={clear} className="inline-flex h-11 items-center rounded-xl border border-ink-300 px-5 font-semibold">
                  Clear filters
                </button>
              }
            >
              Try removing a filter or searching for something else.
            </EmptyState>
          )}
        </section>
      </div>
    </>
  );
}
