import Link from "next/link";
import { BadgeCheck, CreditCard, FileText, Truck } from "lucide-react";
import { db } from "@/lib/db";
import { cardSelect } from "@/lib/catalog/queries";
import { getNavData, getPublicSettings } from "@/lib/public-data";
import { razorpayConfigured } from "@/lib/env";
import { formatINR } from "@/lib/money";
import { HeroCarousel } from "@/components/layout/hero-carousel";
import { ProductRail } from "@/components/product/product-card";
import { SectionHeading } from "@/components/ui/misc";
import { JsonLd } from "@/components/seo/json-ld";
import { CategoryIcon } from "@/components/brand/category-icon";

export const revalidate = 300;

async function getHomeData() {
  const now = new Date();
  const live = { isActive: true, inStock: true } as const;
  const [banners, deals, openBox, categories, brandCounts] = await Promise.all([
    db.banner.findMany({
      where: { isActive: true, placement: "HERO", AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] },
      orderBy: { sortOrder: "asc" },
      take: 6,
    }),
    db.product.findMany({ where: { ...live, condition: "NEW", discountPct: { gt: 0 } }, select: cardSelect, orderBy: [{ discountPct: "desc" }, { priceFrom: "asc" }], take: 12 }),
    db.product.findMany({ where: { ...live, condition: "DEMO" }, select: cardSelect, orderBy: { priceFrom: "asc" }, take: 12 }),
    db.category.findMany({
      where: { isActive: true, parentId: null, products: { some: { isActive: true } } },
      orderBy: { sortOrder: "asc" },
      select: { name: true, slug: true, _count: { select: { products: { where: { isActive: true } } } } },
    }),
    db.product.groupBy({ by: ["brandId"], where: { ...live, condition: "NEW", category: { slug: "smartphones" } }, _count: { _all: true }, orderBy: { _count: { brandId: "desc" } }, take: 2 }),
  ]);
  const topBrands = await db.brand.findMany({ where: { id: { in: brandCounts.map((b) => b.brandId) } }, select: { id: true, name: true, slug: true } });
  const brandRails = await Promise.all(
    brandCounts.map(async (bc) => {
      const brand = topBrands.find((b) => b.id === bc.brandId)!;
      const products = await db.product.findMany({ where: { ...live, brandId: brand.id, condition: "NEW", category: { slug: "smartphones" } }, select: cardSelect, orderBy: [{ isFeatured: "desc" }, { priceFrom: "desc" }], take: 12 });
      return { brand, products };
    }),
  );
  const appliances = await db.product.findMany({ where: { ...live, category: { slug: { in: ["smart-tvs", "air-coolers"] } } }, select: cardSelect, orderBy: [{ priceFrom: "asc" }], take: 12 });
  return { banners, deals, openBox, categories, brandRails, appliances };
}

export default async function HomePage() {
  const [{ banners, deals, openBox, categories, brandRails, appliances }, nav, settings] = await Promise.all([getHomeData(), getNavData(), getPublicSettings()]);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const trust = [
    { icon: Truck, title: settings.freeShippingThreshold > 0 ? `Free delivery over ${formatINR(settings.freeShippingThreshold)}` : "Free delivery", text: "Check delivery dates by pincode" },
    settings.codEnabled ? { icon: BadgeCheck, title: "Cash on Delivery", text: "Pay when your order arrives" } : null,
    razorpayConfigured() ? { icon: CreditCard, title: "Secure online payments", text: "UPI, cards, net banking via Razorpay" } : null,
    { icon: FileText, title: "GST tax invoice", text: "Claim input credit with your GSTIN" },
  ].filter((x): x is NonNullable<typeof x> => Boolean(x));

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "myT Mobiles",
          url: site,
          potentialAction: { "@type": "SearchAction", target: `${site}/search?q={search_term_string}`, "query-input": "required name=search_term_string" },
        }}
      />
      <h1 className="sr-only">myT Mobiles — mobiles, smart TVs and air coolers</h1>
      <div className="container-page space-y-12 pt-4 sm:pt-6">
        <HeroCarousel slides={banners} />

        <section aria-labelledby="cats">
          <h2 id="cats" className="sr-only">Shop by category</h2>
          <ul className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0 lg:grid-cols-8">
            {categories.map((c) => (
              <li key={c.slug} className="w-28 shrink-0 sm:w-auto">
                <Link href={`/c/${c.slug}`} className="card group flex flex-col items-center gap-2 px-3 py-4 text-center hover:ring-2 hover:ring-brand-200">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 transition-transform group-hover:scale-105">
                    <CategoryIcon slug={c.slug} />
                  </span>
                  <span className="text-sm font-semibold text-ink-900">{c.name}</span>
                  <span className="-mt-1.5 text-xs text-ink-500">{c._count.products} products</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {deals.length > 0 && (
          <section>
            <SectionHeading title="Top deals" subtitle="Biggest savings on MRP right now" href="/search?sort=discount" />
            <ProductRail products={deals} priorityCount={2} />
          </section>
        )}

        <section aria-label="Why shop with us" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {trust.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card flex items-center gap-3 p-4">
              <span className="rounded-xl bg-brand-50 p-2.5 text-brand-700"><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <span>
                <span className="block text-sm font-bold text-ink-900">{title}</span>
                <span className="block text-xs text-ink-500">{text}</span>
              </span>
            </div>
          ))}
        </section>

        {brandRails.map(({ brand, products }) =>
          products.length ? (
            <section key={brand.id}>
              <SectionHeading title={`${brand.name} smartphones`} href={`/brands/${brand.slug}`} />
              <ProductRail products={products} />
            </section>
          ) : null,
        )}

        {openBox.length > 0 && (
          <section className="rounded-3xl bg-gradient-to-br from-brand-950 via-brand-950 to-brand-900 p-5 sm:p-8">
            <div className="mb-4 flex items-end justify-between gap-4 text-white">
              <div>
                <p className="text-xs font-bold tracking-[0.18em] text-brand-400 uppercase">Limited pieces</p>
                <h2 className="text-xl font-extrabold sm:text-2xl">Open-box demo units</h2>
                <p className="mt-1 text-sm text-white/70">Display units from our store at lower prices. One piece each.</p>
              </div>
              <Link href="/open-box" className="shrink-0 text-sm font-semibold text-white hover:underline">View all →</Link>
            </div>
            <ProductRail products={openBox} />
          </section>
        )}

        {appliances.length > 0 && (
          <section>
            <SectionHeading title="TVs & air coolers" subtitle="Home appliances in stock" href="/c/smart-tvs" linkLabel="All TVs" />
            <ProductRail products={appliances} />
          </section>
        )}

        <section aria-labelledby="brands">
          <SectionHeading title="Shop by brand" />
          <h2 id="brands" className="sr-only">Brands</h2>
          <ul className="flex flex-wrap gap-2">
            {nav.brands.map((b) => (
              <li key={b.slug}>
                <Link href={`/brands/${b.slug}`} className="inline-flex rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 hover:border-brand-400 hover:text-brand-700">
                  {b.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
