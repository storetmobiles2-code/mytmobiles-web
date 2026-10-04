import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseFilters } from "@/lib/catalog/filters";
import { getCategoryBySlug } from "@/lib/catalog/queries";
import { ListingView } from "@/components/listing/listing-view";

export async function generateMetadata(props: PageProps<"/c/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const c = await getCategoryBySlug(slug);
  if (!c) return {};
  const sp = await props.searchParams;
  const filtered = Object.keys(sp).some((k) => k !== "page");
  return {
    title: `${c.name} — Buy Online at Best Prices`,
    description: c.description ?? `Shop ${c.name} at myT Mobiles with GST invoice and Cash on Delivery.`,
    alternates: { canonical: `/c/${c.slug}` },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function CategoryPage(props: PageProps<"/c/[slug]">) {
  const { slug } = await props.params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();
  const filters = parseFilters(await props.searchParams);
  return (
    <ListingView
      title={category.name}
      description={category.description ?? undefined}
      crumbs={[{ name: "Home", href: "/" }, ...(category.parent ? [{ name: category.parent.name, href: `/c/${category.parent.slug}` }] : []), { name: category.name }]}
      basePath={`/c/${category.slug}`}
      filters={filters}
      scope={{ categoryIds: [category.id, ...category.children.map((c) => c.id)] }}
    />
  );
}
