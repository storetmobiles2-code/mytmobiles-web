import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { ListingFilters } from "./filters";
import { DEMO } from "@/lib/demo";

// The static preview renders every product in scope and filters in the browser.
export const PAGE_SIZE = DEMO ? 1000 : 24;

/** Fields needed to render a product card. */
export const cardSelect = {
  id: true,
  slug: true,
  name: true,
  priceFrom: true,
  mrpFrom: true,
  discountPct: true,
  inStock: true,
  ratingAvg: true,
  ratingCount: true,
  is5G: true,
  condition: true,
  launchedAt: true,
  brand: { select: { name: true, slug: true } },
  images: { select: { url: true, alt: true, width: true, height: true }, orderBy: { sortOrder: "asc" }, take: 1 },
  variants: {
    where: { isActive: true },
    select: { id: true, color: true, colorHex: true, storage: true, ram: true, stock: true, price: true },
    orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
  },
} satisfies Prisma.ProductSelect;

export type ProductCardData = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

function searchWhere(q: string): Prisma.ProductWhereInput {
  const tokens = q
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}+.-]/gu, ""))
    .filter((t) => t.length > 0)
    .slice(0, 8);
  return {
    AND: tokens.map((t) => ({
      OR: [
        { name: { contains: t, mode: "insensitive" } },
        { brand: { name: { contains: t, mode: "insensitive" } } },
        { category: { name: { contains: t, mode: "insensitive" } } },
        { keywords: { has: t } },
        { variants: { some: { OR: [{ color: { contains: t, mode: "insensitive" } }, { sku: { equals: t, mode: "insensitive" } }] } } },
      ],
    })),
  };
}

export interface ListingScope {
  categoryIds?: string[];
  brandId?: string;
  condition?: "NEW" | "DEMO";
}

export function buildWhere(f: ListingFilters, scope: ListingScope = {}): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ isActive: true }];
  if (scope.categoryIds) and.push({ categoryId: { in: scope.categoryIds } });
  if (scope.brandId) and.push({ brandId: scope.brandId });
  if (scope.condition) and.push({ condition: scope.condition });
  if (f.condition) and.push({ condition: f.condition === "demo" ? "DEMO" : "NEW" });
  if (f.q) and.push(searchWhere(f.q));
  if (f.brands.length) and.push({ brand: { slug: { in: f.brands } } });
  if (f.only5G) and.push({ is5G: true });
  if (f.inStock) and.push({ inStock: true });
  if (f.minDiscount) and.push({ discountPct: { gte: f.minDiscount } });
  if (f.minRating) and.push({ ratingAvg: { gte: f.minRating } });

  const variant: Prisma.ProductVariantWhereInput = { isActive: true };
  let variantFilter = false;
  if (f.minPrice !== undefined || f.maxPrice !== undefined) {
    variant.price = {
      ...(f.minPrice !== undefined ? { gte: Math.round(f.minPrice * 100) } : {}),
      ...(f.maxPrice !== undefined ? { lte: Math.round(f.maxPrice * 100) } : {}),
    };
    variantFilter = true;
  }
  if (f.ram.length) {
    variant.ramGb = { in: f.ram };
    variantFilter = true;
  }
  if (f.storage.length) {
    variant.storageGb = { in: f.storage };
    variantFilter = true;
  }
  if (variantFilter) and.push({ variants: { some: variant } });
  return { AND: and };
}

function orderBy(f: ListingFilters): Prisma.ProductOrderByWithRelationInput[] {
  switch (f.sort) {
    case "price-asc":
      return [{ priceFrom: "asc" }, { id: "asc" }];
    case "price-desc":
      return [{ priceFrom: "desc" }, { id: "asc" }];
    case "newest":
      return [{ launchedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }];
    case "discount":
      return [{ discountPct: "desc" }, { priceFrom: "asc" }];
    case "popular":
      return [{ ratingCount: "desc" }, { ratingAvg: "desc" }, { isFeatured: "desc" }];
    default:
      // Relevance: featured & in-stock first, then newest.
      return [{ inStock: "desc" }, { isFeatured: "desc" }, { images: { _count: "desc" } }, { condition: "asc" }, { discountPct: "desc" }, { id: "asc" }];
  }
}

export async function listProducts(f: ListingFilters, scope: ListingScope = {}) {
  const where = buildWhere(f, scope);
  const [total, items] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      select: cardSelect,
      orderBy: orderBy(f),
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  return { total, items, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export interface Facets {
  brands: { slug: string; name: string; count: number }[];
  hasDemo: boolean;
  ram: number[];
  storage: number[];
  priceMin: number;
  priceMax: number;
}

/** Facet options for the current scope (category/brand + search), independent of other filters. */
export async function listingFacets(scope: ListingScope & { q?: string }): Promise<Facets> {
  const where: Prisma.ProductWhereInput = {
    AND: [
      { isActive: true },
      ...(scope.categoryIds ? [{ categoryId: { in: scope.categoryIds } }] : []),
      ...(scope.brandId ? [{ brandId: scope.brandId }] : []),
      ...(scope.condition ? [{ condition: scope.condition }] : []),
      ...(scope.q ? [searchWhere(scope.q)] : []),
    ],
  };
  const [brandGroups, variants, demoCount] = await Promise.all([
    db.product.groupBy({ by: ["brandId"], where, _count: { _all: true } }),
    db.productVariant.findMany({
      where: { isActive: true, product: where },
      select: { ramGb: true, storageGb: true, price: true },
    }),
    db.product.count({ where: { AND: [where, { condition: "DEMO" }] } }),
  ]);
  const brands = await db.brand.findMany({
    where: { id: { in: brandGroups.map((g) => g.brandId) } },
    select: { id: true, slug: true, name: true },
    orderBy: { name: "asc" },
  });
  const counts = new Map(brandGroups.map((g) => [g.brandId, g._count._all]));
  const uniq = (xs: (number | null)[]) => [...new Set(xs.filter((x): x is number => x !== null))].sort((a, b) => a - b);
  const prices = variants.map((v) => v.price);
  return {
    brands: brands.map((b) => ({ slug: b.slug, name: b.name, count: counts.get(b.id) ?? 0 })),
    hasDemo: demoCount > 0,
    ram: uniq(variants.map((v) => v.ramGb)),
    storage: uniq(variants.map((v) => v.storageGb)),
    priceMin: prices.length ? Math.floor(Math.min(...prices) / 100) : 0,
    priceMax: prices.length ? Math.ceil(Math.max(...prices) / 100) : 0,
  };
}

export const getCategoryBySlug = cache(async (slug: string) =>
  db.category.findFirst({
    where: { slug, isActive: true },
    include: { children: { where: { isActive: true }, orderBy: { sortOrder: "asc" } }, parent: true },
  }),
);

export const getNavCategories = cache(async () =>
  db.category.findMany({
    where: { isActive: true, parentId: null },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true, imageUrl: true, children: { where: { isActive: true }, select: { name: true, slug: true }, orderBy: { sortOrder: "asc" } } },
  }),
);

export const getBrands = cache(async () =>
  db.brand.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
);

export const getProductBySlug = cache(async (slug: string) =>
  db.product.findFirst({
    where: { slug, isActive: true },
    include: {
      brand: true,
      category: { include: { parent: true } },
      images: { orderBy: { sortOrder: "asc" } },
      variants: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { price: "asc" }] },
    },
  }),
);

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;

/** Same-category products, preferring the same brand first. */
export async function getRelatedProducts(productId: string, categoryId: string, brandSlug: string, take = 8) {
  const items = await db.product.findMany({
    where: { isActive: true, id: { not: productId }, categoryId },
    select: cardSelect,
    orderBy: [{ inStock: "desc" }, { isFeatured: "desc" }, { launchedAt: { sort: "desc", nulls: "last" } }],
    take: take * 2,
  });
  return items
    .sort((a, b) => Number(b.brand.slug === brandSlug) - Number(a.brand.slug === brandSlug))
    .slice(0, take);
}

export async function getProductsByIds(ids: string[]) {
  if (!ids.length) return [];
  const items = await db.product.findMany({ where: { id: { in: ids }, isActive: true }, select: cardSelect });
  const order = new Map(ids.map((id, i) => [id, i]));
  return items.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** Keeps listing aggregates in sync. Call after any change to variants or stock. */
export async function refreshProductAggregates(productIds: string[], tx: Prisma.TransactionClient | typeof db = db) {
  for (const productId of new Set(productIds)) {
    const variants = await tx.productVariant.findMany({
      where: { productId, isActive: true },
      select: { price: true, mrp: true, stock: true },
    });
    // "From" price reflects what can be bought now; fall back to all variants when sold out.
    const buyable = variants.filter((v) => v.stock > 0);
    const cheapest = [...(buyable.length ? buyable : variants)].sort((a, b) => a.price - b.price)[0];
    const discountPct = variants.reduce(
      (max, v) => Math.max(max, v.mrp > v.price ? Math.floor(((v.mrp - v.price) / v.mrp) * 100) : 0),
      0,
    );
    await tx.product.update({
      where: { id: productId },
      data: {
        priceFrom: cheapest?.price ?? 0,
        mrpFrom: cheapest ? Math.max(cheapest.mrp, cheapest.price) : 0,
        discountPct,
        inStock: variants.some((v) => v.stock > 0),
      },
    });
  }
}

/** Per-product data the static preview needs to filter listings in the browser. */
export async function demoListingMeta(ids: string[]) {
  const rows = await db.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, keywords: true, variants: { where: { isActive: true }, select: { price: true, ramGb: true, storageGb: true } } },
  });
  return Object.fromEntries(rows.map((r) => [r.id, { keywords: r.keywords, variants: r.variants }]));
}
