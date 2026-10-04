import type { Metadata } from "next";
import { parseFilters } from "@/lib/catalog/filters";
import { ListingView } from "@/components/listing/listing-view";
import { trackServer } from "@/lib/analytics";

export async function generateMetadata(props: PageProps<"/search">): Promise<Metadata> {
  const { q } = parseFilters(await props.searchParams);
  return { title: q ? `Search results for “${q}”` : "All products", robots: { index: false, follow: true } };
}

export default async function SearchPage(props: PageProps<"/search">) {
  const filters = parseFilters(await props.searchParams);
  if (filters.q && filters.page === 1) void trackServer({ name: "search", path: "/search", props: { q: filters.q } });
  return (
    <ListingView
      title={filters.q ? `Results for “${filters.q}”` : "All products"}
      crumbs={[{ name: "Home", href: "/" }, { name: filters.q ? "Search" : "All products" }]}
      basePath="/search"
      filters={filters}
      scope={{}}
    />
  );
}
