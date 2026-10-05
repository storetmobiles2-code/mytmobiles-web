import Link from "next/link";
import { SearchX } from "lucide-react";
import { activeFilterCount, filtersToSearchParams, parseFilters, type ListingFilters } from "@/lib/catalog/filters";
import { demoListingMeta, listingFacets, listProducts, type ListingScope } from "@/lib/catalog/queries";
import { DEMO } from "@/lib/demo";
import { DemoListing } from "./demo-listing";
import { ProductGrid } from "@/components/product/product-card";
import { Breadcrumbs, EmptyState, Pagination, type Crumb } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { FiltersForm, SortSelect } from "./filters-form";
import { JsonLd } from "@/components/seo/json-ld";

export async function ListingView({
  title,
  description,
  crumbs,
  basePath,
  filters,
  scope,
  showBrandFilter = true,
  showConditionFilter = true,
}: {
  title: string;
  description?: string;
  crumbs: Crumb[];
  basePath: string;
  filters: ListingFilters;
  scope: ListingScope;
  showBrandFilter?: boolean;
  showConditionFilter?: boolean;
}) {
  if (DEMO) return <DemoListingView {...{ title, description, crumbs, basePath, scope, showBrandFilter, showConditionFilter }} />;
  const [{ items, total, pages }, facets] = await Promise.all([listProducts(filters, scope), listingFacets({ ...scope, q: filters.q })]);
  const active = activeFilterCount(filters);
  const hrefFor = (page: number) => {
    const p = filtersToSearchParams({ ...filters, page });
    const qs = p.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return (
    <div className="container-page py-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, ...(c.href ? { item: `${site}${c.href}` } : {}) })),
        }}
      />
      <Breadcrumbs items={crumbs} />
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {total.toLocaleString("en-IN")} {total === 1 ? "product" : "products"}
            {description ? ` · ${description}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FiltersForm mode="mobile" filters={filters} facets={facets} showBrand={showBrandFilter} showCondition={showConditionFilter} />
          <SortSelect value={filters.sort} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <div className="card sticky top-36 max-h-[calc(100dvh-10rem)] overflow-y-auto px-4 py-1">
            <div className="flex items-center justify-between pt-3">
              <h2 className="font-bold">Filters</h2>
              {active > 0 && (
                <Link href={filters.q ? `${basePath}?q=${encodeURIComponent(filters.q)}` : basePath} className="text-xs font-semibold text-brand-700 hover:underline">
                  Clear all ({active})
                </Link>
              )}
            </div>
            <FiltersForm mode="desktop" filters={filters} facets={facets} showBrand={showBrandFilter} showCondition={showConditionFilter} />
          </div>
        </aside>
        <section aria-labelledby="products-heading">
          <h2 id="products-heading" className="sr-only">Products</h2>
          {items.length ? (
            <>
              <ProductGrid products={items} priorityCount={4} />
              <Pagination page={filters.page} pages={pages} hrefFor={hrefFor} />
            </>
          ) : (
            <EmptyState icon={<SearchX className="h-7 w-7" />} title="No products match these filters" action={<ButtonLink href={basePath} variant="outline">Clear filters</ButtonLink>}>
              Try removing a filter or searching for something else.
            </EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}

/** Static preview: every product in scope, filtered in the browser from the URL. */
async function DemoListingView({
  title,
  description,
  crumbs,
  basePath,
  scope,
  showBrandFilter,
  showConditionFilter,
}: {
  title: string;
  description?: string;
  crumbs: Crumb[];
  basePath: string;
  scope: ListingScope;
  showBrandFilter: boolean;
  showConditionFilter: boolean;
}) {
  const [{ items }, facets] = await Promise.all([listProducts(parseFilters({}), scope), listingFacets(scope)]);
  const meta = await demoListingMeta(items.map((i) => i.id));
  return (
    <div className="container-page py-6">
      <Breadcrumbs items={crumbs} />
      <DemoListing title={title} description={description} basePath={basePath} items={items} meta={meta} facets={facets} showBrandFilter={showBrandFilter} showConditionFilter={showConditionFilter} />
    </div>
  );
}
