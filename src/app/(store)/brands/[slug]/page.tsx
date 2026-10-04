import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parseFilters } from "@/lib/catalog/filters";
import { ListingView } from "@/components/listing/listing-view";

const getBrand = (slug: string) => db.brand.findFirst({ where: { slug, isActive: true } });

export async function generateMetadata(props: PageProps<"/brands/[slug]">): Promise<Metadata> {
  const brand = await getBrand((await props.params).slug);
  if (!brand) return {};
  return {
    title: `${brand.name} — Mobiles & More`,
    description: `Buy ${brand.name} products online at myT Mobiles. GST invoice, Cash on Delivery and secure payments.`,
    alternates: { canonical: `/brands/${brand.slug}` },
  };
}

export default async function BrandPage(props: PageProps<"/brands/[slug]">) {
  const brand = await getBrand((await props.params).slug);
  if (!brand) notFound();
  return (
    <ListingView
      title={brand.name}
      crumbs={[{ name: "Home", href: "/" }, { name: "Brands" }, { name: brand.name }]}
      basePath={`/brands/${brand.slug}`}
      filters={parseFilters(await props.searchParams)}
      scope={{ brandId: brand.id }}
      showBrandFilter={false}
    />
  );
}
