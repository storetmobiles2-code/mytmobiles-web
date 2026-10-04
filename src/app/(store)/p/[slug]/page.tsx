import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, FileText, RotateCcw, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalog/queries";
import { getPublicSettings } from "@/lib/public-data";
import { formatINR } from "@/lib/money";
import { Badge, Breadcrumbs, Rating, SectionHeading } from "@/components/ui/misc";
import { PurchasePanel } from "@/components/product/purchase-panel";
import { PincodeChecker } from "@/components/product/pincode-checker";
import { ProductRail } from "@/components/product/product-card";
import { JsonLd } from "@/components/seo/json-ld";

export const revalidate = 120;

// Pages are rendered on first request and then cached (ISR) rather than built up front.
export async function generateStaticParams() {
  return [];
}

type SpecGroup = { group: string; items: { label: string; value: string }[] };

export async function generateMetadata(props: PageProps<"/p/[slug]">): Promise<Metadata> {
  const p = await getProductBySlug((await props.params).slug);
  if (!p) return { title: "Product not found" };
  const minPrice = Math.min(...p.variants.map((v) => v.price));
  const title = p.seoTitle ?? `${p.name} — Price ${formatINR(minPrice)}`;
  const description = p.seoDescription ?? `${p.shortDescription} Buy ${p.name} online at ${formatINR(minPrice)} with GST invoice and Cash on Delivery at myT Mobiles.`;
  return {
    title,
    description,
    alternates: { canonical: `/p/${p.slug}` },
    openGraph: { title, description, type: "website", images: p.images.slice(0, 1).map((i) => ({ url: i.url, width: i.width, height: i.height, alt: i.alt })) },
  };
}

export default async function ProductPage(props: PageProps<"/p/[slug]">) {
  const product = await getProductBySlug((await props.params).slug);
  if (!product) notFound();
  const [related, reviews, settings] = await Promise.all([
    getRelatedProducts(product.id, product.categoryId, product.brand.slug),
    db.review.findMany({ where: { productId: product.id, status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { name: true } } } }),
    getPublicSettings(),
  ]);
  const specs = (product.specs as unknown as SpecGroup[]) ?? [];
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const crumbs = [
    { name: "Home", href: "/" },
    ...(product.category.parent ? [{ name: product.category.parent.name, href: `/c/${product.category.parent.slug}` }] : []),
    { name: product.category.name, href: `/c/${product.category.slug}` },
    { name: product.name },
  ];
  const prices = product.variants.map((v) => v.price);
  const anyStock = product.variants.some((v) => v.stock > 0);

  return (
    <div className="container-page py-6">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.name,
            description: product.shortDescription,
            sku: product.variants[0]?.sku,
            brand: { "@type": "Brand", name: product.brand.name },
            image: product.images.slice(0, 5).map((i) => `${site}${i.url}`),
            itemCondition: product.condition === "DEMO" ? "https://schema.org/UsedCondition" : "https://schema.org/NewCondition",
            offers: {
              "@type": "AggregateOffer",
              priceCurrency: "INR",
              lowPrice: (Math.min(...prices) / 100).toFixed(2),
              highPrice: (Math.max(...prices) / 100).toFixed(2),
              offerCount: product.variants.length,
              availability: anyStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              url: `${site}/p/${product.slug}`,
            },
            ...(product.ratingCount > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.ratingAvg.toFixed(1), reviewCount: product.ratingCount } } : {}),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, ...(c.href ? { item: `${site}${c.href}` } : {}) })),
          },
        ]}
      />
      <Breadcrumbs items={crumbs} />
      <div className="mt-4">
        <PurchasePanel
            productId={product.id}
            name={product.name}
            variants={product.variants.map((v) => ({ id: v.id, sku: v.sku, color: v.color, storage: v.storage, ram: v.ram, price: v.price, mrp: v.mrp, stock: v.stock, maxPerOrder: v.maxPerOrder }))}
            images={product.images.map((i) => ({ url: i.url, alt: i.alt, color: i.color }))}
            header={
              <div>
                <Link href={`/brands/${product.brand.slug}`} className="text-sm font-semibold text-brand-700 hover:underline">{product.brand.name}</Link>
                <h1 className="mt-1 text-2xl leading-tight font-extrabold tracking-tight text-balance sm:text-3xl">{product.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Rating value={product.ratingAvg} count={product.ratingCount} size="md" />
                  {product.condition === "DEMO" && <Badge tone="info">Demo / open-box unit</Badge>}
                  {product.is5G && <Badge tone="brand">5G</Badge>}
                </div>
                {product.condition === "DEMO" && (
                  <p className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900">
                    Display unit from our store — may show light signs of handling. No returns on demo units; <Link href="/contact" className="font-semibold underline">ask us</Link> about its condition and remaining warranty.
                  </p>
                )}
              </div>
            }
            footer={
              <>
                {product.highlights.length > 0 && (
                  <ul className="space-y-1.5 text-sm text-ink-700">
                    {product.highlights.map((h) => (
                      <li key={h} className="flex gap-2"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />{h}</li>
                    ))}
                  </ul>
                )}
                <PincodeChecker />
                <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                  <li className="flex items-center gap-2 rounded-xl bg-ink-100/70 px-3 py-2.5"><ShieldCheck className="h-4 w-4 text-brand-600" aria-hidden="true" />{product.condition === "DEMO" ? "Brand warranty (remaining)" : "Brand warranty"}</li>
                  <li className="flex items-center gap-2 rounded-xl bg-ink-100/70 px-3 py-2.5"><RotateCcw className="h-4 w-4 text-brand-600" aria-hidden="true" />{product.returnWindowDays > 0 ? `${product.returnWindowDays}-day replacement*` : "No returns"}</li>
                  <li className="flex items-center gap-2 rounded-xl bg-ink-100/70 px-3 py-2.5"><FileText className="h-4 w-4 text-brand-600" aria-hidden="true" />GST invoice</li>
                </ul>
                {product.returnWindowDays > 0 && (
                  <p className="text-xs text-ink-500">*For damaged, defective or wrong items reported within {product.returnWindowDays} days of delivery. <Link className="underline" href="/help/returns">Policy</Link>{settings.codEnabled ? " · Cash on Delivery available on eligible pincodes" : ""}</p>
                )}
              </>
            }
          />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="card p-5 sm:p-6" aria-labelledby="specs">
          <h2 id="specs" className="text-lg font-bold">Specifications</h2>
          {specs.map((g) => (
            <div key={g.group} className="mt-4">
              <h3 className="mb-2 text-xs font-bold tracking-wide text-ink-500 uppercase">{g.group}</h3>
              <dl className="divide-y divide-ink-100 rounded-xl border border-ink-100">
                {g.items.map((it) => (
                  <div key={it.label} className="grid grid-cols-[40%_1fr] gap-3 px-3 py-2.5 text-sm">
                    <dt className="text-ink-500">{it.label}</dt>
                    <dd className="text-ink-900">{it.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
          <div className="mt-4 grid grid-cols-[40%_1fr] gap-3 rounded-xl border border-ink-100 px-3 py-2.5 text-sm">
            <span className="text-ink-500">Warranty</span>
            <span>{product.warranty}</span>
          </div>
        </section>
        <section className="card p-5 sm:p-6" aria-labelledby="about">
          <h2 id="about" className="text-lg font-bold">About this product</h2>
          <p className="mt-3 text-sm leading-7 whitespace-pre-line text-ink-700">{product.description}</p>
          {product.boxContents.length > 0 && (
            <>
              <h3 className="mt-5 text-sm font-bold">In the box</h3>
              <ul className="mt-2 list-disc pl-5 text-sm text-ink-700">{product.boxContents.map((b) => <li key={b}>{b}</li>)}</ul>
            </>
          )}
          <p className="mt-5 text-xs text-ink-500">Images are official manufacturer product images; colours on screen may vary slightly. HSN {product.hsnCode} · GST {product.gstRateBps / 100}% included.</p>
        </section>
      </div>

      <section className="card mt-6 p-5 sm:p-6" aria-labelledby="reviews">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="reviews" className="text-lg font-bold">Ratings & reviews</h2>
          <Link href={`/p/${product.slug}/review`} className="text-sm font-semibold text-brand-700 hover:underline">Write a review</Link>
        </div>
        {reviews.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">No reviews yet. Bought this from us? Share your experience — only verified buyers can review.</p>
        ) : (
          <ul className="mt-4 divide-y divide-ink-100">
            {reviews.map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex items-center gap-2">
                  <Rating value={r.rating} count={1} />
                  <span className="font-semibold">{r.title}</span>
                </div>
                <p className="mt-1.5 text-sm text-ink-700">{r.body}</p>
                <p className="mt-1.5 text-xs text-ink-500">
                  {r.user.name.split(" ")[0]} · {r.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  {r.isVerifiedPurchase && <span className="ml-2 font-semibold text-mint-700">✓ Verified purchase</span>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {related.length > 0 && (
        <section className="mt-10">
          <SectionHeading title="You may also like" href={`/c/${product.category.slug}`} />
          <ProductRail products={related} />
        </section>
      )}
    </div>
  );
}
